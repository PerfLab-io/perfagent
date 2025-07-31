/**
 * Instrumentation helpers for adding performance monitoring
 * Optimized for Vercel Analytics with 2-property limit
 */

import { performanceMonitor } from './PerformanceMonitor';

/**
 * Decorator for timing async methods
 */
export function monitored(operationName?: string) {
	return function (
		target: any,
		propertyKey: string,
		descriptor: PropertyDescriptor,
	) {
		const originalMethod = descriptor.value;
		const operation =
			operationName || `${target.constructor.name}.${propertyKey}`;

		descriptor.value = async function (...args: any[]) {
			return performanceMonitor.timeOperation(operation, () =>
				originalMethod.apply(this, args),
			);
		};

		return descriptor;
	};
}

/**
 * Monitor cache operations with hit/miss tracking
 */
export function monitorCache<
	T extends {
		get: (...args: any[]) => Promise<any>;
		set: (...args: any[]) => Promise<any>;
	},
>(cache: T, cacheType: string): T {
	return {
		...cache,
		get: async (...args: any[]) => {
			const startTime = Date.now();
			const result = await cache.get(...args);
			const duration = Date.now() - startTime;

			// Track hit/miss
			performanceMonitor.trackCacheAccess(cacheType, result !== null, duration);

			return result;
		},
		set: async (...args: any[]) => {
			return performanceMonitor.timeOperation(`cache.set.${cacheType}`, () =>
				cache.set(...args),
			);
		},
	};
}

/**
 * Simple timing wrapper for functions
 */
export function withMonitoring<T extends (...args: any[]) => Promise<any>>(
	fn: T,
	operationName: string,
): T {
	return (async (...args: Parameters<T>) => {
		return performanceMonitor.timeOperation(operationName, () => fn(...args));
	}) as T;
}

/**
 * Monitor SSE connections
 */
export class SSEMonitor {
	private connectionStart: number;
	private messageCount: number = 0;

	constructor(private serverId: string) {
		this.connectionStart = Date.now();
	}

	onConnect(): void {
		const duration = Date.now() - this.connectionStart;
		performanceMonitor.timeOperation('sse.connect', async () => {}, {
			serverId: this.serverId,
			duration,
		});
	}

	onMessage(): void {
		this.messageCount++;
		// Only track every 10th message to avoid overwhelming analytics
		if (this.messageCount % 10 === 0) {
			performanceMonitor.timeOperation('sse.message', async () => {}, {
				serverId: this.serverId,
				messageCount: this.messageCount,
			});
		}
	}

	onError(error: Error): void {
		performanceMonitor
			.timeOperation(
				'sse.error',
				async () => {
					throw error;
				},
				{ serverId: this.serverId },
			)
			.catch(() => {}); // Error is tracked, don't re-throw
	}
}

/**
 * Performance middleware for API routes
 */
export function performanceMiddleware(routeName: string) {
	return async (
		req: Request,
		handler: () => Promise<Response>,
	): Promise<Response> => {
		return performanceMonitor.timeOperation(`api.${routeName}`, handler, {
			method: req.method,
		});
	};
}

/**
 * Track tool execution with proper categorization
 */
export async function monitorToolExecution<T>(
	toolName: string,
	serverId: string,
	fn: () => Promise<T>,
): Promise<T> {
	const startTime = Date.now();

	try {
		const result = await fn();
		const duration = Date.now() - startTime;
		performanceMonitor.trackToolExecution(toolName, serverId, duration, true);
		return result;
	} catch (error) {
		const duration = Date.now() - startTime;
		performanceMonitor.trackToolExecution(toolName, serverId, duration, false);
		throw error;
	}
}

/**
 * Create a monitored connection manager
 */
export function createMonitoredConnectionManager(
	ConnectionManagerClass: any,
): any {
	return class extends ConnectionManagerClass {
		async testLiveConnection(
			serverId: string,
			userId: string,
		): Promise<boolean> {
			return performanceMonitor.timeOperation(
				'connection.test',
				() => super.testLiveConnection(serverId, userId),
				{ serverId },
			);
		}

		async tryOptionalPing(serverId: string, userId: string): Promise<any> {
			return performanceMonitor.timeOperation(
				'connection.ping',
				() => super.tryOptionalPing(serverId, userId),
				{ serverId },
			);
		}
	};
}

/**
 * Create monitored auth manager
 */
export function createMonitoredAuthManager(AuthManagerClass: any): any {
	return class extends AuthManagerClass {
		async validateToken(serverId: string): Promise<boolean> {
			return performanceMonitor.timeOperation(
				'auth.validate',
				() => super.validateToken(serverId),
				{ serverId },
			);
		}

		async refreshToken(serverId: string): Promise<any> {
			return performanceMonitor.timeOperation(
				'auth.refresh',
				() => super.refreshToken(serverId),
				{ serverId },
			);
		}
	};
}

/**
 * Performance dashboard data (for direct use in components or logging)
 */
export function getPerformanceDashboard(timeWindowMs: number = 3600000) {
	const summary = performanceMonitor.getLocalSummary(timeWindowMs);
	const stats: Record<string, any> = {};

	// Get stats for key operations
	const keyOperations = [
		'connection.test',
		'connection.ping',
		'cache.get.tools',
		'cache.get.auth',
		'tool.execution',
		'auth.validate',
		'sse.connect',
	];

	for (const op of keyOperations) {
		const opStats = performanceMonitor.getStats(op, timeWindowMs);
		if (opStats) {
			stats[op] = {
				count: opStats.count,
				avg: Math.round(opStats.averageDuration),
				p95: Math.round(opStats.p95),
				p99: Math.round(opStats.p99),
			};
		}
	}

	return {
		summary: {
			...summary,
			avgDuration: Math.round(summary.avgDuration),
			successRate: Math.round(summary.successRate * 100) / 100,
		},
		operations: stats,
		timeWindow: timeWindowMs,
		timestamp: new Date().toISOString(),
	};
}

/**
 * Get performance stats for a specific operation
 */
export function getOperationStats(
	operationName: string,
	timeWindowMs: number = 3600000,
) {
	return performanceMonitor.getStats(operationName, timeWindowMs);
}

/**
 * Log performance summary to console (useful for debugging)
 */
export function logPerformanceSummary(timeWindowMs: number = 3600000) {
	const dashboard = getPerformanceDashboard(timeWindowMs);

	console.log('🚀 MCP Performance Summary');
	console.log('========================');
	console.log(`Time Window: ${timeWindowMs / 1000}s`);
	console.log(`Total Operations: ${dashboard.summary.totalOperations}`);
	console.log(`Success Rate: ${dashboard.summary.successRate}%`);
	console.log(`Average Duration: ${dashboard.summary.avgDuration}ms`);
	console.log(`Slow Operations: ${dashboard.summary.slowOperations}`);
	console.log(`Errors: ${dashboard.summary.errors}`);

	if (Object.keys(dashboard.operations).length > 0) {
		console.log('\nOperation Breakdown:');
		for (const [op, stats] of Object.entries(dashboard.operations)) {
			console.log(
				`  ${op}: ${stats.count} ops, avg: ${stats.avg}ms, p95: ${stats.p95}ms`,
			);
		}
	}
}

/**
 * Clear performance metrics (development helper)
 */
export function clearMetrics() {
	if (process.env.NODE_ENV !== 'production') {
		performanceMonitor.clear();
		console.log('🧹 Performance metrics cleared');
	} else {
		console.warn('⚠️ Cannot clear metrics in production');
	}
}

/**
 * Check if any operations are performing poorly
 */
export function getPerformanceAlerts(timeWindowMs: number = 3600000): Array<{
	operation: string;
	issue: string;
	value: number;
	threshold?: number;
}> {
	const alerts: Array<{
		operation: string;
		issue: string;
		value: number;
		threshold?: number;
	}> = [];

	const summary = performanceMonitor.getLocalSummary(timeWindowMs);

	// Check overall success rate
	if (summary.successRate < 95) {
		alerts.push({
			operation: 'overall',
			issue: 'low_success_rate',
			value: summary.successRate,
			threshold: 95,
		});
	}

	// Check slow operations
	if (summary.slowOperations > summary.totalOperations * 0.1) {
		alerts.push({
			operation: 'overall',
			issue: 'high_slow_operations',
			value: summary.slowOperations,
			threshold: Math.round(summary.totalOperations * 0.1),
		});
	}

	// Check individual operations
	const keyOperations = [
		'connection.test',
		'connection.ping',
		'cache.get.tools',
		'tool.execution',
	];

	for (const op of keyOperations) {
		const stats = performanceMonitor.getStats(op, timeWindowMs);
		if (stats) {
			// Check if P95 is too high
			if (stats.p95 > 2000) {
				// 2 seconds
				alerts.push({
					operation: op,
					issue: 'high_p95',
					value: stats.p95,
					threshold: 2000,
				});
			}
		}
	}

	return alerts;
}
