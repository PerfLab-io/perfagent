import {
	MCPClient,
	type AuthorizationNeededCallback,
} from '@perflab/mastra-mcp';
import { db } from '@/drizzle/db';
import { mcpServers } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { storePKCEVerifier } from './pkceStore';
import { toolCatalog } from './toolCatalog';

// OAuth configuration constants
export const OAUTH_CONFIG = {
	redirectUris: [
		'http://localhost:3000/api/mcp/oauth/callback',
		'https://agent.perflab.io/api/mcp/oauth/callback',
		// Add your production domain here
	] as string[],
	scopes: ['read', 'write'] as string[], // Default scopes to request
	clientName: 'PerfAgent - AI Web Performance Analysis Tool',
};

/**
 * Discovers OAuth authorization URL from WWW-Authenticate header according to MCP specification
 * Based on RFC 9728 (Protected Resource Metadata) and RFC 8414 (Authorization Server Metadata)
 */
async function discoverOAuthAuthorizationUrl(
	wwwAuthHeader: string,
	resourceUrl: string,
): Promise<string | null> {
	try {
		// Parse WWW-Authenticate header
		// Format: Bearer realm="example", resource="https://example.com/mcp", as_uri="https://auth.example.com"
		const authServer = parseWWWAuthenticateHeader(wwwAuthHeader);

		let authServerUrl = authServer.as_uri;

		// If no as_uri in header, try to discover from resource_metadata or resource URL
		if (!authServerUrl) {
			console.log(
				'[OAuth] No as_uri in WWW-Authenticate header, trying resource metadata or URL discovery',
			);

			// First try the resource_metadata URL if provided (RFC 9728)
			if (authServer.resource_metadata) {
				try {
					console.log(
						'[OAuth] Fetching resource metadata from:',
						authServer.resource_metadata,
					);
					const resourceMetadataResponse = await fetch(
						authServer.resource_metadata,
					);
					if (resourceMetadataResponse.ok) {
						const resourceMetadata = await resourceMetadataResponse.json();
						console.log(
							'[OAuth] Resource metadata:',
							JSON.stringify(resourceMetadata, null, 2),
						);
						if (
							resourceMetadata.authorization_servers &&
							resourceMetadata.authorization_servers.length > 0
						) {
							authServerUrl = resourceMetadata.authorization_servers[0];
							console.log(
								'[OAuth] Found authorization server from resource metadata:',
								authServerUrl,
							);
						} else {
							console.log(
								'[OAuth] No authorization_servers found in resource metadata',
							);
						}
					} else {
						console.log(
							'[OAuth] Failed to fetch resource metadata:',
							resourceMetadataResponse.status,
							resourceMetadataResponse.statusText,
						);
					}
				} catch (error) {
					console.log('[OAuth] Failed to fetch resource metadata:', error);
				}
			}

			// If still no authServerUrl, try common discovery patterns
			if (!authServerUrl) {
				const resourceUrlObj = new URL(resourceUrl);

				// Try common authorization server discovery patterns
				const discoveryUrls = [
					// Try the resource URL itself
					`${resourceUrlObj.origin}/.well-known/oauth-authorization-server`,
					// Try removing path segments
					`${resourceUrlObj.protocol}//${resourceUrlObj.host}/.well-known/oauth-authorization-server`,
				];

				for (const discoveryUrl of discoveryUrls) {
					try {
						console.log(
							'[OAuth] Trying authorization server discovery at:',
							discoveryUrl,
						);
						const discoveryResponse = await fetch(discoveryUrl);
						if (discoveryResponse.ok) {
							authServerUrl = discoveryUrl.replace(
								'/.well-known/oauth-authorization-server',
								'',
							);
							console.log(
								'[OAuth] Found authorization server at:',
								authServerUrl,
							);
							break;
						}
					} catch (error) {
						console.log('[OAuth] Discovery failed for:', discoveryUrl, error);
						continue;
					}
				}
			}

			if (!authServerUrl) {
				console.log('[OAuth] Could not discover authorization server');
				return null;
			}
		}

		// Fetch authorization server metadata from /.well-known/oauth-authorization-server
		// Handle cases where the auth server is co-located with the resource server
		let metadataUrl = `${authServerUrl}/.well-known/oauth-authorization-server`;

		// If the auth server URL is the same as the resource server's origin,
		// try using the same path structure as the resource
		const resourceUrlObj = new URL(resourceUrl);
		if (
			authServerUrl === resourceUrlObj.origin &&
			resourceUrlObj.pathname !== '/'
		) {
			// Extract the base path from the resource URL (e.g., /api/mcp from https://v0.perflab.io/api/mcp)
			const pathSegments = resourceUrlObj.pathname
				.split('/')
				.filter((segment) => segment.length > 0);
			if (pathSegments.length > 0) {
				const basePath = '/' + pathSegments.join('/');
				metadataUrl = `${authServerUrl}${basePath}/.well-known/oauth-authorization-server`;
				console.log('[OAuth] Using co-located auth server path:', metadataUrl);
			}
		}

		console.log(
			'[OAuth] Fetching authorization server metadata from:',
			metadataUrl,
		);

		const metadataResponse = await fetch(metadataUrl);
		if (!metadataResponse.ok) {
			console.log(
				'[OAuth] Failed to fetch authorization server metadata:',
				metadataResponse.status,
				metadataResponse.statusText,
			);
			console.log('[OAuth] Tried URL:', metadataUrl);
			return null;
		}

		const metadata = await metadataResponse.json();
		console.log(
			'[OAuth] Authorization server metadata:',
			JSON.stringify(metadata, null, 2),
		);
		const authorizationEndpoint = metadata.authorization_endpoint;

		if (!authorizationEndpoint) {
			console.log('[OAuth] No authorization_endpoint found in server metadata');
			console.log('[OAuth] Available metadata keys:', Object.keys(metadata));
			return null;
		}

		// Construct authorization URL with proper parameters
		const authUrl = new URL(authorizationEndpoint);
		authUrl.searchParams.set('response_type', 'code');
		authUrl.searchParams.set('client_id', OAUTH_CONFIG.clientName);
		authUrl.searchParams.set('redirect_uri', OAUTH_CONFIG.redirectUris[0]);
		authUrl.searchParams.set('scope', OAUTH_CONFIG.scopes.join(' '));

		// Add resource parameter if specified (RFC 8707)
		if (authServer.resource) {
			authUrl.searchParams.set('resource', authServer.resource);
		}

		// Generate PKCE parameters
		const codeVerifier = generateCodeVerifier();
		const codeChallenge = await generateCodeChallenge(codeVerifier);
		authUrl.searchParams.set('code_challenge', codeChallenge);
		authUrl.searchParams.set('code_challenge_method', 'S256');

		// Generate state parameter for CSRF protection
		const state = generateState();
		authUrl.searchParams.set('state', state);

		// Store the code_verifier with the state for later retrieval
		storePKCEVerifier(state, codeVerifier);
		console.log('[OAuth] Stored PKCE code_verifier for state:', state);

		console.log('[OAuth] Generated authorization URL:', authUrl.toString());
		return authUrl.toString();
	} catch (error) {
		console.error('[OAuth] Error discovering authorization URL:', error);
		return null;
	}
}

/**
 * Parses WWW-Authenticate header according to RFC 9728
 */
function parseWWWAuthenticateHeader(header: string): {
	realm?: string;
	resource?: string;
	as_uri?: string;
	resource_metadata?: string;
} {
	const result: {
		realm?: string;
		resource?: string;
		as_uri?: string;
		resource_metadata?: string;
	} = {};

	// Remove "Bearer " prefix
	const params = header.replace(/^Bearer\s+/, '');

	// Parse key=value pairs
	const regex = /(\w+)="([^"]+)"/g;
	let match;

	while ((match = regex.exec(params)) !== null) {
		const [, key, value] = match;
		switch (key) {
			case 'realm':
				result.realm = value;
				break;
			case 'resource':
				result.resource = value;
				break;
			case 'as_uri':
				result.as_uri = value;
				break;
			case 'resource_metadata':
				result.resource_metadata = value;
				break;
		}
	}

	return result;
}

/**
 * Generates a cryptographically secure random code verifier for PKCE
 */
function generateCodeVerifier(): string {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
		'',
	);
}

/**
 * Generates code challenge from code verifier using SHA256
 */
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(codeVerifier);
	const digest = await crypto.subtle.digest('SHA-256', data);
	const base64 = Buffer.from(digest).toString('base64');
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generates a cryptographically secure random state parameter
 */
function generateState(): string {
	const array = new Uint8Array(16);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
		'',
	);
}

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

	// OAuth callback function to handle authorization redirects
	const onAuthorizationNeeded: AuthorizationNeededCallback = async (
		serverUrl,
		authUrl,
		_context,
	) => {
		console.log(`[OAuth] Authorization needed for server: ${serverUrl}`);
		console.log(`[OAuth] Authorization URL: ${authUrl}`);

		// Update server auth status to 'required'
		const serverRecord = servers.find((s) => s.url === serverUrl);
		if (serverRecord) {
			await db
				.update(mcpServers)
				.set({
					authStatus: 'required',
					updatedAt: new Date().toISOString(),
				})
				.where(eq(mcpServers.id, serverRecord.id));
		}

		// Throw error with auth URL - this will be caught and handled gracefully
		throw new Error(`OAUTH_REQUIRED:${authUrl}`);
	};

	// Create server configuration for Mastra MCPClient with OAuth always enabled
	const serverConfig = servers.reduce(
		(acc, server) => {
			const config: any = {
				url: new URL(server.url),
				timeout: 60_000, // 60 second timeout
				// Always include OAuth configuration with our constants
				authorization: {
					redirectUris: OAUTH_CONFIG.redirectUris,
					scopes: OAUTH_CONFIG.scopes,
					clientName: OAUTH_CONFIG.clientName,
					onAuthorizationNeeded,
				},
			};

			// If server has stored OAuth tokens, include them in requestInit for HTTP transport
			if (server.authStatus === 'authorized' && server.accessToken) {
				console.log(
					`[OAuth] Found stored access token for server: ${server.name}`,
				);
				config.requestInit = {
					headers: {
						Authorization: `Bearer ${server.accessToken}`,
					},
				};
			}

			acc[server.name] = config;
			return acc;
		},
		{} as Record<string, any>,
	);

	// Initialize MCP client with user's servers
	const client = new MCPClient({
		id: `user-${userId}-${Date.now()}`,
		servers: serverConfig,
	});

	// Note: Tool catalog registration moved to getMcpServerInfo to avoid interfering with client creation

	return client;
}

/**
 * Normalizes date fields in data structures to prevent "toISOString is not a function" errors
 */
function normalizeDateFields(data: any): any {
	if (!data || typeof data !== 'object') {
		return data;
	}

	// Handle arrays
	if (Array.isArray(data)) {
		return data.map(item => normalizeDateFields(item));
	}

	// Handle objects
	const normalized = { ...data };
	const dateFieldNames = ['createdAt', 'updatedAt', 'expiresAt', 'tokenExpiresAt', 'timestamp', 'date'];

	for (const fieldName of dateFieldNames) {
		if (fieldName in normalized && normalized[fieldName]) {
			const value = normalized[fieldName];
			// If it's already a Date object, leave it as is
			if (value instanceof Date) {
				continue;
			}
			// If it's a string that looks like a date, convert it to Date
			if (typeof value === 'string') {
				try {
					const dateValue = new Date(value);
					// Only replace if it's a valid date
					if (!isNaN(dateValue.getTime())) {
						normalized[fieldName] = dateValue;
					}
				} catch (error) {
					// If conversion fails, leave the original value
					console.warn(`[Date Normalization] Failed to convert ${fieldName}:`, error);
				}
			}
		}
	}

	// Recursively handle nested objects
	for (const key in normalized) {
		if (normalized[key] && typeof normalized[key] === 'object' && !Array.isArray(normalized[key]) && !(normalized[key] instanceof Date)) {
			normalized[key] = normalizeDateFields(normalized[key]);
		}
	}

	return normalized;
}

/**
 * Filters resource objects to only include MCP spec-compliant fields
 * This prevents issues with non-standard fields that may cause processing errors
 */
function filterToSpecCompliantResource(resource: any) {
	// According to MCP spec, only these fields are standard
	const specCompliantResource: any = {
		uri: resource.uri, // Required field
	};
	
	// Add optional fields if they exist
	if (resource.name !== undefined) specCompliantResource.name = resource.name;
	if (resource.title !== undefined) specCompliantResource.title = resource.title;  
	if (resource.description !== undefined) specCompliantResource.description = resource.description;
	if (resource.mimeType !== undefined) specCompliantResource.mimeType = resource.mimeType;
	
	return specCompliantResource;
}

/**
 * Lists all resources available from the connected MCP servers
 */
export async function listMcpResources(client: MCPClient) {
	if (!client) return {};
	try {
		console.log('[MCP Resources] About to call client.resources.list()');
		const resources = await client.resources.list();
		console.log('[MCP Resources] Raw resources received:', JSON.stringify(resources, null, 2));
		
		// Filter to spec-compliant fields to avoid processing issues with non-standard fields
		if (resources && typeof resources === 'object' && Array.isArray(resources.resources)) {
			const filtered = {
				...resources,
				resources: resources.resources.map(filterToSpecCompliantResource)
			};
			console.log('[MCP Resources] Filtered to spec-compliant resources:', JSON.stringify(filtered, null, 2));
			return filtered;
		}
		
		return resources;
	} catch (error) {
		console.error('[MCP Resources] Error in listMcpResources:', error);
		console.error('[MCP Resources] Error stack:', error instanceof Error ? error.stack : 'No stack');
		if (error instanceof Error && error.message.includes('toISOString is not a function')) {
			console.error('[MCP Resources] Date field error detected - this suggests the MCP server is returning non-standard date fields:', error.message);
			console.error('[MCP Resources] The MCP spec does not define date fields in resources. This may be a server implementation issue.');
			// Return empty result instead of crashing
			return {};
		}
		throw error;
	}
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
	try {
		const resource = await client.resources.read(serverName, resourceUri);
		return normalizeDateFields(resource);
	} catch (error) {
		if (error instanceof Error && error.message.includes('toISOString is not a function')) {
			console.warn('[MCP Resource Read] Date field error detected, attempting to handle gracefully:', error.message);
			return null;
		}
		throw error;
	}
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
 * Tests connection to an MCP server and detects OAuth requirements
 */
export async function testMcpServerConnection(
	userId: string,
	serverId: string,
) {
	const server = await db
		.select()
		.from(mcpServers)
		.where(and(eq(mcpServers.id, serverId), eq(mcpServers.userId, userId)))
		.limit(1);

	if (server.length === 0) {
		throw new Error('Server not found');
	}

	const serverRecord = server[0];

	try {
		// First, try a simple HTTP request to see if we get a 401 with WWW-Authenticate header
		// This will help us detect OAuth requirements and discover the authorization server
		try {
			const response = await fetch(serverRecord.url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					jsonrpc: '2.0',
					id: 1,
					method: 'initialize',
					params: {},
				}),
			});

			// If we get 401, parse WWW-Authenticate header for OAuth discovery
			if (response.status === 401) {
				const wwwAuth = response.headers.get('www-authenticate');
				if (wwwAuth && wwwAuth.includes('Bearer')) {
					console.log('[OAuth] 401 response with WWW-Authenticate:', wwwAuth);

					// Update server status to indicate auth is required
					await db
						.update(mcpServers)
						.set({
							authStatus: 'required',
							updatedAt: new Date().toISOString(),
						})
						.where(eq(mcpServers.id, serverId));

					// Try to discover the OAuth authorization URL
					const authUrl = await discoverOAuthAuthorizationUrl(
						wwwAuth,
						serverRecord.url,
					);

					if (authUrl) {
						console.log(
							'[OAuth] Successfully discovered auth URL, returning to frontend:',
							authUrl,
						);
						return { status: 'auth_required', authUrl };
					} else {
						// Even if discovery fails, we know auth is required
						// Return a response indicating manual setup is needed
						console.log(
							'[OAuth] Discovery failed, returning manual setup response',
						);
						return {
							status: 'auth_required',
							authUrl: null,
							message:
								'OAuth authentication required but could not auto-discover authorization server. Please check server documentation for OAuth setup instructions.',
						};
					}
				}
			}
		} catch (fetchError) {
			console.log('Direct fetch failed, trying MCP client:', fetchError);
		}

		// If direct fetch didn't work or didn't indicate OAuth, try the MCP client
		const serverConfig: any = {
			url: new URL(serverRecord.url),
			timeout: 30_000, // Shorter timeout for testing
			authorization: {
				redirectUris: OAUTH_CONFIG.redirectUris,
				scopes: OAUTH_CONFIG.scopes,
				clientName: OAUTH_CONFIG.clientName,
				onAuthorizationNeeded: async (
					_serverUrl: string,
					authUrl: string,
					_context: any,
				) => {
					// Update server auth status and throw special error
					await db
						.update(mcpServers)
						.set({
							authStatus: 'required',
							updatedAt: new Date().toISOString(),
						})
						.where(eq(mcpServers.id, serverId));

					throw new Error(`OAUTH_REQUIRED:${authUrl}`);
				},
			},
		};

		// If server has stored OAuth tokens, include them in requestInit for HTTP transport
		if (serverRecord.authStatus === 'authorized' && serverRecord.accessToken) {
			console.log(
				`[OAuth] Testing connection with stored access token for server: ${serverRecord.name}`,
			);
			serverConfig.requestInit = {
				headers: {
					Authorization: `Bearer ${serverRecord.accessToken}`,
				},
			};
		}

		const testClient = new MCPClient({
			id: `test-${userId}-${Date.now()}`,
			servers: {
				[serverRecord.name]: serverConfig,
			},
		});

		// Try to get toolsets to test the connection
		await testClient.getToolsets();

		// If we get here, connection was successful
		await db
			.update(mcpServers)
			.set({
				authStatus: 'authorized',
				updatedAt: new Date().toISOString(),
			})
			.where(eq(mcpServers.id, serverId));

		await testClient.disconnect();
		return { status: 'authorized' };
	} catch (error) {
		if (error instanceof Error && error.message.startsWith('OAUTH_REQUIRED:')) {
			const authUrl = error.message.split('OAUTH_REQUIRED:')[1];
			return { status: 'auth_required', authUrl };
		} else {
			// For any other error, mark as failed
			await db
				.update(mcpServers)
				.set({
					authStatus: 'failed',
					updatedAt: new Date().toISOString(),
				})
				.where(eq(mcpServers.id, serverId));

			throw error;
		}
	}
}

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
	const serverConfig: any = {
		url: new URL(serverRecord.url),
		timeout: 60_000,
	};

	// If server has stored OAuth tokens, include them in requestInit for HTTP transport
	if (serverRecord.authStatus === 'authorized' && serverRecord.accessToken) {
		console.log(
			`[OAuth] Getting server info with stored access token for server: ${serverRecord.name}`,
		);
		serverConfig.requestInit = {
			headers: {
				Authorization: `Bearer ${serverRecord.accessToken}`,
			},
		};
	}

	const client = new MCPClient({
		id: `user-${userId}-${Date.now()}`,
		servers: {
			[serverRecord.name]: serverConfig,
		},
	});

	try {
		// Fetch all capabilities with error handling for date fields
		console.log(`[MCP Server Info] About to fetch capabilities for server: ${serverRecord.name}`);
		const [toolsets, resources, prompts] = await Promise.all([
			client.getToolsets().catch((error) => {
				console.error('[MCP Server Info] Error in getToolsets:', error);
				if (error instanceof Error && error.message.includes('toISOString is not a function')) {
					console.warn('[MCP Server Info] Date field error in toolsets, returning empty:', error.message);
					return {};
				}
				throw error;
			}),
			client.resources.list().then((resources) => {
				// Filter to spec-compliant fields to avoid processing issues
				if (resources && typeof resources === 'object' && Array.isArray(resources.resources)) {
					return {
						...resources,
						resources: resources.resources.map(filterToSpecCompliantResource)
					};
				}
				return resources;
			}).catch((error) => {
				console.error('[MCP Server Info] Error in resources.list:', error);
				console.error('[MCP Server Info] Error stack:', error instanceof Error ? error.stack : 'No stack');
				if (error instanceof Error && error.message.includes('toISOString is not a function')) {
					console.warn('[MCP Server Info] Date field error in resources, returning empty:', error.message);
					return {};
				}
				throw error;
			}),
			client.prompts.list().catch((error) => {
				console.error('[MCP Server Info] Error in prompts.list:', error);
				if (error instanceof Error && error.message.includes('toISOString is not a function')) {
					console.warn('[MCP Server Info] Date field error in prompts, returning empty:', error.message);
					return {};
				}
				throw error;
			}),
		]);

		console.log(`[MCP Debug] Server ${serverRecord.name} toolsets structure:`, JSON.stringify(toolsets, null, 2));
		console.log(`[MCP Debug] Server ${serverRecord.name} toolsets keys:`, Object.keys(toolsets || {}));
		
		// Log each server's toolset structure
		if (toolsets && typeof toolsets === 'object') {
			for (const [serverName, serverToolset] of Object.entries(toolsets)) {
				console.log(`[MCP Debug] Server "${serverName}" toolset:`, typeof serverToolset, Object.keys(serverToolset || {}));
			}
		}

		// Register tools with the catalog for better discovery and management
		if (toolsets) {
			try {
				const catalog = toolCatalog.registerCatalog(
					serverRecord.id,
					serverRecord.name,
					serverRecord.url,
					toolsets
				);
				console.log(`[Tool Catalog] Registered ${catalog.tools.length} tools for server: ${serverRecord.name}`);
			} catch (catalogError) {
				console.error(`[Tool Catalog] Failed to register tools for server ${serverRecord.name}:`, catalogError);
			}
		}

		await client.disconnect();

		return {
			server: serverRecord,
			toolsets,
			resources, // Already filtered to spec-compliant fields
			prompts,
		};
	} catch (error) {
		console.error('Error connecting to MCP server:', error);
		await client.disconnect();
		throw error;
	}
}
