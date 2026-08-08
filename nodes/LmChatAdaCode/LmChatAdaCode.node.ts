import { ChatOpenAI } from '@langchain/openai';
import type {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';

import { loadAdaCodeModels, normalizeBaseUrl } from '../shared/GenericFunctions';

type ChatModelOptions = {
	temperature?: number;
	topP?: number;
	maxTokens?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	timeout?: number;
	maxRetries?: number;
	responseFormat?: 'text' | 'json_object';
};

export class LmChatAdaCode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'adaCODE Chat Model',
		name: 'lmChatAdaCode',
		icon: 'file:adacode-icon.svg',
		group: ['transform'],
		version: 1,
		description: 'Model bahasa adaCODE untuk AI Agent, Chain, dan node AI lainnya',
		defaults: {
			name: 'adaCODE Chat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://adacode.ai/docs',
					},
				],
			},
		},
		// Sub-node AI: tanpa input Main, keluarannya disambungkan ke konektor
		// "Chat Model" milik AI Agent/Chain. Aturan lint bawaan hanya mengenal node
		// biasa (Main → Main), jadi dimatikan di dua baris ini saja.
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
		outputs: ['ai_languageModel'],
		outputNames: ['Model'],
		credentials: [
			{
				name: 'adaCodeApi',
				required: true,
			},
		],
		properties: [
			{
				displayName:
					'Sambungkan node ini ke konektor <b>Chat Model</b> milik AI Agent, Basic LLM Chain, atau node AI lain',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Model Name or ID',
				name: 'model',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getModels' },
				default: 'adacode-2.0',
				required: true,
				description:
					'Model diambil langsung dari katalog API key Anda. Model berlabel "(coding plan)" dibayar kuota plan; sisanya tarif pasar dari Token Recharge. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Frequency Penalty',
						name: 'frequencyPenalty',
						type: 'number',
						typeOptions: { minValue: -2, maxValue: 2, numberPrecision: 2 },
						default: 0,
						description: 'Menekan pengulangan kata yang sering muncul',
					},
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						type: 'number',
						typeOptions: { minValue: 0, maxValue: 10 },
						default: 2,
						description: 'Berapa kali percobaan ulang saat permintaan gagal',
					},
					{
						displayName: 'Maximum Number of Tokens',
						name: 'maxTokens',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 2048,
						description: 'Batas panjang balasan',
					},
					{
						displayName: 'Presence Penalty',
						name: 'presencePenalty',
						type: 'number',
						typeOptions: { minValue: -2, maxValue: 2, numberPrecision: 2 },
						default: 0,
						description: 'Mendorong model membahas topik baru',
					},
					{
						displayName: 'Response Format',
						name: 'responseFormat',
						type: 'options',
						options: [
							{ name: 'Text', value: 'text' },
							{ name: 'JSON', value: 'json_object' },
						],
						default: 'text',
						description: 'Paksa model membalas dalam JSON bila node berikutnya butuh JSON',
					},
					{
						displayName: 'Sampling Temperature',
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
						name: 'topP',
						type: 'number',
						typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
						default: 1,
						description: 'Nucleus sampling — alternatif dari Sampling Temperature',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			getModels: loadAdaCodeModels,
		},
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = await this.getCredentials('adaCodeApi');
		const modelName = this.getNodeParameter('model', itemIndex) as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as ChatModelOptions;

		// Gateway adaCODE berbicara protokol OpenAI di /v1, jadi ChatOpenAI cukup
		// diarahkan ulang baseURL-nya. `useResponsesApi: false` memaksa jalur
		// /v1/chat/completions — jalur yang dipakai semua model di katalog adaCODE;
		// tanpa itu langchain bisa memilih /v1/responses untuk sebagian model.
		const baseURL = `${normalizeBaseUrl(credentials.baseUrl)}/v1`;

		const model = new ChatOpenAI({
			apiKey: credentials.apiKey as string,
			model: modelName,
			temperature: options.temperature,
			topP: options.topP,
			maxTokens: options.maxTokens,
			frequencyPenalty: options.frequencyPenalty,
			presencePenalty: options.presencePenalty,
			timeout: options.timeout ?? 300000,
			maxRetries: options.maxRetries ?? 2,
			useResponsesApi: false,
			configuration: {
				baseURL,
				defaultHeaders: { 'User-Agent': 'n8n-nodes-adacode' },
			},
			modelKwargs:
				options.responseFormat === 'json_object'
					? { response_format: { type: 'json_object' } }
					: undefined,
		});

		return { response: model };
	}
}
