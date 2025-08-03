import { type CoreMessage, type DataStreamWriter, coreMessageSchema } from 'ai';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { createUserMcpClient } from '@/lib/ai/mastra/mcpClient';
import dedent from 'dedent';
import { zodToJsonSchema } from 'zod-to-json-schema';

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

// Main MCP workflow - handles both discovery and execution based on action
const mcpWorkflow = createWorkflow({
	id: 'mcpWorkflow',
	inputSchema: mcpWorkflowInputSchema,
	outputSchema: z.union([
		// Discovery output
		z.object({
			action: z.literal('discover'),
			discovery: toolDiscoveryResultSchema,
			recommendedTool: toolCallRequestSchema.optional(),
		}),
		// Execution output
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
				// Discovery output
				z.object({
					action: z.literal('discover'),
					discovery: toolDiscoveryResultSchema,
					recommendedTool: toolCallRequestSchema.optional(),
				}),
				// Execution output
				z.object({
					action: z.literal('execute'),
					result: toolCallResultSchema,
					followUpRecommendations: z.array(toolCallRequestSchema).optional(),
				}),
			]),
			execute: async ({ inputData, mastra, runId }) => {
				const { action } = inputData;

				if (action === 'discover') {
					// Run tool discovery inline
					const triggerData = inputData as TriggerSchema;
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
						const totalServers = Object.keys(toolsets).length;

						const totalTools = Object.values(toolsets).reduce(
							(total, toolset) => total + Object.keys(toolset).length,
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

						// Use MCP agent to analyze user request and recommend tools
						let recommendedTool:
							| z.infer<typeof toolCallRequestSchema>
							| undefined;

						if (messages.length > 0) {
							const mcpAgent = mastra.getAgent('mcpAgent');
							const parsedToolsets = JSON.stringify(
								Object.keys(toolsets).map((serverName) => ({
									serverName,
									tools: Object.keys(toolsets[serverName]).map((toolName) => ({
										toolName,
										description: toolsets[serverName][toolName].description,
										inputSchema: zodToJsonSchema(
											toolsets[serverName][toolName].inputSchema,
										),
									})),
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
										// toolsets,
										output: z.object({
											selectedTool: toolCallRequestSchema,
										}),
									},
								);

								console.log('MCP agent response:', response.object);
								recommendedTool = response.object.selectedTool;
								console.log(
									'######################### Recommended tool:',
									recommendedTool,
								);
							} catch (error) {
								console.error('Error getting tool recommendation:', error);
							}
						}

						console.log('Tool discovery step complete:');
						console.log('- Total tools found:', discovery.totalTools);
						console.log('- Servers found:', discovery.totalServers);
						console.log(
							'- Recommended tool:',
							recommendedTool ? recommendedTool.toolName : 'none',
						);

						// Send discovery completion update
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

						// If we have a recommended tool, send approval UI
						if (recommendedTool) {
							console.log(
								'Sending tool call approval UI for:',
								recommendedTool,
							);

							dataStream.writeData({
								type: 'tool-call-approval',
								runId,
								status: 'started',
								content: {
									type: 'tool-call-approval',
									data: {
										toolCall: recommendedTool,
										status: 'pending',
										title: 'Tool Call Approval',
										timestamp: Date.now(),
									},
								},
							});
						} else {
							console.log('No tool recommendation from MCP agent');

							// Still show available tools for manual selection
							dataStream.writeData({
								type: 'tool-catalog',
								runId,
								status: 'completed',
								content: {
									type: 'tool-catalog',
									data: {
										id: 'tool-catalog',
										type: 'tool-catalog',
										timestamp: Date.now(),
										title: 'Available Tools',
										message:
											'Here are the available tools. You can request a specific tool to be used.',
										servers: [],
									},
								},
							});
						}

						// Return discovery results - workflow stops here
						return {
							action: 'discover' as const,
							discovery: discovery,
							recommendedTool: recommendedTool,
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
				} else if (action === 'execute') {
					// Execute the approved tool inline
					const triggerData = inputData as TriggerSchema;
					const { toolCallRequest, dataStream, userId } = triggerData;

					if (!toolCallRequest) {
						throw new Error('No tool call request provided for execution');
					}

					// Update the approval UI to show it's been approved
					dataStream.writeData({
						type: 'tool-call-approval',
						runId,
						status: 'started',
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
						// Import dependencies
						const { toolExecutionService } = await import('../toolExecution');
						const { db } = await import('@/drizzle/db');
						const { mcpServers } = await import('@/drizzle/schema');
						const { eq, and } = await import('drizzle-orm');

						// Look up the server ID by name
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
							throw new Error(
								`Server ${toolCallRequest.serverName} not found for user`,
							);
						}

						const result = await toolExecutionService.executeTool({
							serverId: server.id,
							userId,
							toolName: toolCallRequest.toolName,
							arguments: toolCallRequest.arguments,
						});

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
									result: JSON.stringify(result), // Convert to string to avoid type issues
								},
							},
						});

						return {
							action: 'execute' as const,
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
