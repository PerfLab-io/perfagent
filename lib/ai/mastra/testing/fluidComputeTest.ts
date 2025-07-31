/**
 * Fluid Compute Testing Framework
 * Tests scenarios specific to Vercel Fluid Compute environment
 * No real server dependencies - simulates Fluid Compute constraints
 */

import { ConnectionManager } from '../connection/ConnectionManager';
import { mcpToolCache, mcpOAuthCache } from '../cache/MCPCache';
import { MockMCPServer, mcpProtocolTest } from './mcpProtocolTest';

interface FluidComputeTestScenario {
	name: string;
	description: string;
	test: () => Promise<{
		success: boolean;
		errors: string[];
		details: any;
	}>;
}

/**
 * Fluid Compute Test Suite
 * Tests behaviors specific to serverless environment constraints
 */
export class FluidComputeTestSuite {
	private connectionManager: ConnectionManager;

	constructor() {
		this.connectionManager = new ConnectionManager();
	}

	/**
	 * Test cache behavior across simulated instance restarts
	 */
	async testCacheResilienceAcrossInstances(): Promise<{
		success: boolean;
		errors: string[];
		details: any;
	}> {
		const errors: string[] = [];
		const details: any = {};

		try {
			const serverId = 'cache-test-server';
			const userId = 'test-user';

			// Simulate caching some capabilities
			const mockCapabilities = {
				tools: [
					{
						name: 'test_tool',
						description: 'Test tool for cache testing',
						inputSchema: { type: 'object' },
					},
				],
				capabilities: { tools: {} },
				cachedAt: new Date().toISOString(),
				serverUrl: 'mock://cache-test',
			};

			await mcpToolCache.cacheServerTools(serverId, mockCapabilities);

			// Verify cache hit
			const cachedResult = await mcpToolCache.getServerTools(serverId);
			if (!cachedResult) {
				errors.push('Cache should contain the stored capabilities');
			} else {
				details.cacheHit = cachedResult;
			}

			// Simulate instance restart by creating new Connection Manager
			const newConnectionManager = new ConnectionManager();

			// Test that KV cache persists across "instance restart"
			const persistedCache = await mcpToolCache.getServerTools(serverId);
			if (!persistedCache) {
				errors.push('Cache should persist across instance restarts');
			}

			// Test that in-memory connection status is lost (as expected)
			const connectionStatus =
				newConnectionManager.getLiveConnectionStatus(serverId);
			if (connectionStatus) {
				errors.push(
					'In-memory connection status should be lost after instance restart',
				);
			}

			details.persistedCache = persistedCache;
			details.connectionStatusAfterRestart = connectionStatus;
		} catch (error) {
			errors.push(
				`Cache resilience test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}

		return {
			success: errors.length === 0,
			errors,
			details,
		};
	}

	/**
	 * Test cold start performance scenarios
	 */
	async testColdStartPerformance(): Promise<{
		success: boolean;
		errors: string[];
		details: any;
	}> {
		const errors: string[] = [];
		const details: any = {};

		try {
			// Simulate cold start scenario
			const startTime = Date.now();

			// Create fresh connection manager (simulates cold start)
			const coldConnectionManager = new ConnectionManager();

			// Test cache effectiveness for reducing cold start impact
			const serverId = 'cold-start-test';
			const userId = 'test-user';

			// Pre-populate cache (simulates previous instance)
			const mockCapabilities = {
				tools: [{ name: 'cached_tool', description: 'Pre-cached tool' }],
				capabilities: { tools: {} },
				cachedAt: new Date().toISOString(),
				serverUrl: 'mock://cold-start-test',
			};

			await mcpToolCache.cacheServerTools(serverId, mockCapabilities);

			// Measure cache retrieval time (should be fast)
			const cacheStartTime = Date.now();
			const cachedResult = await mcpToolCache.getServerTools(serverId);
			const cacheRetrievalTime = Date.now() - cacheStartTime;

			if (!cachedResult) {
				errors.push('Cache should provide capabilities during cold start');
			}

			// Cache retrieval should be very fast (< 100ms)
			if (cacheRetrievalTime > 100) {
				errors.push(
					`Cache retrieval too slow: ${cacheRetrievalTime}ms (should be < 100ms)`,
				);
			}

			const totalColdStartTime = Date.now() - startTime;

			details.cacheRetrievalTime = cacheRetrievalTime;
			details.totalColdStartTime = totalColdStartTime;
			details.cachedCapabilities = cachedResult;
		} catch (error) {
			errors.push(
				`Cold start test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}

		return {
			success: errors.length === 0,
			errors,
			details,
		};
	}

	/**
	 * Test concurrent request handling within single instance
	 */
	async testConcurrentRequestHandling(): Promise<{
		success: boolean;
		errors: string[];
		details: any;
	}> {
		const errors: string[] = [];
		const details: any = {};

		try {
			const serverId = 'concurrent-test';
			const userId = 'test-user';

			// Create mock server
			mcpProtocolTest.createMockServer(serverId, {
				delay: 50, // Small delay to simulate network
			});

			// Simulate concurrent requests from same instance
			const concurrentRequests = 5;
			const promises = [];

			for (let i = 0; i < concurrentRequests; i++) {
				promises.push(
					this.connectionManager.getLiveConnectionStatus(`${serverId}-${i}`),
				);
			}

			const startTime = Date.now();
			const results = await Promise.all(promises);
			const concurrentExecutionTime = Date.now() - startTime;

			// All requests should complete
			if (results.length !== concurrentRequests) {
				errors.push('Not all concurrent requests completed');
			}

			// Concurrent execution should be efficient
			// (not much slower than single request due to parallelism)
			const expectedMaxTime = 150; // Reasonable for 5 concurrent requests with 50ms delay
			if (concurrentExecutionTime > expectedMaxTime) {
				errors.push(
					`Concurrent execution too slow: ${concurrentExecutionTime}ms (expected < ${expectedMaxTime}ms)`,
				);
			}

			details.concurrentRequests = concurrentRequests;
			details.executionTime = concurrentExecutionTime;
			details.averageTimePerRequest =
				concurrentExecutionTime / concurrentRequests;
		} catch (error) {
			errors.push(
				`Concurrent request test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}

		return {
			success: errors.length === 0,
			errors,
			details,
		};
	}

	/**
	 * Test memory cleanup and garbage collection readiness
	 */
	async testMemoryCleanup(): Promise<{
		success: boolean;
		errors: string[];
		details: any;
	}> {
		const errors: string[] = [];
		const details: any = {};

		try {
			const initialMemoryUsage = process.memoryUsage();

			// Simulate memory-intensive operations
			const connectionManager = new ConnectionManager();
			const testOperations = [];

			for (let i = 0; i < 100; i++) {
				const serverId = `memory-test-${i}`;
				testOperations.push(
					connectionManager.getLiveConnectionStatus(serverId),
				);
			}

			await Promise.all(testOperations);

			// Force garbage collection if available
			if (global.gc) {
				global.gc();
			}

			const finalMemoryUsage = process.memoryUsage();
			const memoryIncrease =
				finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed;

			// Memory increase should be reasonable (< 10MB for this test)
			const maxMemoryIncrease = 10 * 1024 * 1024; // 10MB
			if (memoryIncrease > maxMemoryIncrease) {
				errors.push(
					`Memory usage increased by ${Math.round(memoryIncrease / 1024 / 1024)}MB (should be < 10MB)`,
				);
			}

			details.initialMemory = initialMemoryUsage;
			details.finalMemory = finalMemoryUsage;
			details.memoryIncrease = memoryIncrease;
			details.memoryIncreaseKB = Math.round(memoryIncrease / 1024);
		} catch (error) {
			errors.push(
				`Memory cleanup test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}

		return {
			success: errors.length === 0,
			errors,
			details,
		};
	}

	/**
	 * Test cache TTL behavior and refresh strategies
	 */
	async testCacheTTLBehavior(): Promise<{
		success: boolean;
		errors: string[];
		details: any;
	}> {
		const errors: string[] = [];
		const details: any = {};

		try {
			const serverId = 'ttl-test-server';

			// Test capabilities cache (2h TTL)
			const mockCapabilities = {
				tools: [{ name: 'ttl_test_tool', description: 'TTL test tool' }],
				capabilities: { tools: {} },
				cachedAt: new Date().toISOString(),
				serverUrl: 'mock://ttl-test',
			};

			await mcpToolCache.cacheServerTools(serverId, mockCapabilities);

			// Verify cache is valid
			const isValidBefore = await mcpToolCache.isCacheValid(serverId);
			if (!isValidBefore) {
				errors.push('Newly cached capabilities should be valid');
			}

			// Test OAuth cache (30min TTL)
			const mockTokens = {
				accessToken: 'test-access-token',
				refreshToken: 'test-refresh-token',
				serverUrl: 'mock://ttl-test',
			};

			await mcpOAuthCache.cacheValidatedToken(serverId, mockTokens);

			// Verify OAuth cache
			const cachedTokens = await mcpOAuthCache.getValidatedToken(serverId);
			if (
				!cachedTokens ||
				cachedTokens.accessToken !== mockTokens.accessToken
			) {
				errors.push('OAuth tokens should be cached correctly');
			}

			// Test cache validity checking
			const isTokenCacheValid = await mcpOAuthCache.isTokenCacheValid(
				serverId,
				mockTokens.accessToken,
			);
			if (!isTokenCacheValid) {
				errors.push('Newly cached tokens should be valid');
			}

			details.capabilitiesCacheValid = isValidBefore;
			details.oauthCacheValid = isTokenCacheValid;
			details.cachedTokens = cachedTokens;
		} catch (error) {
			errors.push(
				`Cache TTL test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}

		return {
			success: errors.length === 0,
			errors,
			details,
		};
	}

	/**
	 * Run complete Fluid Compute test suite
	 */
	async runFluidComputeTests(): Promise<{
		success: boolean;
		results: Record<string, any>;
		summary: {
			totalTests: number;
			passedTests: number;
			failedTests: number;
		};
	}> {
		const testSuites: FluidComputeTestScenario[] = [
			{
				name: 'Cache Resilience Across Instances',
				description:
					'Tests KV cache persistence and in-memory state loss across instance restarts',
				test: () => this.testCacheResilienceAcrossInstances(),
			},
			{
				name: 'Cold Start Performance',
				description: 'Tests cache effectiveness in reducing cold start impact',
				test: () => this.testColdStartPerformance(),
			},
			{
				name: 'Concurrent Request Handling',
				description:
					'Tests handling of concurrent requests within single instance',
				test: () => this.testConcurrentRequestHandling(),
			},
			{
				name: 'Memory Cleanup',
				description: 'Tests memory usage and garbage collection readiness',
				test: () => this.testMemoryCleanup(),
			},
			{
				name: 'Cache TTL Behavior',
				description:
					'Tests cache TTL strategies for capabilities and OAuth tokens',
				test: () => this.testCacheTTLBehavior(),
			},
		];

		const results: Record<string, any> = {};
		let passedTests = 0;
		let failedTests = 0;

		for (const suite of testSuites) {
			try {
				console.log(`Running Fluid Compute test: ${suite.name}`);
				const result = await suite.test();
				results[suite.name] = {
					...result,
					description: suite.description,
				};

				if (result.success) {
					passedTests++;
					console.log(`✓ ${suite.name} passed`);
				} else {
					failedTests++;
					console.log(`✗ ${suite.name} failed:`, result.errors);
				}
			} catch (error) {
				results[suite.name] = {
					success: false,
					errors: [
						`Test suite failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
					],
					details: {},
					description: suite.description,
				};
				failedTests++;
				console.log(`✗ ${suite.name} failed with exception:`, error);
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
	 * Clean up test resources
	 */
	cleanup(): void {
		// Clean up any test resources
		mcpProtocolTest.cleanup();
	}
}

// Export singleton instance
export const fluidComputeTest = new FluidComputeTestSuite();

// Export types
export type { FluidComputeTestScenario };
