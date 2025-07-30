/**
 * Simple in-memory store for PKCE parameters
 * In production, use Redis or database with TTL
 */
import { OAUTH_CONFIG } from './mcpClient';

interface PKCEData {
	codeVerifier: string;
	clientId: string;
	createdAt: number;
}

const pkceStore = new Map<string, PKCEData>();

// Clean up expired entries every 5 minutes
setInterval(
	() => {
		const now = Date.now();
		const EXPIRY_TIME = 10 * 60 * 1000; // 10 minutes

		for (const [state, data] of pkceStore.entries()) {
			if (now - data.createdAt > EXPIRY_TIME) {
				pkceStore.delete(state);
			}
		}
	},
	5 * 60 * 1000,
);

export function storePKCEVerifier(state: string, codeVerifier: string, clientId?: string): void {
	pkceStore.set(state, {
		codeVerifier,
		clientId: clientId || OAUTH_CONFIG.clientName,
		createdAt: Date.now(),
	});
}

export function retrievePKCEData(state: string): { codeVerifier: string; clientId: string } | null {
	const data = pkceStore.get(state);
	if (!data) {
		return null;
	}

	// Check if expired (10 minutes)
	if (Date.now() - data.createdAt > 10 * 60 * 1000) {
		pkceStore.delete(state);
		return null;
	}

	// Delete after retrieval for security
	pkceStore.delete(state);
	return { codeVerifier: data.codeVerifier, clientId: data.clientId };
}

// Backward compatibility
export function retrievePKCEVerifier(state: string): string | null {
	const data = retrievePKCEData(state);
	return data?.codeVerifier || null;
}
