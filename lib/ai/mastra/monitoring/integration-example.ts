/**
 * Example of how to integrate performance monitoring into existing MCP code
 * This shows the patterns without modifying the actual production files
 */

import { performanceMonitor } from './PerformanceMonitor';
import { monitored, monitorCache, withMonitoring } from './instrumentation';

// Example 1: Decorating class methods
class ExampleConnectionManager {
	@monitored('connection.test')
	async testConnection(serverId: string): Promise<boolean> {
		// Existing connection test logic
		await new Promise(resolve => setTimeout(resolve, 100));
		return true;
	}

	@monitored('connection.ping')
	async pingServer(serverId: string): Promise<{ supported: boolean; success: boolean }> {
		// Existing ping logic
		return { supported: true, success: true };
	}
}

// Example 2: Wrapping cache operations
const originalCache = {
	async get(key: string) {
		// Simulate cache operation
		await new Promise(resolve => setTimeout(resolve, 10));
		return Math.random() > 0.5 ? { data: 'cached' } : null;
	},
	async set(key: string, value: any) {
		// Simulate cache operation
		await new Promise(resolve => setTimeout(resolve, 5));
	}
};

// Wrap cache with monitoring
const monitoredCache = monitorCache(originalCache, 'tools');

// Example 3: Manual timing for complex operations
async function exampleToolExecution(toolName: string, serverId: string) {
	return performanceMonitor.timeOperation(
		'tool.execution',
		async () => {
			// Existing tool execution logic
			await new Promise(resolve => setTimeout(resolve, 200));
			
			if (Math.random() > 0.1) {
				return { success: true, result: 'Tool executed' };
			} else {
				throw new Error('Tool execution failed');
			}
		},
		{ toolName, serverId }
	);
}

// Example 4: Wrapping existing functions
const originalGetServerInfo = async (serverId: string) => {
	// Simulate existing getMcpServerInfo
	await new Promise(resolve => setTimeout(resolve, 150));
	return { capabilities: { tools: [] } };
};

const monitoredGetServerInfo = withMonitoring(
	originalGetServerInfo, 
	'server.info'
);

// Example 5: Cache hit/miss tracking
async function exampleCacheAccess(key: string) {
	const startTime = Date.now();
	const result = await originalCache.get(key);
	const duration = Date.now() - startTime;
	
	// Track cache hit/miss
	performanceMonitor.trackCacheAccess('tools', result !== null, duration);
	
	return result;
}

// Example 6: SSE monitoring
import { SSEMonitor } from './instrumentation';

function exampleSSEConnection(serverId: string) {
	const sseMonitor = new SSEMonitor(serverId);
	
	// Simulate SSE connection
	setTimeout(() => sseMonitor.onConnect(), 100);
	
	// Simulate messages
	let messageCount = 0;
	const messageInterval = setInterval(() => {
		sseMonitor.onMessage();
		messageCount++;
		
		if (messageCount > 10) {
			clearInterval(messageInterval);
		}
	}, 50);
	
	return sseMonitor;
}

// Example usage demonstration
export async function demonstrateMonitoring() {
	console.log('🚀 Starting performance monitoring demonstration...');
	
	// Test connection manager
	const manager = new ExampleConnectionManager();
	await manager.testConnection('example-server');
	await manager.pingServer('example-server');
	
	// Test cache operations
	await monitoredCache.get('test-key');
	await monitoredCache.set('test-key', { data: 'test' });
	
	// Test tool execution
	try {
		await exampleToolExecution('test-tool', 'example-server');
	} catch (error) {
		console.log('Tool execution failed (expected for demo)');
	}
	
	// Test server info
	await monitoredGetServerInfo('example-server');
	
	// Test cache access
	await exampleCacheAccess('cache-test');
	
	// Test SSE
	const sseMonitor = exampleSSEConnection('example-server');
	
	// Wait a bit for operations to complete
	await new Promise(resolve => setTimeout(resolve, 1000));
	
	// Get performance summary
	const summary = performanceMonitor.getLocalSummary();
	console.log('📊 Performance Summary:', summary);
	
	console.log('✅ Monitoring demonstration complete!');
	
	return summary;
}

// Example integration patterns for different scenarios
export const INTEGRATION_PATTERNS = {
	// Pattern 1: Decorator for class methods (cleanest)
	decorator: `
		@monitored('operation.name')
		async methodName() { /* existing code */ }
	`,
	
	// Pattern 2: Wrapper for existing functions
	wrapper: `
		const monitored = withMonitoring(existingFunction, 'operation.name');
	`,
	
	// Pattern 3: Manual timing (most control)
	manual: `
		return performanceMonitor.timeOperation('operation.name', async () => {
			// existing code
		});
	`,
	
	// Pattern 4: Cache monitoring
	cache: `
		const monitoredCache = monitorCache(originalCache, 'cache-type');
	`,
	
	// Pattern 5: Specific tracking
	specific: `
		performanceMonitor.trackCacheAccess('type', hit, duration);
		performanceMonitor.trackToolExecution(tool, server, duration, success);
	`
};