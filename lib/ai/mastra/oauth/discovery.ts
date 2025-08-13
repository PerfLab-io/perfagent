import { OAUTH_CONFIG } from '../config';
import { storePKCEVerifier } from '../pkceStore';

const DISCOVERY_CACHE_TTL_MS = 5 * 60 * 1000;
const protectedResourceCache = new Map<string, { data: any; ts: number }>();
const authServerMetadataCache = new Map<string, { data: any; ts: number }>();

function getCached(cache: Map<string, { data: any; ts: number }>, key: string) {
	const entry = cache.get(key);
	if (entry && Date.now() - entry.ts < DISCOVERY_CACHE_TTL_MS)
		return entry.data;
	return null;
}

function setCached(
	cache: Map<string, { data: any; ts: number }>,
	key: string,
	data: any,
) {
	cache.set(key, { data, ts: Date.now() });
}

export function generateDiscoveryUrls(
	resourceUrl: string,
	endpoint: string,
): string[] {
	const u = new URL(resourceUrl);
	const origin = u.origin.replace(/\/$/, '');
	const href = u.href.replace(/\/$/, '');
	return [
		`${origin}/.well-known/${endpoint}`,
		`${href}/.well-known/${endpoint}`,
	];
}

export async function discoverProtectedResourceMetadata(resourceUrl: string) {
	const endpoints = generateDiscoveryUrls(
		resourceUrl,
		'oauth-protected-resource',
	);
	for (const endpoint of endpoints) {
		const cached = getCached(protectedResourceCache, endpoint);
		if (cached) return cached;
		try {
			const response = await fetch(endpoint);
			if (response.ok) {
				const metadata = await response.json();
				const result = {
					authorization_servers: metadata.authorization_servers || [],
					resource: metadata.resource || resourceUrl,
					scopes_supported: metadata.scopes_supported || [],
				};
				setCached(protectedResourceCache, endpoint, result);
				return result;
			}
		} catch {}
	}
	return null;
}

export async function discoverAuthorizationServerMetadata(
	authServerIssuer: string,
	resourceUrl?: string,
) {
	const u = new URL(authServerIssuer);
	const origin = u.origin.replace(/\/$/, '');
	const urls = [`${origin}/.well-known/oauth-authorization-server`];
	if (resourceUrl) {
		const resourceU = new URL(resourceUrl);
		if (resourceU.pathname !== '/')
			urls.push(`${resourceUrl}/.well-known/oauth-authorization-server`);
	}
	for (const url of urls) {
		const cached = getCached(authServerMetadataCache, url);
		if (cached) return cached;
		try {
			const response = await fetch(url);
			if (response.ok) {
				const metadata = await response.json();
				setCached(authServerMetadataCache, url, metadata);
				return metadata;
			}
		} catch {}
	}
	return null;
}

export function parseWWWAuthenticateHeader(header: string) {
	const result: any = {};
	const params = header.replace(/^Bearer\s+/, '');
	// Expand to allow as_uri in angle brackets per some implementations
	const regex = /([A-Za-z0-9_-]+)=("([^"]*)"|'([^']*)'|<([^>]+)>|([^,\s]+))/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(params)) !== null) {
		const key = match[1];
		const value = match[3] ?? match[4] ?? match[5] ?? match[6] ?? '';
		result[key] = value;
	}
	return result;
}

// Minimal dynamic client registration helper (RFC 7591)
async function attemptDynamicClientRegistration(
	registrationEndpoint: string,
): Promise<string | null> {
	try {
		console.log(
			'[OAuth] Attempting dynamic client registration at:',
			registrationEndpoint,
		);
		const registrationData = {
			client_name: OAUTH_CONFIG.clientName,
			redirect_uris: OAUTH_CONFIG.redirectUris,
			scope: OAUTH_CONFIG.scopes.join(' '),
			token_endpoint_auth_method: 'none',
			grant_types: ['authorization_code'],
			response_types: ['code'],
		};
		const response = await fetch(registrationEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(registrationData),
		});
		if (response.ok) {
			const clientInfo = await response.json();
			if (clientInfo?.client_id) {
				console.log(
					'[OAuth] Dynamic client registration successful:',
					clientInfo.client_id,
				);
				return clientInfo.client_id as string;
			}
		} else {
			const errText = await response.text();
			console.log(
				'[OAuth] Dynamic registration failed:',
				response.status,
				errText,
			);
		}
	} catch (e) {
		console.log('[OAuth] Dynamic registration error:', e);
	}
	return null;
}

function generateFallbackDiscovery(resourceUrl: string): {
	authServer: string;
	assumptions: string[];
} {
	const u = new URL(resourceUrl);
	const assumptions: string[] = [];
	const authServer = `${u.protocol}//${u.hostname}`;
	assumptions.push('Authorization server at same origin');
	assumptions.push('Using default scopes: read, write');
	return { authServer, assumptions };
}

function generateFallbackAuthServerMetadata(authServerIssuer: string): any {
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
		_fallback: true,
		_assumptions: [
			'Standard OAuth 2.0 endpoint paths',
			'PKCE S256 support',
			'Authorization code flow',
		],
	};
}

function generateCodeVerifier(): string {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(codeVerifier);
	const digest = await crypto.subtle.digest('SHA-256', data);
	const base64 = Buffer.from(digest).toString('base64');
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateState(): string {
	const array = new Uint8Array(16);
	crypto.getRandomValues(array);
	return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function discoverOAuthAuthorizationUrl(
	wwwAuthHeader: string,
	resourceUrl: string,
	opts?: { clientIdOverride?: string; redirectUriOverride?: string },
): Promise<string | null> {
	try {
		// Step 1: Parse WWW-Authenticate header
		const authServer = parseWWWAuthenticateHeader(wwwAuthHeader);
		let authServerIssuer = authServer.as_uri;

		// Step 2: If no as_uri, try protected resource metadata discovery (RFC 9728)
		if (!authServerIssuer) {
			// Try resource_metadata URL from WWW-Authenticate header first
			if (authServer.resource_metadata) {
				try {
					const response = await fetch(authServer.resource_metadata);
					if (response.ok) {
						const metadata = await response.json();
						if (metadata.authorization_servers?.length > 0) {
							authServerIssuer = metadata.authorization_servers[0];
						}
					}
				} catch {}
			}
			// Standard protected resource discovery
			if (!authServerIssuer) {
				const resourceMetadata =
					await discoverProtectedResourceMetadata(resourceUrl);
				if (
					resourceMetadata?.authorization_servers &&
					resourceMetadata.authorization_servers.length > 0
				) {
					authServerIssuer = resourceMetadata.authorization_servers[0];
				}
			}
			// Fallback for non-compliant servers
			if (!authServerIssuer) {
				const fallback = generateFallbackDiscovery(resourceUrl);
				authServerIssuer = fallback.authServer;
			}
		}

		if (!authServerIssuer) return null;

		// Step 3: Discover authorization server metadata (RFC 8414)
		let serverMetadata = await discoverAuthorizationServerMetadata(
			authServerIssuer,
			resourceUrl,
		);
		if (!serverMetadata?.authorization_endpoint) {
			serverMetadata = generateFallbackAuthServerMetadata(authServerIssuer);
		}

		// Step 4: Generate authorization URL with PKCE
		let clientId = opts?.clientIdOverride || OAUTH_CONFIG.clientName;
		const chosenRedirect = OAUTH_CONFIG.redirectUris[0];
		const redirectUri = opts?.redirectUriOverride || chosenRedirect;
		if (serverMetadata.registration_endpoint) {
			const registered = await attemptDynamicClientRegistration(
				serverMetadata.registration_endpoint,
			);
			if (registered) {
				clientId = registered;
			}
		}

		const authUrl = new URL(serverMetadata.authorization_endpoint);
		authUrl.searchParams.set('response_type', 'code');
		authUrl.searchParams.set('client_id', clientId);
		authUrl.searchParams.set('redirect_uri', redirectUri);
		authUrl.searchParams.set('scope', OAUTH_CONFIG.scopes.join(' '));
		if (authServer.resource)
			authUrl.searchParams.set('resource', authServer.resource);

		const codeVerifier = generateCodeVerifier();
		const codeChallenge = await generateCodeChallenge(codeVerifier);
		authUrl.searchParams.set('code_challenge', codeChallenge);
		authUrl.searchParams.set('code_challenge_method', 'S256');
		const state = generateState();
		authUrl.searchParams.set('state', state);
		await storePKCEVerifier(
			state,
			codeVerifier,
			clientId,
			authServer.resource,
			redirectUri,
		);
		return authUrl.toString();
	} catch {
		return null;
	}
}
