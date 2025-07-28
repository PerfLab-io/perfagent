import { convertToCoreMessages, createDataStream } from 'ai';
import { analyseInsightsForCWV } from '@/lib/insights';
import { z } from 'zod';
import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { stream } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { UserInteractionsData } from '@perflab/trace_engine/models/trace/handlers/UserInteractionsHandler';
import { mastra } from '@/lib/ai/mastra';
import { langfuse } from '@/lib/tools/langfuse';
import { routerOutputSchema } from '@/lib/ai/mastra/agents/router';
import dedent from 'dedent';
import { verifySession } from '@/lib/session.server';
import { db } from '@/drizzle/db';
import { mcpServers } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import {
	createUserMcpClient,
	getMcpServerInfo,
} from '@/lib/ai/mastra/mcpClient';
import { DEFAULT_MCP_SERVERS } from '@/lib/ai/defaultMCPServers';
import { createMcpAwareLargeAssistant } from '@/lib/ai/mastra/agents/largeAssistant';
import { createMcpAwareRouterAgent } from '@/lib/ai/mastra/agents/router';

export const runtime = 'nodejs';

// Define the request body schema
const requestSchema = z.object({
	messages: z.array(z.any()).default([]),
	files: z.array(z.any()).default([]),
	insights: z.any().default(null),
	userInteractions: z.any().default(null),
	model: z.string().default('default_model'),
	traceFile: z.any().default(null),
	inpInteractionAnimation: z.string().or(z.null()).default(null),
	aiContext: z.string().or(z.null()).default(null),
});

// Create Hono app for chat API
const chat = new Hono().basePath('/api');

// MCP Server management endpoints
// GET /api/mcp/servers - List user's MCP servers
chat.get('/mcp/servers', async (c) => {
	try {
		const sessionData = await verifySession();
		if (!sessionData) {
			return c.json({ error: 'Authentication required' }, 401);
		}

		const servers = await db
			.select()
			.from(mcpServers)
			.where(eq(mcpServers.userId, sessionData.userId));

		return c.json(servers);
	} catch (error) {
		console.error('Error fetching MCP servers:', error);
		return c.json({ error: 'Failed to fetch servers' }, 500);
	}
});

// POST /api/mcp/servers - Create a new MCP server
const createServerSchema = z.object({
	name: z.string().min(1),
	url: z.string().url(),
});

chat.post('/mcp/servers', zValidator('json', createServerSchema), async (c) => {
	try {
		const sessionData = await verifySession();
		if (!sessionData) {
			return c.json({ error: 'Authentication required' }, 401);
		}

		const { name, url } = c.req.valid('json');
		const serverId = crypto.randomUUID();

		await db.insert(mcpServers).values({
			id: serverId,
			userId: sessionData.userId,
			name,
			url,
			enabled: true,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});

		return c.json({ id: serverId, name, url, enabled: true });
	} catch (error) {
		console.error('Error creating MCP server:', error);
		return c.json({ error: 'Failed to create server' }, 500);
	}
});

// PATCH /api/mcp/servers/:id - Update a server
const updateServerSchema = z.object({
	name: z.string().min(1).optional(),
	enabled: z.boolean().optional(),
});

chat.patch(
	'/mcp/servers/:id',
	zValidator('json', updateServerSchema),
	async (c) => {
		try {
			const sessionData = await verifySession();
			if (!sessionData) {
				return c.json({ error: 'Authentication required' }, 401);
			}

			const serverId = c.req.param('id');
			const updates = c.req.valid('json');

			// Verify ownership
			const server = await db
				.select()
				.from(mcpServers)
				.where(
					and(
						eq(mcpServers.id, serverId),
						eq(mcpServers.userId, sessionData.userId),
					),
				)
				.limit(1);

			if (server.length === 0) {
				return c.json({ error: 'Server not found' }, 404);
			}

			await db
				.update(mcpServers)
				.set({
					...updates,
					updatedAt: new Date().toISOString(),
				})
				.where(eq(mcpServers.id, serverId));

			return c.json({ success: true });
		} catch (error) {
			console.error('Error updating MCP server:', error);
			return c.json({ error: 'Failed to update server' }, 500);
		}
	},
);

// GET /api/mcp/server-info/:id - Get server capabilities
chat.get('/mcp/server-info/:id', async (c) => {
	try {
		const sessionData = await verifySession();
		if (!sessionData) {
			return c.json({ error: 'Authentication required' }, 401);
		}

		const serverId = c.req.param('id');
		const serverInfo = await getMcpServerInfo(sessionData.userId, serverId);

		if (!serverInfo) {
			return c.json({ error: 'Server not found' }, 404);
		}

		return c.json(serverInfo);
	} catch (error) {
		console.error('Error fetching server info:', error);
		return c.json({ error: 'Failed to fetch server info' }, 500);
	}
});

// DELETE /api/mcp/servers/:id - Delete a server
chat.delete('/mcp/servers/:id', async (c) => {
	try {
		const sessionData = await verifySession();
		if (!sessionData) {
			return c.json({ error: 'Authentication required' }, 401);
		}

		const serverId = c.req.param('id');

		// Verify ownership before deletion
		const server = await db
			.select()
			.from(mcpServers)
			.where(
				and(
					eq(mcpServers.id, serverId),
					eq(mcpServers.userId, sessionData.userId),
				),
			)
			.limit(1);

		if (server.length === 0) {
			return c.json({ error: 'Server not found' }, 404);
		}

		await db.delete(mcpServers).where(eq(mcpServers.id, serverId));

		return c.json({ success: true });
	} catch (error) {
		console.error('Error deleting MCP server:', error);
		return c.json({ error: 'Failed to delete server' }, 500);
	}
});

// POST endpoint for chat
chat.post('/chat', zValidator('json', requestSchema), async (c) => {
	try {
		const body = c.req.valid('json');
		const messages = convertToCoreMessages(body.messages);
		const files = body.files;
		const insights: ReturnType<typeof analyseInsightsForCWV> = body.insights;
		const userInteractions: UserInteractionsData = body.userInteractions;
		const model = body.model;
		const traceFile = body.traceFile;
		const inpInteractionAnimation = body.inpInteractionAnimation;
		const aiContext = body.aiContext;

		if (messages.length === 0) {
			return c.json({ error: 'No messages provided' }, 400);
		}

		// Get MCP toolsets if user is authenticated
		let toolsets = {};
		let mcpClient = null;
		const sessionData = await verifySession();
		if (sessionData) {
			mcpClient = await createUserMcpClient(sessionData.userId);
			if (mcpClient) {
				try {
					toolsets = await mcpClient.getToolsets();
				} catch (error) {
					console.error('Error fetching MCP toolsets:', error);
				}
			}
		}

		const dataStream = createDataStream({
			execute: async (dataStreamWriter) => {
				dataStreamWriter.writeData('initialized call');

				// Use MCP-aware router if toolsets are available
				const routerAgent =
					toolsets && Object.keys(toolsets).length > 0
						? createMcpAwareRouterAgent(toolsets)
						: mastra.getAgent('routerAgent');

				const { object } = await routerAgent.generate(messages, {
					output: routerOutputSchema,
				});

				const smallAssistant = mastra.getAgent('smallAssistant');

				if (object.certainty < 0.5) {
					const stream = await smallAssistant.stream(
						[
							...messages,
							{
								role: 'assistant',
								content:
									'Unclear user request, I should kindly ask for clarification and steer the conversation back on track.',
							},
						],
						{
							toolsets,
						},
					);
					stream.mergeIntoDataStream(dataStreamWriter, {
						sendReasoning: true,
						sendSources: true,
					});
				} else {
					switch (object.workflow) {
						case 'cwvInsightsWorkflow':
							if (insights) {
								const insightsWorkflow = mastra.getWorkflow(
									'cwvInsightsWorkflow',
								);
								const run = insightsWorkflow.createRun();

								const unsubscribe = run.watch((event) => {
									console.log('========== event', event);
								});

								const _run = await run.start({
									inputData: {
										// @ts-expect-error - TODO: fix this type error
										insights,
										dataStream: dataStreamWriter,
										messages,
										inpInteractionAnimation,
										aiContext,
									},
								});

								unsubscribe();
							} else {
								const stream = await smallAssistant.stream(
									[
										...messages,
										{
											role: 'assistant',
											content:
												'User request is missing required data for analysis, I should kindly prompt the user to attach the trace json file containing the data to process the request. I should remind the user that I only process Google Chrome trace files and refer to the official blog post: https://developer.chrome.com/blog/devtools-tips-39?hl=en.',
										},
									],
									{
										toolsets,
									},
								);
								stream.mergeIntoDataStream(dataStreamWriter);
							}
							break;
						case 'researchWorkflow':
							const researchWorkflow = mastra.getWorkflow('researchWorkflow');
							const run = researchWorkflow.createRun();

							const unsubscribe = run.watch((event) => {
								console.log('========== event', event);
							});

							const _run = await run.start({
								inputData: {
									messages,
									dataStream: dataStreamWriter,
								},
							});

							unsubscribe();
							break;
						default:
							// Use MCP-aware agent if toolsets are available
							const agent =
								toolsets && Object.keys(toolsets).length > 0
									? createMcpAwareLargeAssistant(toolsets)
									: mastra.getAgent('largeAssistant');

							const stream = await agent.stream(messages, {
								toolsets,
							});
							stream.mergeIntoDataStream(dataStreamWriter, {
								sendReasoning: true,
								sendSources: true,
							});
							break;
					}
				}

				// Disconnect MCP client when done
				if (mcpClient) {
					try {
						await mcpClient.disconnect();
					} catch (error) {
						console.error('Error disconnecting MCP client:', error);
					}
				}
			},
			onError: (error) => {
				// Disconnect MCP client on error
				if (mcpClient) {
					try {
						mcpClient.disconnect();
					} catch (err) {
						console.error('Error disconnecting MCP client:', err);
					}
				}
				return error instanceof Error ? error.message : String(error);
			},
		});

		c.header('X-Vercel-AI-Data-Stream', 'v1');
		c.header('Content-Type', 'text/plain; charset=utf-8');

		try {
			await langfuse.flushAsync();
		} catch (e) {
			console.error(e);
		}

		return stream(c, (stream) =>
			stream.pipe(dataStream.pipeThrough(new TextEncoderStream())),
		);
	} catch (error) {
		console.error('Error in chat API:', error);

		if (error instanceof Error && error.name === 'AbortError') {
			// Return a specific status code for aborted requests
			console.log('Returning aborted response');
			// @ts-expect-error - 499 status code is not standard, but it refers for user cancellation
			return c.json({ error: 'Request aborted' }, 499);
		}
		return c.json(
			{
				error: 'Internal server error',
				message: error instanceof Error ? error.message : 'Unknown error',
			},
			500,
		);
	}
});

chat.post('/suggest', zValidator('json', requestSchema), async (c) => {
	const body = c.req.valid('json');

	const insights: ReturnType<typeof analyseInsightsForCWV> = body.insights;

	const suggestionsAssistant = mastra.getAgent('suggestionsAssistant');
	const stream = await suggestionsAssistant.generate(
		[
			{
				role: 'user',
				content: dedent`
					Here is the insights data:
					\`\`\`json
					${JSON.stringify(insights, null, 2)}
					\`\`\`
				`,
			},
		],
		{ output: z.array(z.string()).min(4).max(5) },
	);

	return c.json(stream.object);
});

export const GET = handle(chat);
export const POST = handle(chat);
export const PATCH = handle(chat);
export const DELETE = handle(chat);
