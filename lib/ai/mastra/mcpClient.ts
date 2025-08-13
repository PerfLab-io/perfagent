import { MCPClient } from '@perflab/mastra-mcp';
import { db } from '@/drizzle/db';
import { mcpServers } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { toolCatalog } from './toolCatalog';
import {
	listMcpResources as listMcpResourcesMod,
	readMcpResource as readMcpResourceMod,
} from './resources';
import {
	listMcpPrompts as listMcpPromptsMod,
	getMcpPrompt as getMcpPromptMod,
} from './prompts';
import {
	refreshOAuthToken as refreshOAuthTokenExt,
	validateAccessToken as validateAccessTokenExt,
	ensureFreshToken as ensureFreshTokenExt,
} from './oauth/tokens';
import { OAUTH_CONFIG as BASE_OAUTH_CONFIG } from './config';
export const OAUTH_CONFIG = BASE_OAUTH_CONFIG;

export { createUserMcpClient } from './client/factory';
export { getMcpServerInfo } from './capabilities';

export class OAuthRequiredError extends Error {
	authUrl: string;
	constructor(authUrl: string) {
		super(`OAUTH_REQUIRED:${authUrl}`);
		this.name = 'OAuthRequiredError';
		this.authUrl = authUrl;
	}
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	return Promise.race([
		promise,
		new Promise<never>((_, reject) =>
			reject(new Error(`Request timed out after ${timeoutMs}ms`)),
		),
	]).finally(() => clearTimeout(timeout)) as Promise<T>;
}

// Reusable JSON-RPC initialize payload builder
function buildInitializeBody() {
	return {
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
	};
}

/**
 * Lists all resources available from the connected MCP servers
 */
export async function listMcpResources(client: MCPClient) {
	return await listMcpResourcesMod(client);
}

/**
 * Lists all prompts available from the connected MCP servers
 */
export async function listMcpPrompts(client: MCPClient) {
	return await listMcpPromptsMod(client);
}

/**
 * Reads a specific resource from an MCP server
 */
export async function readMcpResource(
	client: MCPClient,
	serverName: string,
	resourceUri: string,
) {
	return await readMcpResourceMod(client, serverName, resourceUri);
}

/**
 * Gets a specific prompt from an MCP server
 */
export async function getMcpPrompt(
	client: MCPClient,
	serverName: string,
	promptName: string,
) {
	return await getMcpPromptMod(client, serverName, promptName);
}

/**
 * Registers an elicitation handler for a specific server
 */
export async function registerElicitationHandler(
	client: MCPClient,
	serverName: string,
	handler: (request: any) => Promise<{
		action: 'accept' | 'decline' | 'cancel';
		content?: any;
		_meta?: any;
	}>,
) {
	if (!client) return;
	await client.elicitation.onRequest(serverName, handler);
}

/**
 * Handles OAuth authorization code after user completes authorization
 */
export async function handleOAuthAuthorizationCode(
	_userId: string,
	serverName: string,
	code: string,
	state: string,
	client: MCPClient,
) {
	try {
		// Provide authorization code to the MCP client
		await client.provideAuthorizationCode(serverName, code, state);

		console.log(`[OAuth] Successfully authorized server: ${serverName}`);

		// TODO: Store tokens in database for persistence
		// This would require access to the client's internal token storage

		return { success: true };
	} catch (error) {
		console.error(`[OAuth] Failed to authorize server ${serverName}:`, error);
		throw error;
	}
}

/**
 * Stores OAuth tokens for a server (for persistence across sessions)
 */
export async function storeOAuthTokens(
	userId: string,
	serverId: string,
	accessToken: string,
	refreshToken?: string,
	expiresAt?: Date,
) {
	await db
		.update(mcpServers)
		.set({
			accessToken,
			refreshToken,
			tokenExpiresAt: expiresAt?.toISOString(),
			updatedAt: new Date().toISOString(),
		})
		.where(and(eq(mcpServers.id, serverId), eq(mcpServers.userId, userId)));
}

/**
 * Retrieves stored OAuth tokens for a server
 */
export async function getStoredOAuthTokens(userId: string, serverId: string) {
	const server = await db
		.select({
			accessToken: mcpServers.accessToken,
			refreshToken: mcpServers.refreshToken,
			tokenExpiresAt: mcpServers.tokenExpiresAt,
		})
		.from(mcpServers)
		.where(and(eq(mcpServers.id, serverId), eq(mcpServers.userId, userId)))
		.limit(1);

	if (server.length === 0) {
		return null;
	}

	const serverData = server[0];
	return {
		accessToken: serverData.accessToken,
		refreshToken: serverData.refreshToken,
		expiresAt: serverData.tokenExpiresAt
			? new Date(serverData.tokenExpiresAt)
			: undefined,
	};
}

/**
 * Refreshes an expired OAuth access token using the refresh token
 */
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
	return await refreshOAuthTokenExt(
		serverUrl,
		refreshToken,
		serverId,
		userId,
		storedClientId,
	);
}

/**
 * Validates an access token by making a simple server request
 */
async function validateAccessToken(
	serverUrl: string,
	accessToken: string,
): Promise<boolean> {
	return await validateAccessTokenExt(serverUrl, accessToken);
}

/**
 * Ensures an access token is usable by checking expiry window and/or validating via initialize.
 * Optionally performs a refresh when needed.
 * Returns updated headers and serverRecord if a valid token is available; otherwise null.
 */
async function ensureFreshToken(
	serverRecord: any,
	serverId: string,
	userId: string,
	options: { preemptiveWindowMs?: number; validate?: boolean } = {},
): Promise<{
	updatedServerRecord: any;
	headers: { Authorization: string };
} | null> {
	return await ensureFreshTokenExt(serverRecord, serverId, userId, options);
}

/**
 * Tests connection to an MCP server and detects OAuth requirements
 * Now uses the new Connection Manager for better error handling
 */
export { testMcpServerConnection } from './connectivity';

/**
 * Gets all tools from the tool catalog
 */
export function getAllCatalogTools() {
	return toolCatalog.getAllTools();
}

/**
 * Gets tools by server from the catalog
 */
export function getCatalogToolsByServer(serverId: string) {
	return toolCatalog.getToolsByServer(serverId);
}

/**
 * Gets catalog statistics
 */
export function getCatalogStats() {
	return toolCatalog.getStats();
}

/**
 * Searches tools in the catalog
 */
export function searchCatalogTools(query: string) {
	return toolCatalog.searchTools(query);
}
