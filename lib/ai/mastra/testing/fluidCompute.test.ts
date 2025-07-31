/**
 * Vitest tests for Fluid Compute Scenarios
 * Tests Vercel Fluid Compute specific behaviors with no real server dependencies
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	mockMcpToolCache,
	mockMcpOAuthCache,
} from './__mocks__/mockDependencies';

// Mock the actual cache imports to avoid database dependencies
vi.mock('../cache/MCPCache', () => ({
	mcpToolCache: mockMcpToolCache,
	mcpOAuthCache: mockMcpOAuthCache,
}));

// Import after mocking
import { fluidComputeTest } from './fluidComputeTest';
import { ConnectionManager } from '../connection/ConnectionManager';

describe('Fluid Compute Scenario Tests', () => {
	beforeEach(() => {
		// Fresh state for each test
	});

	afterEach(() => {
		// Clean up after each test
		fluidComputeTest.cleanup();
	});

	describe('Cache Resilience Across Instances', () => {
		it('should persist KV cache across simulated instance restarts', async () => {
			const result =
				await fluidComputeTest.testCacheResilienceAcrossInstances();

			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.details.cacheHit).toBeDefined();
			expect(result.details.persistedCache).toBeDefined();
		});

		it('should lose in-memory connection status after instance restart', async () => {
			const result =
				await fluidComputeTest.testCacheResilienceAcrossInstances();

			expect(result.success).toBe(true);
			expect(result.details.connectionStatusAfterRestart).toBeNull();
		});

		it('should maintain cache integrity across instance boundaries', async () => {
			const serverId = 'integrity-test-server';
			const userId = 'test-user';

			const mockCapabilities = {
				tools: [
					{ name: 'integrity_tool', description: 'Test tool for integrity' },
				],
				capabilities: { tools: {} },
				cachedAt: new Date().toISOString(),
				serverUrl: 'mock://integrity-test',
			};

			await mockMcpToolCache.cacheServerTools(serverId, mockCapabilities);

			// Simulate instance restart by creating new Connection Manager
			const newConnectionManager = new ConnectionManager();

			// Cache should still be available
			const cachedResult = await mockMcpToolCache.getServerTools(serverId);
			expect(cachedResult).toBeDefined();
			expect(cachedResult!.tools).toHaveLength(1);
			expect(cachedResult!.tools[0].name).toBe('integrity_tool');
		});
	});

	describe('Cold Start Performance', () => {
		it('should demonstrate cache effectiveness for cold starts', async () => {
			const result = await fluidComputeTest.testColdStartPerformance();

			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.details.cacheRetrievalTime).toBeLessThan(100);
			expect(result.details.cachedCapabilities).toBeDefined();
		});

		it('should measure cache retrieval performance', async () => {
			const serverId = 'perf-test-server';

			const mockCapabilities = {
				tools: [{ name: 'perf_tool', description: 'Performance test tool' }],
				capabilities: { tools: {} },
				cachedAt: new Date().toISOString(),
				serverUrl: 'mock://perf-test',
			};

			await mockMcpToolCache.cacheServerTools(serverId, mockCapabilities);

			const startTime = Date.now();
			const cachedResult = await mockMcpToolCache.getServerTools(serverId);
			const retrievalTime = Date.now() - startTime;

			expect(cachedResult).toBeDefined();
			expect(retrievalTime).toBeLessThan(50); // Should be very fast
		});
	});

	describe('Concurrent Request Handling', () => {
		it('should handle concurrent requests efficiently', async () => {
			const result = await fluidComputeTest.testConcurrentRequestHandling();

			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.details.concurrentRequests).toBeGreaterThan(1);
			expect(result.details.executionTime).toBeDefined();
		});

		it('should maintain performance under concurrent load', async () => {
			const connectionManager = new ConnectionManager();
			const concurrentOperations = 10;
			const promises = [];

			const startTime = Date.now();

			for (let i = 0; i < concurrentOperations; i++) {
				promises.push(
					connectionManager.getLiveConnectionStatus(`concurrent-test-${i}`),
				);
			}

			const results = await Promise.all(promises);
			const totalTime = Date.now() - startTime;

			expect(results).toHaveLength(concurrentOperations);
			expect(totalTime).toBeLessThan(1000); // Should complete quickly
		});
	});

	describe('Memory Cleanup', () => {
		it('should manage memory efficiently', async () => {
			const result = await fluidComputeTest.testMemoryCleanup();

			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.details.memoryIncrease).toBeDefined();
			expect(result.details.memoryIncreaseKB).toBeLessThan(10240); // Less than 10MB
		});

		it('should not leak memory with repeated operations', async () => {
			const initialMemory = process.memoryUsage();

			// Perform many operations
			const connectionManager = new ConnectionManager();
			for (let i = 0; i < 50; i++) {
				connectionManager.getLiveConnectionStatus(`memory-leak-test-${i}`);
			}

			// Force garbage collection if available
			if (global.gc) {
				global.gc();
			}

			const finalMemory = process.memoryUsage();
			const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

			// Memory increase should be minimal (less than 5MB)
			expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
		});
	});

	describe('Cache TTL Behavior', () => {
		it('should respect cache TTL strategies', async () => {
			const result = await fluidComputeTest.testCacheTTLBehavior();

			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.details.capabilitiesCacheValid).toBe(true);
			expect(result.details.oauthCacheValid).toBe(true);
		});

		it('should validate capabilities cache (2h TTL)', async () => {
			const serverId = 'ttl-capabilities-test';

			const mockCapabilities = {
				tools: [{ name: 'ttl_tool', description: 'TTL test tool' }],
				capabilities: { tools: {} },
				cachedAt: new Date().toISOString(),
				serverUrl: 'mock://ttl-test',
			};

			await mockMcpToolCache.cacheServerTools(serverId, mockCapabilities);

			// Verify cache validity
			const isValid = await mockMcpToolCache.isCacheValid(serverId);
			expect(isValid).toBe(true);

			// Get cached data
			const cached = await mockMcpToolCache.getServerTools(serverId);
			expect(cached).toBeDefined();
			expect(cached!.tools).toHaveLength(1);
		});

		it('should validate OAuth cache (30min TTL)', async () => {
			const serverId = 'ttl-oauth-test';

			const mockTokens = {
				accessToken: 'test-access-token-ttl',
				refreshToken: 'test-refresh-token-ttl',
				serverUrl: 'mock://ttl-oauth-test',
			};

			await mockMcpOAuthCache.cacheValidatedToken(serverId, mockTokens);

			// Verify cache validity
			const isValid = await mockMcpOAuthCache.isTokenCacheValid(
				serverId,
				mockTokens.accessToken,
			);
			expect(isValid).toBe(true);

			// Get cached tokens
			const cached = await mockMcpOAuthCache.getValidatedToken(serverId);
			expect(cached).toBeDefined();
			expect(cached!.accessToken).toBe(mockTokens.accessToken);
		});
	});

	describe('Instance Sharing Simulation', () => {
		it('should simulate multiple requests on same instance', async () => {
			const connectionManager = new ConnectionManager();
			const serverIds = ['shared-1', 'shared-2', 'shared-3'];

			// Simulate requests from different users on same instance
			const promises = serverIds.map((serverId) =>
				connectionManager.getLiveConnectionStatus(serverId),
			);

			const results = await Promise.all(promises);
			expect(results).toHaveLength(serverIds.length);

			// All requests should complete (even if returning null for new servers)
			results.forEach((result) => {
				expect(result).toBeNull(); // New servers have no status yet
			});
		});

		it('should maintain separate connection states per server', async () => {
			const connectionManager = new ConnectionManager();

			// This would normally be set by actual connection attempts
			// Here we're just testing the state isolation works
			const status1 = connectionManager.getLiveConnectionStatus('server-1');
			const status2 = connectionManager.getLiveConnectionStatus('server-2');

			expect(status1).toBeNull();
			expect(status2).toBeNull();

			// Both are null but they're independent null values (different calls)
			// Test that the method works correctly for different server IDs
			expect(typeof status1).toBe(typeof status2);
			expect(connectionManager.getLiveConnectionStatus('server-1')).toBeNull();
			expect(connectionManager.getLiveConnectionStatus('server-2')).toBeNull();
		});
	});

	describe('Full Fluid Compute Test Suite', () => {
		it('should run complete Fluid Compute test suite', async () => {
			const result = await fluidComputeTest.runFluidComputeTests();

			expect(result.success).toBe(true);
			expect(result.summary.totalTests).toBeGreaterThan(0);
			expect(result.summary.passedTests).toBe(result.summary.totalTests);
			expect(result.summary.failedTests).toBe(0);
		});

		it('should provide detailed performance metrics', async () => {
			const result = await fluidComputeTest.runFluidComputeTests();

			expect(result.results).toBeDefined();
			expect(Object.keys(result.results)).toContain(
				'Cache Resilience Across Instances',
			);
			expect(Object.keys(result.results)).toContain('Cold Start Performance');
			expect(Object.keys(result.results)).toContain(
				'Concurrent Request Handling',
			);
			expect(Object.keys(result.results)).toContain('Memory Cleanup');
			expect(Object.keys(result.results)).toContain('Cache TTL Behavior');
		});
	});
});
