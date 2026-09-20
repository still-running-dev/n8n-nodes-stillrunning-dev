import type {
	ICredentialTestRequest,
	IAuthenticateGeneric,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * A community package may only reference credential types it defines
 * itself, not another package's (n8n's linter enforces this — see
 * no-credential-reuse) — so this exists even though it duplicates the
 * shape of n8n's own built-in "n8n API" credential. Only needed for
 * "Analyse Workflow"'s "Current Workflow" input source; every other
 * operation only ever needs Still Running API.
 */
export class StillRunningN8nApi implements ICredentialType {
	name = 'stillRunningN8nApi';

	displayName = 'Still Running N8n API';

	documentationUrl = 'https://docs.n8n.io/api/authentication/';

	icon = { light: 'file:../nodes/StillRunning/stillRunning.light.svg', dark: 'file:../nodes/StillRunning/stillRunning.dark.svg' } as const;

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: "This n8n instance's own API key (Settings → n8n API), not a stillrunning.dev key",
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://localhost:5678/api/v1',
			required: true,
			placeholder: 'https://your-instance.app.n8n.cloud/api/v1',
			description: "This n8n instance's own REST API base URL",
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-N8N-API-KEY': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/workflows',
			method: 'GET',
			qs: {
				limit: 1,
			},
		},
	};
}
