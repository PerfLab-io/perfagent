/**
 * Connection Manager - Unified interface for MCP operations
 * Orchestrates authentication, caching, and server communication
 */
import { AuthManager } from '@/lib/ai/mastra/auth/AuthManager';
// Import the working OAuth functions that handle CF Observability properly
import {
	getMcpServerInfo,
	testMcpServerConnection,
} from '@/lib/ai/mastra/mcpClient';
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
// Import removed - using flexible any[] type for tools to handle different MCP server formats

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
	error?: string;
	requiresAuth?: boolean;
	authUrl?: string;
	fromCache?: boolean;
}

// Live connection status - in-memory only (per plan: NOT stored in KV)
interface LiveConnectionStatus {
	status: 'connected' | 'disconnected' | 'testing' | 'unknown';
	lastTested: Date;
	lastSuccess?: Date;
	error?: string;
	pingSupported?: boolean;
}

// Ping test result for optional MCP ping
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
	// Live connection status - in-memory only (per plan: NOT stored in KV)
	private liveConnectionStatus = new Map<string, LiveConnectionStatus>();

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
			// Check KV cache first (capabilities only - 2h TTL per plan)
			const cached = await mcpToolCache.getServerTools(serverId);
			if (cached) {
				console.log(
					`[Connection Manager] Using cached capabilities for server ${serverId}`,
				);
				// Update live connection status (successful cache hit indicates recent success)
				this.updateLiveStatus(serverId, {
					status: 'connected',
					lastTested: new Date(cached.cachedAt),
					lastSuccess: new Date(cached.cachedAt),
				});

				// Track resource listing from cache
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

			// Test live connection first
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

			// Use existing getMcpServerInfo - preserves CF Observability logic
			const result = await getMcpServerInfo(userId, serverId);

			if (result && result.server) {
				// Extract tools from toolsets structure
				const tools: any[] = [];
				if (result.toolsets && typeof result.toolsets === 'object') {
					Object.values(result.toolsets).forEach((toolset: any) => {
						if (Array.isArray(toolset)) {
							tools.push(...toolset);
						}
					});
				}

				// Count total resources (tools + resources + prompts)
				const resourceCount =
					tools.length +
					(Array.isArray(result.resources) ? result.resources.length : 0) +
					(Array.isArray(result.prompts) ? result.prompts.length : 0);

				// Track resource listing success
				const duration = performance.measure(
					'listResources',
					'listResourcesStart',
				).duration;
				telemetryService.trackClientListResources(resourceCount, duration);
				performance.clearMarks('listResourcesStart');
				performance.clearMeasures('listResources');

				// Cache capabilities only (NOT connection status per plan)
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

				// Update live status on success
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
				// Update live status on failure
				this.updateLiveStatus(serverId, {
					status: 'disconnected',
					lastTested: new Date(),
					error: 'Failed to get server info',
				});

				// Track resource listing failure
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

			// Track resource listing error
			const duration = performance.measure(
				'listResources',
				'listResourcesStart',
			).duration;
			telemetryService.trackClientListResources(0, duration);
			performance.clearMarks('listResourcesStart');
			performance.clearMeasures('listResources');
			// Update live status on error
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
			// Ensure authentication
			const authResult = await this.authManager.ensureAuthenticated(
				serverId,
				userId,
			);
			if (authResult.status !== 'authenticated') {
				return {
					success: false,
					requiresAuth: true,
					authUrl: authResult.authUrl,
					error: authResult.error || 'Authentication required',
				};
			}

			// Get server record
			const server = await this.getServerRecord(serverId, userId);
			if (!server) {
				return {
					success: false,
					error: `Server ${serverId} not found`,
				};
			}

			// Execute the tool call
			const result = await this.makeToolCallRequest(
				server.url,
				server.accessToken!,
				toolName,
				arguments_,
			);

			return result;
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

		// After successful initialize, get tools list
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
	): Promise<ConnectionResult> {
		const response = await this.makeRequest(serverUrl, accessToken, {
			jsonrpc: '2.0',
			id: Date.now(),
			method: 'tools/call',
			params: {
				name: toolName,
				arguments: arguments_,
			},
		});

		return response;
	}

	private async makeRequest(
		serverUrl: string,
		accessToken: string,
		request: MCPRequest,
	): Promise<ConnectionResult & { result?: any }> {
		try {
			const response = await fetch(serverUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify(request),
			});

			if (!response.ok) {
				if (response.status === 401) {
					return {
						success: false,
						requiresAuth: true,
						error: 'Authentication failed - token may be expired',
					};
				}

				return {
					success: false,
					error: `HTTP ${response.status}: ${response.statusText}`,
				};
			}

			const mcpResponse: MCPResponse = await response.json();

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
		// Update status to testing
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
