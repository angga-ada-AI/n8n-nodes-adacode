import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { adaCodeApiRequest, loadAdaCodeModels } from '../shared/GenericFunctions';

type ChatMessage = { role: string; content: string };

export class AdaCode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'adaCODE',
		name: 'adaCode',
		icon: 'file:adacode-icon.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Pakai model AI adaCODE (Claude, GPT, GLM, Qwen, MiniMax, adaCODE) dengan satu API key',
		defaults: {
			name: 'adaCODE',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'adaCodeApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Chat', value: 'chat' },
					{ name: 'Model', value: 'model' },
				],
				default: 'chat',
			},

			// ─── Chat ────────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['chat'] } },
				options: [
					{
						name: 'Message a Model',
						value: 'complete',
						description: 'Kirim pesan ke sebuah model dan ambil balasannya',
						action: 'Message a model',
					},
				],
				default: 'complete',
			},
			{
				displayName: 'Model Name or ID',
				name: 'model',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getModels' },
				displayOptions: { show: { resource: ['chat'] } },
				default: 'adacode-2.0',
				required: true,
				description:
					'Model diambil langsung dari katalog API key Anda. Model berlabel "(coding plan)" dibayar kuota plan; sisanya tarif pasar dari Token Recharge. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Input',
				name: 'inputMode',
				type: 'options',
				displayOptions: { show: { resource: ['chat'] } },
				options: [
					{
						name: 'Prompt',
						value: 'simple',
						description: 'Satu prompt (opsional dengan system message)',
					},
					{
						name: 'Messages',
						value: 'messages',
						description: 'Susun sendiri daftar pesan (system/user/assistant)',
					},
				],
				default: 'simple',
			},
			{
				displayName: 'System Message',
				name: 'systemMessage',
				type: 'string',
				typeOptions: { rows: 2 },
				displayOptions: { show: { resource: ['chat'], inputMode: ['simple'] } },
				default: '',
				description: 'Instruksi peran untuk model. Kosongkan bila tidak perlu.',
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: { rows: 4 },
				displayOptions: { show: { resource: ['chat'], inputMode: ['simple'] } },
				default: '',
				required: true,
				description: 'Pesan yang dikirim ke model',
			},
			{
				displayName: 'Messages',
				name: 'messages',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true, sortable: true },
				displayOptions: { show: { resource: ['chat'], inputMode: ['messages'] } },
				default: { message: [{ role: 'user', content: '' }] },
				placeholder: 'Add Message',
				options: [
					{
						name: 'message',
						displayName: 'Message',
						values: [
							{
								displayName: 'Role',
								name: 'role',
								type: 'options',
								options: [
									{ name: 'System', value: 'system' },
									{ name: 'User', value: 'user' },
									{ name: 'Assistant', value: 'assistant' },
								],
								default: 'user',
							},
							{
								displayName: 'Content',
								name: 'content',
								type: 'string',
								typeOptions: { rows: 3 },
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				displayOptions: { show: { resource: ['chat'] } },
				default: true,
				description:
					'Whether to return only balasan model (content, model, usage) alih-alih seluruh respons API',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				displayOptions: { show: { resource: ['chat'] } },
				default: {},
				options: [
					{
						displayName: 'Custom Body Fields (JSON)',
						name: 'extraBody',
						type: 'json',
						default: '{}',
						description:
							'Field tambahan yang digabung ke body permintaan (mis. {"tools": []}). Menimpa opsi lain bila namanya sama.',
					},
					{
						displayName: 'Frequency Penalty',
						name: 'frequency_penalty',
						type: 'number',
						typeOptions: { minValue: -2, maxValue: 2, numberPrecision: 2 },
						default: 0,
						description: 'Menekan pengulangan kata yang sering muncul',
					},
					{
						displayName: 'Max Tokens',
						name: 'max_tokens',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 1024,
						description: 'Batas panjang balasan',
					},
					{
						displayName: 'Output Content as JSON',
						name: 'jsonOutput',
						type: 'boolean',
						default: false,
						description:
							'Whether meminta model membalas dalam JSON (response_format json_object) dan mem-parse hasilnya',
					},
					{
						displayName: 'Presence Penalty',
						name: 'presence_penalty',
						type: 'number',
						typeOptions: { minValue: -2, maxValue: 2, numberPrecision: 2 },
						default: 0,
						description: 'Mendorong model membahas topik baru',
					},
					{
						displayName: 'Seed',
						name: 'seed',
						type: 'number',
						default: 0,
						description: 'Nilai untuk hasil yang lebih reproducible (bila model mendukung)',
					},
					{
						displayName: 'Stop Sequences',
						name: 'stop',
						type: 'string',
						default: '',
						description: 'Dipisah koma. Model berhenti saat menemui salah satunya.',
					},
					{
						displayName: 'Temperature',
						name: 'temperature',
						type: 'number',
						typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 2 },
						default: 0.7,
						description: 'Makin tinggi makin acak/kreatif',
					},
					{
						displayName: 'Timeout (Ms)',
						name: 'timeout',
						type: 'number',
						typeOptions: { minValue: 1000 },
						default: 300000,
						description: 'Batas waktu menunggu balasan model',
					},
					{
						displayName: 'Top P',
						name: 'top_p',
						type: 'number',
						typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
						default: 1,
						description: 'Nucleus sampling — alternatif dari Temperature',
					},
				],
			},

			// ─── Model ───────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['model'] } },
				options: [
					{
						name: 'Get Many',
						value: 'list',
						description: 'Ambil daftar model yang tersedia untuk API key ini',
						action: 'Get many models',
					},
				],
				default: 'list',
			},
		],
	};

	methods = {
		loadOptions: {
			getModels: loadAdaCodeModels,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'model' && operation === 'list') {
					const response = await adaCodeApiRequest.call(this, 'GET', '/v1/models');
					for (const model of (response?.data ?? []) as IDataObject[]) {
						returnData.push({ json: model, pairedItem: { item: i } });
					}
					// Daftar model tidak bergantung pada item input — sekali jalan cukup.
					break;
				}

				if (resource !== 'chat' || operation !== 'complete') {
					throw new NodeOperationError(
						this.getNode(),
						`Operasi "${resource}: ${operation}" belum didukung`,
						{ itemIndex: i },
					);
				}

				const model = this.getNodeParameter('model', i) as string;
				const inputMode = this.getNodeParameter('inputMode', i) as string;
				const simplify = this.getNodeParameter('simplify', i) as boolean;
				const options = this.getNodeParameter('options', i, {}) as IDataObject;

				const messages: ChatMessage[] = [];
				if (inputMode === 'simple') {
					const systemMessage = this.getNodeParameter('systemMessage', i, '') as string;
					const prompt = this.getNodeParameter('prompt', i) as string;
					if (systemMessage.trim() !== '') {
						messages.push({ role: 'system', content: systemMessage });
					}
					messages.push({ role: 'user', content: prompt });
				} else {
					const collection = this.getNodeParameter('messages.message', i, []) as ChatMessage[];
					for (const message of collection) {
						messages.push({ role: message.role, content: message.content });
					}
				}

				if (messages.length === 0 || messages.every((m) => (m.content ?? '').trim() === '')) {
					throw new NodeOperationError(this.getNode(), 'Pesan untuk model masih kosong', {
						itemIndex: i,
					});
				}

				const body: IDataObject = { model, messages };

				for (const key of [
					'temperature',
					'max_tokens',
					'top_p',
					'frequency_penalty',
					'presence_penalty',
					'seed',
				]) {
					if (options[key] !== undefined) body[key] = options[key];
				}

				if (typeof options.stop === 'string' && options.stop.trim() !== '') {
					body.stop = options.stop
						.split(',')
						.map((value) => value.trim())
						.filter((value) => value !== '');
				}

				if (options.jsonOutput === true) {
					body.response_format = { type: 'json_object' };
				}

				if (options.extraBody !== undefined && options.extraBody !== '' && options.extraBody !== '{}') {
					let extra: IDataObject;
					try {
						extra =
							typeof options.extraBody === 'string'
								? (JSON.parse(options.extraBody) as IDataObject)
								: (options.extraBody as IDataObject);
					} catch {
						throw new NodeOperationError(
							this.getNode(),
							'Custom Body Fields bukan JSON yang valid',
							{ itemIndex: i },
						);
					}
					Object.assign(body, extra);
				}

				const response = await adaCodeApiRequest.call(
					this,
					'POST',
					'/v1/chat/completions',
					body,
					{},
					{ timeout: (options.timeout as number) ?? 300000 },
				);

				if (!simplify) {
					returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
					continue;
				}

				const choice = (response?.choices ?? [])[0] ?? {};
				const rawContent = choice?.message?.content ?? '';
				let content: unknown = rawContent;

				if (options.jsonOutput === true && typeof rawContent === 'string') {
					try {
						content = JSON.parse(rawContent);
					} catch {
						// Model tidak selalu patuh pada response_format; kembalikan teks apa adanya
						// daripada menggagalkan seluruh item.
						content = rawContent;
					}
				}

				returnData.push({
					json: {
						content,
						model: response?.model ?? model,
						finishReason: choice?.finish_reason ?? null,
						usage: response?.usage ?? null,
						id: response?.id ?? null,
					} as IDataObject,
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
