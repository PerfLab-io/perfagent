/**
 * Enhanced Tool Execution - Unified interface for executing MCP tools
 * Uses Connection Manager for robust authentication, error handling, and caching
 * Features live connection status and optional MCP ping optimization
 */
import {
	ConnectionManager,
	type LiveConnectionStatus,
} from './connection/ConnectionManager';
import { errorHandler } from './connection/ErrorHandler';
import { mcpToolCache } from './cache/MCPCache';
import { db } from '@/drizzle/db';
import { mcpServers } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { telemetryService } from './monitoring/TelemetryService';
import { performance } from 'node:perf_hooks';

interface ToolExecutionRequest {
	serverId: string;
	userId: string;
	toolName: string;
	arguments: Record<string, any>;
}

interface ToolExecutionResult {
	success: boolean;
	result?: any;
	error?: string;
	executionTime?: number;
	fromCache?: boolean;
	connectionStatus?: LiveConnectionStatus;
}

interface ToolDiscoveryResult {
	tools: ToolInfo[];
	totalServers: number;
	authorizedServers: number;
	connectionStates: Record<string, LiveConnectionStatus>;
}

interface ToolInfo {
	name: string;
	description: string;
	serverId: string;
	serverName: string;
	serverUrl: string;
	inputSchema?: any;
	requiresAuth: boolean;
}

/**
 * Enhanced tool execution service with Connection Manager integration
 */
export class ToolExecutionService {
	private connectionManager: ConnectionManager;

	constructor() {
		this.connectionManager = new ConnectionManager();
	}

	/**
	 * Execute a tool on a specific MCP server
	 * Includes live connection status for better debugging
	 */
	async executeTool(
		request: ToolExecutionRequest,
	): Promise<ToolExecutionResult> {
		performance.mark('toolExecutionStart');
		console.log(
			`[Tool Execution] Executing tool ${request.toolName} on server ${request.serverId}`,
		);

		try {
			// Check connection status before execution
			const connectionStatus = this.connectionManager.getLiveConnectionStatus(
				request.serverId,
			);

			// Execute with retry logic and error handling
			const result = await errorHandler.executeWithRetry(
				() =>
					this.connectionManager.executeToolCall(
						request.serverId,
						request.userId,
						request.toolName,
						request.arguments,
					),
				{
					serverId: request.serverId,
					userId: request.userId,
					method: 'executeToolCall',
				},
			);

			// Get updated connection status after execution
			const updatedConnectionStatus =
				this.connectionManager.getLiveConnectionStatus(request.serverId);

			// Check if we got an error result
			if ('error' in result) {
				const message =
					result.error instanceof Error
						? result.error.message
						: (result.error as any)?.message ||
							(result.error as any) ||
							'Unknown error';

				// Track failed execution
				const duration = performance.measure(
					'toolExecution',
					'toolExecutionStart',
				).duration;
				telemetryService.trackToolExecution('failed', duration);

				return {
					success: false,
					error: message,
					executionTime: duration,
					connectionStatus: updatedConnectionStatus || undefined,
				};
			}

			console.log(
				`[Tool Execution] Successfully executed tool ${request.toolName}`,
			);

			// Track successful execution
			const duration = performance.measure(
				'toolExecution',
				'toolExecutionStart',
			).duration;
			telemetryService.trackToolExecution('success', duration);

			// Track result type
			const resultType = telemetryService.classifyResultType(result);
			telemetryService.trackToolResult(resultType, 'success');

			return {
				success: true,
				result: result,
				executionTime: duration,
				connectionStatus: updatedConnectionStatus || undefined,
			};
		} catch (error) {
			console.error(
				`[Tool Execution] Error executing tool ${request.toolName}:`,
				error,
			);
			const connectionStatus = this.connectionManager.getLiveConnectionStatus(
				request.serverId,
			);

			// Track execution failure
			const duration = performance.measure(
				'toolExecution',
				'toolExecutionStart',
			).duration;
			telemetryService.trackToolExecution('failed', duration);

			// Track critical error if timeout
			if (duration > 30000) {
				telemetryService.trackSlowOperation('tool_execution', duration);
			}

			performance.clearMarks();
			performance.clearMeasures();

			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				executionTime: duration,
				connectionStatus: connectionStatus || undefined,
			};
		}
	}

	/**
	 * Discover all available tools across user's MCP servers
	 * Includes live connection status for each server
	 */
	async discoverTools(userId: string): Promise<ToolDiscoveryResult> {
		console.log(`[Tool Discovery] Discovering tools for user ${userId}`);

		performance.mark('toolDiscoveryStart');

		// Get all user's enabled servers
		const servers = await db
			.select()
			.from(mcpServers)
			.where(and(eq(mcpServers.userId, userId), eq(mcpServers.enabled, true)));

		const tools: ToolInfo[] = [];
		const connectionStates: Record<string, LiveConnectionStatus> = {};
		let authorizedServers = 0;

		for (const server of servers) {
			try {
				// Get server capabilities (with caching and live status tracking)
				const capabilities = await this.connectionManager.getServerCapabilities(
					server.id,
					userId,
				);

				// Get live connection status
				const connectionStatus = this.connectionManager.getLiveConnectionStatus(
					server.id,
				);
				if (connectionStatus) {
					connectionStates[server.id] = connectionStatus;
				}

				if ('error' in capabilities) {
					console.warn(
						`[Tool Discovery] Failed to get capabilities for server ${server.name}: ${capabilities.error}`,
					);
					continue;
				}

				if (capabilities.success && capabilities.tools) {
					authorizedServers++;

					// Add tools from this server
					for (const tool of capabilities.tools) {
						tools.push({
							name: tool.name,
							description: tool.description || '',
							serverId: server.id,
							serverName: server.name,
							serverUrl: server.url,
							inputSchema: tool.inputSchema,
							requiresAuth: server.authStatus !== 'authorized',
						});
					}
				}
			} catch (error) {
				console.error(
					`[Tool Discovery] Error processing server ${server.name}:`,
					error,
				);
				// Still try to get connection status even on error
				const connectionStatus = this.connectionManager.getLiveConnectionStatus(
					server.id,
				);
				if (connectionStatus) {
					connectionStates[server.id] = connectionStatus;
				}
			}
		}

		console.log(
			`[Tool Discovery] Discovered ${tools.length} tools from ${authorizedServers}/${servers.length} servers`,
		);

		// Track tool discovery
		const discoveryDuration = performance.measure(
			'toolDiscovery',
			'toolDiscoveryStart',
		).duration;
		telemetryService.trackToolDiscovery(tools.length, discoveryDuration);

		performance.clearMarks();
		performance.clearMeasures();

		return {
			tools,
			totalServers: servers.length,
			authorizedServers,
			connectionStates,
		};
	}

	/**
	 * Search for tools by name or description
	 */
	async searchTools(userId: string, query: string): Promise<ToolInfo[]> {
		const discovery = await this.discoverTools(userId);
		const searchTerm = query.toLowerCase();

		return discovery.tools.filter(
			(tool) =>
				tool.name.toLowerCase().includes(searchTerm) ||
				tool.description.toLowerCase().includes(searchTerm),
		);
	}

	/**
	 * Get tools for a specific server
	 */
	async getServerTools(serverId: string, userId: string): Promise<ToolInfo[]> {
		console.log(`[Tool Discovery] Getting tools for server ${serverId}`);

		try {
			// Get server info
			const server = await db
				.select()
				.from(mcpServers)
				.where(and(eq(mcpServers.id, serverId), eq(mcpServers.userId, userId)))
				.limit(1);

			if (server.length === 0) {
				return [];
			}

			const serverRecord = server[0];

			// Get server capabilities
			const capabilities = await this.connectionManager.getServerCapabilities(
				serverId,
				userId,
			);

			if (
				'error' in capabilities ||
				!capabilities.success ||
				!capabilities.tools
			) {
				return [];
			}

			// Convert to ToolInfo format
			return capabilities.tools.map((tool) => ({
				name: tool.name,
				description: tool.description || '',
				serverId: serverRecord.id,
				serverName: serverRecord.name,
				serverUrl: serverRecord.url,
				inputSchema: tool.inputSchema,
				requiresAuth: serverRecord.authStatus !== 'authorized',
			}));
		} catch (error) {
			console.error(
				`[Tool Discovery] Error getting tools for server ${serverId}:`,
				error,
			);
			return [];
		}
	}

	/**
	 * Validate tool arguments against schema
	 */
	validateToolArguments(
		tool: ToolInfo,
		arguments_: Record<string, any>,
	): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!tool.inputSchema) {
			return { valid: true, errors: [] };
		}

		// Basic validation - can be enhanced with proper JSON schema validation
		const schema = tool.inputSchema;

		if (schema.required && Array.isArray(schema.required)) {
			for (const requiredField of schema.required) {
				if (!(requiredField in arguments_)) {
					errors.push(`Missing required field: ${requiredField}`);
				}
			}
		}

		if (schema.properties) {
			for (const [fieldName, value] of Object.entries(arguments_)) {
				if (!(fieldName in schema.properties)) {
					errors.push(`Unknown field: ${fieldName}`);
				}
			}
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Execute tool with validation
	 */
	async executeToolWithValidation(
		request: ToolExecutionRequest,
	): Promise<ToolExecutionResult> {
		// Get tool info for validation
		const tools = await this.getServerTools(request.serverId, request.userId);
		const tool = tools.find((t) => t.name === request.toolName);

		if (!tool) {
			return {
				success: false,
				error: `Tool '${request.toolName}' not found on server`,
			};
		}

		// Validate arguments
		const validation = this.validateToolArguments(tool, request.arguments);
		if (!validation.valid) {
			return {
				success: false,
				error: `Invalid arguments: ${validation.errors.join(', ')}`,
			};
		}

		// Execute the tool
		return await this.executeTool(request);
	}

	/**
	 * Get server health status for all user servers
	 */
	async getServerHealthStatus(userId: string): Promise<
		{
			serverId: string;
			serverName: string;
			connectionStatus: LiveConnectionStatus | null;
			isHealthy: boolean;
			lastSuccess?: Date;
			pingSupported?: boolean;
		}[]
	> {
		console.log(
			`[Tool Execution] Getting server health status for user ${userId}`,
		);

		const servers = await db
			.select()
			.from(mcpServers)
			.where(and(eq(mcpServers.userId, userId), eq(mcpServers.enabled, true)));

		return servers.map((server) => {
			const connectionStatus = this.connectionManager.getLiveConnectionStatus(
				server.id,
			);
			return {
				serverId: server.id,
				serverName: server.name,
				connectionStatus,
				isHealthy: connectionStatus?.status === 'connected',
				lastSuccess: connectionStatus?.lastSuccess,
				pingSupported: connectionStatus?.pingSupported,
			};
		});
	}

	/**
	 * Test connection to a specific server
	 */
	async testServerConnection(
		serverId: string,
		userId: string,
	): Promise<{
		success: boolean;
		connectionStatus: LiveConnectionStatus | null;
		error?: string;
	}> {
		console.log(`[Tool Execution] Testing connection to server ${serverId}`);

		try {
			const result = await this.connectionManager.testConnection(
				serverId,
				userId,
			);
			const connectionStatus =
				this.connectionManager.getLiveConnectionStatus(serverId);

			return {
				success: result.success,
				connectionStatus,
				error: result.error,
			};
		} catch (error) {
			const connectionStatus =
				this.connectionManager.getLiveConnectionStatus(serverId);
			return {
				success: false,
				connectionStatus,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	/**
	 * Get execution statistics with enhanced connection insights
	 */
	async getExecutionStats(userId: string): Promise<{
		totalServers: number;
		authorizedServers: number;
		totalTools: number;
		healthyServers: number;
		serversWithPing: number;
		cacheStats: any;
		connectionStates: Record<string, LiveConnectionStatus>;
	}> {
		const discovery = await this.discoverTools(userId);
		const cacheStats = await this.connectionManager.getCacheStats();

		// Count healthy servers and ping support
		let healthyServers = 0;
		let serversWithPing = 0;

		Object.values(discovery.connectionStates).forEach((status) => {
			if (status.status === 'connected') {
				healthyServers++;
			}
			if (status.pingSupported === true) {
				serversWithPing++;
			}
		});

		return {
			totalServers: discovery.totalServers,
			authorizedServers: discovery.authorizedServers,
			totalTools: discovery.tools.length,
			healthyServers,
			serversWithPing,
			cacheStats,
			connectionStates: discovery.connectionStates,
		};
	}
}

// Export singleton instance
export const toolExecutionService = new ToolExecutionService();

// Export types
export type {
	ToolExecutionRequest,
	ToolExecutionResult,
	ToolDiscoveryResult,
	ToolInfo,
};
