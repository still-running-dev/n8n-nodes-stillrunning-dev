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

// There is deliberately no "fetch this workflow" input: that needs an n8n API
// credential, which would be a second service in this package (n8n's review
// asks for one). n8n's own n8n node (Workflow → Get) fetches a workflow, and
// its output goes straight into Workflow JSON as {{ $json }}.
export const analyseWorkflowDescription: INodeProperties[] = [
	{
		displayName: 'Workflow JSON',
		name: 'workflowJson',
		type: 'json',
		default: '',
		required: true,
		displayOptions: { show: showOnlyForAnalyseWorkflow },
		description:
			'The exported n8n workflow or Make blueprint JSON to analyse. For a workflow on this ' +
			"instance, fetch it with n8n's own n8n node (Workflow → Get) and set this to {{ $json }}.",
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
	const workflowDefinition = parseWorkflowJsonParameter.call(
		this,
		this.getNodeParameter('workflowJson', itemIndex),
		itemIndex,
	);

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
