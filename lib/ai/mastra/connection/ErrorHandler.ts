/**
 * MCP Error Handler - Standardized error handling with proper MCP error codes
 * Handles retry logic, error classification, and user-friendly error messages
 * Enhanced with Inspector-style error detection for Fluid Compute resilience
 */

// MCP JSON-RPC error codes (from MCP specification)
export const MCP_ERROR_CODES = {
	// Standard JSON-RPC errors
	PARSE_ERROR: -32700,
	INVALID_REQUEST: -32600,
	METHOD_NOT_FOUND: -32601,
	INVALID_PARAMS: -32602,
	INTERNAL_ERROR: -32603,

	// MCP-specific errors
	UNAUTHORIZED: -32002,
	FORBIDDEN: -32003,
	NOT_FOUND: -32004,
	METHOD_NOT_ALLOWED: -32005,
	TIMEOUT: -32008,
	CANCELLED: -32009,
} as const;

export type MCPErrorCode =
	(typeof MCP_ERROR_CODES)[keyof typeof MCP_ERROR_CODES];

interface MCPError {
	code: number;
	message: string;
	data?: any;
}

interface ErrorContext {
	serverId: string;
	userId: string;
	serverUrl?: string;
	method?: string;
	attempt?: number;
	maxRetries?: number;
}

interface ErrorResult {
	shouldRetry: boolean;
	retryAfter?: number; // milliseconds
	userMessage: string;
	requiresAuth?: boolean;
	isFatal?: boolean;
}

/**
 * Handles MCP errors with proper classification, retry logic, and user messaging
 */
export class ErrorHandler {
	private maxRetries = 2;
	private baseRetryDelay = 1000; // 1 second

	/**
	 * Process an MCP error and determine appropriate action
	 */
	handleError(error: unknown, context: ErrorContext): ErrorResult {
		console.log(
			`[Error Handler] Processing error for server ${context.serverId}:`,
			error,
		);

		// Handle different error types
		if (this.isMCPError(error)) {
			return this.handleMCPError(error, context);
		}

		if (this.isNetworkError(error)) {
			return this.handleNetworkError(error, context);
		}

		if (this.isHTTPError(error)) {
			return this.handleHTTPError(error, context);
		}

		// Generic error handling
		return this.handleGenericError(error, context);
	}

	/**
	 * Execute operation with automatic retry logic
	 */
	async executeWithRetry<T>(
		operation: () => Promise<T>,
		context: ErrorContext,
	): Promise<T | { error: ErrorResult }> {
		const maxRetries = context.maxRetries || this.maxRetries;
		let lastError: unknown;

		for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
			try {
				const result = await operation();
				if (attempt > 1) {
					console.log(
						`[Error Handler] Operation succeeded on attempt ${attempt} for server ${context.serverId}`,
					);
				}
				return result;
			} catch (error) {
				lastError = error;
				const errorResult = this.handleError(error, { ...context, attempt });

				// If it's a fatal error or we shouldn't retry, fail immediately
				if (
					errorResult.isFatal ||
					!errorResult.shouldRetry ||
					attempt > maxRetries
				) {
					console.log(
						`[Error Handler] Operation failed permanently for server ${context.serverId}`,
					);
					return { error: errorResult };
				}

				// Wait before retrying
				const delay =
					errorResult.retryAfter || this.calculateRetryDelay(attempt);
				console.log(
					`[Error Handler] Retrying operation for server ${context.serverId} in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`,
				);
				await this.delay(delay);
			}
		}

		// This shouldn't be reached, but handle it just in case
		return { error: this.handleError(lastError, context) };
	}

	private handleMCPError(error: MCPError, context: ErrorContext): ErrorResult {
		const { code, message, data } = error;

		switch (code) {
			case MCP_ERROR_CODES.UNAUTHORIZED:
				return {
					shouldRetry: false,
					requiresAuth: true,
					isFatal: false,
					userMessage:
						'Authentication required. Please authorize the server connection.',
				};

			case MCP_ERROR_CODES.FORBIDDEN:
				return {
					shouldRetry: false,
					isFatal: true,
					userMessage:
						'Access forbidden. Please check your permissions for this server.',
				};

			case MCP_ERROR_CODES.METHOD_NOT_FOUND:
				return {
					shouldRetry: false,
					isFatal: true,
					userMessage: `Method not supported by server: ${context.method || 'unknown'}`,
				};

			case MCP_ERROR_CODES.INVALID_PARAMS:
				return {
					shouldRetry: false,
					isFatal: true,
					userMessage: 'Invalid parameters provided to server method.',
				};

			case MCP_ERROR_CODES.TIMEOUT:
				return {
					shouldRetry: true,
					retryAfter: 2000,
					userMessage: 'Server request timed out. Retrying...',
				};

			case MCP_ERROR_CODES.CANCELLED:
				return {
					shouldRetry: false,
					isFatal: true,
					userMessage: 'Operation was cancelled by the server.',
				};

			case MCP_ERROR_CODES.INTERNAL_ERROR:
				return {
					shouldRetry: true,
					retryAfter: 3000,
					userMessage: 'Server internal error. Retrying...',
				};

			case MCP_ERROR_CODES.PARSE_ERROR:
			case MCP_ERROR_CODES.INVALID_REQUEST:
				return {
					shouldRetry: false,
					isFatal: true,
					userMessage: 'Invalid request format. This is likely a client error.',
				};

			default:
				return {
					shouldRetry: code >= -32099 && code <= -32000, // Standard JSON-RPC server errors are retryable
					userMessage: `Server error (${code}): ${message}`,
				};
		}
	}

	private handleNetworkError(error: any, context: ErrorContext): ErrorResult {
		const errorMessage = error.message?.toLowerCase() || '';

		if (errorMessage.includes('timeout')) {
			return {
				shouldRetry: true,
				retryAfter: 2000,
				userMessage: 'Network timeout. Retrying connection...',
			};
		}

		if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
			return {
				shouldRetry: true,
				retryAfter: 1500,
				userMessage: 'Network connection failed. Retrying...',
			};
		}

		if (errorMessage.includes('cors')) {
			return {
				shouldRetry: false,
				isFatal: true,
				userMessage:
					'Cross-origin request blocked. Please check server CORS configuration.',
			};
		}

		return {
			shouldRetry: true,
			userMessage: 'Network error occurred. Retrying...',
		};
	}

	private handleHTTPError(error: any, context: ErrorContext): ErrorResult {
		const status = error.status || error.response?.status;

		switch (status) {
			case 401:
				return {
					shouldRetry: false,
					requiresAuth: true,
					userMessage:
						'Authentication failed. Please reauthorize the server connection.',
				};

			case 403:
				return {
					shouldRetry: false,
					isFatal: true,
					userMessage:
						'Access forbidden. Please check your server permissions.',
				};

			case 404:
				return {
					shouldRetry: false,
					isFatal: true,
					userMessage:
						'Server endpoint not found. Please check the server URL.',
				};

			case 429:
				const retryAfter = error.headers?.['retry-after'];
				return {
					shouldRetry: true,
					retryAfter: retryAfter ? parseInt(retryAfter) * 1000 : 5000,
					userMessage: 'Rate limit exceeded. Waiting before retry...',
				};

			case 500:
			case 502:
			case 503:
			case 504:
				return {
					shouldRetry: true,
					retryAfter: 3000,
					userMessage: `Server error (${status}). Retrying...`,
				};

			default:
				return {
					shouldRetry: status >= 500 && status < 600,
					userMessage: `HTTP error ${status}: ${error.message || 'Unknown error'}`,
				};
		}
	}

	private handleGenericError(
		error: unknown,
		context: ErrorContext,
	): ErrorResult {
		const message =
			error instanceof Error ? error.message : 'Unknown error occurred';

		console.error(
			`[Error Handler] Generic error for server ${context.serverId}:`,
			error,
		);

		return {
			shouldRetry: true,
			userMessage: message,
		};
	}

	private isMCPError(error: unknown): error is MCPError {
		return (
			typeof error === 'object' &&
			error !== null &&
			'code' in error &&
			'message' in error &&
			typeof (error as any).code === 'number'
		);
	}

	private isNetworkError(error: unknown): boolean {
		if (!(error instanceof Error)) return false;

		const message = error.message.toLowerCase();
		return (
			message.includes('network') ||
			message.includes('fetch') ||
			message.includes('timeout') ||
			message.includes('cors') ||
			error.name === 'NetworkError' ||
			error.name === 'TypeError' // Often network-related in fetch
		);
	}

	private isHTTPError(error: unknown): boolean {
		return (
			typeof error === 'object' &&
			error !== null &&
			('status' in error ||
				('response' in error && (error as any).response?.status))
		);
	}

	private calculateRetryDelay(attempt: number): number {
		// Exponential backoff: 1s, 2s, 4s, etc.
		return this.baseRetryDelay * Math.pow(2, attempt - 1);
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Format error for logging
	 */
	formatErrorForLogging(error: unknown, context: ErrorContext): string {
		const timestamp = new Date().toISOString();
		const contextStr = `Server: ${context.serverId}, User: ${context.userId}, Method: ${context.method || 'unknown'}`;

		if (this.isMCPError(error)) {
			return `[${timestamp}] MCP Error ${error.code}: ${error.message} | ${contextStr}`;
		}

		if (error instanceof Error) {
			return `[${timestamp}] ${error.name}: ${error.message} | ${contextStr}`;
		}

		return `[${timestamp}] Unknown error: ${JSON.stringify(error)} | ${contextStr}`;
	}

	/**
	 * Check if error indicates server is permanently unavailable
	 */
	isServerUnavailable(error: unknown): boolean {
		if (this.isMCPError(error)) {
			return [
				MCP_ERROR_CODES.FORBIDDEN,
				MCP_ERROR_CODES.METHOD_NOT_FOUND,
				MCP_ERROR_CODES.INVALID_REQUEST,
			].includes(error.code as any);
		}

		if (this.isHTTPError(error)) {
			const status = (error as any).status || (error as any).response?.status;
			return [403, 404, 410].includes(status);
		}

		return false;
	}

	// =============================================================================
	// Inspector-Style Error Detection Methods (Phase 3B)
	// =============================================================================

	/**
	 * Check if error is a 401 Unauthorized error
	 * Inspector pattern for specific error type detection
	 */
	is401Error(error: unknown): boolean {
		// Check HTTP 401 errors
		if (this.isHTTPError(error)) {
			const status = (error as any).status || (error as any).response?.status;
			return status === 401;
		}

		// Check MCP unauthorized errors
		if (this.isMCPError(error)) {
			return error.code === MCP_ERROR_CODES.UNAUTHORIZED;
		}

		// Check error message content
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			return (
				message.includes('unauthorized') ||
				message.includes('authentication') ||
				message.includes('invalid token') ||
				message.includes('expired token') ||
				message.includes('(401)') ||
				message.includes(' 401')
			);
		}

		return false;
	}

	/**
	 * Check if error is a proxy authentication error
	 * Inspector pattern for proxy-specific error detection
	 */
	isProxyAuthError(error: unknown): boolean {
		// Check HTTP 407 Proxy Authentication Required
		if (this.isHTTPError(error)) {
			const status = (error as any).status || (error as any).response?.status;
			return status === 407;
		}

		// Check error message content for proxy-related issues
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			return (
				message.includes('proxy') &&
				(message.includes('auth') ||
					message.includes('credential') ||
					message.includes('authentication required'))
			);
		}

		return false;
	}

	/**
	 * Check if error is a MCP protocol-specific error
	 * Inspector pattern for MCP spec compliance errors
	 */
	isMCPProtocolError(error: unknown): boolean {
		// Direct MCP errors are protocol errors
		if (this.isMCPError(error)) {
			return true;
		}

		// Check for JSON-RPC related errors in message
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			return (
				message.includes('jsonrpc') ||
				message.includes('json-rpc') ||
				message.includes('mcp') ||
				message.includes('protocol') ||
				message.includes('invalid request format')
			);
		}

		return false;
	}

	/**
	 * Check if error is a transport-level error (network, connection, etc.)
	 * Inspector pattern for transport-agnostic error classification
	 */
	isTransportError(error: unknown): boolean {
		// Network errors are transport errors
		if (this.isNetworkError(error)) {
			return true;
		}

		// Connection-related HTTP errors
		if (this.isHTTPError(error)) {
			const status = (error as any).status || (error as any).response?.status;
			return [408, 502, 503, 504, 522, 523, 524].includes(status);
		}

		// Check error message for transport issues
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			return (
				message.includes('connection') ||
				message.includes('socket') ||
				message.includes('timeout') ||
				message.includes('abort') ||
				message.includes('disconnect')
			);
		}

		return false;
	}

	/**
	 * Check if error is a rate limiting error
	 * Inspector pattern for rate limit detection
	 */
	isRateLimitError(error: unknown): boolean {
		// HTTP 429 Too Many Requests
		if (this.isHTTPError(error)) {
			const status = (error as any).status || (error as any).response?.status;
			return status === 429;
		}

		// Check error message for rate limiting
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			return (
				message.includes('rate limit') ||
				message.includes('too many requests') ||
				message.includes('quota exceeded') ||
				message.includes('throttle')
			);
		}

		return false;
	}

	/**
	 * Check if error is a server-side error (5xx)
	 * Inspector pattern for server error classification
	 */
	isServerError(error: unknown): boolean {
		// HTTP 5xx errors
		if (this.isHTTPError(error)) {
			const status = (error as any).status || (error as any).response?.status;
			return status >= 500 && status < 600;
		}

		// MCP internal errors
		if (this.isMCPError(error)) {
			return error.code === MCP_ERROR_CODES.INTERNAL_ERROR;
		}

		// Check error message for server-side issues
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			return (
				message.includes('server error') ||
				message.includes('internal server error') ||
				message.includes('service unavailable')
			);
		}

		return false;
	}

	/**
	 * Check if error is a client-side error (4xx, but not auth-related)
	 * Inspector pattern for client error classification
	 */
	isClientError(error: unknown): boolean {
		// HTTP 4xx errors (excluding auth errors)
		if (this.isHTTPError(error)) {
			const status = (error as any).status || (error as any).response?.status;
			return status >= 400 && status < 500 && status !== 401 && status !== 407;
		}

		// MCP client errors
		if (this.isMCPError(error)) {
			const clientErrorCodes = [
				MCP_ERROR_CODES.PARSE_ERROR,
				MCP_ERROR_CODES.INVALID_REQUEST,
				MCP_ERROR_CODES.METHOD_NOT_FOUND,
				MCP_ERROR_CODES.INVALID_PARAMS,
			];
			return clientErrorCodes.includes(error.code as any);
		}

		return false;
	}

	/**
	 * Get error recovery recommendation based on error type
	 * Inspector pattern for actionable error resolution
	 */
	getErrorRecoveryRecommendation(
		error: unknown,
		_context: ErrorContext,
	): {
		action: 'retry' | 'reauth' | 'reconfigure' | 'abort';
		message: string;
		automated: boolean;
		retryAfter?: number;
	} {
		// Authentication errors
		if (this.is401Error(error)) {
			return {
				action: 'reauth',
				message: 'Please reauthorize the server connection',
				automated: false,
			};
		}

		// Proxy authentication errors
		if (this.isProxyAuthError(error)) {
			return {
				action: 'reconfigure',
				message: 'Please check proxy authentication settings',
				automated: false,
			};
		}

		// Rate limiting errors
		if (this.isRateLimitError(error)) {
			const retryAfter = this.extractRetryAfter(error);
			return {
				action: 'retry',
				message: `Rate limited, retrying in ${Math.ceil((retryAfter || 5000) / 1000)} seconds`,
				automated: true,
				retryAfter,
			};
		}

		// Transport errors
		if (this.isTransportError(error)) {
			return {
				action: 'retry',
				message: 'Connection issue, retrying...',
				automated: true,
				retryAfter: 2000,
			};
		}

		// Server errors
		if (this.isServerError(error)) {
			return {
				action: 'retry',
				message: 'Server error, retrying...',
				automated: true,
				retryAfter: 3000,
			};
		}

		// Client errors
		if (this.isClientError(error)) {
			return {
				action: 'abort',
				message: 'Invalid request - please check your configuration',
				automated: false,
			};
		}

		// Default case
		return {
			action: 'retry',
			message: 'Unknown error, retrying...',
			automated: true,
			retryAfter: 1500,
		};
	}

	/**
	 * Extract retry-after value from error headers
	 */
	private extractRetryAfter(error: unknown): number | undefined {
		if (this.isHTTPError(error)) {
			const retryAfter =
				(error as any).headers?.['retry-after'] ||
				(error as any).response?.headers?.['retry-after'];
			if (retryAfter) {
				const parsed = parseInt(retryAfter);
				return !isNaN(parsed) ? parsed * 1000 : undefined; // Convert to milliseconds
			}
		}
		return undefined;
	}

	/**
	 * Create context-aware error message with enhanced details
	 * Inspector pattern for improved error messaging without hard-coded server logic
	 */
	getContextAwareErrorMessage(error: unknown, context: ErrorContext): string {
		// Use the existing error handling logic which already provides good messages
		const errorResult = this.handleError(error, context);

		// Enhance with additional context if available
		const serverInfo = context.serverUrl
			? ` (${new URL(context.serverUrl).hostname})`
			: '';
		const methodInfo = context.method ? ` while calling ${context.method}` : '';

		// For authentication errors, provide more actionable guidance
		if (this.is401Error(error)) {
			return `Authentication failed${serverInfo}. Please reauthorize the server connection.`;
		}

		// For rate limit errors, include retry timing if available
		if (this.isRateLimitError(error)) {
			const retryAfter = this.extractRetryAfter(error);
			const waitTime = retryAfter
				? ` Please wait ${Math.ceil(retryAfter / 1000)} seconds.`
				: ' Please wait before retrying.';
			return `Rate limit exceeded${serverInfo}.${waitTime}`;
		}

		// For transport errors, provide connectivity guidance
		if (this.isTransportError(error)) {
			return `Connection failed${serverInfo}${methodInfo}. Please check your network connection and try again.`;
		}

		// For other errors, return the standard message with context
		return `${errorResult.userMessage}${serverInfo}${methodInfo}`;
	}
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

// Export types
export type { ErrorResult, ErrorContext, MCPError };
