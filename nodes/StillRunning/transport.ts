import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export interface StillRunningCredentialsI {
	apiKey: string;
	baseUrl: string;
}

const DEFAULT_BASE_URL = 'https://api.stillrunning.dev/api/v1';

/**
 * Returns the attached `stillRunningApi` credential, or `undefined` if the
 * node has none — n8n has no separate "has a credential" check; catching
 * `getCredentials()`'s rejection is the documented way to detect this. Used
 * by "Analyse Workflow" to decide local vs. remote; the other two operations
 * call this and throw a clear error themselves when it comes back empty,
 * since they have no local fallback.
 */
export async function getStillRunningCredentials(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<StillRunningCredentialsI | undefined> {
	try {
		return (await this.getCredentials(
			'stillRunningApi',
			itemIndex,
		)) as unknown as StillRunningCredentialsI;
	} catch {
		return undefined;
	}
}

/**
 * Thin wrapper — every call here mirrors what a declarative `routing.request`
 * block would do, plus one step: the API wraps every answer as
 * `{ data, httpStatus, frontFacingMessage }`, and the node outputs `data`.
 */
export async function stillRunningApiRequest(
	this: IExecuteFunctions,
	itemIndex: number,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('stillRunningApi', itemIndex);
	const baseURL = (credentials.baseUrl as string) || DEFAULT_BASE_URL;

	const options: IHttpRequestOptions = {
		method,
		baseURL,
		url: path,
		json: true,
		...(body ? { body } : {}),
	};

	const response = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'stillRunningApi',
		options,
	)) as { data?: unknown } | null;

	const data = response?.data;
	if (data === null || typeof data !== 'object' || Array.isArray(data)) {
		// Most likely a Base URL that points somewhere other than the API.
		throw new NodeOperationError(
			this.getNode(),
			`The answer from ${baseURL} isn't a stillrunning.dev API response.`,
			{
				itemIndex,
				description: `Check the Still Running API credential's Base URL. The default is ${DEFAULT_BASE_URL}.`,
			},
		);
	}

	return data as IDataObject;
}
