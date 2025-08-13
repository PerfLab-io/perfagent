import { MCPClient } from '@perflab/mastra-mcp';

export async function listMcpPrompts(client: MCPClient) {
	if (!client) return {} as any;
	return (await client.prompts.list()) as any;
}

export async function getMcpPrompt(
	client: MCPClient,
	serverName: string,
	promptName: string,
) {
	if (!client) return null;
	return await client.prompts.get({ serverName, name: promptName });
}
