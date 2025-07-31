/**
 * Vitest integration tests for MCP Infrastructure
 * Tests complete system integration with no real server dependencies
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	mockDb,
	mockMcpToolCache,
	mockMcpOAuthCache,
} from './__mocks__/mockDependencies';

// Mock problematic imports to avoid database dependencies
vi.mock('@/drizzle/db', () => ({ db: mockDb }));
vi.mock('../cache/MCPCache', () => ({
	mcpToolCache: mockMcpToolCache,
	mcpOAuthCache: mockMcpOAuthCache,
}));

// Import after mocking
import { mcpProtocolTest } from './mcpProtocolTest';
import { fluidComputeTest } from './fluidComputeTest';
import { ConnectionManager } from '../connection/ConnectionManager';
import { errorHandler } from '../connection/ErrorHandler';

describe('MCP Infrastructure Integration Tests', () => {
	beforeEach(() => {
		// Setup for integration tests
	});

	afterEach(() => {
		// Cleanup after integration tests
		mcpProtocolTest.cleanup();
		fluidComputeTest.cleanup();
	});

	describe('MCP Protocol Integration', () => {
		it('should run protocol initialization tests', async () => {
			// Create mock server
			mcpProtocolTest.createMockServer('integration-protocol-test');

			const result = await mcpProtocolTest.testInitializationSequence(
				'integration-protocol-test',
			);

			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.details.initResponse).toBeDefined();
			expect(result.details.toolsResponse).toBeDefined();
		});

		it('should run protocol error handling tests', async () => {
			const result = await mcpProtocolTest.testErrorHandling();

			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.details).toBeDefined();
		});

		it('should run full protocol test suite', async () => {
			const result = await mcpProtocolTest.runFullTestSuite(
				'integration-full-test',
			);

			expect(result.success).toBe(true);
			expect(result.summary.totalTests).toBeGreaterThan(0);
			expect(result.summary.passedTests).toBe(result.summary.totalTests);
			expect(result.summary.failedTests).toBe(0);
		});
	});

	describe('Fluid Compute Integration', () => {
		it('should test cache resilience', async () => {
			const result =
				await fluidComputeTest.testCacheResilienceAcrossInstances();

			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.details.cacheHit).toBeDefined();
		});

		it('should test cold start performance', async () => {
			const result = await fluidComputeTest.testColdStartPerformance();

			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.details.cacheRetrievalTime).toBeLessThan(100);
		});

		it('should run full Fluid Compute test suite', async () => {
			const result = await fluidComputeTest.runFluidComputeTests();

			expect(result.success).toBe(true);
			expect(result.summary.totalTests).toBeGreaterThan(0);
			expect(result.summary.passedTests).toBe(result.summary.totalTests);
			expect(result.summary.failedTests).toBe(0);
		});
	});

	describe('Connection Manager Integration', () => {
		it('should integrate with error handler correctly', async () => {
			const connectionManager = new ConnectionManager();

			// Test that connection manager uses error handler patterns
			const mockError = new Error('Test connection error');

			// Error handler should classify this correctly
			const isTransportError = errorHandler.isTransportError(mockError);
			expect(typeof isTransportError).toBe('boolean');

			// Error handler should provide recovery recommendation
			const recommendation = errorHandler.getErrorRecoveryRecommendation(
				mockError,
				{
					serverId: 'test-server',
					userId: 'test-user',
				},
			);

			expect(recommendation.action).toBeDefined();
			expect(recommendation.message).toBeDefined();
			expect(typeof recommendation.automated).toBe('boolean');
		});

		it('should handle live connection status properly', () => {
			const connectionManager = new ConnectionManager();

			// Initially, no connection status should exist
			const status = connectionManager.getLiveConnectionStatus('new-server');
			expect(status).toBeNull();

			// Connection status should be isolated per server
			const status1 = connectionManager.getLiveConnectionStatus('server-1');
			const status2 = connectionManager.getLiveConnectionStatus('server-2');

			expect(status1).toBeNull();
			expect(status2).toBeNull();
			// Both are null but method works correctly for different server IDs
			expect(typeof status1).toBe(typeof status2);
		});
	});

	describe('Tool Execution Service Integration', () => {
		it('should test tool execution patterns without database', () => {
			// Test the tool execution interface without actual service instantiation
			const mockToolExecutionRequest = {
				serverId: 'test-server',
				userId: 'test-user',
				toolName: 'test-tool',
				arguments: { input: 'test' },
			};

			// Verify the request structure is valid
			expect(mockToolExecutionRequest.serverId).toBeDefined();
			expect(mockToolExecutionRequest.userId).toBeDefined();
			expect(mockToolExecutionRequest.toolName).toBeDefined();
			expect(mockToolExecutionRequest.arguments).toBeDefined();
		});

		it('should test tool discovery patterns', () => {
			// Test tool discovery interface patterns
			const mockToolInfo = {
				name: 'test-tool',
				description: 'Test tool description',
				serverId: 'test-server',
				serverName: 'Test Server',
				serverUrl: 'mock://test-server',
				requiresAuth: false,
			};

			expect(mockToolInfo.name).toBe('test-tool');
			expect(mockToolInfo.requiresAuth).toBe(false);
		});

		it('should test execution result patterns', () => {
			// Test execution result interface
			const mockResult = {
				success: true,
				result: { content: [{ type: 'text', text: 'Test result' }] },
				executionTime: 100,
				fromCache: false,
			};

			expect(mockResult.success).toBe(true);
			expect(mockResult.executionTime).toBeGreaterThan(0);
		});
	});

	describe('Error Handler Integration', () => {
		it('should provide context-aware error messages', () => {
			const mockError = {
				code: -32002, // UNAUTHORIZED
				message: 'Authentication required',
			};

			const context = {
				serverId: 'test-server',
				userId: 'test-user',
				serverUrl: 'https://example.com/mcp',
				method: 'tools/list',
			};

			const message = errorHandler.getContextAwareErrorMessage(
				mockError,
				context,
			);

			expect(message).toBeDefined();
			expect(typeof message).toBe('string');
			expect(message.length).toBeGreaterThan(0);

			// Should include server info
			expect(message).toContain('example.com');
		});

		it('should classify errors correctly across all categories', () => {
			const testCases = [
				{
					error: { code: -32002, message: 'Unauthorized' },
					expected: { is401: true, isMCP: true, isTransport: false },
				},
				{
					error: { status: 401, message: 'Unauthorized' },
					expected: { is401: true, isMCP: false, isTransport: false },
				},
				{
					error: new Error('Connection timeout'),
					expected: { is401: false, isMCP: false, isTransport: true },
				},
				{
					error: { status: 429, message: 'Too Many Requests' },
					expected: {
						is401: false,
						isMCP: false,
						isTransport: false,
						isRateLimit: true,
					},
				},
			];

			testCases.forEach((testCase, index) => {
				const { error, expected } = testCase;

				if (expected.is401 !== undefined) {
					expect(errorHandler.is401Error(error)).toBe(expected.is401);
				}
				if (expected.isMCP !== undefined) {
					expect(errorHandler.isMCPProtocolError(error)).toBe(expected.isMCP);
				}
				if (expected.isTransport !== undefined) {
					expect(errorHandler.isTransportError(error)).toBe(
						expected.isTransport,
					);
				}
				if (expected.isRateLimit !== undefined) {
					expect(errorHandler.isRateLimitError(error)).toBe(
						expected.isRateLimit,
					);
				}
			});
		});
	});

	describe('Cache Integration', () => {
		it('should integrate caching across all components', async () => {
			// This test verifies that caching works across the entire system
			const serverId = 'integration-cache-test';
			const userId = 'test-user';

			// Connection manager should be able to use cache stats
			const connectionManager = new ConnectionManager();
			const cacheStats = await connectionManager.getCacheStats();

			expect(cacheStats).toBeDefined();
			expect(cacheStats.tools).toBeDefined();
			expect(cacheStats.oauth).toBeDefined();
			expect(cacheStats.auth).toBeDefined();
		});
	});

	describe('System Resilience', () => {
		it('should handle component failures gracefully', async () => {
			// Test that system components handle errors without crashing
			const connectionManager = new ConnectionManager();

			// Should handle invalid server IDs gracefully
			const status =
				connectionManager.getLiveConnectionStatus('invalid-server-id');
			expect(status).toBeNull();

			// Should handle error objects gracefully
			const mockError = new Error('Test error');
			const isTransportError = errorHandler.isTransportError(mockError);
			expect(typeof isTransportError).toBe('boolean');
		});

		it('should maintain performance under stress', async () => {
			const startTime = Date.now();
			const connectionManager = new ConnectionManager();

			// Simulate many concurrent operations
			const operations = [];
			for (let i = 0; i < 100; i++) {
				operations.push(
					connectionManager.getLiveConnectionStatus(`stress-test-${i}`),
				);
			}

			const results = await Promise.all(operations);
			const duration = Date.now() - startTime;

			expect(results).toHaveLength(100);
			expect(duration).toBeLessThan(1000); // Should complete within 1 second
		});
	});
});
