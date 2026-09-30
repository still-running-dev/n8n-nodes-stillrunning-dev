import type {
	ICredentialTestRequest,
	IAuthenticateGeneric,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class StillRunningApi implements ICredentialType {
	name = 'stillRunningApi';

	displayName = 'Still Running API';

	documentationUrl = 'https://github.com/still-running-dev/n8n-nodes-stillrunning-dev#readme';

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
			description:
				'A workspace API key from stillrunning.dev (Settings → API Keys). Only needed for ' +
				'"Report Heartbeat" and "Get Workflow Health" — "Analyse Workflow" runs locally without one.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.stillrunning.dev/api/v1',
			description: 'Only change this for a self-hosted or staging stillrunning.dev instance.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-Still-Running-Api-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	// Reuses the analyse endpoint rather than a dedicated "whoami" route —
	// there isn't one yet. A near-empty body still returns 200 (analysis is
	// simply skipped for input that isn't a real export); only an invalid
	// key makes this fail, which is all a credential test needs.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/external/analyze',
			method: 'POST',
			body: {
				workflow: { test: true },
			},
		},
	};
}
