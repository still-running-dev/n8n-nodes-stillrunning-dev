import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getStillRunningCredentials, stillRunningApiRequest } from '../transport';

const showOnlyForGetWorkflowHealth = {
	operation: ['getWorkflowHealth'],
};

export const getWorkflowHealthDescription: INodeProperties[] = [
	{
		displayName: 'Workflow ID',
		name: 'workflowRemoteId',
		type: 'string',
		default: '={{$workflow.id}}',
		required: true,
		displayOptions: { show: showOnlyForGetWorkflowHealth },
		description:
			"Defaults to this workflow's own id — change it to check another monitored workflow " +
			"in the same stillrunning.dev workspace",
	},
];

export async function executeGetWorkflowHealth(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const credentials = await getStillRunningCredentials.call(this, itemIndex);
	if (!credentials) {
		throw new NodeOperationError(
			this.getNode(),
			'"Get Workflow Health" needs a Still Running API credential — "Analyse Workflow" is the ' +
				'only operation that works without one.',
			{ itemIndex },
		);
	}

	const workflowRemoteId = this.getNodeParameter('workflowRemoteId', itemIndex) as string;

	return stillRunningApiRequest.call(
		this,
		itemIndex,
		'GET',
		`/external/workflows/${encodeURIComponent(workflowRemoteId)}/health`,
	);
}
