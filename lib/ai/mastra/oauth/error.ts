export class OAuthRequiredError extends Error {
	authUrl: string;
	constructor(authUrl: string) {
		super(`OAUTH_REQUIRED:${authUrl}`);
		this.name = 'OAuthRequiredError';
		this.authUrl = authUrl;
	}
}
