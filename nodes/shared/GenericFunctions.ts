import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INode,
	INodePropertyOptions,
	ISupplyDataFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const ADACODE_CREDENTIALS = 'adaCodeApi';
export const DEFAULT_BASE_URL = 'https://api.adacode.ai';

export type AdaCodeContext = IExecuteFunctions | ILoadOptionsFunctions | ISupplyDataFunctions;

/**
 * User boleh menulis base URL apa adanya ("https://api.adacode.ai/", ".../v1").
 * Semua endpoint di node ini sudah membawa awalan /v1 sendiri, jadi akhiran itu
 * dibuang di sini — kalau tidak, URL jadi /v1/v1/chat/completions dan gateway
 * menjawab 404 yang membingungkan.
 */
export function normalizeBaseUrl(raw?: unknown): string {
	const value = typeof raw === 'string' ? raw.trim() : '';
	if (value === '') return DEFAULT_BASE_URL;
	return value.replace(/\/+$/, '').replace(/\/v1$/, '');
}

export async function getBaseUrl(context: AdaCodeContext): Promise<string> {
	const credentials = await context.getCredentials(ADACODE_CREDENTIALS);
	return normalizeBaseUrl(credentials?.baseUrl);
}

/**
 * Gateway adaCODE menjawab error bergaya OpenAI: { error: { message, type, code } }.
 * Pesannya sudah ditulis untuk dibaca manusia (mis. dompet Token Recharge kosong,
 * jendela kuota habis), tapi n8n hanya menampilkan "The service was not able to
 * process your request" bila pesan itu tidak diangkat. Fungsi ini mengangkatnya.
 */
export function toNodeApiError(node: INode, error: unknown): NodeApiError {
	const err = error as IDataObject & {
		response?: { body?: IDataObject };
		error?: IDataObject;
		httpCode?: string;
		statusCode?: number;
	};

	const body = (err?.response?.body ?? err?.error ?? err) as IDataObject;
	const inner = (body?.error ?? body) as IDataObject;
	const message = typeof inner?.message === 'string' ? inner.message : undefined;
	const code = typeof inner?.code === 'string' ? inner.code : undefined;
	const status = Number(err?.httpCode ?? err?.statusCode ?? 0);

	let description: string | undefined;
	if (code === 'premium_wallet_empty' || status === 402) {
		description =
			'Model ini di luar katalog Coding Plan sehingga ditagih tarif pasar dari Token Recharge. Isi saldo di https://adacode.ai/subscribe atau pilih model berlabel "coding plan" di dropdown Model.';
	} else if (status === 401 || status === 403) {
		description =
			'API key ditolak. Pastikan key masih aktif di https://adacode.ai/api-keys dan tersalin utuh (diawali sk-adacode-).';
	} else if (status === 429) {
		description =
			'Kuota atau rate limit terpakai habis. Tunggu jendela kuota berikutnya, pakai model grup lain, atau upgrade plan di https://adacode.ai/subscribe.';
	} else if (status === 404) {
		description =
			'Endpoint tidak ditemukan. Periksa Base URL di kredensial — tulis tanpa akhiran /v1.';
	}

	return new NodeApiError(node, error as JsonObject, {
		message: message ?? 'Permintaan ke adaCODE gagal',
		description,
		httpCode: status ? String(status) : undefined,
	});
}

export async function adaCodeApiRequest(
	this: AdaCodeContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	options: { timeout?: number } = {},
): Promise<any> {
	const baseUrl = await getBaseUrl(this);

	const requestOptions: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${endpoint}`,
		headers: {
			'Content-Type': 'application/json',
			'User-Agent': 'n8n-nodes-adacode',
		},
		json: true,
	};

	if (Object.keys(body).length > 0) requestOptions.body = body;
	if (Object.keys(qs).length > 0) requestOptions.qs = qs;
	if (options.timeout) requestOptions.timeout = options.timeout;

	try {
		return await this.helpers.httpRequestWithAuthentication.call(
			this,
			ADACODE_CREDENTIALS,
			requestOptions,
		);
	} catch (error) {
		throw toNodeApiError(this.getNode(), error);
	}
}

type AdaCodeModel = {
	id?: string;
	owned_by?: string;
	provider?: string;
	/** Label siap-tampil dari server, sudah membawa penanda "(coding plan)". */
	display_name?: string;
	/** Ditandai server per-key: model termasuk katalog Coding Plan. */
	_codingPlan?: boolean;
	/** Ditandai server per-key: model di luar katalog (tarif pasar). */
	_premium?: boolean;
};

/** Model media tidak bisa dipakai lewat /v1/chat/completions. */
const MEDIA_MODEL_PATTERN = /(image|imagen|video|veo|dall-?e|flux|sora|tts|whisper|embedding)/i;

/**
 * Dropdown model diisi LIVE dari GET /v1/models, jadi katalog tiap key tampil apa
 * adanya (key Coding Plan melihat katalog kurasi, key PAYG melihat daftar penuh).
 *
 * Label diambil dari `display_name` milik server — di sanalah penanda
 * "(coding plan)" hidup, dan server adalah satu-satunya yang tahu status tiap
 * model untuk key ini. Node hanya menambahkan konteks penagihan di deskripsi,
 * supaya user tahu model mana yang menagih dompet Token Recharge SEBELUM
 * workflow-nya ditolak 402 saat dijalankan.
 */
export async function loadAdaCodeModels(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const response = await adaCodeApiRequest.call(this, 'GET', '/v1/models');
	const models = (response?.data ?? []) as AdaCodeModel[];

	const usable = models.filter((model) => {
		const id = model?.id ?? '';
		return id !== '' && !MEDIA_MODEL_PATTERN.test(id);
	});

	// Key PAYG tidak mendapat penandaan apa pun dari server (semua model dibayar
	// per-token), jadi keterangan penagihan hanya ditampilkan bila server memang
	// membedakan katalog untuk key ini.
	const adaPembedaan = usable.some((m) => m._codingPlan === true || m._premium === true);

	const entries = usable.map((model) => {
		const id = model.id as string;
		const label = (model.display_name ?? '').trim() || id;
		const owner = model.owned_by ?? model.provider ?? '';
		const codingPlan = model._codingPlan === true || /\(coding plan\)/i.test(label);

		const keterangan = [id, owner].filter((part) => part !== '').join(' · ');
		const penagihan = !adaPembedaan
			? ''
			: codingPlan
				? ' · termasuk kuota Coding Plan'
				: ' · tarif pasar, dibayar Token Recharge';

		return {
			name: label,
			value: id,
			description: `${keterangan}${penagihan}`,
			codingPlan,
		};
	});

	// Model yang sudah termasuk plan didahulukan — itu yang bisa langsung dipakai
	// tanpa saldo Token Recharge.
	entries.sort((a, b) => {
		if (a.codingPlan !== b.codingPlan) return a.codingPlan ? -1 : 1;
		return a.name.localeCompare(b.name);
	});

	// Sebagian model punya alias ber-display_name sama (mis. adacode-2.0 dan
	// alias claude-adacode-2.0 untuk penemuan model di Claude Code). Tanpa
	// pembeda, dropdown menampilkan dua baris yang tampak identik dan user tidak
	// tahu mana yang dipilihnya.
	const jumlahNama = new Map<string, number>();
	for (const entry of entries) {
		jumlahNama.set(entry.name, (jumlahNama.get(entry.name) ?? 0) + 1);
	}

	return entries.map(({ name, value, description }) => ({
		name: (jumlahNama.get(name) ?? 0) > 1 ? `${name} — ${value}` : name,
		value,
		description,
	}));
}
