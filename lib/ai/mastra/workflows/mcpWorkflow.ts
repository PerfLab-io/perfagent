import { type CoreMessage, type DataStreamWriter, coreMessageSchema } from 'ai';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { createUserMcpClient } from '@/lib/ai/mastra/mcpClient';
import dedent from 'dedent';

// Message schema
const messageSchema = coreMessageSchema;

// Tool definition schema based on MCP specification
const mcpToolSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	inputSchema: z.record(z.any()).optional(),
});

// Tool call request schema
const toolCallRequestSchema = z.object({
	toolName: z.string(),
	arguments: z.record(z.any()).default({}),
	serverName: z.string(),
	reason: z.string().describe('Reason why this tool call is needed'),
});

// Tool call approval status
const approvalStatusSchema = z.enum(['pending', 'approved', 'denied']);

// Tool call result schema
const toolCallResultSchema = z.object({
	success: z.boolean(),
	result: z.any().optional(),
	error: z.string().optional(),
	metadata: z.record(z.any()).optional(),
});

// Tool discovery result schema
const toolDiscoveryResultSchema = z.object({
	servers: z.array(
		z.object({
			name: z.string(),
			url: z.string(),
			tools: z.array(mcpToolSchema),
			connected: z.boolean(),
		}),
	),
	totalTools: z.number(),
});

// Workflow input schema
const mcpWorkflowInputSchema = z.object({
	dataStream: z.object({
		writeData: z.function().args(
			z.object({
				type: z.string(),
				content: z.any(),
			}),
		),
	}),
	messages: z.array(messageSchema),
	userId: z.string().describe('User ID for MCP client creation'),
	action: z
		.enum(['discover', 'execute'])
		.describe('Whether to discover tools or execute a tool call'),
	toolCallRequest: toolCallRequestSchema
		.optional()
		.describe('Tool call details when action is execute'),
});

// Step outputs
const toolDiscoveryOutputSchema = z.object({
	discovery: toolDiscoveryResultSchema,
	recommendedTool: toolCallRequestSchema.optional(),
});

const toolApprovalOutputSchema = z.object({
	toolCallRequest: toolCallRequestSchema,
	approved: z.boolean(),
	reason: z.string().optional(),
});

const toolExecutionOutputSchema = z.object({
	result: toolCallResultSchema,
	followUpRecommendations: z.array(toolCallRequestSchema).optional(),
});

type TriggerSchema = {
	messages: CoreMessage[];
	userId: string;
	action: 'discover' | 'execute';
	toolCallRequest?: z.infer<typeof toolCallRequestSchema>;
	dataStream: DataStreamWriter;
};

// Tool discovery step
const toolDiscoveryStep = createStep({
	id: 'tool-discovery',
	inputSchema: mcpWorkflowInputSchema,
	outputSchema: toolDiscoveryOutputSchema,
	execute: async ({ mastra, runId, getInitData }) => {
		const triggerData = getInitData() as TriggerSchema;
		const { dataStream, userId, messages } = triggerData;

		if (!mastra) {
			throw new Error('Mastra not found');
		}

		dataStream.writeData({
			type: 'text',
			runId,
			status: 'started',
			content: {
				type: 'mcp-discovery',
				data: {
					id: 'mcp-discovery',
					type: 'mcp-discovery',
					timestamp: Date.now(),
					title: 'Tool Discovery',
					message: 'Discovering available MCP tools...',
				},
			},
		});

		try {
			// Create MCP client and discover tools
			const mcpClient = await createUserMcpClient(userId);
			if (!mcpClient) {
				throw new Error('Failed to create MCP client');
			}

			const toolsets = await mcpClient.getToolsets();
			const servers = Object.entries(toolsets).map(([serverName, toolset]) => ({
				name: serverName,
				url: '', // TODO: Get actual URL from server registry
				tools: Object.values(toolset).map((tool: any) => ({
					name: tool.name,
					description: tool.description,
					inputSchema: tool.inputSchema,
				})),
				connected: true,
			}));

			const totalTools = servers.reduce(
				(total, server) => total + server.tools.length,
				0,
			);

			const discovery: z.infer<typeof toolDiscoveryResultSchema> = {
				servers,
				totalTools,
			};

			dataStream.writeData({
				type: 'text',
				runId,
				status: 'in-progress',
				content: {
					type: 'mcp-discovery',
					data: {
						id: 'mcp-discovery',
						type: 'mcp-discovery',
						timestamp: Date.now(),
						title: 'Tool Discovery',
						message: `Found ${totalTools} tools across ${servers.length} servers`,
					},
				},
			});

			// Use MCP agent to analyze user request and recommend tools
			let recommendedTool: z.infer<typeof toolCallRequestSchema> | undefined;

			if (messages.length > 0) {
				const mcpAgent = mastra.getAgent('mcpAgent');

				const toolsContext = servers
					.map(
						(server) =>
							`Server: ${server.name}\nTools: ${server.tools.map((t) => `- ${t.name}: ${t.description || 'No description'}`).join('\n')}`,
					)
					.join('\n\n');

				try {
					const response = await mcpAgent.generate(
						[
							{
								role: 'system',
								content: dedent`
								You are an MCP tool recommendation agent. Analyze the user's request and recommend the most appropriate tool to use.
								
								Available tools:
								${toolsContext}
								
								If you find a suitable tool, respond with a tool recommendation including the tool name, server name, arguments, and reason.
								If no suitable tool is found, respond with null.
							`,
							},
							...messages,
						],
						{
							output: z.object({
								recommendedTool: toolCallRequestSchema.optional(),
							}),
						},
					);

					recommendedTool = response.object.recommendedTool;
				} catch (error) {
					console.error('Error getting tool recommendation:', error);
				}
			}

			return {
				discovery,
				recommendedTool,
			};
		} catch (error) {
			dataStream.writeData({
				type: 'text',
				runId,
				status: 'error',
				content: {
					type: 'mcp-discovery',
					data: {
						id: 'mcp-discovery',
						type: 'mcp-discovery',
						timestamp: Date.now(),
						title: 'Tool Discovery',
						message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
					},
				},
			});

			throw error;
		}
	},
});

// Tool approval step - this will send approval request to UI
const toolApprovalStep = createStep({
	id: 'tool-approval',
	inputSchema: toolDiscoveryOutputSchema,
	outputSchema: toolApprovalOutputSchema,
	execute: async ({ inputData, runId, getInitData }) => {
		const triggerData = getInitData() as TriggerSchema;
		const { dataStream, action, toolCallRequest } = triggerData;

		// If action is 'execute', it means user has already approved
		if (action === 'execute' && toolCallRequest) {
			return {
				toolCallRequest,
				approved: true,
				reason: 'User explicitly requested tool execution',
			};
		}

		// If we have a recommended tool from discovery, request approval
		if (inputData.recommendedTool) {
			dataStream.writeData({
				type: 'text',
				runId,
				status: 'waiting-for-approval',
				content: {
					type: 'tool-call-approval',
					data: {
						id: 'tool-call-approval',
						type: 'tool-call-approval',
						timestamp: Date.now(),
						title: 'Tool Call Approval',
						toolCall: inputData.recommendedTool,
						status: 'pending',
					},
				},
			});

			// Return pending state - UI will handle approval/denial
			return {
				toolCallRequest: inputData.recommendedTool,
				approved: false,
				reason: 'Waiting for user approval',
			};
		}

		// No tool to approve
		throw new Error('No tool call to approve');
	},
});

// Tool execution step
const toolExecutionStep = createStep({
	id: 'tool-execution',
	inputSchema: toolApprovalOutputSchema,
	outputSchema: toolExecutionOutputSchema,
	execute: async ({ inputData, runId, getInitData }) => {
		const triggerData = getInitData() as TriggerSchema;
		const { dataStream, userId } = triggerData;
		const { toolCallRequest, approved } = inputData;

		if (!approved) {
			throw new Error('Tool call was not approved');
		}

		dataStream.writeData({
			type: 'text',
			runId,
			status: 'executing',
			content: {
				type: 'tool-execution',
				data: {
					id: 'tool-execution',
					type: 'tool-execution',
					timestamp: Date.now(),
					title: 'Tool Execution',
					message: `Executing ${toolCallRequest.toolName}...`,
				},
			},
		});

		try {
			// Create MCP client and execute tool
			const mcpClient = await createUserMcpClient(userId);
			if (!mcpClient) {
				throw new Error('Failed to create MCP client');
			}

			const result = await mcpClient.callTool(
				toolCallRequest.toolName,
				toolCallRequest.arguments,
			);

			const toolResult: z.infer<typeof toolCallResultSchema> = {
				success: true,
				result,
				metadata: {
					toolName: toolCallRequest.toolName,
					serverName: toolCallRequest.serverName,
					executedAt: new Date().toISOString(),
				},
			};

			dataStream.writeData({
				type: 'text',
				runId,
				status: 'completed',
				content: {
					type: 'tool-execution',
					data: {
						id: 'tool-execution',
						type: 'tool-execution',
						timestamp: Date.now(),
						title: 'Tool Execution',
						message: `Successfully executed ${toolCallRequest.toolName}`,
						result: result,
					},
				},
			});

			return {
				result: toolResult,
				followUpRecommendations: [], // TODO: Implement follow-up recommendations
			};
		} catch (error) {
			const toolResult: z.infer<typeof toolCallResultSchema> = {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				metadata: {
					toolName: toolCallRequest.toolName,
					serverName: toolCallRequest.serverName,
					executedAt: new Date().toISOString(),
				},
			};

			dataStream.writeData({
				type: 'text',
				runId,
				status: 'error',
				content: {
					type: 'tool-execution',
					data: {
						id: 'tool-execution',
						type: 'tool-execution',
						timestamp: Date.now(),
						title: 'Tool Execution',
						message: `Error executing ${toolCallRequest.toolName}: ${toolResult.error}`,
					},
				},
			});

			return {
				result: toolResult,
			};
		}
	},
});

// Create the MCP workflow
const mcpWorkflow = createWorkflow({
	id: 'mcp-workflow',
	inputSchema: mcpWorkflowInputSchema,
	outputSchema: z.object({
		discovery: toolDiscoveryResultSchema.optional(),
		execution: toolExecutionOutputSchema.optional(),
		error: z.string().optional(),
	}),
})
	.then(toolDiscoveryStep)
	.then(toolApprovalStep)
	.then(toolExecutionStep)
	.commit();

export { mcpWorkflow };
export type { TriggerSchema as MCPWorkflowTriggerSchema };
export {
	toolCallRequestSchema,
	toolCallResultSchema,
	mcpWorkflowInputSchema,
	approvalStatusSchema,
};
