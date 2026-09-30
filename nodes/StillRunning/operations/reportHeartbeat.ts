import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getStillRunningCredentials, stillRunningApiRequest } from '../transport';

const showOnlyForReportHeartbeat = {
	operation: ['reportHeartbeat'],
};

export const reportHeartbeatDescription: INodeProperties[] = [
	{
		displayName: 'Workflow ID',
		name: 'workflowRemoteId',
		type: 'string',
		default: '={{$workflow.id}}',
		required: true,
		displayOptions: { show: showOnlyForReportHeartbeat },
		description: 'Defaults to this workflow\'s own ID — change it to report on behalf of another one',
	},
	{
		displayName: 'Workflow Name',
		name: 'workflowName',
		type: 'string',
		default: '={{$workflow.name}}',
		required: true,
		displayOptions: { show: showOnlyForReportHeartbeat },
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		noDataExpression: false,
		displayOptions: { show: showOnlyForReportHeartbeat },
		options: [
			{ name: 'Success', value: 'success' },
			{ name: 'Error', value: 'error' },
		],
		default: 'success',
	},
	{
		displayName: 'Started At',
		name: 'startedAt',
		type: 'dateTime',
		default: '={{$now.toISO()}}',
		required: true,
		displayOptions: { show: showOnlyForReportHeartbeat },
	},
	{
		displayName: 'Finished At',
		name: 'finishedAt',
		type: 'dateTime',
		default: '={{$now.toISO()}}',
		displayOptions: { show: showOnlyForReportHeartbeat },
		description: 'Leave the field empty (delete the default) to omit it, e.g. when reporting mid-run',
	},
	{
		displayName: 'Error Message',
		name: 'errorMessage',
		type: 'string',
		default: '',
		displayOptions: { show: { ...showOnlyForReportHeartbeat, status: ['error'] } },
	},
	{
		displayName: 'Run ID',
		name: 'runId',
		type: 'string',
		default: '={{$execution.id}}',
		displayOptions: { show: showOnlyForReportHeartbeat },
		description:
			'An idempotency key — resending the same value updates the same run instead of creating ' +
			'a duplicate. Defaults to this execution\'s own id.',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showOnlyForReportHeartbeat },
		options: [
			{
				displayName: 'Items Processed',
				name: 'itemsProcessed',
				type: 'number',
				typeOptions: { minValue: 0, numberPrecision: 0 },
				default: 0,
				description:
					'How many items this run wrote, e.g. {{ $(\'Append Row\').isExecuted ? $(\'Append Row\').all().length : 0 }}. ' +
					'A run that writes 0 when it usually writes more raises a zero-write alert.',
			},
		],
	},
];

export async function executeReportHeartbeat(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const credentials = await getStillRunningCredentials.call(this, itemIndex);
	if (!credentials) {
		throw new NodeOperationError(
			this.getNode(),
			'"Report Heartbeat" needs a Still Running API credential — "Analyse Workflow" is the ' +
				'only operation that works without one.',
			{ itemIndex },
		);
	}

	const finishedAt = this.getNodeParameter('finishedAt', itemIndex, '') as string;
	const errorMessage = this.getNodeParameter('errorMessage', itemIndex, '') as string;
	const runId = this.getNodeParameter('runId', itemIndex, '') as string;
	const { itemsProcessed } = this.getNodeParameter('additionalFields', itemIndex, {}) as {
		itemsProcessed?: number;
	};

	// An expression can produce anything; the API only takes a whole number from 0 up.
	if (
		itemsProcessed !== undefined &&
		!(Number.isSafeInteger(itemsProcessed) && itemsProcessed >= 0)
	) {
		throw new NodeOperationError(
			this.getNode(),
			`"Items Processed" must be a whole number of 0 or more, got ${String(itemsProcessed)}.`,
			{ itemIndex },
		);
	}

	const body: IDataObject = {
		workflowRemoteId: this.getNodeParameter('workflowRemoteId', itemIndex) as string,
		workflowName: this.getNodeParameter('workflowName', itemIndex) as string,
		status: this.getNodeParameter('status', itemIndex) as string,
		startedAt: this.getNodeParameter('startedAt', itemIndex) as string,
		...(finishedAt ? { finishedAt } : {}),
		...(errorMessage ? { errorMessage } : {}),
		...(runId ? { runId } : {}),
		...(itemsProcessed !== undefined ? { itemsProcessed } : {}),
	};

	return stillRunningApiRequest.call(this, itemIndex, 'POST', '/external/heartbeats', body);
}
