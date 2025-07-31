/**
 * Performance Monitor for MCP Infrastructure
 * Integrates with Vercel Analytics for production monitoring
 */

import { track } from '@vercel/analytics/server';

interface PerformanceMetric {
	operation: string;
	duration: number;
	timestamp: Date;
	success: boolean;
	metadata?: Record<string, any>;
}

interface PerformanceStats {
	operation: string;
	count: number;
	totalDuration: number;
	averageDuration: number;
	minDuration: number;
	maxDuration: number;
	p50: number;
	p95: number;
	p99: number;
}

interface PerformanceThreshold {
	operation: string;
	warningMs: number;
	criticalMs: number;
}

// Event names for Vercel Analytics
const ANALYTICS_EVENTS = {
	MCP_OPERATION: 'mcp_operation',
	MCP_ERROR: 'mcp_error',
	MCP_SLOW: 'mcp_slow_operation',
	CACHE_HIT: 'mcp_cache_hit',
	CACHE_MISS: 'mcp_cache_miss',
} as const;

/**
 * Performance monitor for tracking MCP operation metrics
 * Uses Vercel Analytics for production monitoring with 2-property limit
 */
export class PerformanceMonitor {
	private metrics: PerformanceMetric[] = [];
	private readonly maxMetrics = 1000; // Keep last 1k metrics in memory
	private readonly thresholds: Map<string, PerformanceThreshold> = new Map();
	private readonly isProduction = process.env.NODE_ENV === 'production';

	constructor() {
		this.initializeDefaultThresholds();
	}

	/**
	 * Initialize default performance thresholds
	 */
	private initializeDefaultThresholds(): void {
		// Connection operations
		this.setThreshold('connection.test', 1000, 3000);
		this.setThreshold('connection.ping', 100, 500);

		// Cache operations
		this.setThreshold('cache.get', 50, 200);
		this.setThreshold('cache.set', 100, 500);

		// Tool operations
		this.setThreshold('tool.discovery', 500, 2000);
		this.setThreshold('tool.execution', 2000, 5000);

		// Auth operations
		this.setThreshold('auth.validate', 100, 500);
		this.setThreshold('auth.refresh', 1000, 3000);

		// SSE operations
		this.setThreshold('sse.connect', 500, 2000);
		this.setThreshold('sse.message', 100, 500);
	}

	/**
	 * Set performance threshold for an operation
	 */
	setThreshold(operation: string, warningMs: number, criticalMs: number): void {
		this.thresholds.set(operation, {
			operation,
			warningMs,
			criticalMs,
		});
	}

	/**
	 * Start timing an operation
	 */
	startOperation(
		operation: string,
		metadata?: Record<string, any>,
	): () => void {
		const startTime = Date.now();

		return () => {
			const duration = Date.now() - startTime;
			this.recordMetric(operation, duration, true, metadata);
		};
	}

	/**
	 * Time an async operation
	 */
	async timeOperation<T>(
		operation: string,
		fn: () => Promise<T>,
		metadata?: Record<string, any>,
	): Promise<T> {
		const startTime = Date.now();

		try {
			const result = await fn();
			const duration = Date.now() - startTime;
			this.recordMetric(operation, duration, true, metadata);
			return result;
		} catch (error) {
			const duration = Date.now() - startTime;
			this.recordMetric(operation, duration, false, {
				...metadata,
				error: error instanceof Error ? error.message : 'Unknown error',
			});
			throw error;
		}
	}

	/**
	 * Record a performance metric
	 */
	private recordMetric(
		operation: string,
		duration: number,
		success: boolean,
		metadata?: Record<string, any>,
	): void {
		const metric: PerformanceMetric = {
			operation,
			duration,
			timestamp: new Date(),
			success,
			metadata,
		};

		// Store in memory for local stats
		this.metrics.push(metric);
		if (this.metrics.length > this.maxMetrics) {
			this.metrics = this.metrics.slice(-this.maxMetrics);
		}

		// Send to Vercel Analytics in production
		if (this.isProduction) {
			this.sendToAnalytics(metric);
		}
	}

	/**
	 * Send metric to Vercel Analytics with 2-property limit
	 */
	private sendToAnalytics(metric: PerformanceMetric): void {
		const threshold = this.thresholds.get(metric.operation);

		// Strategy: Use 2 properties wisely
		// Property 1: operation (what)
		// Property 2: duration_bucket or status (how)

		if (!metric.success) {
			// Track errors
			track(ANALYTICS_EVENTS.MCP_ERROR, {
				operation: metric.operation,
				error_type: this.classifyError(metric.metadata?.error),
			});
			return;
		}

		// Check if it's a slow operation
		if (threshold && metric.duration >= threshold.criticalMs) {
			track(ANALYTICS_EVENTS.MCP_SLOW, {
				operation: metric.operation,
				duration_bucket: this.getDurationBucket(metric.duration),
			});
			return;
		}

		// For cache operations, track hit/miss
		if (metric.operation.startsWith('cache.get')) {
			const event = metric.metadata?.hit
				? ANALYTICS_EVENTS.CACHE_HIT
				: ANALYTICS_EVENTS.CACHE_MISS;

			track(event, {
				cache_type: this.getCacheType(metric.operation),
				duration_bucket: this.getDurationBucket(metric.duration),
			});
			return;
		}

		// For normal operations, sample to avoid hitting limits
		// Only track 10% of successful fast operations
		if (Math.random() < 0.1) {
			track(ANALYTICS_EVENTS.MCP_OPERATION, {
				operation: metric.operation,
				duration_bucket: this.getDurationBucket(metric.duration),
			});
		}
	}

	/**
	 * Classify error types for analytics
	 */
	private classifyError(error?: string): string {
		if (!error) return 'unknown';

		if (error.includes('UNAUTHORIZED') || error.includes('401')) return 'auth';
		if (error.includes('timeout') || error.includes('TIMEOUT'))
			return 'timeout';
		if (error.includes('network') || error.includes('ECONNREFUSED'))
			return 'network';
		if (error.includes('SSE') || error.includes('EventSource')) return 'sse';
		if (error.includes('rate limit')) return 'rate_limit';

		return 'other';
	}

	/**
	 * Get cache type from operation name
	 */
	private getCacheType(operation: string): string {
		if (operation.includes('tool')) return 'tools';
		if (operation.includes('oauth') || operation.includes('auth'))
			return 'auth';
		if (operation.includes('capability')) return 'capabilities';
		return 'other';
	}

	/**
	 * Bucket durations for analytics
	 */
	private getDurationBucket(duration: number): string {
		if (duration < 50) return '0-50ms';
		if (duration < 100) return '50-100ms';
		if (duration < 250) return '100-250ms';
		if (duration < 500) return '250-500ms';
		if (duration < 1000) return '500ms-1s';
		if (duration < 2000) return '1-2s';
		if (duration < 5000) return '2-5s';
		return '5s+';
	}

	/**
	 * Get performance statistics for an operation (local only)
	 */
	getStats(operation: string, timeWindowMs?: number): PerformanceStats | null {
		const cutoffTime = timeWindowMs
			? new Date(Date.now() - timeWindowMs)
			: new Date(0);

		const relevantMetrics = this.metrics.filter(
			(m) => m.operation === operation && m.timestamp >= cutoffTime,
		);

		if (relevantMetrics.length === 0) {
			return null;
		}

		const durations = relevantMetrics
			.map((m) => m.duration)
			.sort((a, b) => a - b);
		const count = durations.length;
		const totalDuration = durations.reduce((sum, d) => sum + d, 0);

		return {
			operation,
			count,
			totalDuration,
			averageDuration: totalDuration / count,
			minDuration: durations[0],
			maxDuration: durations[count - 1],
			p50: this.getPercentile(durations, 50),
			p95: this.getPercentile(durations, 95),
			p99: this.getPercentile(durations, 99),
		};
	}

	/**
	 * Track cache hit/miss explicitly
	 */
	trackCacheAccess(cacheType: string, hit: boolean, duration: number): void {
		const operation = `cache.get.${cacheType}`;
		this.recordMetric(operation, duration, true, { hit });
	}

	/**
	 * Track tool execution
	 */
	trackToolExecution(
		toolName: string,
		serverId: string,
		duration: number,
		success: boolean,
	): void {
		const operation = 'tool.execution';
		this.recordMetric(operation, duration, success, { toolName, serverId });

		// For production, aggregate tool names to avoid cardinality
		if (this.isProduction && success) {
			track(ANALYTICS_EVENTS.MCP_OPERATION, {
				operation: 'tool_execution',
				server_type: this.getServerType(serverId),
			});
		}
	}

	/**
	 * Get server type for analytics (to reduce cardinality)
	 */
	private getServerType(serverId: string): string {
		// Group servers by type to avoid high cardinality
		if (serverId.includes('github')) return 'github';
		if (serverId.includes('cf-observability')) return 'cf_observability';
		if (serverId.includes('slack')) return 'slack';
		if (serverId.includes('mcp-server-')) return 'generic';
		return 'custom';
	}

	/**
	 * Calculate percentile
	 */
	private getPercentile(sortedValues: number[], percentile: number): number {
		const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
		return sortedValues[Math.max(0, index)];
	}

	/**
	 * Get local performance summary (not sent to analytics)
	 */
	getLocalSummary(timeWindowMs: number = 3600000): {
		totalOperations: number;
		successRate: number;
		avgDuration: number;
		slowOperations: number;
		errors: number;
	} {
		const cutoffTime = new Date(Date.now() - timeWindowMs);
		const recentMetrics = this.metrics.filter((m) => m.timestamp >= cutoffTime);

		if (recentMetrics.length === 0) {
			return {
				totalOperations: 0,
				successRate: 100,
				avgDuration: 0,
				slowOperations: 0,
				errors: 0,
			};
		}

		const successful = recentMetrics.filter((m) => m.success);
		const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);

		const slowCount = recentMetrics.filter((m) => {
			const threshold = this.thresholds.get(m.operation);
			return threshold && m.duration >= threshold.warningMs;
		}).length;

		return {
			totalOperations: recentMetrics.length,
			successRate: (successful.length / recentMetrics.length) * 100,
			avgDuration: totalDuration / recentMetrics.length,
			slowOperations: slowCount,
			errors: recentMetrics.length - successful.length,
		};
	}

	/**
	 * Clear local metrics
	 */
	clear(): void {
		this.metrics = [];
	}
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export types
export type { PerformanceMetric, PerformanceStats, PerformanceThreshold };
