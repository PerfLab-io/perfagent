/**
 * Connection Manager - Unified interface for MCP operations
 * Orchestrates authentication, caching, and server communication
 */
import { AuthManager, type AuthResult } from '@/lib/ai/mastra/auth/AuthManager';
// Import the working OAuth functions that handle CF Observability properly
import { refreshOAuthToken } from '@/lib/ai/mastra/mcpClient';
import { mcpToolCache, mcpOAuthCache, type ToolCacheEntry } from '@/lib/ai/mastra/cache/MCPCache';
import { db } from '@/drizzle/db';
import { mcpServers } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import type { ToolMetadata } from '@/lib/ai/mastra/toolCatalog';

interface ServerCapabilities {
	tools?: any[];
	resources?: any[];
	prompts?: any[];
	rootListChanged?: boolean;
}

interface ConnectionResult {
	success: boolean;
	capabilities?: ServerCapabilities;
	tools?: ToolMetadata[];
	error?: string;
	requiresAuth?: boolean;
	authUrl?: string;
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
 */
export class ConnectionManager {
	private authManager: AuthManager;
	
	constructor(authManager?: AuthManager) {
		this.authManager = authManager || new AuthManager();
	}

	/**
	 * Get server capabilities and tools with caching
	 */
	async getServerCapabilities(serverId: string, userId: string): Promise<ConnectionResult> {
		console.log(`[Connection Manager] Getting capabilities for server ${serverId}`);

		try {
			// Check cache first
			const cached = await mcpToolCache.getServerTools(serverId);
			if (cached) {
				console.log(`[Connection Manager] Using cached capabilities for server ${serverId}`);
				return {
					success: true,
					capabilities: cached.capabilities,
					tools: cached.tools,
				};
			}

			// Ensure authentication
			const authResult = await this.authManager.ensureAuthenticated(serverId, userId);
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

			// Fetch capabilities from server
			const capabilities = await this.fetchServerCapabilities(server.url, server.accessToken!);
			if (!capabilities.success) {
				return capabilities;
			}

			// Process and extract tools
			const tools = this.extractToolsFromCapabilities(capabilities.capabilities!);

			// Cache the results
			const cacheEntry: ToolCacheEntry = {
				tools,
				capabilities: capabilities.capabilities!,
				cachedAt: new Date().toISOString(),
				serverUrl: server.url,
			};

			await mcpToolCache.cacheServerTools(serverId, cacheEntry);

			return {
				success: true,
				capabilities: capabilities.capabilities,
				tools,
			};

		} catch (error) {
			console.error(`[Connection Manager] Error getting capabilities for server ${serverId}:`, error);
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
		console.log(`[Connection Manager] Executing tool ${toolName} on server ${serverId}`);

		try {
			// Ensure authentication
			const authResult = await this.authManager.ensureAuthenticated(serverId, userId);
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
			console.error(`[Connection Manager] Error executing tool ${toolName} on server ${serverId}:`, error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	/**
	 * Test server connection and return status
	 */
	async testConnection(serverId: string, userId: string): Promise<ConnectionResult> {
		console.log(`[Connection Manager] Testing connection to server ${serverId}`);

		try {
			// Get server record
			const server = await this.getServerRecord(serverId, userId);
			if (!server) {
				return {
					success: false,
					error: `Server ${serverId} not found`,
				};
			}

			// Check authentication status
			const authResult = await this.authManager.ensureAuthenticated(serverId, userId);
			if (authResult.status !== 'authenticated') {
				return {
					success: false,
					requiresAuth: true,
					authUrl: authResult.authUrl,
					error: authResult.error || 'Authentication required',
				};
			}

			// Test with a simple initialize request
			const testResult = await this.makeRequest(server.url, server.accessToken!, {
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

			return {
				success: testResult.success,
				error: testResult.error,
			};

		} catch (error) {
			console.error(`[Connection Manager] Error testing connection to server ${serverId}:`, error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	/**
	 * Invalidate cache for a specific server
	 */
	async invalidateServerCache(serverId: string): Promise<void> {
		console.log(`[Connection Manager] Invalidating cache for server ${serverId}`);
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

	private async fetchServerCapabilities(serverUrl: string, accessToken: string): Promise<ConnectionResult> {
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
			console.error(`[Connection Manager] Network error for ${serverUrl}:`, error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Network error',
			};
		}
	}

	private extractToolsFromCapabilities(capabilities: ServerCapabilities): ToolMetadata[] {
		if (!capabilities.tools) return [];

		return capabilities.tools.map((tool: any) => ({
			name: tool.name,
			description: tool.description || '',
			inputSchema: tool.inputSchema || {},
			// Map other tool properties as needed
		})) as ToolMetadata[];
	}

	private async getServerRecord(serverId: string, userId: string) {
		const servers = await db
			.select()
			.from(mcpServers)
			.where(and(eq(mcpServers.id, serverId), eq(mcpServers.userId, userId)))
			.limit(1);

		return servers[0] || null;
	}
}

// Export types
export type { ConnectionResult, ServerCapabilities };