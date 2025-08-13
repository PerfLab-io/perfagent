import { MCPClient } from '@perflab/mastra-mcp';
import { db } from '@/drizzle/db';
import { mcpServers } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { mcpToolCache, type ToolCacheEntry } from './cache/MCPCache';
import { toolCatalog } from './toolCatalog';
import { SSE_ESTABLISH_DELAY_MS, TOKEN_EXPIRY_SKEW_MS } from './config';
import { listMcpResources as listMcpResourcesMod } from './resources';
import { ensureFreshToken } from './oauth/tokens';

export async function getMcpServerInfo(userId: string, serverId: string) {
	const cached = await mcpToolCache.getServerTools(serverId);
	const server = await db
		.select()
		.from(mcpServers)
		.where(and(eq(mcpServers.id, serverId), eq(mcpServers.userId, userId)))
		.limit(1);
	if (cached) {
		if (server.length === 0) return null;
		return {
			server: server[0],
			toolsets: cached.capabilities?.tools || {},
			resources: cached.capabilities?.resources || {},
			prompts: cached.capabilities?.prompts || {},
		};
	}
	if (server.length === 0) return null;
	let serverRecord = server[0];

	// do not proceed when authorization is required
	if (serverRecord.authStatus === 'required') {
		throw new Error(
			`Server ${serverRecord.name} requires OAuth authorization before accessing capabilities`,
		);
	}
	const urlPath = new URL(serverRecord.url).pathname;
	const isSseEndpoint = urlPath.endsWith('/sse');

	if (serverRecord.authStatus === 'authorized' && serverRecord.accessToken) {
		const ensured = await ensureFreshToken(serverRecord, serverId, userId, {
			preemptiveWindowMs: TOKEN_EXPIRY_SKEW_MS,
			// For SSE endpoints, validate with an initialize preflight to avoid transport auth hangs
			validate: isSseEndpoint,
		});
		if (ensured) serverRecord = ensured.updatedServerRecord;
	}
	const serverConfig: any = {
		url: new URL(serverRecord.url),
		timeout: 60_000,
		enableServerLogs: true,
		reconnectionOptions: {
			maxAttempts: 3,
			backoffMultiplier: 1.5,
			initialDelayMs: 1000,
			maxDelayMs: 5000,
		},
	};
	if (serverRecord.authStatus === 'authorized' && serverRecord.accessToken) {
		const authHeaders = { Authorization: `Bearer ${serverRecord.accessToken}` };
		serverConfig.requestInit = { headers: authHeaders };
		serverConfig.eventSourceInit = {
			headers: authHeaders,
			withCredentials: false,
		};
	}
	const client = new MCPClient({
		id: `user-${userId}-${Date.now()}`,
		servers: { [serverRecord.name]: serverConfig },
	});
	try {
		const callWithTimeout = async <T>(
			p: Promise<T>,
			ms: number,
			fallback: T,
		) => {
			return await Promise.race<T>([
				p,
				new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
			]);
		};

		const maxAttempts = isSseEndpoint ? 3 : 1; // first handshake can be slow; give two quick retries
		let toolsets: any = {};
		let resources: any = {};
		let prompts: any = {};
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			if (serverRecord.authStatus === 'authorized') {
				const delay = SSE_ESTABLISH_DELAY_MS * (attempt + 1);
				await new Promise((r) => setTimeout(r, delay));
			}
			const timeoutMs = 8000;
			const [t, r, p] = await Promise.all([
				callWithTimeout<any>(
					client.getToolsets().catch(() => ({})),
					timeoutMs,
					{},
				),
				callWithTimeout<any>(
					// Use same filtration/defensive logic as the public helper
					listMcpResourcesMod(client).catch(() => ({})) as any,
					timeoutMs,
					{},
				),
				callWithTimeout<any>(
					client.prompts.list().catch(() => ({})),
					timeoutMs,
					{},
				),
			]);
			toolsets = t;
			resources = r;
			prompts = p;
			const hasNonEmptyToolsets =
				toolsets &&
				typeof toolsets === 'object' &&
				Object.keys(toolsets).length > 0;
			const hasNonEmptyResources =
				resources &&
				typeof resources === 'object' &&
				Array.isArray((resources as any).resources) &&
				(resources as any).resources.length > 0;
			const hasNonEmptyPrompts =
				prompts &&
				typeof prompts === 'object' &&
				Array.isArray((prompts as any).prompts) &&
				(prompts as any).prompts.length > 0;
			if (hasNonEmptyToolsets || hasNonEmptyResources || hasNonEmptyPrompts)
				break;
		}
		if (toolsets) {
			try {
				const catalog = toolCatalog.registerCatalog(
					serverRecord.id,
					serverRecord.name,
					serverRecord.url,
					toolsets,
				);
				void catalog;
			} catch {}
		}
		const cacheable =
			(toolsets && Object.keys(toolsets).length > 0) ||
			(resources &&
				typeof resources === 'object' &&
				Array.isArray((resources as any).resources) &&
				(resources as any).resources.length > 0) ||
			(prompts &&
				typeof prompts === 'object' &&
				Array.isArray((prompts as any).prompts) &&
				(prompts as any).prompts.length > 0);
		if (cacheable) {
			const cacheEntry: ToolCacheEntry = {
				tools: [],
				capabilities: { tools: toolsets, resources, prompts },
				cachedAt: new Date().toISOString(),
				serverUrl: serverRecord.url,
			};
			await mcpToolCache.cacheServerTools(serverId, cacheEntry);
		}
		await client.disconnect();
		return { server: serverRecord, toolsets, resources, prompts };
	} finally {
		await client.disconnect();
	}
}
