import { MCPClient } from '@perflab/mastra-mcp';

function normalizeDateFields(data: any): any {
	if (!data || typeof data !== 'object') return data;
	if (Array.isArray(data)) return data.map((item) => normalizeDateFields(item));
	const normalized: any = { ...data };
	const dateFieldNames = [
		'createdAt',
		'updatedAt',
		'expiresAt',
		'tokenExpiresAt',
		'timestamp',
		'date',
	];
	for (const fieldName of dateFieldNames) {
		if (fieldName in normalized && normalized[fieldName]) {
			const value = normalized[fieldName];
			if (value instanceof Date) continue;
			if (typeof value === 'string') {
				try {
					const dateValue = new Date(value);
					if (!isNaN(dateValue.getTime())) normalized[fieldName] = dateValue;
				} catch {}
			}
		}
	}
	for (const key in normalized) {
		if (
			normalized[key] &&
			typeof normalized[key] === 'object' &&
			!Array.isArray(normalized[key]) &&
			!(normalized[key] instanceof Date)
		) {
			normalized[key] = normalizeDateFields(normalized[key]);
		}
	}
	return normalized;
}

function filterToSpecCompliantResource(resource: any) {
	const specCompliantResource: any = { uri: resource.uri };
	if (resource.name !== undefined) specCompliantResource.name = resource.name;
	if (resource.title !== undefined)
		specCompliantResource.title = resource.title;
	if (resource.description !== undefined)
		specCompliantResource.description = resource.description;
	if (resource.mimeType !== undefined)
		specCompliantResource.mimeType = resource.mimeType;
	return specCompliantResource;
}

export async function listMcpResources(client: MCPClient) {
	if (!client) return {} as any;
	try {
		console.log('[MCP Resources] About to call client.resources.list()');
		const resources = await client.resources.list();
		console.log(
			'[MCP Resources] Raw resources received:',
			JSON.stringify(resources, null, 2),
		);
		if (
			resources &&
			typeof resources === 'object' &&
			Array.isArray(resources.resources)
		) {
			const filtered = {
				...resources,
				resources: resources.resources.map(filterToSpecCompliantResource),
			};
			console.log(
				'[MCP Resources] Filtered to spec-compliant resources:',
				JSON.stringify(filtered, null, 2),
			);
			return filtered as any;
		}
		return resources as any;
	} catch (error) {
		console.error('[MCP Resources] Error in listMcpResources:', error);
		console.error(
			'[MCP Resources] Error stack:',
			error instanceof Error ? error.stack : 'No stack',
		);
		if (
			error instanceof Error &&
			error.message.includes('toISOString is not a function')
		) {
			console.error(
				'[MCP Resources] Date field error detected - this suggests the MCP server is returning non-standard date fields:',
				error.message,
			);
			console.error(
				'[MCP Resources] The MCP spec does not define date fields in resources. This may be a server implementation issue.',
			);
			return {} as any;
		}
		throw error;
	}
}

export async function readMcpResource(
	client: MCPClient,
	serverName: string,
	resourceUri: string,
) {
	if (!client) return null;
	try {
		const resource = await client.resources.read(serverName, resourceUri);
		return normalizeDateFields(resource);
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.includes('toISOString is not a function')
		) {
			console.warn(
				'[MCP Resource Read] Date field error detected, attempting to handle gracefully:',
				error.message,
			);
			return null;
		}
		throw error;
	}
}
