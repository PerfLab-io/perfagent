import { type CoreMessage, type DataStreamWriter, coreMessageSchema } from 'ai';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { createUserMcpClient } from '@/lib/ai/mastra/client/factory';
import dedent from 'dedent';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { errorHandler } from '@/lib/ai/mastra/connection/ErrorHandler';

// Message schema
const messageSchema = coreMessageSchema;

// Tool call request schema
const toolCallRequestSchema = z.object({
	toolName: z.string().describe('Name of the tool to be called'),
	arguments: z
		.any()
		.default({})
		.describe(
			"Selected tool's inputSchema. This is represents what should be passed to the tool",
		),
	serverName: z
		.string()
		.describe('Name of the server where the tool is located'),
	reason: z.string().describe('Reason why this tool call is needed'),
});

// Tool call result schema
const toolCallResultSchema = z.object({
	success: z.boolean(),
	result: z.any().optional(),
	error: z.string().optional(),
	metadata: z.record(z.any()).optional(),
});

// Tool discovery result schema
const toolDiscoveryResultSchema = z.object({
	totalServers: z.number(),
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

type TriggerSchema = {
	messages: CoreMessage[];
	userId: string;
	action: 'discover' | 'execute';
	toolCallRequest?: z.infer<typeof toolCallRequestSchema>;
	dataStream: DataStreamWriter;
};

// Centralized error handler that writes to the data stream and asks the agent
async function handleAndReportError(params: {
	phase: 'discover' | 'execute';
	err: unknown;
	mastra: any;
	messages: CoreMessage[];
	dataStream: DataStreamWriter;
	runId: string;
	context?: {
		userId?: string;
		serverId?: string;
		serverName?: string;
		serverUrl?: string;
		method?: string;
		stage?: string;
		toolName?: string;
	};
	severity?: 'soft' | 'hard';
}) {
	const {
		phase,
		err,
		mastra,
		messages,
		dataStream,
		runId,
		context = {},
		severity = 'hard',
	} = params;

	const ctx = {
		serverId: context.serverId || 'unknown',
		userId: context.userId || 'unknown',
		serverUrl: context.serverUrl,
		method: context.method,
	};

	const userMessage = errorHandler.getContextAwareErrorMessage(err, ctx);
	const recovery = errorHandler.getErrorRecoveryRecommendation(err, ctx);

	const baseData: any = {
		id: phase === 'discover' ? 'mcp-discovery' : 'tool-execution',
		type: phase === 'discover' ? 'mcp-discovery' : 'tool-execution',
		timestamp: Date.now(),
		title: phase === 'discover' ? 'Tool Discovery' : 'Tool Execution',
		message: `${userMessage}${recovery ? ` — ${recovery.message}` : ''}`,
		...(phase === 'execute'
			? { toolName: context.toolName, serverName: context.serverName }
			: {}),
		...(severity === 'hard'
			? { error: err instanceof Error ? err.message : String(err) }
			: {}),
	};

	if (phase === 'discover') {
		dataStream.writeData({
			type: 'text',
			runId,
			status: severity === 'soft' ? 'in-progress' : 'error',
			content: { type: 'mcp-discovery', data: baseData },
		});
	} else {
		dataStream.writeData({
			type: 'tool-execution',
			runId,
			status: 'complete',
			content: { type: 'tool-execution', data: baseData },
		});
	}

	const stageText = context.stage ? ` during ${context.stage}` : '';
	const assistPrompt = dedent`
		You are a helpful assistant.

		A ${phase} error occurred${stageText}.

		Details for the user:
		- What failed: ${context.method || context.toolName || phase}
		- Server: ${context.serverName || context.serverId || 'unknown'}
		- Reason: ${userMessage}
		- Recommendation: ${recovery?.message || 'Please try again.'}
		- Suggested action: ${recovery?.action || 'retry'}

		Provide a short, clear message explaining the issue and what the user can do next. Keep it concise.
	`;

	try {
		const agentStream = await mastra
			.getAgent('largeAssistant')
			.stream([...messages, { role: 'system', content: assistPrompt }]);
		agentStream.mergeIntoDataStream(dataStream);
	} catch {
		// If agent rendering fails, we already wrote a stream event above
	}
}

// Main MCP workflow - handles both discovery and execution based on action
const mcpWorkflow = createWorkflow({
	id: 'mcpWorkflow',
	inputSchema: mcpWorkflowInputSchema,
	outputSchema: z.union([
		z.object({
			action: z.literal('discover'),
			discovery: toolDiscoveryResultSchema,
			recommendedTool: toolCallRequestSchema.optional(),
		}),
		z.object({
			action: z.literal('execute'),
			result: toolCallResultSchema,
			followUpRecommendations: z.array(toolCallRequestSchema).optional(),
		}),
	]),
})
	.then(
		createStep({
			id: 'mcp-action-handler',
			inputSchema: mcpWorkflowInputSchema,
			outputSchema: z.union([
				z.object({
					action: z.literal('discover'),
					discovery: toolDiscoveryResultSchema,
					recommendedTool: toolCallRequestSchema.optional(),
				}),
				z.object({
					action: z.literal('execute'),
					result: toolCallResultSchema,
					followUpRecommendations: z.array(toolCallRequestSchema).optional(),
				}),
			]),
			execute: async ({ inputData, mastra, runId }) => {
				const { action } = inputData;
				const triggerData = inputData as TriggerSchema;
				const { dataStream, userId, messages } = triggerData;

				if (action === 'discover') {
					let recommendedTool:
						| z.infer<typeof toolCallRequestSchema>
						| undefined;

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
						const mcpClient = await createUserMcpClient(userId);
						if (!mcpClient) {
							throw new Error('Failed to create MCP client');
						}

						let toolsets: any = {};
						try {
							toolsets = await mcpClient.getToolsets();
						} catch (e) {
							console.warn(
								'getToolsets() failed; continuing with empty set',
								e,
							);
							await handleAndReportError({
								phase: 'discover',
								err: e,
								mastra,
								messages,
								dataStream,
								runId,
								context: {
									userId,
									stage: 'getToolsets',
									method: 'getToolsets',
								},
								severity: 'soft',
							});
							toolsets = {};
						}
						const totalServers = Object.keys(toolsets).length;

						const totalTools = Object.values(toolsets).reduce(
							(total: number, toolset: any) =>
								total + Object.keys(toolset).length,
							0,
						);

						const discovery: z.infer<typeof toolDiscoveryResultSchema> = {
							totalServers,
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
									message: `Found ${totalTools} tools across ${totalServers} servers`,
								},
							},
						});

						const mcpAgent = mastra.getAgent('mcpAgent');
						const parsedToolsets = JSON.stringify(
							Object.keys(toolsets || {}).map((serverName) => ({
								serverName,
								tools: Object.keys(toolsets?.[serverName] || {}).map(
									(toolName) => ({
										toolName,
										description:
											toolsets?.[serverName]?.[toolName]?.description,
										inputSchema: zodToJsonSchema(
											toolsets?.[serverName]?.[toolName]?.inputSchema,
										),
									}),
								),
							})),
						);

						try {
							const response = await mcpAgent.generate(
								[
									...messages,
									{
										role: 'user',
										content: dedent`
											Here's the list of toolsets to choose from

											${parsedToolsets}
										`,
									},
								],
								{
									output: z.object({
										selectedTool: toolCallRequestSchema,
									}),
								},
							);

							console.log('MCP agent response:', response.object);
							recommendedTool = response.object.selectedTool;
						} catch (error) {
							await handleAndReportError({
								phase: 'discover',
								err: error,
								mastra,
								messages,
								dataStream,
								runId,
								context: {
									userId,
									stage: 'tool-recommendation',
									method: 'mcpAgent.generate',
								},
								severity: 'soft',
							});
						}

						dataStream.writeData({
							type: 'text',
							runId,
							status: 'completed',
							content: {
								type: 'mcp-discovery',
								data: {
									id: 'mcp-discovery',
									type: 'mcp-discovery',
									timestamp: Date.now(),
									title: 'Tool Discovery',
									message: `Discovery complete. Found ${discovery.totalTools} tools across ${discovery.totalServers} servers.`,
									discovery: discovery,
								},
							},
						});

						// Recommendation is optional; proceed without throwing
						const safeToolCall = recommendedTool
							? {
									toolName: recommendedTool.toolName,
									serverName: recommendedTool.serverName,
									reason: recommendedTool.reason,
									arguments:
										recommendedTool.arguments &&
										typeof recommendedTool.arguments === 'object'
											? recommendedTool.arguments
											: {},
								}
							: null;

						if (safeToolCall) {
							dataStream.writeData({
								type: 'tool-call-approval',
								runId,
								status: 'started',
								content: {
									type: 'tool-call-approval',
									data: {
										toolCall: safeToolCall,
										status: 'pending',
										title: 'Tool Call Approval',
										timestamp: Date.now(),
									},
								} as any,
							} as any);
						}

						const agentPrompt = recommendedTool
							? dedent`
							You are a helpful assistant that can help the user with their request. You should ask the user if they want to try the tool call ${recommendedTool.toolName} from ${recommendedTool.serverName}.

							You should not output anything else. A simple, short message is enough, as alongside your message the user will be presented with an interface to approve or reject the tool call.
							`
							: dedent`
							You are a helpful assistant that can help the user with their request. You should ask the user to help you understand their request so you can find tools that could fulfill it.

							You have access to the following tools:

							${parsedToolsets}

							You should output a message with a clear, well-structured, and concise message to help the user decide what tool, and which server, to use.
							`;

						const agentStream = await mastra.getAgent('largeAssistant').stream([
							...messages,
							{
								role: 'system',
								content: agentPrompt,
							},
						]);

						agentStream.mergeIntoDataStream(dataStream);

						return {
							action: 'discover' as const,
							discovery: discovery,
							recommendedTool: recommendedTool,
						};
					} catch (error) {
						await handleAndReportError({
							phase: 'discover',
							err: error,
							mastra,
							messages,
							dataStream,
							runId,
							context: { userId, stage: 'discovery' },
							severity: 'hard',
						});

						// Gracefully return empty discovery to avoid failing the workflow
						return {
							action: 'discover' as const,
							discovery: { totalServers: 0, totalTools: 0 },
							recommendedTool: undefined,
						};
					}
				} else if (action === 'execute') {
					const triggerData = inputData as TriggerSchema;
					const { toolCallRequest, dataStream, userId } = triggerData;

					if (!toolCallRequest) {
						throw new Error('No tool call request provided for execution');
					}

					dataStream.writeData({
						type: 'tool-call-approval',
						runId,
						status: 'complete',
						content: {
							type: 'tool-call-approval',
							data: {
								toolCall: toolCallRequest,
								status: 'approved',
								title: 'Tool Call Approved',
								timestamp: Date.now(),
							},
						},
					});

					dataStream.writeData({
						type: 'tool-execution',
						runId,
						status: 'started',
						content: {
							type: 'tool-execution',
							data: {
								id: 'tool-execution',
								type: 'tool-execution',
								timestamp: Date.now(),
								title: 'Tool Execution',
								toolName: toolCallRequest.toolName,
								serverName: toolCallRequest.serverName,
								message: `Executing ${toolCallRequest.toolName}...`,
							},
						},
					});

					try {
						const { toolExecutionService } = await import('../toolExecution');
						const { db } = await import('@/drizzle/db');
						const { mcpServers } = await import('@/drizzle/schema');
						const { eq, and } = await import('drizzle-orm');

						const [server] = await db
							.select()
							.from(mcpServers)
							.where(
								and(
									eq(mcpServers.name, toolCallRequest.serverName),
									eq(mcpServers.userId, userId),
								),
							)
							.limit(1);

						if (!server) {
							await handleAndReportError({
								phase: 'execute',
								err: new Error(
									`Server ${toolCallRequest.serverName} not found for user`,
								),
								mastra,
								messages,
								dataStream,
								runId,
								context: {
									userId,
									serverName: toolCallRequest.serverName,
									toolName: toolCallRequest.toolName,
									method: 'executeTool',
									stage: 'server-lookup',
								},
								severity: 'hard',
							});

							const toolResult: z.infer<typeof toolCallResultSchema> = {
								success: false,
								error: `Server ${toolCallRequest.serverName} not found for user`,
								metadata: {
									toolName: toolCallRequest.toolName,
									serverName: toolCallRequest.serverName,
									executedAt: new Date().toISOString(),
								},
							};

							return {
								action: 'execute' as const,
								result: toolResult,
							};
						}

						const execResult = await errorHandler.executeWithRetry(
							() =>
								toolExecutionService.executeTool({
									serverId: server.id,
									userId,
									toolName: toolCallRequest.toolName,
									arguments: toolCallRequest.arguments,
								}),
							{
								serverId: server.id,
								userId,
								method: toolCallRequest.toolName,
							},
						);

						if ((execResult as any)?.error) {
							const errRes = (execResult as any).error;
							await handleAndReportError({
								phase: 'execute',
								err: errRes,
								mastra,
								messages,
								dataStream,
								runId,
								context: {
									userId,
									serverId: server.id,
									serverName: toolCallRequest.serverName,
									toolName: toolCallRequest.toolName,
									method: toolCallRequest.toolName,
									stage: 'executeTool',
								},
								severity: 'hard',
							});

							const toolResult: z.infer<typeof toolCallResultSchema> = {
								success: false,
								error: errRes.userMessage || 'Unknown error',
								metadata: {
									toolName: toolCallRequest.toolName,
									serverName: toolCallRequest.serverName,
									executedAt: new Date().toISOString(),
								},
							};

							return {
								action: 'execute' as const,
								result: toolResult,
							};
						}

						const result = execResult as any;

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
							type: 'tool-execution',
							runId,
							status: 'complete',
							content: {
								type: 'tool-execution',
								data: {
									id: 'tool-execution',
									type: 'tool-execution',
									timestamp: Date.now(),
									title: 'Tool Execution',
									toolName: toolCallRequest.toolName,
									serverName: toolCallRequest.serverName,
									message: `Successfully executed ${toolCallRequest.toolName}`,
									result: JSON.stringify(result), // Convert to string to avoid type issues
								},
							},
						});

						const agentSummary = await mastra
							.getAgent('largeAssistant')
							.stream([
								...messages,
								{
									role: 'user',
									content: dedent`
										I have the result from the ${toolCallRequest.toolName} tool from ${toolCallRequest.serverName} server.
										
										Tool result:

										${typeof result === 'string' ? result : JSON.stringify(result, null, 2)}

										Please format the result in a way that is easy to understand without ommiting any important details.

										The result might be extensive, so please format it using the best possible markdown formatting to display dense or extensive information.
									`,
								},
							]);

						agentSummary.mergeIntoDataStream(dataStream);

						return {
							action: 'execute' as const,
							result: toolResult,
							followUpRecommendations: [], // TODO: Implement follow-up recommendations
						};
					} catch (error) {
						await handleAndReportError({
							phase: 'execute',
							err: error,
							mastra,
							messages,
							dataStream,
							runId,
							context: {
								userId,
								serverName: toolCallRequest.serverName,
								toolName: toolCallRequest.toolName,
								method: toolCallRequest.toolName,
								stage: 'executeTool',
							},
							severity: 'hard',
						});

						const toolResult: z.infer<typeof toolCallResultSchema> = {
							success: false,
							error: error instanceof Error ? error.message : 'Unknown error',
							metadata: {
								toolName: toolCallRequest.toolName,
								serverName: toolCallRequest.serverName,
								executedAt: new Date().toISOString(),
							},
						};

						return {
							action: 'execute' as const,
							result: toolResult,
						};
					}
				} else {
					throw new Error(`Unknown MCP action: ${action}`);
				}
			},
		}),
	)
	.commit();

export { mcpWorkflow };
export type { TriggerSchema as MCPWorkflowTriggerSchema };
export { toolCallRequestSchema, toolCallResultSchema, mcpWorkflowInputSchema };
