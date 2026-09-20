import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
// Vendored, not a package.json dependency — see vendor/healthCheck.generated.ts's
// own header and scripts/vendor-health-check.mjs for why.
 
import healthCheck from '../vendor/healthCheck.generated';
import { getStillRunningCredentials, stillRunningApiRequest } from '../transport';

const analyze = (healthCheck as { analyze: (input: string | object) => IDataObject }).analyze;

const showOnlyForAnalyseWorkflow = {
	operation: ['analyseWorkflow'],
};

export const analyseWorkflowDescription: INodeProperties[] = [
	{
		displayName: 'Input Source',
		name: 'inputSource',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForAnalyseWorkflow },
		options: [
			{
				name: 'Workflow JSON',
				value: 'workflowJson',
				description: 'Paste or pass in a workflow (or Make blueprint) export',
			},
			{
				name: 'Current Workflow',
				value: 'currentWorkflow',
				description: "Fetch this workflow's own definition via the n8n API",
			},
		],
		default: 'workflowJson',
	},
	{
		displayName: 'Workflow JSON',
		name: 'workflowJson',
		type: 'json',
		default: '',
		required: true,
		displayOptions: {
			show: { ...showOnlyForAnalyseWorkflow, inputSource: ['workflowJson'] },
		},
		description: 'The exported n8n workflow or Make blueprint JSON to analyse',
	},
];

/**
 * The one operation with real branching logic — why this node can't be
 * fully declarative (see StillRunning.node.ts's own doc comment). Local
 * mode calls the vendored, exact-pinned @still-running/health-check build
 * directly, with nothing sent over the network; remote mode is a thin
 * request through the same shape every other operation uses.
 */
export async function executeAnalyseWorkflow(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const inputSource = this.getNodeParameter('inputSource', itemIndex) as string;

	const workflowDefinition =
		inputSource === 'currentWorkflow'
			? await fetchCurrentWorkflowDefinition.call(this, itemIndex)
			: parseWorkflowJsonParameter.call(this, this.getNodeParameter('workflowJson', itemIndex), itemIndex);

	const credentials = await getStillRunningCredentials.call(this, itemIndex);

	if (!credentials) {
		// Bundled at build time from an exact-pinned devDependency — see this
		// repo's README on dependency vendoring for why this is never a
		// runtime dependency in package.json.
		const result = analyze(workflowDefinition);
		return { mode: 'local', ...result };
	}

	const result = await stillRunningApiRequest.call(this, itemIndex, 'POST', '/external/analyze', {
		workflow: workflowDefinition,
	});

	return { mode: 'remote', ...result };
}

async function fetchCurrentWorkflowDefinition(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const { id } = this.getWorkflow();

	if (!id) {
		throw new NodeOperationError(
			this.getNode(),
			'This workflow has no id yet — save it at least once before analysing it by id, ' +
				'or switch Input Source to "Workflow JSON".',
			{ itemIndex },
		);
	}

	const response = await this.helpers.httpRequestWithAuthentication.call(this, 'stillRunningN8nApi', {
		method: 'GET',
		url: `/workflows/${id}`,
		json: true,
	});

	return response as IDataObject;
}

function parseWorkflowJsonParameter(
	this: IExecuteFunctions,
	raw: unknown,
	itemIndex: number,
): IDataObject {
	if (typeof raw === 'string') {
		try {
			return JSON.parse(raw) as IDataObject;
		} catch {
			throw new NodeOperationError(this.getNode(), 'Workflow JSON is not valid JSON.', {
				itemIndex,
			});
		}
	}

	return raw as IDataObject;
}
