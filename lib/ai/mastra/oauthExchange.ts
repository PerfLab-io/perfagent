import { OAUTH_CONFIG } from './mcpClient';
import { retrievePKCEData, retrievePKCEVerifier } from './pkceStore';

/**
 * Generate fallback authorization server metadata for token exchange
 */
function generateFallbackAuthServerMetadata(authServerIssuer: string): any {
	const u = new URL(authServerIssuer);
	const baseUrl = `${u.protocol}//${u.hostname}`;

	return {
		issuer: authServerIssuer,
		token_endpoint: `${baseUrl}/token`, // Try /token first (more common)
		_fallback: true,
		_alternatives: [
			`${baseUrl}/oauth/token`,
			`${baseUrl}/auth/token`,
			`${baseUrl}/api/oauth/token`,
		],
	};
}

/**
 * Attempt Dynamic Client Registration (RFC 7591)
 */
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
			token_endpoint_auth_method: 'none', // PKCE-only, no client secret
			grant_types: ['authorization_code'],
			response_types: ['code'],
		};

		const response = await fetch(registrationEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(registrationData),
		});

		if (response.ok) {
			const clientInfo = await response.json();
			console.log(
				'[OAuth] Dynamic client registration successful:',
				clientInfo.client_id,
			);
			return clientInfo.client_id;
		} else {
			const errorText = await response.text();
			console.log(
				'[OAuth] Dynamic client registration failed:',
				response.status,
				errorText,
			);
		}
	} catch (error) {
		console.log('[OAuth] Dynamic client registration error:', error);
	}

	return null;
}

/**
 * Enhanced authorization server metadata discovery for token exchange
 */
async function discoverTokenEndpoint(
	authServerIssuer: string,
	resourceUrl: string,
): Promise<string | null> {
	const u = new URL(authServerIssuer);
	const metadataUrls = [
		// RFC 8414 standard location
		`${u.protocol}//${u.hostname}/.well-known/oauth-authorization-server`,
	];

	// Add alternative location using the resource URL path if available
	const resourceU = new URL(resourceUrl);
	if (resourceU.pathname !== '/') {
		metadataUrls.push(`${resourceUrl}/.well-known/oauth-authorization-server`);
	}

	for (const metadataUrl of metadataUrls) {
		try {
			console.log('[OAuth] Trying metadata URL:', metadataUrl);
			const metadataResponse = await fetch(metadataUrl);
			if (metadataResponse.ok) {
				const metadata = await metadataResponse.json();
				if (metadata.token_endpoint) {
					console.log('[OAuth] Found token endpoint:', metadata.token_endpoint);
					return metadata.token_endpoint;
				}
			}
		} catch (error) {
			console.log('[OAuth] Metadata fetch failed:', metadataUrl, error);
		}
	}

	// Use fallback if we have a specific auth server (not same-origin assumption)
	if (authServerIssuer && authServerIssuer !== resourceU.origin) {
		console.log('[OAuth] Using fallback token endpoint');
		const fallbackMetadata =
			generateFallbackAuthServerMetadata(authServerIssuer);
		return fallbackMetadata.token_endpoint;
	}

	return null;
}

/**
 * Exchanges OAuth authorization code for access token
 */
export async function exchangeOAuthCode(
	serverUrl: string,
	code: string,
	state: string,
) {
	try {
		console.log('[OAuth] Starting token exchange for server:', serverUrl);

		// Parse the server URL to get the authorization server
		const resourceUrl = new URL(serverUrl);
		const authServerUrl = resourceUrl.origin;

		// Discover the token endpoint using enhanced discovery
		let tokenEndpoint = await discoverTokenEndpoint(authServerUrl, serverUrl);

		if (!tokenEndpoint) {
			throw new Error('Could not discover token endpoint');
		}

		console.log('[OAuth] Using token endpoint:', tokenEndpoint);

		// For fallback cases, we might need to try alternative endpoints
		let tokenExchangeEndpoints = [tokenEndpoint];
		if (
			tokenEndpoint.includes('/token') &&
			!tokenEndpoint.includes('/oauth/')
		) {
			// If using fallback /token endpoint, also try /oauth/token as alternative
			const altEndpoint = tokenEndpoint.replace('/token', '/oauth/token');
			tokenExchangeEndpoints.push(altEndpoint);
		}

		// Retrieve the code_verifier and client_id using the state
		const pkceData = retrievePKCEData(state);
		if (!pkceData) {
			console.error('[OAuth] No PKCE data found for state:', state);
			throw new Error('PKCE data not found - authorization expired or invalid');
		}

		console.log('[OAuth] Retrieved PKCE data for state:', state);
		console.log(
			'[OAuth] Using client_id from authorization:',
			pkceData.clientId,
		);

		// The client_id is now determined during the authorization phase and stored with PKCE data
		console.log(
			'[OAuth] Token exchange using client_id from authorization phase',
		);

		// Build token exchange parameters
		// Use the client_id from the authorization phase first, then fallbacks
		const clientStrategies: (string | null)[] = [
			// Primary: Client ID used during authorization
			pkceData.clientId,
		];

		// Add fallback strategies only if the primary differs from our defaults
		if (pkceData.clientId !== OAUTH_CONFIG.clientName) {
			clientStrategies.push(
				// Fallback 1: Original client name
				OAUTH_CONFIG.clientName,
				// Fallback 2: URL-safe client name
				'perfagent-web-performance-tool',
				// Fallback 3: Simple client name
				'perfagent',
				// Fallback 4: No client_id (public client with PKCE only)
				null,
			);
		}

		// Build initial token params (will be modified per attempt)
		const baseTokenParams = {
			grant_type: 'authorization_code',
			code: code,
			redirect_uri: OAUTH_CONFIG.redirectUris[0],
			code_verifier: pkceData.codeVerifier, // Include the PKCE code_verifier
		};

		let tokenParams = new URLSearchParams(baseTokenParams);

		console.log(
			'[OAuth] Token exchange parameters:',
			Array.from(tokenParams.keys()),
		);

		// Try token exchange with multiple endpoints and client strategies
		let tokenResponse: Response | null = null;
		let lastError: string = '';
		let successfulEndpoint: string = '';
		let successfulClientId: string = '';

		for (const endpoint of tokenExchangeEndpoints) {
			console.log('[OAuth] Attempting token exchange with endpoint:', endpoint);

			for (let i = 0; i < clientStrategies.length; i++) {
				const clientId = clientStrategies[i];
				console.log(
					`[OAuth] Trying client_id strategy ${i + 1}:`,
					clientId || 'no client_id (public client)',
				);

				// Create fresh token params for each attempt
				tokenParams = new URLSearchParams(baseTokenParams);
				if (clientId) {
					tokenParams.set('client_id', clientId);
				}
				// Note: if clientId is null, we don't add client_id (public client)

				try {
					tokenResponse = await fetch(endpoint, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
						},
						body: tokenParams,
					});

					if (tokenResponse.ok) {
						successfulEndpoint = endpoint;
						successfulClientId = clientId || 'none';
						console.log('[OAuth] Token exchange successful!');
						console.log('[OAuth] Successful endpoint:', endpoint);
						console.log('[OAuth] Successful client_id:', clientId);
						break;
					} else {
						const errorText = await tokenResponse.text();
						lastError = `${tokenResponse.status} - ${errorText}`;
						console.log(
							`[OAuth] Failed with client_id "${clientId || 'none'}":`,
							lastError,
						);
						tokenResponse = null;
					}
				} catch (error) {
					lastError = error instanceof Error ? error.message : 'Unknown error';
					console.log(
						`[OAuth] Network error with client_id "${clientId || 'none'}":`,
						lastError,
					);
					tokenResponse = null;
				}
			}

			if (tokenResponse && tokenResponse.ok) {
				break; // Success, exit both loops
			}
		}

		if (!tokenResponse || !tokenResponse.ok) {
			console.error('[OAuth] All token endpoints failed');
			console.error('[OAuth] Endpoints tried:', tokenExchangeEndpoints);
			console.error('[OAuth] Authorization server derived:', authServerUrl);
			console.error('[OAuth] Resource URL:', serverUrl);
			throw new Error(
				`Token exchange failed with all endpoints. Last error: ${lastError}`,
			);
		}

		const tokenData = await tokenResponse.json();
		console.log('[OAuth] Token exchange successful');

		return {
			accessToken: tokenData.access_token,
			refreshToken: tokenData.refresh_token,
			expiresIn: tokenData.expires_in,
			tokenType: tokenData.token_type || 'Bearer',
			clientId: successfulClientId, // Return the successful client_id for persistence
		};
	} catch (error) {
		console.error('[OAuth] Failed to exchange authorization code:', error);
		throw error;
	}
}
