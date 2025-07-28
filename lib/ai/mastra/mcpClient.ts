import { MCPClient } from '@mastra/mcp';
import { db } from '@/drizzle/db';
import { mcpServers } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Creates an MCP client instance for a specific user with their configured servers
 */
export async function createUserMcpClient(userId: string) {
	// Fetch user's enabled MCP servers from the database
	const servers = await db
		.select()
		.from(mcpServers)
		.where(and(eq(mcpServers.userId, userId), eq(mcpServers.enabled, true)));

	if (servers.length === 0) {
		return null;
	}

	// Create server configuration for Mastra MCPClient
	const serverConfig = servers.reduce(
		(acc, server) => {
			acc[server.name] = {
				url: new URL(server.url),
				timeout: 60_000, // 60 second timeout
			};
			return acc;
		},
		{} as Record<string, { url: URL; timeout?: number }>,
	);

	// Initialize MCP client with user's servers
	const client = new MCPClient({
		servers: serverConfig,
	});

	return client;
}

/**
 * Lists all resources available from the connected MCP servers
 */
export async function listMcpResources(client: MCPClient) {
	if (!client) return {};
	return await client.resources.list();
}

/**
 * Lists all prompts available from the connected MCP servers
 */
export async function listMcpPrompts(client: MCPClient) {
	if (!client) return {};
	return await client.prompts.list();
}

/**
 * Reads a specific resource from an MCP server
 */
export async function readMcpResource(
	client: MCPClient,
	serverName: string,
	resourceUri: string,
) {
	if (!client) return null;
	return await client.resources.read(serverName, resourceUri);
}

/**
 * Gets a specific prompt from an MCP server
 */
export async function getMcpPrompt(
	client: MCPClient,
	serverName: string,
	promptName: string,
) {
	if (!client) return null;
	return await client.prompts.get({
		serverName,
		name: promptName,
	});
}

/**
 * Registers an elicitation handler for a specific server
 */
export async function registerElicitationHandler(
	client: MCPClient,
	serverName: string,
	handler: (
		request: any,
	) => Promise<{
		action: 'accept' | 'decline' | 'cancel';
		content?: any;
		_meta?: any;
	}>,
) {
	if (!client) return;
	await client.elicitation.onRequest(serverName, handler);
}

/**
 * Gets information about a specific MCP server including its capabilities
 */
export async function getMcpServerInfo(userId: string, serverId: string) {
	// Fetch the specific server from the database
	const server = await db
		.select()
		.from(mcpServers)
		.where(and(eq(mcpServers.id, serverId), eq(mcpServers.userId, userId)))
		.limit(1);

	if (server.length === 0) {
		return null;
	}

	const serverRecord = server[0];

	// Create a temporary client just for this server
	const client = new MCPClient({
		servers: {
			[serverRecord.name]: {
				url: new URL(serverRecord.url),
				timeout: 60_000,
			},
		},
	});

	try {
		// Fetch all capabilities
		const [toolsets, resources, prompts] = await Promise.all([
			client.getToolsets(),
			client.resources.list(),
			client.prompts.list(),
		]);

		await client.disconnect();

		return {
			server: serverRecord,
			toolsets,
			resources,
			prompts,
		};
	} catch (error) {
		console.error('Error connecting to MCP server:', error);
		await client.disconnect();
		throw error;
	}
}
