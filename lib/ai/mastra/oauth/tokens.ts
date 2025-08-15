import { db } from '@/drizzle/db';
import { mcpServers } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { OAUTH_CONFIG } from '../config';

function buildInitializeBody() {
	return {
		jsonrpc: '2.0',
		id: 1,
		method: 'initialize',
		params: {
			protocolVersion: '2024-11-05',
			capabilities: {},
			clientInfo: { name: 'PerfAgent', version: '1.0.0' },
		},
	};
}

export async function validateAccessToken(
	serverUrl: string,
	accessToken: string,
): Promise<boolean> {
	try {
		const response = await fetch(serverUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify(buildInitializeBody()),
		});

		if (response.ok) return true;
		if (response.status === 401) return false;

		return true;
	} catch {
		return true;
	}
}

export async function refreshOAuthToken(
	serverUrl: string,
	refreshToken: string,
	serverId: string,
	userId: string,
	storedClientId?: string,
): Promise<{
	accessToken: string;
	refreshToken?: string;
	expiresAt?: Date;
} | null> {
	try {
		const resourceUrl = new URL(serverUrl);
		const authServerUrl = resourceUrl.origin;
		const metadataUrls = [
			`${authServerUrl}/.well-known/oauth-authorization-server`,
			`${serverUrl}/.well-known/oauth-authorization-server`,
		];

		let tokenEndpoint: string | null = null;

		for (const metadataUrl of metadataUrls) {
			try {
				const response = await fetch(metadataUrl);

				if (response.ok) {
					const metadata = await response.json();

					if (metadata.token_endpoint) {
						tokenEndpoint = metadata.token_endpoint;

						break;
					}
				}
			} catch {}
		}
		if (!tokenEndpoint) tokenEndpoint = `${authServerUrl}/oauth/token`;

		let clientIdToUse = storedClientId || OAUTH_CONFIG.clientName;

		const refreshParams = new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
			client_id: clientIdToUse,
		});

		let response = await fetch(tokenEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: refreshParams,
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => '');

			if (response.status === 401 && errorText.includes('invalid_client')) {
				const alternatives = [
					'PerfAgent - AI Web Performance Analysis Tool',
					'perfagent',
					'mcp-client',
					'',
				].filter((c) => c !== clientIdToUse && c !== storedClientId);

				for (const alt of alternatives) {
					const altParams = new URLSearchParams({
						grant_type: 'refresh_token',
						refresh_token: refreshToken,
						client_id: alt,
					});

					response = await fetch(tokenEndpoint, {
						method: 'POST',
						headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
						body: altParams,
					});

					if (response.ok) break;
				}
			}
		}

		if (!response.ok) {
			let finalErrorText = 'Unknown error';

			try {
				finalErrorText = await response.text();
			} catch {}

			if (
				response.status === 401 &&
				(finalErrorText.includes('invalid_grant') ||
					finalErrorText.includes('invalid_client') ||
					finalErrorText.includes('Client not found'))
			) {
				await db
					.update(mcpServers)
					.set({
						authStatus: 'required',
						accessToken: null,
						refreshToken: null,
						tokenExpiresAt: null,
						clientId: null,
						updatedAt: new Date().toISOString(),
					})
					.where(
						and(eq(mcpServers.id, serverId), eq(mcpServers.userId, userId)),
					);
			}

			return null;
		}

		const tokenData = await response.json();
		const expiresAt = tokenData.expires_in
			? new Date(Date.now() + tokenData.expires_in * 1000)
			: undefined;

		const updateData: any = {
			accessToken: tokenData.access_token,
			tokenExpiresAt: expiresAt?.toISOString() || null,
			updatedAt: new Date().toISOString(),
		};

		if (tokenData.refresh_token)
			updateData.refreshToken = tokenData.refresh_token;

		await db
			.update(mcpServers)
			.set(updateData)
			.where(and(eq(mcpServers.id, serverId), eq(mcpServers.userId, userId)));

		return {
			accessToken: tokenData.access_token,
			refreshToken: tokenData.refresh_token,
			expiresAt,
		};
	} catch {
		return null;
	}
}

export async function ensureFreshToken(
	serverRecord: any,
	serverId: string,
	userId: string,
	options: { preemptiveWindowMs?: number; validate?: boolean } = {},
) {
	if (!serverRecord?.accessToken) return null;

	let shouldRefresh = false;

	if (serverRecord.tokenExpiresAt) {
		const expiresAt = new Date(serverRecord.tokenExpiresAt);
		const now = new Date();
		const pre = options.preemptiveWindowMs ?? 0;

		shouldRefresh =
			now >= expiresAt || expiresAt.getTime() - now.getTime() < pre;
	}

	if (!shouldRefresh && options.validate) {
		const isValid = await validateAccessToken(
			serverRecord.url,
			serverRecord.accessToken,
		);

		shouldRefresh = !isValid;
	}

	let currentAccessToken = serverRecord.accessToken as string;

	if (shouldRefresh && serverRecord.refreshToken) {
		const refreshed = await refreshOAuthToken(
			serverRecord.url,
			serverRecord.refreshToken,
			serverId,
			userId,
			serverRecord.clientId || undefined,
		);

		if (refreshed?.accessToken) {
			serverRecord = {
				...serverRecord,
				accessToken: refreshed.accessToken,
				refreshToken: refreshed.refreshToken || serverRecord.refreshToken,
				tokenExpiresAt: refreshed.expiresAt?.toISOString() || null,
			};

			currentAccessToken = refreshed.accessToken;
		}
	}

	if (!currentAccessToken) return null;

	return {
		updatedServerRecord: serverRecord,
		headers: { Authorization: `Bearer ${currentAccessToken}` },
	};
}
