import {
	MCPClient,
	type AuthorizationNeededCallback,
} from '@perflab/mastra-mcp';
import { db } from '@/drizzle/db';
import { mcpServers } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { OAUTH_CONFIG } from '../config';
import { ensureFreshToken } from '../oauth/tokens';
import { OAuthRequiredError } from '../oauth/error';

export async function createUserMcpClient(userId: string) {
	const servers = await db
		.select()
		.from(mcpServers)
		.where(and(eq(mcpServers.userId, userId), eq(mcpServers.enabled, true)));

	if (servers.length === 0) return null;

	const onAuthorizationNeeded: AuthorizationNeededCallback = async (
		serverUrl,
		authUrl,
		_context,
	) => {
		const serverRecord = servers.find((s) => s.url === serverUrl);

		if (serverRecord) {
			await db
				.update(mcpServers)
				.set({ authStatus: 'required', updatedAt: new Date().toISOString() })
				.where(eq(mcpServers.id, serverRecord.id));
		}

		throw new OAuthRequiredError(authUrl);
	};

	const serverConfig: Record<string, any> = {};

	for (const server of servers) {
		const config: any = {
			url: new URL(server.url),
			timeout: 60_000,
		};

		if (server.authStatus !== 'authorized' || !server.accessToken) {
			config.authorization = {
				redirectUris: OAUTH_CONFIG.redirectUris,
				scopes: OAUTH_CONFIG.scopes,
				clientName: OAUTH_CONFIG.clientName,
				onAuthorizationNeeded,
			};
		}

		if (server.authStatus === 'authorized' && server.accessToken) {
			const ensured = await ensureFreshToken(server, server.id, userId, {
				preemptiveWindowMs: 0,
				validate: false,
			});

			const tokenToUse =
				ensured?.updatedServerRecord?.accessToken || server.accessToken;
			const authHeaders = { Authorization: `Bearer ${tokenToUse}` };

			config.requestInit = { headers: authHeaders };
			config.eventSourceInit = { headers: authHeaders };
		}

		serverConfig[server.name] = config;
	}

	return new MCPClient({
		id: `user-${userId}-${Date.now()}`,
		servers: serverConfig,
	});
}
