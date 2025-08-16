export const OAUTH_CONFIG = {
	redirectUris: [
		process.env.NODE_ENV === 'development'
			? 'http://localhost:3000/api/mcp/oauth/callback'
			: 'https://agent.perflab.io/api/mcp/oauth/callback',
	],
	scopes: ['read', 'write'] as const,
	clientName: 'PerfAgent - AI Web Performance Analysis Tool',
};

// Centralized constants
export const REQUEST_TIMEOUT_MS = 10_000;
export const OAUTH_REQUEST_TIMEOUT_MS = 15_000;
export const SSE_ESTABLISH_DELAY_MS = 150;
export const TOKEN_EXPIRY_SKEW_MS = 5 * 60 * 1000; // 5 minutes
