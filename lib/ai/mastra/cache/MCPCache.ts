/**
 * MCP-specific caching classes for tools and OAuth tokens
 * Optimized for 2-hour tool caching and 30-minute token validation caching
 */
import { kv } from '@/lib/kv';

// Import existing types from the codebase
import type { ToolMetadata } from '@/lib/ai/mastra/toolCatalog';

interface ServerCapabilities {
	tools?: any[];
	resources?: any[];
	prompts?: any[];
	rootListChanged?: boolean;
}

interface ToolCacheEntry {
	tools: ToolMetadata[];
	capabilities: ServerCapabilities;
	cachedAt: string;
	serverVersion?: string;
	serverUrl: string;
}

interface TokenCacheEntry {
	accessToken: string;
	refreshToken?: string;
	expiresAt?: string;
	clientId?: string;
	validatedAt: string;
	serverUrl: string;
}

/**
 * Cache for MCP server tools and capabilities
 * Uses 2-hour TTL with automatic compression for large tool data
 */
export class MCPToolCache {
	private PREFIX = 'mcp:tools:';
	private TTL = 2 * 60 * 60; // 2 hours

	async getServerTools(serverId: string): Promise<ToolCacheEntry | null> {
		const entry = await kv.get<ToolCacheEntry>(`${this.PREFIX}${serverId}`);
		
		if (entry) {
			console.log(`[MCP Tool Cache] Cache hit for server ${serverId}`);
			return entry;
		}
		
		console.log(`[MCP Tool Cache] Cache miss for server ${serverId}`);
		return null;
	}

	async cacheServerTools(
		serverId: string,
		entry: ToolCacheEntry,
	): Promise<void> {
		const cacheEntry: ToolCacheEntry = {
			...entry,
			cachedAt: new Date().toISOString(),
		};

		await kv.set(`${this.PREFIX}${serverId}`, cacheEntry, {
			expirationTtl: this.TTL,
			compress: true, // Tools data can be large
		});

		console.log(
			`[MCP Tool Cache] Cached ${entry.tools.length} tools for server ${serverId}`,
		);
	}

	async invalidateServer(serverId: string): Promise<void> {
		await kv.delete(`${this.PREFIX}${serverId}`);
		console.log(`[MCP Tool Cache] Invalidated cache for server ${serverId}`);
	}

	async invalidateAll(): Promise<void> {
		const keys = await kv.keys(`${this.PREFIX}*`);
		
		for (const key of keys) {
			await kv.delete(key);
		}
		
		console.log(`[MCP Tool Cache] Invalidated ${keys.length} cached tool entries`);
	}

	async getCacheStats(): Promise<{
		totalEntries: number;
		serverIds: string[];
	}> {
		const keys = await kv.keys(`${this.PREFIX}*`);
		const serverIds = keys.map((key) => key.replace(this.PREFIX, ''));

		return {
			totalEntries: keys.length,
			serverIds,
		};
	}

	/**
	 * Check if cache entry is still valid based on server version
	 */
	async isCacheValid(
		serverId: string,
		currentServerVersion?: string,
	): Promise<boolean> {
		const entry = await this.getServerTools(serverId);
		if (!entry) return false;

		// If we have version info, check if it matches
		if (currentServerVersion && entry.serverVersion) {
			return entry.serverVersion === currentServerVersion;
		}

		// Otherwise check age (cache is valid for TTL duration)
		const cacheAge = Date.now() - new Date(entry.cachedAt).getTime();
		return cacheAge < this.TTL * 1000;
	}
}

/**
 * Cache for OAuth token validation results
 * Uses 30-minute TTL for security - shorter than tool cache
 */
export class MCPOAuthCache {
	private PREFIX = 'mcp:oauth:';
	private TTL = 30 * 60; // 30 minutes

	async cacheValidatedToken(
		serverId: string,
		entry: Omit<TokenCacheEntry, 'validatedAt'>,
	): Promise<void> {
		const cacheEntry: TokenCacheEntry = {
			...entry,
			validatedAt: new Date().toISOString(),
		};

		await kv.set(`${this.PREFIX}${serverId}`, cacheEntry, {
			expirationTtl: this.TTL,
			// Don't compress tokens - they're small and security-sensitive
		});

		console.log(`[MCP OAuth Cache] Cached validated token for server ${serverId}`);
	}

	async getValidatedToken(serverId: string): Promise<TokenCacheEntry | null> {
		const entry = await kv.get<TokenCacheEntry>(`${this.PREFIX}${serverId}`);
		
		if (entry) {
			console.log(`[MCP OAuth Cache] Found cached token for server ${serverId}`);
			return entry;
		}
		
		return null;
	}

	async invalidateToken(serverId: string): Promise<void> {
		await kv.delete(`${this.PREFIX}${serverId}`);
		console.log(`[MCP OAuth Cache] Invalidated token cache for server ${serverId}`);
	}

	async invalidateAll(): Promise<void> {
		const keys = await kv.keys(`${this.PREFIX}*`);
		
		for (const key of keys) {
			await kv.delete(key);
		}
		
		console.log(`[MCP OAuth Cache] Invalidated ${keys.length} cached token entries`);
	}

	/**
	 * Check if cached token matches current token and is still valid
	 */
	async isTokenCacheValid(
		serverId: string,
		currentAccessToken: string,
	): Promise<boolean> {
		const entry = await this.getValidatedToken(serverId);
		if (!entry) return false;

		// Check if it's the same token
		if (entry.accessToken !== currentAccessToken) {
			// Token changed, invalidate cache
			await this.invalidateToken(serverId);
			return false;
		}

		// Check if cache is still fresh (within TTL)
		const cacheAge = Date.now() - new Date(entry.validatedAt).getTime();
		if (cacheAge >= this.TTL * 1000) {
			// Cache expired
			await this.invalidateToken(serverId);
			return false;
		}

		return true;
	}

	async getCacheStats(): Promise<{
		totalTokens: number;
		serverIds: string[];
	}> {
		const keys = await kv.keys(`${this.PREFIX}*`);
		const serverIds = keys.map((key) => key.replace(this.PREFIX, ''));

		return {
			totalTokens: keys.length,
			serverIds,
		};
	}
}

// Export singleton instances
export const mcpToolCache = new MCPToolCache();
export const mcpOAuthCache = new MCPOAuthCache();

// Export types
export type { ToolCacheEntry, TokenCacheEntry, ServerCapabilities };