import { convertToCoreMessages, createDataStream } from 'ai';
import { analyseInsightsForCWV } from '@/lib/insights';
import { z } from 'zod';
import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { stream } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { mastra } from '@/lib/ai/mastra';
import { langfuse } from '@/lib/tools/langfuse';
import { routerOutputSchema } from '@/lib/ai/mastra/agents/router';
import dedent from 'dedent';
import { verifySession } from '@/lib/session.server';
import { db } from '@/drizzle/db';
import { mcpServers } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import {
	getMcpServerInfo,
	testMcpServerConnection,
} from '@/lib/ai/mastra/mcpClient';
import { exchangeOAuthCode } from '@/lib/ai/mastra/oauthExchange';

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
	toolApproval: z
		.object({
			approved: z.boolean(),
			toolCall: z.object({
				toolName: z.string(),
				arguments: z.record(z.any()),
				serverName: z.string(),
				reason: z.string(),
			}),
		})
		.optional(),
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
			authStatus: 'unknown', // Will be tested after creation
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});

		// Test the connection to detect OAuth requirements
		try {
			await testMcpServerConnection(sessionData.userId, serverId);
		} catch (error) {
			// If connection test fails, still return success but with unknown status
			console.log('Server connection test failed:', error);
		}

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

// POST /api/mcp/servers/:id/test - Test connection to MCP server
chat.post('/mcp/servers/:id/test', async (c) => {
	try {
		const sessionData = await verifySession();
		if (!sessionData) {
			return c.json({ error: 'Authentication required' }, 401);
		}

		const serverId = c.req.param('id');

		const result = await testMcpServerConnection(sessionData.userId, serverId);
		return c.json(result);
	} catch (error) {
		console.error('Error testing MCP server connection:', error);
		return c.json(
			{
				error: 'Connection test failed',
				message: error instanceof Error ? error.message : 'Unknown error',
			},
			500,
		);
	}
});

// OAuth callback endpoints

// GET /api/mcp/oauth/callback - Handle OAuth authorization callback
const oauthCallbackSchema = z.object({
	code: z.string(),
	state: z.string(),
	iss: z.string().optional(), // issuer parameter
});

chat.get(
	'/mcp/oauth/callback',
	zValidator('query', oauthCallbackSchema),
	async (c) => {
		try {
			const { code, state, iss } = c.req.valid('query');

			// Don't require authentication - validate using state and issuer instead

			// Find the server by matching the issuer and auth status
			// Since we don't have session data, we need to find all servers requiring auth that match the issuer
			const servers = await db
				.select()
				.from(mcpServers)
				.where(eq(mcpServers.authStatus, 'required'));

			let matchingServer = null;
			if (iss) {
				// Try to match by issuer URL
				matchingServer = servers.find((server) => {
					try {
						const serverUrl = new URL(server.url);
						const issuerUrl = new URL(iss);
						return serverUrl.origin === issuerUrl.origin;
					} catch {
						return false;
					}
				});
			}

			// If no issuer match, take the first server requiring auth (for backward compatibility)
			if (!matchingServer && servers.length > 0) {
				matchingServer = servers[0];
			}

			if (!matchingServer) {
				return c.html(`
					<html>
						<body>
							<h1>Authorization Error</h1>
							<p>No matching server found for this authorization callback.</p>
							<p><a href="/mcp-servers">Return to MCP Servers</a></p>
						</body>
					</html>
				`);
			}

			const serverRecord = matchingServer;

			try {
				console.log(
					`[OAuth] Processing authorization callback for ${serverRecord.name}`,
				);
				console.log(`[OAuth] Code: ${code}, State: ${state}`);

				// Exchange authorization code for tokens
				const tokenData = await exchangeOAuthCode(
					serverRecord.url,
					code,
					state,
				);

				// Calculate token expiration time
				const tokenExpiresAt = tokenData.expiresIn
					? new Date(Date.now() + tokenData.expiresIn * 1000)
					: undefined;

				// Update server with tokens and mark as authorized
				await db
					.update(mcpServers)
					.set({
						authStatus: 'authorized',
						accessToken: tokenData.accessToken,
						refreshToken: tokenData.refreshToken || null,
						tokenExpiresAt: tokenExpiresAt?.toISOString() || null,
						clientId: tokenData.clientId || null, // Save the successful client_id
						updatedAt: new Date().toISOString(),
					})
					.where(eq(mcpServers.id, serverRecord.id));

				console.log(
					`[OAuth] Successfully authorized ${serverRecord.name} with tokens`,
				);

				// Redirect to the MCP servers page with success message
				return c.html(`
					<html>
						<body>
							<h1>Authorization Successful</h1>
							<p>Successfully authorized access to ${serverRecord.name}!</p>
							<p><a href="/mcp-servers">Return to MCP Servers</a></p>
							<script>
								// Auto-redirect after 3 seconds
								setTimeout(() => {
									window.location.href = '/mcp-servers';
								}, 3000);
							</script>
						</body>
					</html>
				`);
			} catch (error) {
				console.error('OAuth callback error:', error);

				// Update server status to failed
				await db
					.update(mcpServers)
					.set({
						authStatus: 'failed',
						updatedAt: new Date().toISOString(),
					})
					.where(eq(mcpServers.id, serverRecord.id));

				return c.html(`
					<html>
						<body>
							<h1>Authorization Failed</h1>
							<p>Failed to authorize access to ${serverRecord.name}.</p>
							<p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
							<p><a href="/mcp-servers">Return to MCP Servers</a></p>
						</body>
					</html>
				`);
			}
		} catch (error) {
			console.error('OAuth callback error:', error);
			return c.html(`
				<html>
					<body>
						<h1>Authorization Error</h1>
						<p>An unexpected error occurred during authorization.</p>
						<p><a href="/mcp-servers">Return to MCP Servers</a></p>
					</body>
				</html>
			`);
		}
	},
);

// Also handle POST requests for OAuth callback (some OAuth servers use POST)
chat.post('/mcp/oauth/callback', async (c) => {
	try {
		// Don't require authentication - validate using state and issuer instead

		// Try to get parameters from query string first
		const url = new URL(c.req.url);
		let code = url.searchParams.get('code');
		let state = url.searchParams.get('state');
		let iss = url.searchParams.get('iss');

		// If not in query params, try to parse from body
		if (!code || !state) {
			try {
				const body = await c.req.text();
				if (!code) code = body.match(/code=([^&]+)/)?.[1] || null;
				if (!state) state = body.match(/state=([^&]+)/)?.[1] || null;
				if (!iss) iss = body.match(/iss=([^&]+)/)?.[1] || null;
			} catch (error) {
				console.log('Failed to parse body:', error);
			}
		}

		if (!code || !state) {
			return c.json({ error: 'Missing code or state parameter' }, 400);
		}

		// Find the server by matching the issuer and auth status
		const servers = await db
			.select()
			.from(mcpServers)
			.where(eq(mcpServers.authStatus, 'required'));

		let matchingServer = null;
		if (iss) {
			const decodedIss = decodeURIComponent(iss);
			matchingServer = servers.find((server) => {
				try {
					const serverUrl = new URL(server.url);
					const issuerUrl = new URL(decodedIss);
					return serverUrl.origin === issuerUrl.origin;
				} catch {
					return false;
				}
			});
		}

		if (!matchingServer && servers.length > 0) {
			matchingServer = servers[0];
		}

		if (!matchingServer) {
			return c.html(`
				<html>
					<body>
						<h1>Authorization Error</h1>
						<p>No matching server found for this authorization callback.</p>
						<p><a href="/mcp-servers">Return to MCP Servers</a></p>
					</body>
				</html>
			`);
		}

		const serverRecord = matchingServer;

		try {
			console.log(
				`[OAuth] Processing authorization callback for ${serverRecord.name}`,
			);
			console.log(`[OAuth] Code: ${code}, State: ${state}`);

			// Exchange authorization code for tokens
			const tokenData = await exchangeOAuthCode(serverRecord.url, code, state);

			// Calculate token expiration time
			const tokenExpiresAt = tokenData.expiresIn
				? new Date(Date.now() + tokenData.expiresIn * 1000)
				: undefined;

			// Update server with tokens and mark as authorized
			await db
				.update(mcpServers)
				.set({
					authStatus: 'authorized',
					accessToken: tokenData.accessToken,
					refreshToken: tokenData.refreshToken || null,
					tokenExpiresAt: tokenExpiresAt?.toISOString() || null,
					clientId: tokenData.clientId || null, // Save the successful client_id
					updatedAt: new Date().toISOString(),
				})
				.where(eq(mcpServers.id, serverRecord.id));

			console.log(
				`[OAuth] Successfully authorized ${serverRecord.name} with tokens`,
			);

			// Redirect to the MCP servers page with success message
			return c.html(`
				<html>
					<body>
						<h1>Authorization Successful</h1>
						<p>Successfully authorized access to ${serverRecord.name}!</p>
						<p><a href="/mcp-servers">Return to MCP Servers</a></p>
						<script>
							// Auto-redirect after 3 seconds
							setTimeout(() => {
								window.location.href = '/mcp-servers';
							}, 3000);
						</script>
					</body>
				</html>
			`);
		} catch (error) {
			console.error('OAuth callback error:', error);

			// Update server status to failed
			await db
				.update(mcpServers)
				.set({
					authStatus: 'failed',
					updatedAt: new Date().toISOString(),
				})
				.where(eq(mcpServers.id, serverRecord.id));

			return c.html(`
				<html>
					<body>
						<h1>Authorization Failed</h1>
						<p>Failed to authorize access to ${serverRecord.name}.</p>
						<p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
						<p><a href="/mcp-servers">Return to MCP Servers</a></p>
					</body>
				</html>
			`);
		}
	} catch (error) {
		console.error('OAuth callback error:', error);
		return c.html(`
			<html>
				<body>
					<h1>Authorization Error</h1>
					<p>An unexpected error occurred during authorization.</p>
					<p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
					<p><a href="/mcp-servers">Return to MCP Servers</a></p>
				</body>
			</html>
		`);
	}
});

// POST endpoint for chat
chat.post('/chat', zValidator('json', requestSchema), async (c) => {
	try {
		const body = c.req.valid('json');
		const messages = convertToCoreMessages(body.messages);
		const insights: ReturnType<typeof analyseInsightsForCWV> = body.insights;
		const inpInteractionAnimation = body.inpInteractionAnimation;
		const aiContext = body.aiContext;
		const toolApproval = body.toolApproval;

		if (messages.length === 0) {
			return c.json({ error: 'No messages provided' }, 400);
		}

		const sessionData = await verifySession();

		const dataStream = createDataStream({
			execute: async (dataStreamWriter) => {
				dataStreamWriter.writeData('initialized call');

				if (toolApproval && sessionData) {
					const mcpWorkflow = mastra.getWorkflow('mcpWorkflow');
					const run = mcpWorkflow.createRun();

					const unsubscribe = run.watch((event) => {
						console.log('========== MCP workflow execution event', event);
					});

					if (toolApproval.approved) {
						await run.start({
							inputData: {
								messages,
								userId: sessionData.userId,
								action: 'execute',
								toolCallRequest: toolApproval.toolCall,
								dataStream: dataStreamWriter,
							},
						});
					} else {
						dataStreamWriter.writeData({
							type: 'tool-call-approval',
							runId: run.runId,
							status: 'completed',
							content: {
								type: 'tool-call-approval',
								data: {
									toolCall: toolApproval.toolCall,
									status: 'denied',
									title: 'Tool Call Denied',
									timestamp: Date.now(),
								},
							},
						});

						const agent = mastra.getAgent('smallAssistant');
						const stream = await agent.stream([
							...messages,
							{
								role: 'assistant',
								content:
									'Tool call denied by user. I should ask the user if I should try with a different tool or ask for clarification.',
							},
						]);
						stream.mergeIntoDataStream(dataStreamWriter);
					}

					unsubscribe();
					return;
				}

				const routerAgent = mastra.getAgent('routerAgent');

				const { object } = await routerAgent.generate(messages, {
					output: routerOutputSchema,
				});

				const smallAssistant = mastra.getAgent('smallAssistant');

				if (object.certainty < 0.5 && object.workflow !== 'mcpWorkflow') {
					const stream = await smallAssistant.stream([
						...messages,
						{
							role: 'assistant',
							content:
								'Unclear user request, I should kindly ask for clarification and steer the conversation back on track.',
						},
					]);
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

								await run.start({
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
								const stream = await smallAssistant.stream([
									...messages,
									{
										role: 'assistant',
										content:
											'User request is missing required data for analysis, I should kindly prompt the user to attach the trace json file containing the data to process the request. I should remind the user that I only process Google Chrome trace files and refer to the official blog post: https://developer.chrome.com/blog/devtools-tips-39?hl=en.',
									},
								]);
								stream.mergeIntoDataStream(dataStreamWriter);
							}
							break;
						case 'researchWorkflow':
							const researchWorkflow = mastra.getWorkflow('researchWorkflow');
							const run = researchWorkflow.createRun();

							const unsubscribe = run.watch((event) => {
								console.log('========== event', event);
							});

							await run.start({
								inputData: {
									messages,
									dataStream: dataStreamWriter,
								},
							});

							unsubscribe();
							break;
						case 'mcpWorkflow':
							if (sessionData) {
								const mcpWorkflow = mastra.getWorkflow('mcpWorkflow');
								const run = mcpWorkflow.createRun();

								const unsubscribe = run.watch((event) => {
									console.log('========== MCP workflow event', event);
								});

								const stream = run.streamVNext({
									inputData: {
										messages,
										userId: sessionData.userId,
										action: 'discover',
										dataStream: dataStreamWriter,
									},
								});

								for await (const chunk of stream) {
									dataStreamWriter.writeData(chunk);
								}

								unsubscribe();
							} else {
								// If no session, use regular assistant
								const stream = await mastra.getAgent('largeAssistant').stream([
									...messages,
									{
										role: 'assistant',
										content:
											'External tool integration requires authentication. Please log in to access MCP tools.',
									},
								]);
								stream.mergeIntoDataStream(dataStreamWriter);
							}
							break;
						default:
							// Use standard large assistant for general queries
							const stream = await mastra
								.getAgent('largeAssistant')
								.stream(messages);
							stream.mergeIntoDataStream(dataStreamWriter, {
								sendReasoning: true,
								sendSources: true,
							});
							break;
					}
				}
			},
			onError: (error) => {
				console.error('Error in chat API:', error);
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
			stream
				.pipe(dataStream.pipeThrough(new TextEncoderStream()))
				.catch((error) => {
					console.error('Error in chat API:', error);
					throw error;
				})
				.finally(async () => {
					// Cleanup completed
				}),
		);
	} catch (error) {
		console.error('Error in chat API:', error);

		if (error instanceof Error && error.name === 'AbortError') {
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
