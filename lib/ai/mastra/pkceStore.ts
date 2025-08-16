/**
 * Redis-backed PKCE store using the shared KV client
 * Ensures 10-minute TTL and one-time retrieval semantics
 */
import { OAUTH_CONFIG } from './config';
import { kv } from '@/lib/kv';

interface PKCEData {
	codeVerifier: string;
	clientId: string;
	resource?: string;
	redirectUri?: string;
	createdAt: number;
}

const PREFIX = 'perfagent:pkce:';
const TTL_SECONDS = 10 * 60; // 10 minutes

export async function storePKCEVerifier(
	state: string,
	codeVerifier: string,
	clientId?: string,
	resource?: string,
	redirectUri?: string,
): Promise<void> {
	const value: PKCEData = {
		codeVerifier,
		clientId: clientId || OAUTH_CONFIG.clientName,
		resource,
		redirectUri,
		createdAt: Date.now(),
	};

	await kv.set(`${PREFIX}${state}`, value, {
		expirationTtl: TTL_SECONDS,
		// Small and sensitive; avoid compression
		compress: false,
	});
}

export async function retrievePKCEData(state: string): Promise<{
	codeVerifier: string;
	clientId: string;
	resource?: string;
	redirectUri?: string;
} | null> {
	const key = `${PREFIX}${state}`;
	const data = await kv.get<PKCEData>(key);
	if (!data) {
		return null;
	}

	// Extra safety: validate not older than TTL, though Redis TTL should enforce this
	if (Date.now() - data.createdAt > TTL_SECONDS * 1000) {
		await kv.delete(key);
		return null;
	}

	// Best-effort one-time read: delete after retrieval
	await kv.delete(key);
	return {
		codeVerifier: data.codeVerifier,
		clientId: data.clientId,
		resource: data.resource,
		redirectUri: data.redirectUri,
	};
}
