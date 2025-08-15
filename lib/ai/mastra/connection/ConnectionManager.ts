/**
 * Connection Manager - Unified interface for MCP operations
 * Orchestrates authentication, caching, and server communication
 */
import { AuthManager } from '@/lib/ai/mastra/auth/AuthManager';
import { getMcpServerInfo } from '@/lib/ai/mastra/capabilities';
import { testMcpServerConnection } from '@/lib/ai/mastra/connectivity';
import {
	mcpToolCache,
	mcpOAuthCache,
	type ToolCacheEntry,
} from '@/lib/ai/mastra/cache/MCPCache';
import { db } from '@/drizzle/db';
import { mcpServers } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { telemetryService } from '@/lib/ai/mastra/monitoring/TelemetryService';
import { performance } from 'node:perf_hooks';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { ensureFreshToken } from '@/lib/ai/mastra/oauth/tokens';
import { TOKEN_EXPIRY_SKEW_MS } from '@/lib/ai/mastra/config';

interface ServerCapabilities {
	tools?: any;
	resources?: any;
	prompts?: any;
	rootListChanged?: boolean;
}

interface ConnectionResult {
	success: boolean;
	capabilities?: ServerCapabilities;
	tools?: any[]; // Use flexible array type to handle both ToolMetadata and raw MCP tools
	result?: any; // For tool execution results
	error?: string;
	requiresAuth?: boolean;
	authUrl?: string;
	fromCache?: boolean;
}

// Live connection status - in-memory only
interface LiveConnectionStatus {
	status: 'connected' | 'disconnected' | 'testing' | 'unknown';
	lastTested: Date;
	lastSuccess?: Date;
	error?: string;
	pingSupported?: boolean;
}

interface PingResult {
	supported: boolean;
	success: boolean;
	error?: string;
	latency?: number;
}

interface MCPRequest {
	jsonrpc: '2.0';
	id: number;
	method: string;
	params?: any;
}

interface MCPResponse {
	jsonrpc: '2.0';
	id: number;
	result?: any;
	error?: {
		code: number;
		message: string;
		data?: any;
	};
}

/**
 * Manages MCP server connections with authentication, caching, and error handling
 * Per approved plan:
 * - Live connection status (in-memory only, NOT in KV)
 * - KV cache only for capabilities (2h TTL)
 * - Optional MCP ping with thorough fallback
 * - Preserves existing OAuth logic for CF Observability
 */
export class ConnectionManager {
	private authManager: AuthManager;
	private liveConnectionStatus = new Map<string, LiveConnectionStatus>();
	private httpSessions = new Map<string, string>();

	private async ensureHttpSession(
		serverId: string,
		serverUrl: string,
		accessToken: string,
	): Promise<string | undefined> {
		try {
			const initReq: MCPRequest = {
				jsonrpc: '2.0',
				id: Date.now(),
				method: 'initialize',
				params: {
					protocolVersion: '2024-11-05',
					capabilities: {},
					clientInfo: { name: 'PerfAgent', version: '1.0.0' },
				},
			};

			const headers: Record<string, string> = {
				'Content-Type': 'application/json',
				Accept: 'application/json, text/event-stream',
				'User-Agent': 'PerfAgent/1.0.0 MCP-Client',
			};

			if (accessToken && accessToken.trim()) {
				headers.Authorization = `Bearer ${accessToken}`;
			}

			const resp = await fetch(serverUrl, {
				method: 'POST',
				headers,
				body: JSON.stringify(initReq),
			});

			if (!resp.ok) return undefined;

			const sess = resp.headers.get('Mcp-Session-Id') || undefined;

			if (sess) this.httpSessions.set(serverId, sess);

			return sess;
		} catch {
			return undefined;
		}
	}

	constructor(authManager?: AuthManager) {
		this.authManager = authManager || new AuthManager();
	}

	/**
	 * Get server capabilities and tools with caching
	 * Uses existing getMcpServerInfo to preserve CF Observability OAuth logic
	 */
	async getServerCapabilities(
		serverId: string,
		userId: string,
	): Promise<ConnectionResult> {
		console.log(
			`[Connection Manager] Getting capabilities for server ${serverId}`,
		);

		performance.mark('listResourcesStart');

		try {
			const cached = await mcpToolCache.getServerTools(serverId);
			if (cached) {
				console.log(
					`[Connection Manager] Using cached capabilities for server ${serverId}`,
				);
				this.updateLiveStatus(serverId, {
					status: 'connected',
					lastTested: new Date(cached.cachedAt),
					lastSuccess: new Date(cached.cachedAt),
				});

				const resourceCount =
					(cached.tools?.length || 0) +
					(Array.isArray(cached.capabilities?.resources)
						? cached.capabilities.resources.length
						: 0) +
					(Array.isArray(cached.capabilities?.prompts)
						? cached.capabilities.prompts.length
						: 0);

				const duration = performance.measure(
					'listResources',
					'listResourcesStart',
				).duration;

				telemetryService.trackClientListResources(resourceCount, duration);
				performance.clearMarks('listResourcesStart');
				performance.clearMeasures('listResources');

				return {
					success: true,
					capabilities: cached.capabilities,
					tools: cached.tools,
					fromCache: true,
				};
			}

			const connectionHealthy = await this.testLiveConnection(serverId, userId);

			if (!connectionHealthy) {
				const status = this.liveConnectionStatus.get(serverId);

				const duration = performance.measure(
					'listResources',
					'listResourcesStart',
				).duration;

				telemetryService.trackClientListResources(0, duration);
				performance.clearMarks('listResourcesStart');
				performance.clearMeasures('listResources');

				return {
					success: false,
					error: status?.error || 'Connection test failed',
					requiresAuth:
						status?.error?.includes('401') ||
						status?.error?.includes('Authentication'),
				};
			}

			const result = await getMcpServerInfo(userId, serverId);

			if (result && result.server) {
				const tools: any[] = [];
				if (result.toolsets && typeof result.toolsets === 'object') {
					Object.values(result.toolsets).forEach((toolset: any) => {
						if (Array.isArray(toolset)) {
							tools.push(...toolset);
						}
					});
				}

				const resourceCount =
					tools.length +
					(Array.isArray(result.resources) ? result.resources.length : 0) +
					(Array.isArray(result.prompts) ? result.prompts.length : 0);

				const duration = performance.measure(
					'listResources',
					'listResourcesStart',
				).duration;

				telemetryService.trackClientListResources(resourceCount, duration);
				performance.clearMarks('listResourcesStart');
				performance.clearMeasures('listResources');

				const cacheEntry: ToolCacheEntry = {
					tools,
					capabilities: {
						tools: result.toolsets,
						resources: result.resources,
						prompts: result.prompts,
					},
					cachedAt: new Date().toISOString(),
					serverUrl: result.server.url,
				};

				await mcpToolCache.cacheServerTools(serverId, cacheEntry);

				this.updateLiveStatus(serverId, {
					status: 'connected',
					lastTested: new Date(),
					lastSuccess: new Date(),
				});

				return {
					success: true,
					capabilities: {
						tools: result.toolsets,
						resources: result.resources,
						prompts: result.prompts,
					},
					tools,
					fromCache: false,
				};
			} else {
				this.updateLiveStatus(serverId, {
					status: 'disconnected',
					lastTested: new Date(),
					error: 'Failed to get server info',
				});

				const duration = performance.measure(
					'listResources',
					'listResourcesStart',
				).duration;

				telemetryService.trackClientListResources(0, duration);
				performance.clearMarks('listResourcesStart');
				performance.clearMeasures('listResources');

				return {
					success: false,
					error:
						'Failed to get server capabilities - server not found or connection failed',
					requiresAuth: true, // Assume auth required when getMcpServerInfo returns null
				};
			}
		} catch (error) {
			console.error(
				`[Connection Manager] Error getting capabilities for server ${serverId}:`,
				error,
			);

			const duration = performance.measure(
				'listResources',
				'listResourcesStart',
			).duration;

			telemetryService.trackClientListResources(0, duration);
			performance.clearMarks('listResourcesStart');
			performance.clearMeasures('listResources');

			this.updateLiveStatus(serverId, {
				status: 'disconnected',
				lastTested: new Date(),
				error: error instanceof Error ? error.message : 'Unknown error',
			});
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	/**
	 * Execute a tool call on a specific server
	 */
	async executeToolCall(
		serverId: string,
		userId: string,
		toolName: string,
		arguments_: any,
	): Promise<ConnectionResult> {
		console.log(
			`[Connection Manager] Executing tool ${toolName} on server ${serverId}`,
		);

		try {
			const server = await this.getServerRecord(serverId, userId);

			if (!server) {
				return {
					success: false,
					error: `Server ${serverId} not found`,
				};
			}

			let effectiveServer: any = { ...server };

			console.log(`[Connection Manager] Server record for ${serverId}:`, {
				name: server.name,
				url: server.url,
				authStatus: server.authStatus,
				hasAccessToken: !!server.accessToken,
				tokenLength: server.accessToken?.length || 0,
			});

			if (
				server.authStatus === 'required' ||
				server.authStatus === 'authorized'
			) {
				const authResult = await this.authManager.ensureAuthenticated(
					serverId,
					userId,
				);

				console.log(
					`[Connection Manager] Auth result for server ${serverId}:`,
					{
						status: authResult.status,
						hasAuthUrl: !!authResult.authUrl,
						error: authResult.error,
					},
				);

				if (authResult.status !== 'authenticated') {
					return {
						success: false,
						requiresAuth: true,
						authUrl: authResult.authUrl,
						error: authResult.error || 'Authentication required',
					};
				}
			} else {
				console.log(
					`[Connection Manager] Server ${serverId} doesn't require authentication (status: ${server.authStatus})`,
				);
			}

			// Determine transport with robust SSE detection
			const rawPath = new URL(effectiveServer.url).pathname;
			const normalizedPath = rawPath.replace(/\/+$/, '').toLowerCase();
			const isSseEndpoint =
				normalizedPath === '/sse' || normalizedPath.endsWith('/events');

			console.log(`[Connection Manager] Transport detection`, {
				url: effectiveServer.url,
				rawPath,
				normalizedPath,
				isSseEndpoint,
				transport: isSseEndpoint ? 'SSE' : 'HTTP',
			});

			if (isSseEndpoint) {
				// Ensure fresh token before opening SSE connection (reduce 403 risk)
				try {
					if (
						effectiveServer.authStatus === 'authorized' &&
						effectiveServer.accessToken
					) {
						const ensured = await ensureFreshToken(
							effectiveServer,
							serverId,
							userId,
							{ preemptiveWindowMs: TOKEN_EXPIRY_SKEW_MS, validate: true },
						);
						if (ensured?.updatedServerRecord) {
							effectiveServer = {
								...effectiveServer,
								...ensured.updatedServerRecord,
							};
						}
					}
				} catch (e) {
					console.log(
						'[Connection Manager] Token ensure failed before SSE, proceeding with current token',
						e,
					);
				}

				// For SSE servers, we need to use the MCP client instead of direct HTTP
				return await this.executeToolViaClient(
					effectiveServer,
					userId,
					toolName,
					arguments_,
				);
			} else {
				// For HTTP servers, use direct POST request
				// Ensure Streamable HTTP session if server supports it
				let sessionId = this.httpSessions.get(serverId);

				if (!sessionId) {
					try {
						sessionId = await (this as any).ensureHttpSession(
							serverId,
							effectiveServer.url,
							effectiveServer.accessToken || '',
						);
					} catch {}
				}

				const result = await this.makeToolCallRequest(
					effectiveServer.url,
					effectiveServer.accessToken || '', // Use empty string if no token
					toolName,
					arguments_,
					sessionId,
					serverId,
				);

				return result;
			}
		} catch (error) {
			console.error(
				`[Connection Manager] Error executing tool ${toolName} on server ${serverId}:`,
				error,
			);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	/**
	 * Test server connection with optional MCP ping and thorough fallback
	 * Updates live connection status (in-memory only per plan)
	 */
	async testConnection(
		serverId: string,
		userId: string,
	): Promise<ConnectionResult> {
		console.log(
			`[Connection Manager] Testing connection to server ${serverId}`,
		);

		const success = await this.testLiveConnection(serverId, userId);
		const status = this.liveConnectionStatus.get(serverId);

		return {
			success,
			error: success ? undefined : status?.error || 'Connection test failed',
			requiresAuth:
				status?.error?.includes('401') ||
				status?.error?.includes('Authentication'),
		};
	}

	/**
	 * Invalidate cache for a specific server
	 */
	async invalidateServerCache(serverId: string): Promise<void> {
		console.log(
			`[Connection Manager] Invalidating cache for server ${serverId}`,
		);
		await Promise.all([
			mcpToolCache.invalidateServer(serverId),
			mcpOAuthCache.invalidateToken(serverId),
		]);
	}

	/**
	 * Get cache statistics
	 */
	async getCacheStats() {
		const [toolStats, oauthStats] = await Promise.all([
			mcpToolCache.getCacheStats(),
			mcpOAuthCache.getCacheStats(),
		]);

		return {
			tools: toolStats,
			oauth: oauthStats,
			auth: this.authManager.getCacheStats(),
		};
	}

	private async fetchServerCapabilities(
		serverUrl: string,
		accessToken: string,
	): Promise<ConnectionResult> {
		const response = await this.makeRequest(serverUrl, accessToken, {
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: {
				protocolVersion: '2024-11-05',
				capabilities: {},
				clientInfo: {
					name: 'PerfAgent',
					version: '1.0.0',
				},
			},
		});

		if (!response.success || !response.result) {
			return response;
		}

		const toolsResponse = await this.makeRequest(serverUrl, accessToken, {
			jsonrpc: '2.0',
			id: 2,
			method: 'tools/list',
			params: {},
		});

		if (!toolsResponse.success) {
			return toolsResponse;
		}

		const capabilities: ServerCapabilities = {
			tools: toolsResponse.result?.tools || [],
			...response.result?.capabilities,
		};

		return {
			success: true,
			capabilities,
		};
	}

	private async makeToolCallRequest(
		serverUrl: string,
		accessToken: string,
		toolName: string,
		arguments_: any,
		sessionId?: string,
		serverIdForSession?: string,
	): Promise<ConnectionResult> {
		const response = await this.makeRequest(
			serverUrl,
			accessToken,
			{
				jsonrpc: '2.0',
				id: Date.now(),
				method: 'tools/call',
				params: {
					name: toolName,
					arguments: arguments_,
				},
			},
			sessionId,
			serverIdForSession,
		);

		return response;
	}

	private async executeToolViaClient(
		server: any,
		userId: string,
		toolName: string,
		arguments_: any,
	): Promise<ConnectionResult> {
		console.log(
			`[Connection Manager] Executing tool ${toolName} for SSE server ${server.name} using MCP SDK`,
		);

		let transport: SSEClientTransport | null = null;
		let client: Client | null = null;

		try {
			// Create SSE transport for the SSE server
			const headers: Record<string, string> = {};
			if (server.accessToken) {
				headers.Authorization = `Bearer ${server.accessToken}`;
			}

			// Build EventSource options with auth header injection for SSE
			const eventSourceInit: any = { withCredentials: false };
			if (server.accessToken) {
				eventSourceInit.fetch = (input: any, init?: RequestInit) => {
					const h = new Headers(init?.headers || {});
					h.set('Authorization', `Bearer ${server.accessToken}`);
					return fetch(input as any, { ...(init || {}), headers: h });
				};

				// Also set headers for transports that honor eventSourceInit.headers directly
				eventSourceInit.headers = {
					Authorization: `Bearer ${server.accessToken}`,
				};
			}

			transport = new SSEClientTransport(new URL(server.url), {
				requestInit: { headers },
				eventSourceInit,
			});

			client = new Client(
				{
					name: 'PerfAgent',
					version: '1.0.0',
				},
				{
					capabilities: {},
				},
			);

			await client.connect(transport);

			const result = await client.callTool(
				{
					name: toolName,
					arguments: arguments_,
				},
				CallToolResultSchema,
				{
					timeout: 60000, // 60 second timeout
				},
			);

			console.log(
				`[Connection Manager] Successfully executed tool ${toolName} via MCP SDK`,
			);

			this.updateLiveStatus(server.id, {
				status: 'connected',
				lastTested: new Date(),
				lastSuccess: new Date(),
			});

			return {
				success: true,
				result: result,
			};
		} catch (error) {
			console.error(
				`[Connection Manager] Error executing tool ${toolName} via MCP SDK:`,
				error,
			);

			this.updateLiveStatus(server.id, {
				status: 'disconnected',
				lastTested: new Date(),
				error: error instanceof Error ? error.message : 'Unknown error',
			});

			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		} finally {
			if (client) {
				await client.close();
			}
			if (transport) {
				await transport.close();
			}
		}
	}

	private async makeRequest(
		serverUrl: string,
		accessToken: string,
		request: MCPRequest,
		sessionId?: string,
		serverIdForSession?: string,
	): Promise<ConnectionResult & { result?: any }> {
		console.log(`[Connection Manager] Making request to ${serverUrl}`);
		console.log(`[Connection Manager] Request method: ${request.method}`);
		console.log(`[Connection Manager] Has access token: ${!!accessToken}`);

		try {
			const headers: Record<string, string> = {
				'Content-Type': 'application/json',
				Accept: 'application/json, text/event-stream',
				'User-Agent': 'PerfAgent/1.0.0 MCP-Client',
			};

			// Attach Streamable HTTP session if available
			if (sessionId) {
				headers['Mcp-Session-Id'] = sessionId;
			}

			// Only add Authorization header if we have a token
			if (accessToken && accessToken.trim()) {
				headers.Authorization = `Bearer ${accessToken}`;
				console.log(
					`[Connection Manager] Adding Authorization header with token length: ${accessToken.length}`,
				);
			} else {
				console.log(
					`[Connection Manager] No access token provided, skipping Authorization header`,
				);
			}

			const response = await fetch(serverUrl, {
				method: 'POST',
				headers,
				body: JSON.stringify(request),
			});

			console.log(
				`[Connection Manager] Response status: ${response.status} ${response.statusText}`,
			);
			console.log(
				`[Connection Manager] Response headers:`,
				Object.fromEntries(response.headers.entries()),
			);

			if (!response.ok) {
				if (response.status === 401) {
					console.log(
						`[Connection Manager] 401 Unauthorized - may need authentication`,
					);
					return {
						success: false,
						requiresAuth: true,
						error: 'Authentication failed - token may be expired',
					};
				}

				if (response.status === 406) {
					console.log(
						`[Connection Manager] Got 406 Not Acceptable, trying fallback`,
					);

					// Try with different Accept header if not already tried
					if (headers.Accept !== '*/*') {
						console.log(`[Connection Manager] Retrying with Accept: */*`);
						const retryHeaders = { ...headers, Accept: '*/*' };

						try {
							const retryResponse = await fetch(serverUrl, {
								method: 'POST',
								headers: retryHeaders,
								body: JSON.stringify(request),
							});

							console.log(
								`[Connection Manager] Retry response status: ${retryResponse.status}`,
							);

							if (retryResponse.ok) {
								console.log(
									`[Connection Manager] Retry succeeded with Accept: */*`,
								);
								const retryContentType =
									retryResponse.headers.get('content-type')?.toLowerCase() ||
									'';
								if (retryContentType.includes('text/event-stream')) {
									const sseResult = await this.readSseJsonRpcResponse(
										retryResponse,
										request.id,
										serverIdForSession,
									);
									if ((sseResult as any).error) {
										return {
											success: false,
											error: (sseResult as any).error?.message || 'MCP Error',
										};
									}
									return { success: true, result: (sseResult as any).result };
								}
								const mcpResponse: MCPResponse = await retryResponse.json();
								if (mcpResponse.error) {
									return {
										success: false,
										error: `MCP Error ${mcpResponse.error.code}: ${mcpResponse.error.message}`,
									};
								}
								return {
									success: true,
									result: mcpResponse.result,
								};
							} else {
								console.log(
									`[Connection Manager] Retry also failed with status: ${retryResponse.status}`,
								);

								// Try a third attempt with minimal headers for very picky servers
								if (retryResponse.status === 406) {
									console.log(
										`[Connection Manager] Trying minimal headers approach`,
									);
									const minimalHeaders: Record<string, string> = {
										'Content-Type': 'application/json',
									};

									// Only add auth if we have it
									if (accessToken && accessToken.trim()) {
										minimalHeaders.Authorization = `Bearer ${accessToken}`;
									}

									try {
										const minimalResponse = await fetch(serverUrl, {
											method: 'POST',
											headers: minimalHeaders,
											body: JSON.stringify(request),
										});

										console.log(
											`[Connection Manager] Minimal headers response status: ${minimalResponse.status}`,
										);

										if (minimalResponse.ok) {
											console.log(
												`[Connection Manager] Success with minimal headers`,
											);
											const minimalContentType =
												minimalResponse.headers
													.get('content-type')
													?.toLowerCase() || '';
											if (minimalContentType.includes('text/event-stream')) {
												const sseResult = await this.readSseJsonRpcResponse(
													minimalResponse,
													request.id,
													serverIdForSession,
												);
												if ((sseResult as any).error) {
													return {
														success: false,
														error:
															(sseResult as any).error?.message || 'MCP Error',
													};
												}
												return {
													success: true,
													result: (sseResult as any).result,
												};
											}
											const mcpResponse: MCPResponse =
												await minimalResponse.json();
											if (mcpResponse.error) {
												return {
													success: false,
													error: `MCP Error ${mcpResponse.error.code}: ${mcpResponse.error.message}`,
												};
											}
											return {
												success: true,
												result: mcpResponse.result,
											};
										}
									} catch (minimalError) {
										console.log(
											`[Connection Manager] Minimal headers request failed:`,
											minimalError,
										);
									}
								}

								// Try to read the original 406 response for more info
								try {
									const originalResponseText = await response.text();
									console.log(
										`[Connection Manager] Original 406 response body:`,
										originalResponseText,
									);
								} catch (e) {
									console.log(
										`[Connection Manager] Could not read original 406 response`,
									);
								}
							}
						} catch (retryError) {
							console.log(
								`[Connection Manager] Retry request failed:`,
								retryError,
							);
						}
					}
				}

				// If session was attached and server returns 404, clear and allow caller to re-init
				if (response.status === 404 && sessionId) {
					console.log(
						'[Connection Manager] 404 with session; clearing cached Mcp-Session-Id',
					);
					if (serverIdForSession) {
						this.httpSessions.delete(serverIdForSession);
					} else {
						this.httpSessions.clear();
					}
				}

				return {
					success: false,
					error: `HTTP ${response.status}: ${response.statusText}`,
				};
			}

			// Handle JSON vs SSE response per Streamable HTTP
			const contentType =
				response.headers.get('content-type')?.toLowerCase() || '';

			if (contentType.includes('text/event-stream')) {
				const sseResult = await this.readSseJsonRpcResponse(
					response,
					request.id,
					serverIdForSession,
				);

				if ((sseResult as any).error) {
					return {
						success: false,
						error: (sseResult as any).error?.message || 'MCP Error',
					};
				}

				return { success: true, result: (sseResult as any).result };
			}

			const mcpResponse: MCPResponse = await response.json();

			if (mcpResponse.error) {
				return {
					success: false,
					error: `MCP Error ${mcpResponse.error.code}: ${mcpResponse.error.message}`,
				};
			}

			return { success: true, result: mcpResponse.result };
		} catch (error) {
			console.error(
				`[Connection Manager] Network error for ${serverUrl}:`,
				error,
			);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Network error',
			};
		}
	}

	// Reads a Streamable HTTP SSE response and returns the merged/batched JSON-RPC result for the given request id
	private async readSseJsonRpcResponse(
		response: Response,
		requestId: number,
		serverIdForSession?: string,
	): Promise<{ result?: any; error?: { code?: number; message?: string } }> {
		// Collect SSE lines and parse only JSON data events
		const reader = (response.body as any)?.getReader?.();

		if (!reader) {
			// Fallback: try text() and split
			const text = await response.text();
			return this.parseSseTextForJsonRpc(text, requestId);
		}

		let buffer = '';
		let done = false;

		while (!done) {
			const { value, done: rdone } = await reader.read();
			done = rdone;

			if (value) buffer += new TextDecoder().decode(value);

			// Try to parse complete events whenever we have double newlines
			const parts = buffer.split('\n\n');
			buffer = parts.pop() || '';

			for (const part of parts) {
				const parsed = this.parseSseEvent(part);

				if (!parsed) continue;

				const { event, data } = parsed;

				if (event === 'message' || event === undefined) {
					try {
						const obj = JSON.parse(data);

						// Handle both single and batched JSON-RPC
						if (Array.isArray(obj)) {
							for (const item of obj) {
								if (item.id === requestId && (item.result || item.error)) {
									return { result: item.result, error: item.error };
								}
							}
						} else if (
							obj &&
							obj.id === requestId &&
							(obj.result || obj.error)
						) {
							return { result: obj.result, error: obj.error };
						}
					} catch {}
				}
			}
		}

		// If we reached here, we did not find a matching response
		return { error: { message: 'Missing JSON-RPC response on SSE stream' } };
	}

	private parseSseEvent(
		chunk: string,
	): { event?: string; data: string } | null {
		let event: string | undefined;
		let data = '';

		for (const line of chunk.split('\n')) {
			if (line.startsWith('event:')) {
				event = line.slice(6).trim();
			} else if (line.startsWith('data:')) {
				data += (data ? '\n' : '') + line.slice(5).trim();
			}
		}

		if (!data) return null;

		return { event, data };
	}

	private parseSseTextForJsonRpc(
		text: string,
		requestId: number,
	): { result?: any; error?: { code?: number; message?: string } } {
		const chunks = text.split('\n\n');

		for (const chunk of chunks) {
			const evt = this.parseSseEvent(chunk);

			if (!evt) continue;

			try {
				const obj = JSON.parse(evt.data);

				if (Array.isArray(obj)) {
					for (const item of obj) {
						if (item.id === requestId && (item.result || item.error)) {
							return { result: item.result, error: item.error };
						}
					}
				} else if (obj && obj.id === requestId && (obj.result || obj.error)) {
					return { result: obj.result, error: obj.error };
				}
			} catch {}
		}

		return { error: { message: 'Missing JSON-RPC response on SSE stream' } };
	}

	private extractToolsFromCapabilities(
		capabilities: ServerCapabilities,
	): any[] {
		if (!capabilities.tools) return [];

		// Handle different formats of tools structure from MCP servers
		if (Array.isArray(capabilities.tools)) {
			return capabilities.tools.map((tool: any) => ({
				name: tool.name,
				description: tool.description || '',
				inputSchema: tool.inputSchema || {},
				// Map other tool properties as needed
			}));
		} else if (typeof capabilities.tools === 'object') {
			// Handle case where tools is an object with server names as keys
			const tools: any[] = [];

			Object.values(capabilities.tools).forEach((toolset: any) => {
				if (Array.isArray(toolset)) {
					tools.push(
						...toolset.map((tool: any) => ({
							name: tool.name,
							description: tool.description || '',
							inputSchema: tool.inputSchema || {},
						})),
					);
				}
			});

			return tools;
		}

		return [];
	}

	private async getServerRecord(serverId: string, userId: string) {
		const servers = await db
			.select()
			.from(mcpServers)
			.where(and(eq(mcpServers.id, serverId), eq(mcpServers.userId, userId)))
			.limit(1);

		return servers[0] || null;
	}

	/**
	 * Get live connection status (in-memory only per plan)
	 */
	getLiveConnectionStatus(serverId: string): LiveConnectionStatus | null {
		return this.liveConnectionStatus.get(serverId) || null;
	}

	/**
	 * Test live connection with optional ping and thorough fallback
	 * Updates in-memory status, does NOT store in KV per plan
	 */
	private async testLiveConnection(
		serverId: string,
		userId: string,
	): Promise<boolean> {
		this.updateLiveStatus(serverId, {
			status: 'testing',
			lastTested: new Date(),
		});

		try {
			// Try optional MCP ping first (fast)
			const pingResult = await this.tryOptionalPing(serverId, userId);

			if (pingResult.supported && pingResult.success) {
				console.log(
					`[Connection Manager] Ping successful for server ${serverId}`,
				);
				this.updateLiveStatus(serverId, {
					status: 'connected',
					lastTested: new Date(),
					lastSuccess: new Date(),
					pingSupported: true,
				});
				return true;
			}

			// Fallback to thorough test (existing testMcpServerConnection)
			console.log(
				`[Connection Manager] Ping ${pingResult.supported ? 'failed' : 'not supported'}, using thorough test for server ${serverId}`,
			);
			const thoroughResult = await testMcpServerConnection(userId, serverId);

			if (thoroughResult.status === 'authorized') {
				this.updateLiveStatus(serverId, {
					status: 'connected',
					lastTested: new Date(),
					lastSuccess: new Date(),
					pingSupported: pingResult.supported,
				});

				return true;
			} else {
				const error =
					thoroughResult.status === 'auth_required'
						? 'Authentication required'
						: `Connection failed with status: ${thoroughResult.status}`;

				this.updateLiveStatus(serverId, {
					status: 'disconnected',
					lastTested: new Date(),
					error,
					pingSupported: pingResult.supported,
				});

				return false;
			}
		} catch (error) {
			console.error(
				`[Connection Manager] Error testing connection to server ${serverId}:`,
				error,
			);

			this.updateLiveStatus(serverId, {
				status: 'disconnected',
				lastTested: new Date(),
				error: error instanceof Error ? error.message : 'Unknown error',
			});

			return false;
		}
	}

	/**
	 * Try optional MCP ping - servers may respond with 404 but still be alive
	 */
	private async tryOptionalPing(
		serverId: string,
		userId: string,
	): Promise<PingResult> {
		try {
			const server = await this.getServerRecord(serverId, userId);
			if (!server?.accessToken) {
				return { supported: false, success: false, error: 'No access token' };
			}

			const startTime = Date.now();
			const response = await this.makeRequest(server.url, server.accessToken, {
				jsonrpc: '2.0',
				id: 1,
				method: 'ping',
				params: {},
			});
			const latency = Date.now() - startTime;

			if (
				response.error?.includes('-32601') ||
				response.error?.includes('Method not found')
			) {
				// Ping not supported - this is OK, server might still be alive
				return { supported: false, success: false };
			}

			return {
				supported: true,
				success: response.success,
				error: response.error,
				latency,
			};
		} catch (error) {
			return {
				supported: false,
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	/**
	 * Update live connection status (in-memory only - NOT stored in KV per plan)
	 */
	private updateLiveStatus(
		serverId: string,
		update: Partial<LiveConnectionStatus>,
	): void {
		const current = this.liveConnectionStatus.get(serverId) || {
			status: 'unknown',
			lastTested: new Date(),
		};

		this.liveConnectionStatus.set(serverId, {
			...current,
			...update,
		});
	}
}

// Export types
export type {
	ConnectionResult,
	ServerCapabilities,
	LiveConnectionStatus,
	PingResult,
};
