/**
 * Vitest tests for MCP Protocol Compliance
 * Spec-based testing with no real server dependencies
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mcpProtocolTest, MockMCPServer } from './mcpProtocolTest';
import { errorHandler, MCP_ERROR_CODES } from '../connection/ErrorHandler';

describe('MCP Protocol Compliance Tests', () => {
	const testServerId = 'vitest-protocol-server';

	beforeEach(() => {
		// Create fresh mock server for each test
		mcpProtocolTest.createMockServer(testServerId);
	});

	afterEach(() => {
		// Clean up after each test
		mcpProtocolTest.cleanup();
	});

	describe('MCP Initialization Sequence', () => {
		it('should handle standard MCP initialization flow', async () => {
			const result = await mcpProtocolTest.testInitializationSequence(testServerId);
			
			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.details.initResponse).toBeDefined();
			expect(result.details.toolsResponse).toBeDefined();
			expect(result.details.requestCount).toBeGreaterThan(0);
		});

		it('should validate initialize response structure', async () => {
			const result = await mcpProtocolTest.testInitializationSequence(testServerId);
			
			expect(result.success).toBe(true);
			
			const initResponse = result.details.initResponse;
			expect(initResponse.result.protocolVersion).toBeDefined();
			expect(initResponse.result.capabilities).toBeDefined();
			expect(initResponse.result.serverInfo).toBeDefined();
		});

		it('should validate tools/list response structure', async () => {
			const result = await mcpProtocolTest.testInitializationSequence(testServerId);
			
			expect(result.success).toBe(true);
			
			const toolsResponse = result.details.toolsResponse;
			expect(toolsResponse.result.tools).toBeDefined();
			expect(Array.isArray(toolsResponse.result.tools)).toBe(true);
			expect(toolsResponse.result.tools.length).toBeGreaterThan(0);
		});
	});

	describe('MCP Error Handling', () => {
		it('should correctly classify MCP error codes', async () => {
			const result = await mcpProtocolTest.testErrorHandling();
			
			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.details).toBeDefined();
		});

		it('should detect 401 errors correctly', () => {
			const unauthorizedError = {
				code: MCP_ERROR_CODES.UNAUTHORIZED,
				message: 'Authentication required',
			};

			expect(errorHandler.is401Error(unauthorizedError)).toBe(true);
			expect(errorHandler.isMCPProtocolError(unauthorizedError)).toBe(true);
		});

		it('should detect method not found errors', () => {
			const methodNotFoundError = {
				code: MCP_ERROR_CODES.METHOD_NOT_FOUND,
				message: 'Method not found',
			};

			expect(errorHandler.isMCPProtocolError(methodNotFoundError)).toBe(true);
			expect(errorHandler.isClientError(methodNotFoundError)).toBe(true);
		});

		it('should detect server errors correctly', () => {
			const internalError = {
				code: MCP_ERROR_CODES.INTERNAL_ERROR,
				message: 'Internal server error',
			};

			expect(errorHandler.isServerError(internalError)).toBe(true);
			expect(errorHandler.isMCPProtocolError(internalError)).toBe(true);
		});

		it('should provide error recovery recommendations', () => {
			const unauthorizedError = {
				code: MCP_ERROR_CODES.UNAUTHORIZED,
				message: 'Authentication required',
			};

			const recommendation = errorHandler.getErrorRecoveryRecommendation(
				unauthorizedError,
				{ serverId: 'test', userId: 'test' }
			);

			expect(recommendation.action).toBe('reauth');
			expect(recommendation.automated).toBe(false);
		});
	});

	describe('Optional MCP Ping', () => {
		it('should handle ping support correctly', async () => {
			const result = await mcpProtocolTest.testOptionalPing(testServerId);
			
			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.details.pingSupported).toBeDefined();
		});

		it('should handle ping not supported gracefully', async () => {
			// Create server without ping support
			const noPingServerId = 'no-ping-server';
			mcpProtocolTest.createMockServer(noPingServerId, {
				responses: {
					ping: {
						jsonrpc: '2.0',
						id: 0,
						error: {
							code: MCP_ERROR_CODES.METHOD_NOT_FOUND,
							message: 'Method not found',
						},
					},
				},
			});

			const result = await mcpProtocolTest.testOptionalPing(noPingServerId);
			
			expect(result.success).toBe(true);
			expect(result.details.pingSupported).toBe(false);
		});
	});

	describe('Tool Execution Protocol', () => {
		it('should handle tool execution correctly', async () => {
			const result = await mcpProtocolTest.testToolExecution(testServerId);
			
			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.details.toolCallResponse).toBeDefined();
		});

		it('should validate tool execution response format', async () => {
			const result = await mcpProtocolTest.testToolExecution(testServerId);
			
			expect(result.success).toBe(true);
			
			const toolResponse = result.details.toolCallResponse;
			expect(toolResponse.result.content).toBeDefined();
			expect(Array.isArray(toolResponse.result.content)).toBe(true);
		});

		it('should handle invalid tool calls gracefully', async () => {
			const result = await mcpProtocolTest.testToolExecution(testServerId);
			
			expect(result.success).toBe(true);
			expect(result.details.invalidToolResponse).toBeDefined();
		});
	});

	describe('Mock Server Functionality', () => {
		it('should simulate network delays', async () => {
			const delayedServerId = 'delayed-server';
			mcpProtocolTest.createMockServer(delayedServerId, {
				delay: 100,
			});

			const startTime = Date.now();
			await mcpProtocolTest.testInitializationSequence(delayedServerId);
			const duration = Date.now() - startTime;

			expect(duration).toBeGreaterThan(100);
		});

		it('should simulate random failures', async () => {
			const unreliableServerId = 'unreliable-server';
			mcpProtocolTest.createMockServer(unreliableServerId, {
				failureRate: 1.0, // 100% failure rate
			});

			const mockServer = mcpProtocolTest['mockServers'].get(unreliableServerId);
			expect(mockServer).toBeDefined();

			const response = await mockServer!.handleRequest('initialize');
			expect(response.error).toBeDefined();
			expect(response.error!.code).toBe(MCP_ERROR_CODES.INTERNAL_ERROR);
		});
	});

	describe('Full Protocol Test Suite', () => {
		it('should run complete test suite successfully', async () => {
			const result = await mcpProtocolTest.runFullTestSuite('full-suite-test');
			
			expect(result.success).toBe(true);
			expect(result.summary.totalTests).toBeGreaterThan(0);
			expect(result.summary.passedTests).toBe(result.summary.totalTests);
			expect(result.summary.failedTests).toBe(0);
		});

		it('should provide detailed test results', async () => {
			const result = await mcpProtocolTest.runFullTestSuite('detailed-test');
			
			expect(result.results).toBeDefined();
			expect(Object.keys(result.results)).toContain('Initialization Sequence');
			expect(Object.keys(result.results)).toContain('Error Handling');
			expect(Object.keys(result.results)).toContain('Optional Ping');
			expect(Object.keys(result.results)).toContain('Tool Execution');
		});
	});
});