import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AdaCodeApi implements ICredentialType {
	name = 'adaCodeApi';

	displayName = 'adaCODE API';

	documentationUrl = 'https://adacode.ai/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'API key adaCODE (diawali sk-adacode-). Buat di https://adacode.ai/api-keys — satu key berlaku untuk semua model di katalog Anda.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.adacode.ai',
			description:
				'Ubah hanya bila memakai gateway adaCODE self-host. Tulis tanpa akhiran /v1 dan tanpa garis miring di akhir.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/models',
			method: 'GET',
		},
	};
}
