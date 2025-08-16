# MCP Infrastructure

Complete MCP (Model Context Protocol) infrastructure with caching, monitoring, error handling, and testing.

## 🚀 Quick Start

### Basic Connection Management
```typescript
import { ConnectionManager } from './connection/ConnectionManager';

const connectionManager = new ConnectionManager();

// Test a server connection
const isConnected = await connectionManager.testLiveConnection(serverId, userId);

// Get live connection status (in-memory only)
const status = connectionManager.getLiveConnectionStatus(serverId);

// Get cache stats
const stats = await connectionManager.getCacheStats();
```

### Performance Monitoring
```typescript
import { 
  monitored, 
  logPerformanceSummary, 
  getPerformanceAlerts 
} from './monitoring/instrumentation';

// Method decorator (recommended)
class MyService {
  @monitored('service.operation')
  async doSomething() {
    // Your code here
  }
}

// Direct monitoring
import { performanceMonitor } from './monitoring/PerformanceMonitor';

const result = await performanceMonitor.timeOperation(
  'custom.operation',
  async () => {
    // Your async operation
    return await someAsyncWork();
  }
);

// Development helpers
logPerformanceSummary();  // Logs to console
const alerts = getPerformanceAlerts();  // Check for issues
```

### Cache Usage
```typescript
import { mcpToolCache, mcpOAuthCache } from './cache/MCPCache';
import { monitorCache } from './monitoring/instrumentation';

// Direct cache usage
const tools = await mcpToolCache.getServerTools(serverId);
await mcpToolCache.cacheServerTools(serverId, toolsData);

// Monitored cache (tracks hit/miss)
const monitoredCache = monitorCache(mcpToolCache, 'tools');
const result = await monitoredCache.getServerTools(serverId); // Tracked automatically
```

### Error Handling
```typescript
import { errorHandler } from './connection/ErrorHandler';

try {
  await mcpOperation();
} catch (error) {
  if (errorHandler.is401Error(error)) {
    // Handle auth error
    const recovery = errorHandler.getErrorRecoveryRecommendation(error, context);
    console.log('Recovery action:', recovery.action);
  }
  
  if (errorHandler.isMCPProtocolError(error)) {
    // Handle MCP protocol error
    const message = errorHandler.getContextAwareErrorMessage(error, context);
    console.log('User-friendly message:', message);
  }
}
```

## 📁 Architecture

### Core Components

- **`connection/`** - Connection management and status tracking
  - `ConnectionManager.ts` - Unified MCP operations
  - `ErrorHandler.ts` - MCP spec-compliant error handling

- **`cache/`** - KV caching layer  
  - `MCPCache.ts` - Tool and OAuth caching (2h/30min TTL)

- **`auth/`** - Authentication management
  - `AuthManager.ts` - Database-centric auth
  - `TokenValidator.ts` - Pre-flight token validation

- **`monitoring/`** - Performance monitoring
  - `PerformanceMonitor.ts` - Vercel Analytics integration
  - `instrumentation.ts` - Decorators and helpers

- **`tools/`** - Tool execution service
  - `ToolExecutionService.ts` - Enhanced tool execution

- **`testing/`** - Comprehensive test framework
  - `mcpProtocolTest.ts` - Mock MCP server and protocol tests
  - `fluidComputeTest.ts` - Vercel Fluid Compute scenario tests
  - `*.test.ts` - Vitest test files (49 tests, all passing)

### Database Layer
- **`lib/kv.ts`** - Custom KV library with Upstash Redis
- **Database indexes** - Optimized for MCP operations

## 🎯 Key Features

### 1. **Connection Management**
- Live connection status (in-memory only)
- Optional MCP ping with fallback
- Automatic capability caching
- SSE connection handling

### 2. **Smart Caching Strategy**
- **KV Storage**: Only capabilities and validated tokens
- **Memory**: Live connection status (ephemeral)
- **Database**: Single source of truth
- **TTL**: Tools (2h), OAuth (30min)

### 3. **Performance Monitoring**
- **Production**: Vercel Analytics with 2-property optimization
- **Development**: Full metrics in memory
- **Smart Sampling**: 100% errors/slow, 10% normal operations
- **Error Classification**: auth, timeout, network, sse, rate_limit

### 4. **Error Recovery**
- MCP spec-compliant error codes (-32002, -32603, etc.)
- Context-aware error messages
- Recovery recommendations
- Layer-aware error detection

### 5. **Vercel Fluid Compute Optimized**
- No connection pooling
- Fast cold start (< 50ms cache retrieval)
- Instance-level optimization
- Memory efficient operations

## 🧪 Testing

### Run Tests
```bash
# All tests
pnpm test

# MCP-specific tests
pnpm test:mcp

# With coverage
pnpm test:coverage
```

### Test Architecture
- **49 tests, all passing**
- **No real server dependencies** - Uses mock MCP servers
- **Fluid Compute scenarios** - Tests serverless constraints
- **Protocol compliance** - MCP spec validation

## 📊 Performance Monitoring Usage

### 1. Method Decorators (Cleanest)
```typescript
import { monitored } from './monitoring/instrumentation';

class ConnectionManager {
  @monitored('connection.test')
  async testLiveConnection(serverId: string, userId: string): Promise<boolean> {
    // Existing logic - automatically monitored
  }
  
  @monitored('connection.ping') 
  async tryOptionalPing(serverId: string, userId: string): Promise<PingResult> {
    // Existing logic - automatically monitored
  }
}
```

### 2. Function Wrappers
```typescript
import { withMonitoring } from './monitoring/instrumentation';

const monitoredGetServerInfo = withMonitoring(
  getMcpServerInfo,
  'server.info'
);

// Usage stays the same, but now monitored
const info = await monitoredGetServerInfo(serverId, userId);
```

### 3. Manual Timing
```typescript
import { performanceMonitor } from './monitoring/PerformanceMonitor';

async function complexOperation() {
  return performanceMonitor.timeOperation(
    'complex.operation',
    async () => {
      // Multi-step operation
      const step1 = await doStep1();
      const step2 = await doStep2(step1);
      return step2;
    },
    { metadata: 'optional' }
  );
}
```

### 4. Cache Monitoring
```typescript
import { monitorCache } from './monitoring/instrumentation';
import { mcpToolCache } from './cache/MCPCache';

// Wrap existing cache with monitoring
const monitoredToolCache = monitorCache(mcpToolCache, 'tools');

// Automatically tracks cache hits/misses
const tools = await monitoredToolCache.getServerTools(serverId);
```

### 5. SSE Connection Monitoring
```typescript
import { SSEMonitor } from './monitoring/instrumentation';

function setupSSEConnection(serverId: string) {
  const sseMonitor = new SSEMonitor(serverId);
  
  eventSource.onopen = () => sseMonitor.onConnect();
  eventSource.onmessage = () => sseMonitor.onMessage();
  eventSource.onerror = (error) => sseMonitor.onError(error);
  
  return eventSource;
}
```

### 6. Development Helpers
```typescript
import { 
  logPerformanceSummary,
  getPerformanceDashboard,
  getPerformanceAlerts,
  clearMetrics 
} from './monitoring/instrumentation';

// Log summary to console
logPerformanceSummary(); // Last hour by default
logPerformanceSummary(600000); // Last 10 minutes

// Get structured data
const dashboard = getPerformanceDashboard();
console.log('Operations:', dashboard.operations);
console.log('Success rate:', dashboard.summary.successRate);

// Check for performance issues
const alerts = getPerformanceAlerts();
alerts.forEach(alert => {
  console.warn(`⚠️ ${alert.operation}: ${alert.issue} (${alert.value})`);
});

// Clear metrics (development only)
clearMetrics();
```

## 🔧 Integration Examples

### Add Monitoring to Existing Services

**Before:**
```typescript
export class ToolExecutionService {
  async executeTool(toolName: string, serverId: string, params: any) {
    // Existing logic
    return await actualExecution(toolName, params);
  }
}
```

**After:**
```typescript
import { monitored } from './monitoring/instrumentation';

export class ToolExecutionService {
  @monitored('tool.execution')
  async executeTool(toolName: string, serverId: string, params: any) {
    // Same logic, now monitored in production
    return await actualExecution(toolName, params);
  }
}
```

### Monitor API Routes
```typescript
import { performanceMiddleware } from './monitoring/instrumentation';

export async function POST(request: Request) {
  return performanceMiddleware('mcp.tools')(request, async () => {
    // Your API logic
    return new Response(JSON.stringify(result));
  });
}
```

### Track Specific Operations
```typescript
import { performanceMonitor } from './monitoring/PerformanceMonitor';

// Tool execution with metadata
async function executeSpecificTool(toolName: string, serverId: string) {
  const startTime = Date.now();
  
  try {
    const result = await actualToolExecution(toolName);
    const duration = Date.now() - startTime;
    
    // Track with specific metadata
    performanceMonitor.trackToolExecution(toolName, serverId, duration, true);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    performanceMonitor.trackToolExecution(toolName, serverId, duration, false);
    throw error;
  }
}
```

## 📈 Production Analytics

In production, metrics automatically flow to Vercel Analytics:

### Events Tracked
- `mcp_operation` - General operations with duration buckets
- `mcp_error` - Errors with error type classification  
- `mcp_slow_operation` - Operations exceeding thresholds
- `mcp_cache_hit` / `mcp_cache_miss` - Cache performance
- `tool_execution` - Tool usage by server type

### Property Strategy (2-property limit)
- **Property 1**: `operation` (what) - connection.test, tool_execution, etc.
- **Property 2**: `duration_bucket` or `error_type` (how) - 0-50ms, auth, timeout, etc.

### Smart Sampling
- **Errors**: 100% tracked
- **Slow operations**: 100% tracked  
- **Cache operations**: 100% tracked
- **Normal operations**: 10% sampled

## 🏗 Next Steps

1. **Add monitoring to existing services** using decorators or wrappers
2. **Review Vercel Analytics dashboard** for performance insights
3. **Set up alerts** for critical operations
4. **Optimize based on metrics** - cache hit rates, slow operations, error patterns
5. **Consider extracting to @perflab/mastra-mcp** package

## 🔍 Debugging

### View Performance Data
```typescript
// In any file, log current performance
import { logPerformanceSummary } from './monitoring/instrumentation';
logPerformanceSummary(); // Outputs to console

// Get specific operation stats
import { getOperationStats } from './monitoring/instrumentation';
const stats = getOperationStats('connection.test');
console.log('Connection test stats:', stats);
```

### Check for Issues
```typescript
import { getPerformanceAlerts } from './monitoring/instrumentation';

const alerts = getPerformanceAlerts();
if (alerts.length > 0) {
  console.warn('Performance issues detected:', alerts);
}
```

This infrastructure provides a solid foundation for reliable, monitored MCP operations in production with comprehensive testing and performance optimization.