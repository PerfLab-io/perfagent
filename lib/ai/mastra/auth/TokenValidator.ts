/**
 * Token validation and refresh functionality extracted from existing OAuth implementation
 * Handles token validation via MCP initialize requests and token refresh flows
 */
import { refreshOAuthToken } from '@/lib/ai/mastra/mcpClient';

interface OAuthTokens {
	accessToken: string;
	refreshToken?: string;
	expiresIn?: number;
	clientId?: string;
}

interface ServerRecord {
	id: string;
	userId: string;
	url: string;
	accessToken: string | null;
	refreshToken: string | null;
	tokenExpiresAt: string | null;
	clientId: string | null;
	authStatus: string;
}

/**
 * Validates OAuth tokens and handles refresh operations
 */
export class TokenValidator {
	/**
	 * Validate an access token by making a proper MCP initialize request
	 * This follows the MCP specification for testing token validity
	 */
	async validate(serverUrl: string, accessToken: string): Promise<boolean> {
		try {
			console.log(`[Token Validator] Validating token for ${serverUrl}`);

			const response = await fetch(serverUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({
					jsonrpc: '2.0',
					id: 1,
					method: 'initialize',
					params: {
						protocolVersion: '2024-11-05',
						capabilities: {},
						clientInfo: {
							name: 'PerfAgent',
							version: '1.0.0',
						},
					},
				}),
			});

			if (response.ok) {
				console.log(`[Token Validator] Token is valid for ${serverUrl}`);
				return true;
			} else if (response.status === 401) {
				console.log(
					`[Token Validator] Token is invalid/expired for ${serverUrl}`,
				);
				return false;
			} else {
				// Other errors might not be token-related, log but assume token is valid
				console.log(
					`[Token Validator] Unexpected response ${response.status} for ${serverUrl}, assuming token is valid`,
				);
				return true;
			}
		} catch (error) {
			console.log(
				`[Token Validator] Network error validating token for ${serverUrl}:`,
				error,
			);
			// Network errors don't indicate token invalidity
			return true;
		}
	}

	/**
	 * Refresh OAuth tokens using the existing refresh logic
	 */
	async refresh(
		serverId: string,
		userId: string,
		serverRecord: ServerRecord,
	): Promise<OAuthTokens | null> {
		if (!serverRecord.refreshToken) {
			console.log(
				`[Token Validator] No refresh token available for server ${serverId}`,
			);
			return null;
		}

		console.log(`[Token Validator] Refreshing token for server ${serverId}`);

		try {
			// Use existing refreshOAuthToken logic
			const refreshedTokens = await refreshOAuthToken(
				serverRecord.url,
				serverRecord.refreshToken,
				serverId,
				userId,
				serverRecord.clientId || undefined,
			);

			if (!refreshedTokens) {
				console.log(
					`[Token Validator] Token refresh failed for server ${serverId}`,
				);
				return null;
			}

			console.log(
				`[Token Validator] Successfully refreshed token for server ${serverId}`,
			);

			// Convert the refresh result to our OAuthTokens interface
			return {
				accessToken: refreshedTokens.accessToken,
				refreshToken: refreshedTokens.refreshToken,
				expiresIn: refreshedTokens.expiresAt
					? Math.floor(
							(refreshedTokens.expiresAt.getTime() - Date.now()) / 1000,
						)
					: undefined,
				clientId: serverRecord.clientId || undefined, // Use existing clientId from server record
			};
		} catch (error) {
			console.error(
				`[Token Validator] Error refreshing token for server ${serverId}:`,
				error,
			);
			return null;
		}
	}

	/**
	 * Check if a token is near expiration and should be refreshed
	 */
	shouldRefreshToken(
		tokenExpiresAt: string | null,
		bufferMinutes: number = 10,
	): boolean {
		if (!tokenExpiresAt) return false;

		const expiresAt = new Date(tokenExpiresAt);
		const now = new Date();
		const bufferMs = bufferMinutes * 60 * 1000;

		// Return true if token expires within the buffer time
		return expiresAt.getTime() - now.getTime() < bufferMs;
	}

	/**
	 * Get time until token expires in seconds
	 */
	getTokenTTL(tokenExpiresAt: string | null): number | null {
		if (!tokenExpiresAt) return null;

		const expiresAt = new Date(tokenExpiresAt);
		const now = new Date();
		const ttlMs = expiresAt.getTime() - now.getTime();

		return Math.max(0, Math.floor(ttlMs / 1000));
	}

	/**
	 * Check if token is expired
	 */
	isTokenExpired(tokenExpiresAt: string | null): boolean {
		if (!tokenExpiresAt) return false;

		const expiresAt = new Date(tokenExpiresAt);
		const now = new Date();

		return now >= expiresAt;
	}
}

// Export types
export type { OAuthTokens, ServerRecord };
