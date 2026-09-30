import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeApiError, NodeOperationError } from 'n8n-workflow';
import { analyseWorkflowDescription, executeAnalyseWorkflow } from './operations/analyseWorkflow';
import { reportHeartbeatDescription, executeReportHeartbeat } from './operations/reportHeartbeat';
import {
	getWorkflowHealthDescription,
	executeGetWorkflowHealth,
} from './operations/getWorkflowHealth';

/**
 * Integrates n8n with stillrunning.dev. Programmatic-style, not declarative
 * — "Analyse Workflow" branches between running the bundled analysis engine
 * locally (no credential attached) and calling the stillrunning.dev API (a
 * credential attached), which a declarative node's routing config can't
 * express (it always issues its configured HTTP request; there's no way to
 * tell it "run local code instead"). "Report Heartbeat" and "Get Workflow
 * Health" have no such branching and are deliberately thin — each is just a
 * parameter-to-request mapping through the shared `stillRunningApiRequest`
 * helper, the same shape a declarative `routing.request` block would be.
 */
export class StillRunning implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Still Running',
		name: 'stillRunning',
		icon: { light: 'file:stillRunning.light.svg', dark: 'file:stillRunning.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		// An integration with a third-party service, worded on purpose: n8n may reject a node
		// that reads as monitoring or analytics, which compete with its paid Insights.
		description:
			'Integrates with stillrunning.dev: analyse a workflow export, report a run, read a workflow status',
		defaults: {
			name: 'Still Running',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'stillRunningApi',
				required: false,
			},
			{
				name: 'stillRunningN8nApi',
				required: false,
				displayOptions: {
					show: {
						operation: ['analyseWorkflow'],
						inputSource: ['currentWorkflow'],
					},
				},
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Analyse Workflow',
						value: 'analyseWorkflow',
						description:
							'Check a workflow export for silent-failure risks — runs locally with no API ' +
							'key, or via stillrunning.dev with one',
						action: 'Analyse a workflow',
					},
					{
						name: 'Report Heartbeat',
						value: 'reportHeartbeat',
						description: "Post a run's outcome to stillrunning.dev",
						action: 'Report a heartbeat',
					},
					{
						name: 'Get Workflow Health',
						value: 'getWorkflowHealth',
						description: "Fetch a monitored workflow's current status from stillrunning.dev",
						action: 'Get workflow health',
					},
				],
				default: 'analyseWorkflow',
			},
			...analyseWorkflowDescription,
			...reportHeartbeatDescription,
			...getWorkflowHealthDescription,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				const json = await executeOperation.call(this, operation, i);
				returnData.push({ json, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}

				if (error instanceof NodeOperationError || error instanceof NodeApiError) {
					throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
				}

				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

function executeOperation(this: IExecuteFunctions, operation: string, itemIndex: number) {
	switch (operation) {
		case 'analyseWorkflow':
			return executeAnalyseWorkflow.call(this, itemIndex);
		case 'reportHeartbeat':
			return executeReportHeartbeat.call(this, itemIndex);
		case 'getWorkflowHealth':
			return executeGetWorkflowHealth.call(this, itemIndex);
		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: "${operation}"`, {
				itemIndex,
			});
	}
}
