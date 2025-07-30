import { OAUTH_CONFIG } from './mcpClient';
import { retrievePKCEVerifier } from './pkceStore';

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
			`${baseUrl}/api/oauth/token`
		]
	};
}

/**
 * Enhanced authorization server metadata discovery for token exchange
 */
async function discoverTokenEndpoint(authServerIssuer: string, resourceUrl: string): Promise<string | null> {
	const u = new URL(authServerIssuer);
	const metadataUrls = [
		// RFC 8414 standard location
		`${u.protocol}//${u.hostname}/.well-known/oauth-authorization-server`
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
		const fallbackMetadata = generateFallbackAuthServerMetadata(authServerIssuer);
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
		if (tokenEndpoint.includes('/token') && !tokenEndpoint.includes('/oauth/')) {
			// If using fallback /token endpoint, also try /oauth/token as alternative
			const altEndpoint = tokenEndpoint.replace('/token', '/oauth/token');
			tokenExchangeEndpoints.push(altEndpoint);
		}

		// Retrieve the code_verifier using the state
		const codeVerifier = retrievePKCEVerifier(state);
		if (!codeVerifier) {
			console.error('[OAuth] No code_verifier found for state:', state);
			throw new Error(
				'PKCE code_verifier not found - authorization expired or invalid',
			);
		}

		console.log('[OAuth] Retrieved PKCE code_verifier for state:', state);

		// Build token exchange parameters
		const tokenParams = new URLSearchParams({
			grant_type: 'authorization_code',
			code: code,
			redirect_uri: OAUTH_CONFIG.redirectUris[0],
			client_id: OAUTH_CONFIG.clientName,
			code_verifier: codeVerifier, // Include the PKCE code_verifier
		});

		console.log(
			'[OAuth] Token exchange parameters:',
			Array.from(tokenParams.keys()),
		);

		// Try token exchange with multiple endpoints
		let tokenResponse: Response | null = null;
		let lastError: string = '';
		
		for (const endpoint of tokenExchangeEndpoints) {
			console.log('[OAuth] Attempting token exchange with endpoint:', endpoint);
			
			try {
				tokenResponse = await fetch(endpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
					body: tokenParams,
				});
				
				if (tokenResponse.ok) {
					console.log('[OAuth] Token exchange successful with endpoint:', endpoint);
					break;
				} else {
					const errorText = await tokenResponse.text();
					lastError = `${tokenResponse.status} - ${errorText}`;
					console.log('[OAuth] Token exchange failed with endpoint:', endpoint, lastError);
					tokenResponse = null;
				}
			} catch (error) {
				lastError = error instanceof Error ? error.message : 'Unknown error';
				console.log('[OAuth] Network error with endpoint:', endpoint, lastError);
				tokenResponse = null;
			}
		}

		if (!tokenResponse || !tokenResponse.ok) {
			console.error('[OAuth] All token endpoints failed');
			console.error('[OAuth] Endpoints tried:', tokenExchangeEndpoints);
			console.error('[OAuth] Authorization server derived:', authServerUrl);
			console.error('[OAuth] Resource URL:', serverUrl);
			throw new Error(`Token exchange failed with all endpoints. Last error: ${lastError}`);
		}

		const tokenData = await tokenResponse.json();
		console.log('[OAuth] Token exchange successful');

		return {
			accessToken: tokenData.access_token,
			refreshToken: tokenData.refresh_token,
			expiresIn: tokenData.expires_in,
			tokenType: tokenData.token_type || 'Bearer',
		};
	} catch (error) {
		console.error('[OAuth] Failed to exchange authorization code:', error);
		throw error;
	}
}
