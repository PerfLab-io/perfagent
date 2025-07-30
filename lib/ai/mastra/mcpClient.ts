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
 * Generate discovery URLs for .well-known endpoints following RFC patterns
 */
function generateDiscoveryUrls(resourceUrl: string, endpoint: string): string[] {
	const u = new URL(resourceUrl);
	return [
		// RFC compliant: protocol//hostname/.well-known/endpoint
		`${u.protocol}//${u.hostname}/.well-known/${endpoint}`,
		// Fallback: full URL path with .well-known/endpoint
		`${u.href}/.well-known/${endpoint}`
	];
}

/**
 * Discover protected resource metadata according to RFC 9728
 */
async function discoverProtectedResourceMetadata(resourceUrl: string): Promise<{
	authorization_servers: string[];
	resource: string;
	scopes_supported: string[];
} | null> {
	console.log('[OAuth] Starting protected resource metadata discovery (RFC 9728)');
	
	const endpoints = generateDiscoveryUrls(resourceUrl, 'oauth-protected-resource');
	
	for (const endpoint of endpoints) {
		try {
			console.log('[OAuth] Fetching protected resource metadata from:', endpoint);
			const response = await fetch(endpoint);
			
			if (response.ok) {
				const metadata = await response.json();
				console.log('[OAuth] Protected resource metadata:', JSON.stringify(metadata, null, 2));
				
				return {
					authorization_servers: metadata.authorization_servers || [],
					resource: metadata.resource || resourceUrl,
					scopes_supported: metadata.scopes_supported || []
				};
			} else {
				console.log('[OAuth] Failed to fetch protected resource metadata:', response.status, response.statusText);
			}
		} catch (error) {
			console.log('[OAuth] Protected resource discovery failed:', endpoint, error);
		}
	}
	
	console.log('[OAuth] No protected resource metadata found - server may not be RFC 9728 compliant');
	return null;
}

/**
 * Discover authorization server metadata according to RFC 8414
 */
async function discoverAuthorizationServerMetadata(authServerIssuer: string, resourceUrl?: string): Promise<any | null> {
	console.log('[OAuth] Starting authorization server metadata discovery (RFC 8414)');
	
	const u = new URL(authServerIssuer);
	const metadataUrls = [
		// RFC 8414 standard location
		`${u.protocol}//${u.hostname}/.well-known/oauth-authorization-server`
	];
	
	// Add alternative location using the resource URL path if available
	if (resourceUrl) {
		const resourceU = new URL(resourceUrl);
		// Only add if it's different from the standard location
		if (resourceU.pathname !== '/') {
			metadataUrls.push(`${resourceUrl}/.well-known/oauth-authorization-server`);
		}
	}
	
	for (const metadataUrl of metadataUrls) {
		try {
			console.log('[OAuth] Fetching authorization server metadata from:', metadataUrl);
			const response = await fetch(metadataUrl);
			
			if (response.ok) {
				const metadata = await response.json();
				console.log('[OAuth] Authorization server metadata:', JSON.stringify(metadata, null, 2));
				
				// Validate issuer (RFC 8414 security requirement)
				if (metadata.issuer && metadata.issuer !== authServerIssuer) {
					console.warn(`[OAuth] Issuer mismatch: expected ${authServerIssuer}, got ${metadata.issuer}`);
					// Continue anyway for compatibility, but log the warning
				}
				
				return metadata;
			} else {
				console.log('[OAuth] Failed to fetch authorization server metadata:', response.status, response.statusText);
			}
		} catch (error) {
			console.log('[OAuth] Authorization server discovery failed:', metadataUrl, error);
		}
	}
	
	console.log('[OAuth] All authorization server metadata endpoints failed');
	return null;
}

/**
 * Generate fallback assumptions for non-compliant servers
 */
function generateFallbackDiscovery(resourceUrl: string): { authServer: string; assumptions: string[] } {
	const u = new URL(resourceUrl);
	const assumptions = [];
	
	// Assume authorization server is at same origin
	const authServer = `${u.protocol}//${u.hostname}`;
	assumptions.push('Authorization server at same origin');
	assumptions.push('Using default scopes: read, write');
	
	console.log('[OAuth] Non-compliant server detected, using assumptions:', assumptions);
	
	return { authServer, assumptions };
}

/**
 * Generate fallback authorization server metadata for servers without RFC 8414 metadata
 */
function generateFallbackAuthServerMetadata(authServerIssuer: string): any {
	console.log('[OAuth] Generating fallback authorization server metadata for:', authServerIssuer);
	
	// Common OAuth 2.0 endpoint patterns
	const u = new URL(authServerIssuer);
	const baseUrl = `${u.protocol}//${u.hostname}`;
	
	return {
		issuer: authServerIssuer,
		authorization_endpoint: `${baseUrl}/oauth/authorize`,
		token_endpoint: `${baseUrl}/oauth/token`,
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code'],
		code_challenge_methods_supported: ['S256'],
		scopes_supported: ['read', 'write'],
		// Mark as fallback for debugging
		_fallback: true,
		_assumptions: [
			'Standard OAuth 2.0 endpoint paths',
			'PKCE S256 support',
			'Authorization code flow'
		]
	};
}

/**
 * Discovers OAuth authorization URL from WWW-Authenticate header according to MCP specification
 * Implements RFC 9728 (Protected Resource Metadata) and RFC 8414 (Authorization Server Metadata)
 */
async function discoverOAuthAuthorizationUrl(
	wwwAuthHeader: string,
	resourceUrl: string,
): Promise<string | null> {
	try {
		console.log('[OAuth] Starting OAuth discovery flow');
		console.log('[OAuth] Resource URL:', resourceUrl);
		console.log('[OAuth] WWW-Authenticate header:', wwwAuthHeader);

		// Step 1: Parse WWW-Authenticate header
		const authServer = parseWWWAuthenticateHeader(wwwAuthHeader);
		let authServerIssuer = authServer.as_uri;
		
		// Step 2: If no as_uri, try protected resource metadata discovery (RFC 9728)
		if (!authServerIssuer) {
			console.log('[OAuth] No as_uri in WWW-Authenticate header, starting resource discovery');
			
			// First: Try resource_metadata URL from WWW-Authenticate header
			if (authServer.resource_metadata) {
				try {
					console.log('[OAuth] Fetching resource metadata from WWW-Authenticate header:', authServer.resource_metadata);
					const response = await fetch(authServer.resource_metadata);
					if (response.ok) {
						const metadata = await response.json();
						console.log('[OAuth] Resource metadata from header:', JSON.stringify(metadata, null, 2));
						if (metadata.authorization_servers?.length > 0) {
							authServerIssuer = metadata.authorization_servers[0];
							console.log('[OAuth] Found authorization server from header metadata:', authServerIssuer);
						}
					}
				} catch (error) {
					console.log('[OAuth] Failed to fetch resource metadata from header:', error);
				}
			}
			
			// Second: Try standard protected resource discovery
			if (!authServerIssuer) {
				const resourceMetadata = await discoverProtectedResourceMetadata(resourceUrl);
				if (resourceMetadata?.authorization_servers && resourceMetadata.authorization_servers.length > 0) {
					authServerIssuer = resourceMetadata.authorization_servers[0];
					console.log('[OAuth] Found authorization server from protected resource metadata:', authServerIssuer);
				}
			}
			
			// Third: Fallback for non-compliant servers
			if (!authServerIssuer) {
				const fallback = generateFallbackDiscovery(resourceUrl);
				authServerIssuer = fallback.authServer;
				console.log('[OAuth] Using fallback authorization server:', authServerIssuer);
			}
		} else {
			console.log('[OAuth] Found as_uri in WWW-Authenticate header:', authServerIssuer);
		}

		if (!authServerIssuer) {
			console.log('[OAuth] Could not determine authorization server issuer');
			return null;
		}

		// Step 3: Discover authorization server metadata (RFC 8414)
		let serverMetadata = await discoverAuthorizationServerMetadata(authServerIssuer, resourceUrl);
		
		// Step 3b: If no RFC 8414 metadata found, generate fallback for known auth server
		if (!serverMetadata?.authorization_endpoint) {
			console.log('[OAuth] No RFC 8414 metadata found, attempting fallback for known authorization server');
			
			// Only generate fallback if we have a valid authorization server from protected resource metadata
			// This means the server is partially compliant (has protected resource metadata) but missing auth server metadata
			if (authServerIssuer && authServerIssuer !== `${new URL(resourceUrl).protocol}//${new URL(resourceUrl).hostname}`) {
				// We have a specific auth server from protected resource metadata, try fallback
				serverMetadata = generateFallbackAuthServerMetadata(authServerIssuer);
				console.log('[OAuth] Using fallback authorization server metadata');
			} else {
				console.log('[OAuth] No authorization endpoint found and no specific auth server identified');
				return null;
			}
		}

		// Step 4: Generate authorization URL
		console.log('[OAuth] Generating authorization URL');
		if (serverMetadata._fallback) {
			console.log('[OAuth] Using fallback metadata with assumptions:', serverMetadata._assumptions);
		}
		const authUrl = new URL(serverMetadata.authorization_endpoint);
		authUrl.searchParams.set('response_type', 'code');
		authUrl.searchParams.set('client_id', OAUTH_CONFIG.clientName);
		authUrl.searchParams.set('redirect_uri', OAUTH_CONFIG.redirectUris[0]);
		authUrl.searchParams.set('scope', OAUTH_CONFIG.scopes.join(' '));

		// Add resource parameter if specified (RFC 8707)
		if (authServer.resource) {
			authUrl.searchParams.set('resource', authServer.resource);
		}

		// Generate PKCE parameters (required by MCP spec)
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

		console.log('[OAuth] Successfully generated authorization URL:', authUrl.toString());
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
