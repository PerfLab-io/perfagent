import { MCPClient } from '@perflab/mastra-mcp';
import { db } from '@/drizzle/db';
import { mcpServers } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { OAUTH_CONFIG } from './config';
import {
	validateAccessToken,
	refreshOAuthToken,
	ensureFreshToken,
} from './oauth/tokens';
import { discoverOAuthAuthorizationUrl } from './oauth/discovery';
import { OAuthRequiredError } from './mcpClient';
import { REQUEST_TIMEOUT_MS } from './config';

export async function testMcpServerConnection(
	userId: string,
	serverId: string,
) {
	const server = await db
		.select()
		.from(mcpServers)
		.where(and(eq(mcpServers.id, serverId), eq(mcpServers.userId, userId)))
		.limit(1);
	if (server.length === 0) throw new Error('Server not found');
	const serverRecord = server[0];

	if (serverRecord.authStatus === 'authorized' && serverRecord.accessToken) {
		const isTokenValid = await validateAccessToken(
			serverRecord.url,
			serverRecord.accessToken,
		);
		if (!isTokenValid) {
			if (serverRecord.refreshToken) {
				try {
					const refreshedTokens = await refreshOAuthToken(
						serverRecord.url,
						serverRecord.refreshToken,
						serverId,
						userId,
						serverRecord.clientId || undefined,
					);
					if (refreshedTokens) {
						const ensured = await ensureFreshToken(
							{ ...serverRecord, accessToken: refreshedTokens.accessToken },
							serverId,
							userId,
							{ validate: true },
						);
						if (ensured) return { status: 'authorized' };
					}
				} catch {}
			}
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
				.where(eq(mcpServers.id, serverId));
			// fall through to discovery
		} else {
			return { status: 'authorized' };
		}
	}

	try {
		// Try direct initialize to get WWW-Authenticate
		const resp = await Promise.race([
			fetch(serverRecord.url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					jsonrpc: '2.0',
					id: 1,
					method: 'initialize',
					params: {
						protocolVersion: '2024-11-05',
						capabilities: {},
						clientInfo: { name: 'PerfAgent', version: '1.0.0' },
					},
				}),
			}),
			new Promise<Response>((_, reject) =>
				setTimeout(() => reject(new Error('timeout')), REQUEST_TIMEOUT_MS),
			),
		]);
		if (resp.status === 401) {
			const wwwAuth = resp.headers.get('www-authenticate');
			if (wwwAuth && wwwAuth.includes('Bearer')) {
				await db
					.update(mcpServers)
					.set({ authStatus: 'required', updatedAt: new Date().toISOString() })
					.where(eq(mcpServers.id, serverId));
				const authUrl = await discoverOAuthAuthorizationUrl(
					wwwAuth,
					serverRecord.url,
					{ clientIdOverride: serverRecord.clientId || undefined },
				);
				if (authUrl) return { status: 'auth_required', authUrl };
				return {
					status: 'auth_required',
					authUrl: null,
					message: 'OAuth required; discovery failed.',
				};
			}
		}
	} catch {}

	const cfg: any = { url: new URL(serverRecord.url), timeout: 30_000 };
	if (serverRecord.authStatus !== 'authorized' || !serverRecord.accessToken) {
		cfg.authorization = {
			redirectUris: OAUTH_CONFIG.redirectUris,
			scopes: OAUTH_CONFIG.scopes,
			clientName: OAUTH_CONFIG.clientName,
			onAuthorizationNeeded: async (_srv: any, authUrl: string) => {
				await db
					.update(mcpServers)
					.set({ authStatus: 'required', updatedAt: new Date().toISOString() })
					.where(eq(mcpServers.id, serverId));
				throw new OAuthRequiredError(authUrl);
			},
		};
	}
	if (serverRecord.authStatus === 'authorized' && serverRecord.accessToken) {
		const authHeaders = { Authorization: `Bearer ${serverRecord.accessToken}` };
		cfg.requestInit = { headers: authHeaders };
		cfg.eventSourceInit = { headers: authHeaders };
	}
	const testClient = new MCPClient({
		id: `test-${userId}-${Date.now()}`,
		servers: { [serverRecord.name]: cfg },
	});
	try {
		await testClient.getToolsets();
		await db
			.update(mcpServers)
			.set({ authStatus: 'authorized', updatedAt: new Date().toISOString() })
			.where(eq(mcpServers.id, serverId));
		return { status: 'authorized' };
	} catch (error) {
		if (error instanceof OAuthRequiredError) {
			return { status: 'auth_required', authUrl: error.authUrl };
		}
		await db
			.update(mcpServers)
			.set({ authStatus: 'failed', updatedAt: new Date().toISOString() })
			.where(eq(mcpServers.id, serverId));
		throw error;
	} finally {
		await testClient.disconnect();
	}
}
