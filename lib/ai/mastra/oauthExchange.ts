import { OAUTH_CONFIG } from './mcpClient';
import { retrievePKCEVerifier } from './pkceStore';

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

		// Discover the token endpoint
		let tokenEndpoint: string | null = null;

		// Try co-located auth server metadata first
		if (resourceUrl.pathname !== '/') {
			const pathSegments = resourceUrl.pathname
				.split('/')
				.filter((segment) => segment.length > 0);
			if (pathSegments.length > 0) {
				const basePath = '/' + pathSegments.join('/');
				const metadataUrl = `${authServerUrl}${basePath}/.well-known/oauth-authorization-server`;
				console.log('[OAuth] Trying co-located metadata URL:', metadataUrl);

				try {
					const metadataResponse = await fetch(metadataUrl);
					if (metadataResponse.ok) {
						const metadata = await metadataResponse.json();
						tokenEndpoint = metadata.token_endpoint;
						console.log('[OAuth] Found token endpoint:', tokenEndpoint);
					}
				} catch (error) {
					console.log('[OAuth] Co-located metadata fetch failed:', error);
				}
			}
		}

		// If not found, try standard location
		if (!tokenEndpoint) {
			const metadataUrl = `${authServerUrl}/.well-known/oauth-authorization-server`;
			console.log('[OAuth] Trying standard metadata URL:', metadataUrl);

			try {
				const metadataResponse = await fetch(metadataUrl);
				if (metadataResponse.ok) {
					const metadata = await metadataResponse.json();
					tokenEndpoint = metadata.token_endpoint;
					console.log('[OAuth] Found token endpoint:', tokenEndpoint);
				}
			} catch (error) {
				console.log('[OAuth] Standard metadata fetch failed:', error);
			}
		}

		if (!tokenEndpoint) {
			throw new Error('Could not discover token endpoint');
		}

		console.log('[OAuth] Using token endpoint:', tokenEndpoint);

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

		// Exchange authorization code for tokens
		const tokenResponse = await fetch(tokenEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: tokenParams,
		});

		if (!tokenResponse.ok) {
			const errorText = await tokenResponse.text();
			console.error(
				'[OAuth] Token exchange failed:',
				tokenResponse.status,
				errorText,
			);
			throw new Error(`Token exchange failed: ${tokenResponse.status}`);
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
