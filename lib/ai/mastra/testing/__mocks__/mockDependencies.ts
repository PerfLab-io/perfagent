/**
 * Mock dependencies for testing
 * Provides isolated testing without external dependencies
 */

// Mock database
export const mockDb = {
	select: () => ({
		from: () => ({
			where: () => ({
				limit: () => Promise.resolve([]),
			}),
		}),
	}),
};

// Mock KV cache implementations
export class MockMCPToolCache {
	private cache = new Map<string, any>();

	async getServerTools(serverId: string) {
		return this.cache.get(`tools:${serverId}`) || null;
	}

	async cacheServerTools(serverId: string, entry: any) {
		this.cache.set(`tools:${serverId}`, entry);
	}

	async invalidateServer(serverId: string) {
		this.cache.delete(`tools:${serverId}`);
	}

	async isCacheValid(serverId: string) {
		const entry = this.cache.get(`tools:${serverId}`);
		if (!entry) return false;

		// Mock cache validity (assume valid if exists)
		return true;
	}

	async getCacheStats() {
		return {
			totalEntries: this.cache.size,
			serverIds: Array.from(this.cache.keys()),
		};
	}
}

export class MockMCPOAuthCache {
	private cache = new Map<string, any>();

	async cacheValidatedToken(serverId: string, entry: any) {
		this.cache.set(`oauth:${serverId}`, {
			...entry,
			validatedAt: new Date().toISOString(),
		});
	}

	async getValidatedToken(serverId: string) {
		return this.cache.get(`oauth:${serverId}`) || null;
	}

	async invalidateToken(serverId: string) {
		this.cache.delete(`oauth:${serverId}`);
	}

	async isTokenCacheValid(serverId: string, accessToken: string) {
		const entry = this.cache.get(`oauth:${serverId}`);
		if (!entry) return false;

		// Check if token matches
		return entry.accessToken === accessToken;
	}

	async getCacheStats() {
		return {
			totalTokens: this.cache.size,
			serverIds: Array.from(this.cache.keys()),
		};
	}
}

// Export mock instances
export const mockMcpToolCache = new MockMCPToolCache();
export const mockMcpOAuthCache = new MockMCPOAuthCache();
