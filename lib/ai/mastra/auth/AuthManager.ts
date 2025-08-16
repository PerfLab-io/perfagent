/**
 * Database-centric OAuth Authentication Manager
 * Uses existing mcp_servers table as single source of truth with instance-level caching
 */
import { db } from '@/drizzle/db';
import { mcpServers } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import {
	TokenValidator,
	type OAuthTokens,
	type ServerRecord,
} from './TokenValidator';
import {
	mcpOAuthCache,
	type TokenCacheEntry,
} from '@/lib/ai/mastra/cache/MCPCache';

type AuthState = 'unknown' | 'required' | 'authorized' | 'failed';

interface AuthResult {
	status: 'authenticated' | 'requires_auth' | 'failed';
	authUrl?: string;
	error?: string;
}

interface AuthCacheEntry {
	state: AuthState;
	timestamp: number;
	accessToken?: string; // Track which token this cache entry is for
}

/**
 * Manages OAuth authentication state using database as primary source of truth
 * with instance-level caching for performance in Fluid Compute environment
 */
export class AuthManager {
	// Instance-level cache for current session (Fluid Compute optimization)
	private authCache = new Map<string, AuthCacheEntry>();
	private cacheTimeout = 5 * 60 * 1000; // 5 minutes

	constructor(private tokenValidator: TokenValidator = new TokenValidator()) {}

	/**
	 * Ensure a server is authenticated and ready for operations
	 */
	async ensureAuthenticated(
		serverId: string,
		userId: string,
	): Promise<AuthResult> {
		console.log(
			`[Auth Manager] Ensuring authentication for server ${serverId}`,
		);

		// Get current state from database (source of truth)
		const server = await this.getServerRecord(serverId, userId);
		if (!server) {
			throw new Error(`Server ${serverId} not found for user ${userId}`);
		}

		// Check instance cache first (Fluid Compute optimization)
		const cached = this.getInstanceCache(serverId, server.accessToken);
		if (cached?.state === 'authorized') {
			console.log(
				`[Auth Manager] Using cached auth state for server ${serverId}`,
			);
			return { status: 'authenticated' };
		}

		// Execute authentication flow based on current database state
		return await this.executeAuthFlow(server);
	}

	private async executeAuthFlow(server: ServerRecord): Promise<AuthResult> {
		const authState = server.authStatus as AuthState;
		console.log(
			`[Auth Manager] Executing auth flow for server ${server.id}, current state: ${authState}`,
		);

		switch (authState) {
			case 'authorized':
				return await this.validateAndRefreshIfNeeded(server);
			case 'required':
				return {
					status: 'requires_auth',
					error:
						'OAuth authorization required. Please complete the authentication flow.',
				};
			case 'failed':
				return {
					status: 'failed',
					error: 'Previous authentication failed. Please retry authorization.',
				};
			default:
				// 'unknown' state or any other state - detect requirements
				return await this.detectAuthRequirements(server);
		}
	}

	private async validateAndRefreshIfNeeded(
		server: ServerRecord,
	): Promise<AuthResult> {
		if (!server.accessToken) {
			console.log(
				`[Auth Manager] Server ${server.id} marked as authorized but no access token found`,
			);
			await this.transitionToRequired(server.id, server.userId);
			return { status: 'requires_auth' };
		}

		// Check if token is cached as valid in Redis
		const isTokenCacheValid = await mcpOAuthCache.isTokenCacheValid(
			server.id,
			server.accessToken,
		);
		if (isTokenCacheValid) {
			console.log(
				`[Auth Manager] Token validation cached for server ${server.id}`,
			);
			this.updateInstanceCache(server.id, 'authorized', server.accessToken);
			return { status: 'authenticated' };
		}

		// Check if token should be refreshed proactively
		if (this.tokenValidator.shouldRefreshToken(server.tokenExpiresAt, 10)) {
			console.log(
				`[Auth Manager] Token near expiration for server ${server.id}, attempting refresh`,
			);

			if (server.refreshToken) {
				const refreshedTokens = await this.tokenValidator.refresh(
					server.id,
					server.userId,
					server,
				);

				if (refreshedTokens) {
					await this.transitionToAuthorized(
						server.id,
						server.userId,
						refreshedTokens,
					);
					return { status: 'authenticated' };
				}
			}
		}

		// Validate token with actual server request
		console.log(`[Auth Manager] Validating token for server ${server.id}`);
		const isValid = await this.tokenValidator.validate(
			server.url,
			server.accessToken,
		);

		if (isValid) {
			// Cache the validated token in Redis
			await mcpOAuthCache.cacheValidatedToken(server.id, {
				accessToken: server.accessToken,
				refreshToken: server.refreshToken || undefined,
				expiresAt: server.tokenExpiresAt || undefined,
				clientId: server.clientId || undefined,
				serverUrl: server.url,
			});

			this.updateInstanceCache(server.id, 'authorized', server.accessToken);
			return { status: 'authenticated' };
		}

		// Token is invalid - try to refresh
		if (server.refreshToken) {
			console.log(
				`[Auth Manager] Token invalid for server ${server.id}, attempting refresh`,
			);

			const refreshedTokens = await this.tokenValidator.refresh(
				server.id,
				server.userId,
				server,
			);

			if (refreshedTokens) {
				await this.transitionToAuthorized(
					server.id,
					server.userId,
					refreshedTokens,
				);
				return { status: 'authenticated' };
			}
		}

		// Token invalid and can't refresh
		console.log(
			`[Auth Manager] Cannot validate or refresh token for server ${server.id}`,
		);
		await this.transitionToRequired(server.id, server.userId);
		return { status: 'requires_auth' };
	}

	private async detectAuthRequirements(
		server: ServerRecord,
	): Promise<AuthResult> {
		// For servers in 'unknown' state, we need to test if they require OAuth
		// This would involve making a test request to see if we get a 401 with WWW-Authenticate
		console.log(
			`[Auth Manager] Detecting auth requirements for server ${server.id}`,
		);

		// For now, if a server is in unknown state and has no tokens, mark as requiring auth
		// A more sophisticated implementation could test the server's response
		await this.transitionToRequired(server.id, server.userId);
		return { status: 'requires_auth' };
	}

	/**
	 * Transition server to 'required' state - needs OAuth authorization
	 */
	async transitionToRequired(serverId: string, userId: string): Promise<void> {
		console.log(
			`[Auth Manager] Transitioning server ${serverId} to 'required' state`,
		);

		await this.updateServerAuth(serverId, userId, {
			authStatus: 'required',
			accessToken: null,
			refreshToken: null,
			tokenExpiresAt: null,
			clientId: null,
			enabled: false,
		});

		// Clear caches
		await mcpOAuthCache.invalidateToken(serverId);
		this.clearInstanceCache(serverId);
	}

	/**
	 * Transition server to 'authorized' state - has valid OAuth tokens
	 */
	async transitionToAuthorized(
		serverId: string,
		userId: string,
		tokens: OAuthTokens,
	): Promise<void> {
		console.log(
			`[Auth Manager] Transitioning server ${serverId} to 'authorized' state`,
		);

		const expiresAt = tokens.expiresIn
			? new Date(Date.now() + tokens.expiresIn * 1000)
			: null;

		await this.updateServerAuth(serverId, userId, {
			authStatus: 'authorized',
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken || null,
			tokenExpiresAt: expiresAt?.toISOString() || null,
			clientId: tokens.clientId || null,
		});

		// Cache the validated token in Redis
		await mcpOAuthCache.cacheValidatedToken(serverId, {
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			expiresAt: expiresAt?.toISOString(),
			clientId: tokens.clientId,
			serverUrl: '', // Will be filled by the caller if needed
		});

		this.updateInstanceCache(serverId, 'authorized', tokens.accessToken);
	}

	/**
	 * Transition server to 'failed' state - authentication failed
	 */
	async transitionToFailed(
		serverId: string,
		userId: string,
		error?: string,
	): Promise<void> {
		console.log(
			`[Auth Manager] Transitioning server ${serverId} to 'failed' state: ${error || 'Unknown error'}`,
		);

		await this.updateServerAuth(serverId, userId, {
			authStatus: 'failed',
			accessToken: null,
			refreshToken: null,
			tokenExpiresAt: null,
			clientId: null,
		});

		// Clear caches
		await mcpOAuthCache.invalidateToken(serverId);
		this.clearInstanceCache(serverId);
	}

	/**
	 * Get current authentication state for a server
	 */
	async getAuthState(
		serverId: string,
		userId: string,
	): Promise<AuthState | null> {
		const server = await this.getServerRecord(serverId, userId);
		return server ? (server.authStatus as AuthState) : null;
	}

	/**
	 * Check if server is currently authenticated (has valid tokens)
	 */
	async isAuthenticated(serverId: string, userId: string): Promise<boolean> {
		const result = await this.ensureAuthenticated(serverId, userId);
		return result.status === 'authenticated';
	}

	private async updateServerAuth(
		serverId: string,
		userId: string,
		updates: Partial<ServerRecord>,
	): Promise<void> {
		await db
			.update(mcpServers)
			.set({
				...updates,
				updatedAt: new Date().toISOString(),
			})
			.where(and(eq(mcpServers.id, serverId), eq(mcpServers.userId, userId)));
	}

	private async getServerRecord(
		serverId: string,
		userId: string,
	): Promise<ServerRecord | null> {
		const servers = await db
			.select()
			.from(mcpServers)
			.where(and(eq(mcpServers.id, serverId), eq(mcpServers.userId, userId)))
			.limit(1);

		return servers[0] || null;
	}

	private getInstanceCache(
		serverId: string,
		currentAccessToken?: string | null,
	): AuthCacheEntry | null {
		const cached = this.authCache.get(serverId);
		if (!cached) return null;

		// Check if cache is still valid
		if (Date.now() - cached.timestamp > this.cacheTimeout) {
			this.authCache.delete(serverId);
			return null;
		}

		// Check if cached token matches current token
		if (currentAccessToken && cached.accessToken !== currentAccessToken) {
			this.authCache.delete(serverId);
			return null;
		}

		return cached;
	}

	private updateInstanceCache(
		serverId: string,
		state: AuthState,
		accessToken?: string,
	): void {
		this.authCache.set(serverId, {
			state,
			timestamp: Date.now(),
			accessToken,
		});
	}

	private clearInstanceCache(serverId: string): void {
		this.authCache.delete(serverId);
	}

	/**
	 * Clear all instance caches (useful for testing or cleanup)
	 */
	clearAllCaches(): void {
		this.authCache.clear();
	}

	/**
	 * Get cache statistics for monitoring
	 */
	getCacheStats() {
		const now = Date.now();
		const validEntries = Array.from(this.authCache.values()).filter(
			(entry) => now - entry.timestamp <= this.cacheTimeout,
		);

		return {
			totalCached: this.authCache.size,
			validCached: validEntries.length,
			expiredCached: this.authCache.size - validEntries.length,
		};
	}
}

// Export types
export type { AuthResult, AuthState };
