/**
 * MCP Telemetry Service
 * Tracks server operations and tool workflows with Vercel Analytics
 * Respects 2-parameter constraint per custom event
 */

import { track } from '@vercel/analytics/server';
import { createHash } from 'crypto';

// Event names following mcp_[category]_[action] pattern
export const MCP_EVENTS = {
	// Server operations
	SERVER_ADDED: 'mcp_server_added',
	SERVER_REMOVED: 'mcp_server_removed',
	SERVER_AUTH: 'mcp_server_auth',
	SERVER_TEST: 'mcp_server_test',
	SERVER_TOGGLE: 'mcp_server_toggle',

	// Tool operations
	TOOL_DISCOVERY: 'mcp_tool_discovery',
	TOOL_APPROVAL: 'mcp_tool_approval',
	TOOL_EXECUTION: 'mcp_tool_execution',
	TOOL_RESULT: 'mcp_tool_result',

	// Performance & errors (reuse existing)
	SLOW_OPERATION: 'mcp_slow_operation',
	CRITICAL_ERROR: 'mcp_critical_error',
} as const;

// Type definitions for event parameters
type ServerType = 'http' | 'sse' | 'stdio';
type AuthStatus = 'success' | 'failed' | 'cancelled';
type AuthMethod = 'oauth' | 'api_key' | 'none';
type TestResult = 'success' | 'failed' | 'timeout';
type ToggleAction = 'activated' | 'deactivated';
type TriggerSource = 'manual' | 'auto' | 'error';
type RemovalReason = 'user' | 'error' | 'auth_failed';
type ApprovalAction = 'approved' | 'rejected' | 'timeout';
type ExecutionStatus = 'success' | 'failed' | 'timeout';
type ResultType = 'text' | 'structured' | 'error' | 'empty';
type ProcessingStatus = 'success' | 'failed' | 'partial';
type ErrorCategory = 'auth' | 'network' | 'protocol' | 'timeout';

/**
 * Telemetry service for MCP operations
 * Provides structured tracking with bucketing and sampling
 */
export class TelemetryService {
	private static instance: TelemetryService;
	private readonly isProduction = process.env.NODE_ENV === 'production';
	private readonly samplingRate = 0.1; // 10% for non-critical operations

	private constructor() {}

	static getInstance(): TelemetryService {
		if (!TelemetryService.instance) {
			TelemetryService.instance = new TelemetryService();
		}
		return TelemetryService.instance;
	}

	/**
	 * Duration buckets for performance tracking
	 */
	private getDurationBucket(ms: number): string {
		if (ms < 1000) return '<1s';
		if (ms < 5000) return '1-5s';
		if (ms < 10000) return '5-10s';
		if (ms < 30000) return '10-30s';
		return '30s+';
	}

	/**
	 * Response time buckets for user interactions
	 */
	private getResponseTimeBucket(ms: number): string {
		if (ms < 1000) return '<1s';
		if (ms < 5000) return '1-5s';
		if (ms < 30000) return '5-30s';
		return '30s+';
	}

	/**
	 * Count buckets for tool discovery
	 */
	private getCountBucket(count: number): string {
		if (count < 10) return '<10';
		if (count < 50) return '10-50';
		if (count < 100) return '50-100';
		return '100+';
	}

	/**
	 * Discovery time classification
	 */
	private getDiscoveryTimeBucket(ms: number): 'fast' | 'normal' | 'slow' {
		if (ms < 500) return 'fast';
		if (ms < 2000) return 'normal';
		return 'slow';
	}

	/**
	 * Hash server identifier for privacy
	 */
	private hashServerId(serverId: string): string {
		return createHash('sha256').update(serverId).digest('hex').slice(0, 8);
	}

	/**
	 * Determine transport type from URL or config
	 */
	private determineTransport(url?: string): ServerType {
		if (!url) return 'stdio';
		if (url.includes('sse://') || url.includes('/sse')) return 'sse';
		if (url.startsWith('http://') || url.startsWith('https://')) return 'http';
		return 'stdio';
	}

	/**
	 * Track server addition
	 */
	trackServerAdded(serverUrl?: string, requiresAuth: boolean = false): void {
		if (!this.isProduction) return;

		const serverType = this.determineTransport(serverUrl);
		track(MCP_EVENTS.SERVER_ADDED, {
			server_type: serverType,
			auth_required: requiresAuth,
		});
	}

	/**
	 * Track server removal
	 */
	trackServerRemoved(serverUrl?: string, reason: RemovalReason = 'user'): void {
		if (!this.isProduction) return;

		const serverType = this.determineTransport(serverUrl);
		track(MCP_EVENTS.SERVER_REMOVED, {
			server_type: serverType,
			removal_reason: reason,
		});
	}

	/**
	 * Track server authentication
	 */
	trackServerAuth(status: AuthStatus, method: AuthMethod = 'none'): void {
		if (!this.isProduction) return;

		track(MCP_EVENTS.SERVER_AUTH, {
			auth_status: status,
			auth_method: method,
		});
	}

	/**
	 * Track server test
	 */
	trackServerTest(result: TestResult, serverId: string): void {
		if (!this.isProduction) return;

		track(MCP_EVENTS.SERVER_TEST, {
			test_result: result,
			server_id_hash: this.hashServerId(serverId),
		});
	}

	/**
	 * Track server toggle
	 */
	trackServerToggle(
		action: ToggleAction,
		source: TriggerSource = 'manual',
	): void {
		if (!this.isProduction) return;

		track(MCP_EVENTS.SERVER_TOGGLE, {
			toggle_action: action,
			trigger_source: source,
		});
	}

	/**
	 * Track tool discovery
	 */
	trackToolDiscovery(toolsCount: number, discoveryTimeMs: number): void {
		if (!this.isProduction) return;

		// Sample at 10% for non-critical operations
		if (Math.random() > this.samplingRate) return;

		track(MCP_EVENTS.TOOL_DISCOVERY, {
			tools_count_bucket: this.getCountBucket(toolsCount),
			discovery_time_bucket: this.getDiscoveryTimeBucket(discoveryTimeMs),
		});
	}

	/**
	 * Track tool approval request
	 */
	trackToolApproval(action: ApprovalAction, responseTimeMs: number): void {
		if (!this.isProduction) return;

		// Always track (critical for understanding user behavior)
		track(MCP_EVENTS.TOOL_APPROVAL, {
			approval_action: action,
			response_time_bucket: this.getResponseTimeBucket(responseTimeMs),
		});
	}

	/**
	 * Track tool execution
	 */
	trackToolExecution(status: ExecutionStatus, durationMs: number): void {
		if (!this.isProduction) return;

		// Always track (critical for performance monitoring)
		track(MCP_EVENTS.TOOL_EXECUTION, {
			execution_status: status,
			duration_bucket: this.getDurationBucket(durationMs),
		});
	}

	/**
	 * Track tool result processing
	 */
	trackToolResult(
		resultType: ResultType,
		processingStatus: ProcessingStatus,
	): void {
		if (!this.isProduction) return;

		// Sample at 10% for non-critical operations
		if (Math.random() > this.samplingRate) return;

		track(MCP_EVENTS.TOOL_RESULT, {
			result_type: resultType,
			processing_status: processingStatus,
		});
	}

	/**
	 * Track slow operations
	 */
	trackSlowOperation(operationType: string, durationMs: number): void {
		if (!this.isProduction) return;

		// Always track slow operations
		track(MCP_EVENTS.SLOW_OPERATION, {
			operation_type: operationType,
			duration_bucket: this.getDurationBucket(durationMs),
		});
	}

	/**
	 * Track critical errors
	 */
	trackCriticalError(category: ErrorCategory, context: string): void {
		if (!this.isProduction) return;

		// Always track critical errors
		track(MCP_EVENTS.CRITICAL_ERROR, {
			error_category: category,
			error_context: context,
		});
	}

	/**
	 * Helper to classify errors
	 */
	classifyError(error: unknown): ErrorCategory {
		const errorStr = error instanceof Error ? error.message : String(error);

		if (
			errorStr.includes('401') ||
			errorStr.includes('UNAUTHORIZED') ||
			errorStr.includes('auth')
		) {
			return 'auth';
		}
		if (errorStr.includes('timeout') || errorStr.includes('TIMEOUT')) {
			return 'timeout';
		}
		if (
			errorStr.includes('network') ||
			errorStr.includes('ECONNREFUSED') ||
			errorStr.includes('fetch')
		) {
			return 'network';
		}
		if (
			errorStr.includes('protocol') ||
			errorStr.includes('MCP') ||
			errorStr.includes('version')
		) {
			return 'protocol';
		}

		return 'network'; // Default to network for unknown errors
	}

	/**
	 * Helper to determine auth method from config
	 */
	determineAuthMethod(config?: any): AuthMethod {
		if (!config) return 'none';
		if (config.oauth || config.clientId) return 'oauth';
		if (config.apiKey || config.token) return 'api_key';
		return 'none';
	}

	/**
	 * Helper to classify result type
	 */
	classifyResultType(result: unknown): ResultType {
		if (!result) return 'empty';
		if (result instanceof Error) return 'error';
		if (typeof result === 'string') return 'text';
		if (typeof result === 'object') return 'structured';
		return 'text';
	}

	/**
	 * Check if operation should be tracked (for sampling)
	 */
	shouldTrack(isCritical: boolean = false): boolean {
		if (!this.isProduction) return false;
		if (isCritical) return true;
		return Math.random() < this.samplingRate;
	}
}

// Export singleton instance
export const telemetryService = TelemetryService.getInstance();
