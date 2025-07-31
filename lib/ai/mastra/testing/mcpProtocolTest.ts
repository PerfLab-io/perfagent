/**
 * MCP Protocol Testing Framework
 * Spec-based testing following MCP Inspector patterns
 * No real server dependencies - uses mock MCP servers with spec-compliant responses
 */

import { ConnectionManager } from '../connection/ConnectionManager';
import { errorHandler } from '../connection/ErrorHandler';
import { MCP_ERROR_CODES } from '../connection/ErrorHandler';

// Mock MCP Server Response Types (based on MCP specification)
interface MockMCPResponse {
	jsonrpc: '2.0';
	id: number;
	result?: any;
	error?: {
		code: number;
		message: string;
		data?: any;
	};
}

interface MockServerConfig {
	url: string;
	responses: Record<
		string,
		MockMCPResponse | ((params: any) => MockMCPResponse)
	>;
	delay?: number;
	failureRate?: number; // 0-1, probability of random failures
}

/**
 * Mock MCP Server for testing MCP protocol compliance
 * Simulates various server behaviors without external dependencies
 */
export class MockMCPServer {
	private config: MockServerConfig;
	private requestCount = 0;

	constructor(config: MockServerConfig) {
		this.config = config;
	}

	/**
	 * Simulate MCP server response based on request method
	 */
	async handleRequest(
		method: string,
		params: any = {},
	): Promise<MockMCPResponse> {
		this.requestCount++;

		// Simulate random failures if configured
		if (this.config.failureRate && Math.random() < this.config.failureRate) {
			return {
				jsonrpc: '2.0',
				id: this.requestCount,
				error: {
					code: MCP_ERROR_CODES.INTERNAL_ERROR,
					message: 'Random server error for testing',
				},
			};
		}

		// Simulate network delay
		if (this.config.delay) {
			await new Promise((resolve) => setTimeout(resolve, this.config.delay));
		}

		// Get response configuration
		const responseConfig = this.config.responses[method];
		if (!responseConfig) {
			return {
				jsonrpc: '2.0',
				id: this.requestCount,
				error: {
					code: MCP_ERROR_CODES.METHOD_NOT_FOUND,
					message: `Method '${method}' not found`,
				},
			};
		}

		// Generate response
		const response =
			typeof responseConfig === 'function'
				? responseConfig(params)
				: responseConfig;

		return {
			...response,
			id: this.requestCount,
		};
	}

	getRequestCount(): number {
		return this.requestCount;
	}

	reset(): void {
		this.requestCount = 0;
	}
}

/**
 * MCP Protocol Test Suite
 * Tests MCP specification compliance without real server dependencies
 */
export class MCPProtocolTestSuite {
	private mockServers: Map<string, MockMCPServer> = new Map();

	/**
	 * Create a mock server with spec-compliant responses
	 */
	createMockServer(
		serverId: string,
		config: Partial<MockServerConfig> = {},
	): MockMCPServer {
		const defaultConfig: MockServerConfig = {
			url: `mock://${serverId}`,
			responses: {
				// Standard MCP initialize response
				initialize: {
					jsonrpc: '2.0',
					id: 0,
					result: {
						protocolVersion: '2024-11-05',
						capabilities: {
							tools: {},
							resources: {},
							prompts: {},
						},
						serverInfo: {
							name: `Mock Server ${serverId}`,
							version: '1.0.0',
						},
					},
				},
				// Standard MCP tools/list response
				'tools/list': {
					jsonrpc: '2.0',
					id: 0,
					result: {
						tools: [
							{
								name: 'mock_tool_1',
								description: 'First mock tool for testing',
								inputSchema: {
									type: 'object',
									properties: {
										input: { type: 'string' },
									},
									required: ['input'],
								},
							},
							{
								name: 'mock_tool_2',
								description: 'Second mock tool for testing',
								inputSchema: {
									type: 'object',
									properties: {
										data: { type: 'number' },
									},
								},
							},
						],
					},
				},
				// Standard MCP ping response (optional)
				ping: {
					jsonrpc: '2.0',
					id: 0,
					result: {},
				},
				// Standard MCP tool execution
				'tools/call': (params: any) => ({
					jsonrpc: '2.0',
					id: 0,
					result: {
						content: [
							{
								type: 'text',
								text: `Executed ${params.name} with arguments: ${JSON.stringify(params.arguments)}`,
							},
						],
					},
				}),
			},
			...config,
		};

		const mockServer = new MockMCPServer(defaultConfig);
		this.mockServers.set(serverId, mockServer);
		return mockServer;
	}

	/**
	 * Test MCP initialization sequence compliance
	 */
	async testInitializationSequence(serverId: string): Promise<{
		success: boolean;
		errors: string[];
		details: any;
	}> {
		const errors: string[] = [];
		const mockServer = this.mockServers.get(serverId);

		if (!mockServer) {
			return {
				success: false,
				errors: ['Mock server not found'],
				details: {},
			};
		}

		try {
			// Test initialize request
			const initResponse = await mockServer.handleRequest('initialize', {
				protocolVersion: '2024-11-05',
				capabilities: {},
				clientInfo: {
					name: 'MCP Test Client',
					version: '1.0.0',
				},
			});

			// Validate initialize response structure
			if (!initResponse.result) {
				errors.push('Initialize response missing result');
			} else {
				const result = initResponse.result;
				if (!result.protocolVersion) {
					errors.push('Initialize response missing protocolVersion');
				}
				if (!result.capabilities) {
					errors.push('Initialize response missing capabilities');
				}
				if (!result.serverInfo) {
					errors.push('Initialize response missing serverInfo');
				}
			}

			// Test tools/list request after initialization
			const toolsResponse = await mockServer.handleRequest('tools/list');

			if (!toolsResponse.result) {
				errors.push('Tools/list response missing result');
			} else if (!Array.isArray(toolsResponse.result.tools)) {
				errors.push('Tools/list response tools is not an array');
			}

			return {
				success: errors.length === 0,
				errors,
				details: {
					initResponse,
					toolsResponse,
					requestCount: mockServer.getRequestCount(),
				},
			};
		} catch (error) {
			errors.push(
				`Initialization test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
			return {
				success: false,
				errors,
				details: {},
			};
		}
	}

	/**
	 * Test MCP error handling compliance
	 */
	async testErrorHandling(): Promise<{
		success: boolean;
		errors: string[];
		details: any;
	}> {
		const errors: string[] = [];
		const details: any = {};

		// Test various error scenarios
		const errorScenarios = [
			{
				name: 'Unauthorized Error',
				error: {
					code: MCP_ERROR_CODES.UNAUTHORIZED,
					message: 'Authentication required',
				},
			},
			{
				name: 'Method Not Found',
				error: {
					code: MCP_ERROR_CODES.METHOD_NOT_FOUND,
					message: 'Method not found',
				},
			},
			{
				name: 'Invalid Params',
				error: {
					code: MCP_ERROR_CODES.INVALID_PARAMS,
					message: 'Invalid parameters',
				},
			},
			{
				name: 'Internal Error',
				error: {
					code: MCP_ERROR_CODES.INTERNAL_ERROR,
					message: 'Internal server error',
				},
			},
		];

		for (const scenario of errorScenarios) {
			try {
				// Test error handler classification
				const mockError = {
					code: scenario.error.code,
					message: scenario.error.message,
				};

				// Test Inspector-style error detection
				const is401 = errorHandler.is401Error(mockError);
				const isMCPError = errorHandler.isMCPProtocolError(mockError);
				const isClientError = errorHandler.isClientError(mockError);
				const isServerError = errorHandler.isServerError(mockError);

				// Validate error classification logic
				if (scenario.error.code === MCP_ERROR_CODES.UNAUTHORIZED && !is401) {
					errors.push(`${scenario.name}: Should be detected as 401 error`);
				}

				if (!isMCPError) {
					errors.push(
						`${scenario.name}: Should be detected as MCP protocol error`,
					);
				}

				details[scenario.name] = {
					error: mockError,
					classification: {
						is401,
						isMCPError,
						isClientError,
						isServerError,
					},
				};
			} catch (error) {
				errors.push(
					`${scenario.name}: Error testing - ${error instanceof Error ? error.message : 'Unknown error'}`,
				);
			}
		}

		return {
			success: errors.length === 0,
			errors,
			details,
		};
	}

	/**
	 * Test optional MCP ping functionality
	 */
	async testOptionalPing(serverId: string): Promise<{
		success: boolean;
		errors: string[];
		details: any;
	}> {
		const errors: string[] = [];
		const mockServer = this.mockServers.get(serverId);

		if (!mockServer) {
			return {
				success: false,
				errors: ['Mock server not found'],
				details: {},
			};
		}

		try {
			// Test ping support
			const pingResponse = await mockServer.handleRequest('ping');

			// Ping is optional, so either success or method not found is valid
			const isValidPingResponse =
				pingResponse.result !== undefined ||
				pingResponse.error?.code === MCP_ERROR_CODES.METHOD_NOT_FOUND;

			if (!isValidPingResponse) {
				errors.push(
					'Invalid ping response - should return result or method not found',
				);
			}

			return {
				success: errors.length === 0,
				errors,
				details: {
					pingResponse,
					pingSupported: pingResponse.result !== undefined,
				},
			};
		} catch (error) {
			errors.push(
				`Ping test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
			return {
				success: false,
				errors,
				details: {},
			};
		}
	}

	/**
	 * Test tool execution protocol compliance
	 */
	async testToolExecution(serverId: string): Promise<{
		success: boolean;
		errors: string[];
		details: any;
	}> {
		const errors: string[] = [];
		const mockServer = this.mockServers.get(serverId);

		if (!mockServer) {
			return {
				success: false,
				errors: ['Mock server not found'],
				details: {},
			};
		}

		try {
			// Test tool execution
			const toolCallResponse = await mockServer.handleRequest('tools/call', {
				name: 'mock_tool_1',
				arguments: { input: 'test input' },
			});

			// Validate tool execution response
			if (!toolCallResponse.result) {
				errors.push('Tool call response missing result');
			} else {
				const result = toolCallResponse.result;
				if (!result.content || !Array.isArray(result.content)) {
					errors.push('Tool call response should have content array');
				}
			}

			// Test invalid tool execution
			const invalidToolResponse = await mockServer.handleRequest('tools/call', {
				name: 'nonexistent_tool',
				arguments: {},
			});

			// Should handle invalid tool gracefully
			if (!invalidToolResponse.error && !invalidToolResponse.result) {
				errors.push('Invalid tool call should return error or result');
			}

			return {
				success: errors.length === 0,
				errors,
				details: {
					toolCallResponse,
					invalidToolResponse,
				},
			};
		} catch (error) {
			errors.push(
				`Tool execution test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
			return {
				success: false,
				errors,
				details: {},
			};
		}
	}

	/**
	 * Run complete MCP protocol compliance test suite
	 */
	async runFullTestSuite(serverId = 'test-server'): Promise<{
		success: boolean;
		results: Record<string, any>;
		summary: {
			totalTests: number;
			passedTests: number;
			failedTests: number;
		};
	}> {
		// Create mock server for testing
		this.createMockServer(serverId);

		const results: Record<string, any> = {};

		// Run all test suites
		const testSuites = [
			{
				name: 'Initialization Sequence',
				test: () => this.testInitializationSequence(serverId),
			},
			{ name: 'Error Handling', test: () => this.testErrorHandling() },
			{ name: 'Optional Ping', test: () => this.testOptionalPing(serverId) },
			{ name: 'Tool Execution', test: () => this.testToolExecution(serverId) },
		];

		let passedTests = 0;
		let failedTests = 0;

		for (const suite of testSuites) {
			try {
				const result = await suite.test();
				results[suite.name] = result;

				if (result.success) {
					passedTests++;
				} else {
					failedTests++;
				}
			} catch (error) {
				results[suite.name] = {
					success: false,
					errors: [
						`Test suite failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
					],
					details: {},
				};
				failedTests++;
			}
		}

		return {
			success: failedTests === 0,
			results,
			summary: {
				totalTests: testSuites.length,
				passedTests,
				failedTests,
			},
		};
	}

	/**
	 * Clean up all mock servers
	 */
	cleanup(): void {
		this.mockServers.clear();
	}
}

// Export singleton instance for easy use
export const mcpProtocolTest = new MCPProtocolTestSuite();

// Export types
export type { MockServerConfig, MockMCPResponse };
