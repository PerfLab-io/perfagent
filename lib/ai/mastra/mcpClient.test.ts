import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks must be declared before importing the module under test
vi.mock('@perflab/mastra-mcp', () => {
	const state: any = {
		toolsetsResult: {},
		resourcesListResult: { resources: [] },
		resourcesListImpl: null as null | (() => any),
		resourceReadResult: null as any,
		promptsListResult: {},
		provideAuthorizationCodeResult: { success: true },
		constructed: [] as any[],
	};

	class MCPClient {
		public resources: any;
		public prompts: any;
		public elicitation: any;
		public __opts: any;
		constructor(opts: any) {
			this.__opts = opts;
			state.constructed.push(opts);
			this.resources = {
				list: vi.fn(async () => {
					if (typeof state.resourcesListImpl === 'function')
						return state.resourcesListImpl();
					return state.resourcesListResult;
				}),
				read: vi.fn(async () => state.resourceReadResult),
			};
			this.prompts = {
				list: vi.fn(async () => state.promptsListResult),
				get: vi.fn(async (_: any) => ({})),
			};
			this.elicitation = {
				onRequest: vi.fn(async () => {}),
			};
		}
		async getToolsets() {
			return state.toolsetsResult;
		}
		async provideAuthorizationCode(
			_serverName: string,
			_code: string,
			_state: string,
		) {
			return state.provideAuthorizationCodeResult;
		}
		async disconnect() {}
	}

	return {
		MCPClient,
		__setState: (next: any) => Object.assign(state, next),
		__state: state,
	};
});

// Mock DB and schema used by the SUT
const updateCalls: any[] = [];
let selectResult: any[] = [];
vi.mock('@/drizzle/db', () => {
	const db: any = {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => {
					const whereReturn: any = {
						limit: vi.fn(async (_n: number) => selectResult),
						then: (res: any, rej: any) =>
							Promise.resolve(selectResult).then(res, rej),
					};
					return whereReturn;
				}),
			})),
		})),
		update: vi.fn(() => ({
			set: vi.fn((vals: any) => ({
				where: vi.fn(async (_cond: any) => {
					updateCalls.push(vals);
					return;
				}),
			})),
		})),
	};
	return { db };
});

vi.mock('@/drizzle/schema', () => {
	// Only shape is used in mock DB operations; values are irrelevant
	const mcpServers = {
		id: 'id',
		userId: 'userId',
		name: 'name',
		url: 'url',
		enabled: 'enabled',
		authStatus: 'authStatus',
		accessToken: 'accessToken',
		refreshToken: 'refreshToken',
		tokenExpiresAt: 'tokenExpiresAt',
		clientId: 'clientId',
	};
	return { mcpServers };
});

// Mock PKCE store and tool catalog + cache
const { storePKCEVerifierMock } = vi.hoisted(() => ({
	storePKCEVerifierMock: vi.fn(async () => {}),
}));
vi.mock('./pkceStore', () => ({ storePKCEVerifier: storePKCEVerifierMock }));

const { toolCatalog } = vi.hoisted(() => ({
	toolCatalog: {
		registerCatalog: vi.fn(() => ({ tools: [] })),
		getAllTools: vi.fn(() => []),
		getToolsByServer: vi.fn(() => []),
		getStats: vi.fn(() => ({ total: 0 })),
		searchTools: vi.fn(() => []),
	},
}));
vi.mock('./toolCatalog', () => ({ toolCatalog }));

const { mcpToolCache } = vi.hoisted(() => ({
	mcpToolCache: {
		getServerTools: vi.fn(async (_: string) => null),
		cacheServerTools: vi.fn(async (_: string, _entry: any) => {}),
	},
}));
vi.mock('./cache/MCPCache', () => ({ mcpToolCache }));

// Import SUT after mocks
import {
	createUserMcpClient,
	listMcpResources,
	listMcpPrompts,
	readMcpResource,
	getMcpPrompt,
	registerElicitationHandler,
	handleOAuthAuthorizationCode,
	storeOAuthTokens,
	getStoredOAuthTokens,
	refreshOAuthToken,
	testMcpServerConnection,
	getMcpServerInfo,
	getAllCatalogTools,
	getCatalogToolsByServer,
	getCatalogStats,
	searchCatalogTools,
} from '@/lib/ai/mastra/mcpClient';
import * as MCPMockModule from '@perflab/mastra-mcp';
import { MCPClient as MockedMCPClient } from '@perflab/mastra-mcp';

const setMCPState = (MCPMockModule as any).__setState as (next: any) => void;
const getMCPState = () => (MCPMockModule as any).__state as any;

describe('mcpClient.ts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		selectResult = [];
		updateCalls.length = 0;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('listMcpResources', () => {
		it('filters resources to spec-compliant fields', async () => {
			setMCPState({
				resourcesListImpl: null,
				resourcesListResult: {
					resources: [
						{
							uri: 'res://1',
							name: 'One',
							extra: 'ignore',
							description: 'desc',
						},
					],
				},
			});
			const client = new MockedMCPClient({ servers: {} }) as any;
			const result = await listMcpResources(client);
			expect(result).toBeDefined();
			expect(Array.isArray((result as any).resources)).toBe(true);
			const r = (result as any).resources[0];
			expect(r).toEqual({ uri: 'res://1', name: 'One', description: 'desc' });
			expect((r as any).extra).toBeUndefined();
		});

		it('returns empty object on date serialization errors', async () => {
			setMCPState({
				resourcesListImpl: () => {
					throw new Error('toISOString is not a function');
				},
			});
			const client = new MockedMCPClient({ servers: {} }) as any;
			const result = await listMcpResources(client);
			expect(result).toEqual({});
		});
	});

	describe('readMcpResource', () => {
		it('normalizes date-like strings into Date objects recursively', async () => {
			setMCPState({
				resourceReadResult: {
					createdAt: '2024-01-01T00:00:00.000Z',
					nested: { date: '2024-02-01T00:00:00.000Z' },
				},
			});
			const client = new MockedMCPClient({ servers: {} }) as any;
			const res = await readMcpResource(client, 'server', 'uri://x');
			expect(res).toBeDefined();
			expect(res!.createdAt instanceof Date).toBe(true);
			expect(res!.nested.date instanceof Date).toBe(true);
		});
	});

	describe('createUserMcpClient', () => {
		it('returns null when user has no enabled servers', async () => {
			selectResult = [];
			const client = await createUserMcpClient('user-x');
			expect(client).toBeNull();
		});

		it('configures authorization and onAuthorizationNeeded updates DB and throws', async () => {
			selectResult = [
				{
					id: 'sid1',
					userId: 'user-1',
					name: 'ServerA',
					url: 'https://api.example.com/mcp',
					enabled: true,
					authStatus: 'none',
					accessToken: null,
					refreshToken: null,
					tokenExpiresAt: null,
				},
			];
			const client = await createUserMcpClient('user-1');
			expect(client).toBeInstanceOf(MockedMCPClient as any);
			const constructed = getMCPState().constructed.at(-1);
			const serverConfig = constructed.servers['ServerA'];
			expect(serverConfig.authorization).toBeDefined();
			await expect(
				serverConfig.authorization.onAuthorizationNeeded(
					'https://api.example.com/mcp',
					'https://auth/authorize',
					{},
				),
			).rejects.toThrow(/OAUTH_REQUIRED:/);
			expect(updateCalls.some((u) => u.authStatus === 'required')).toBe(true);
		});

		it('injects auth headers when access token present and not expired', async () => {
			selectResult = [
				{
					id: 'sid2',
					userId: 'user-1',
					name: 'ServerB',
					url: 'https://api.example.com/mcp',
					enabled: true,
					authStatus: 'authorized',
					accessToken: 'tok',
					refreshToken: null,
					tokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
				},
			];
			const client = await createUserMcpClient('user-1');
			expect(client).toBeInstanceOf(MockedMCPClient as any);
			const constructed = getMCPState().constructed.at(-1);
			const conf = constructed.servers['ServerB'];
			expect(conf.requestInit.headers.Authorization).toBe('Bearer tok');
			expect(conf.eventSourceInit.headers.Authorization).toBe('Bearer tok');
		});

		it('refreshes expired token during config and uses refreshed access token', async () => {
			selectResult = [
				{
					id: 'sid3',
					userId: 'user-1',
					name: 'ServerC',
					url: 'https://api.example.com/mcp',
					enabled: true,
					authStatus: 'authorized',
					accessToken: 'oldtok',
					refreshToken: 'reftok',
					tokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
					clientId: 'client-1',
				},
			];
			vi.stubGlobal('fetch', async (input: any, init?: any) => {
				const url = typeof input === 'string' ? input : input.url;
				if (url.endsWith('/.well-known/oauth-authorization-server')) {
					return new Response(
						JSON.stringify({
							token_endpoint: 'https://auth.example.com/oauth/token',
						}),
						{ status: 200 },
					);
				}
				if (url === 'https://auth.example.com/oauth/token') {
					return new Response(
						JSON.stringify({
							access_token: 'newtok',
							refresh_token: 'newref',
							expires_in: 3600,
						}),
						{ status: 200 },
					);
				}
				return new Response('not found', { status: 404 });
			});
			const client = await createUserMcpClient('user-1');
			expect(client).toBeInstanceOf(MockedMCPClient as any);
			const constructed = getMCPState().constructed.at(-1);
			const conf = constructed.servers['ServerC'];
			expect(conf.requestInit.headers.Authorization).toBe('Bearer newtok');
			// DB update called for new tokens
			expect(updateCalls.some((u) => u.accessToken === 'newtok')).toBe(true);
		});
	});

	describe('refreshOAuthToken', () => {
		it('refreshes token using discovered token endpoint', async () => {
			vi.stubGlobal('fetch', async (input: any, init?: any) => {
				const url = typeof input === 'string' ? input : input.url;
				if (url.endsWith('/.well-known/oauth-authorization-server')) {
					return new Response(
						JSON.stringify({
							token_endpoint: 'https://auth.example.com/oauth/token',
						}),
						{ status: 200 },
					);
				}
				if (url === 'https://auth.example.com/oauth/token') {
					return new Response(
						JSON.stringify({
							access_token: 'new-access',
							refresh_token: 'new-refresh',
							expires_in: 3600,
						}),
						{ status: 200 },
					);
				}
				return new Response('not found', { status: 404 });
			});

			const result = await refreshOAuthToken(
				'https://api.example.com/mcp',
				'old-refresh',
				'server-1',
				'user-1',
				'client-xyz',
			);

			expect(result).toBeDefined();
			expect(result!.accessToken).toBe('new-access');
			expect(updateCalls.some((u) => u.accessToken === 'new-access')).toBe(
				true,
			);
		});

		it('tries alternative client_id on invalid_client and succeeds', async () => {
			vi.stubGlobal('fetch', async (input: any, init?: any) => {
				const url = typeof input === 'string' ? input : input.url;
				if (url.endsWith('/.well-known/oauth-authorization-server')) {
					return new Response(
						JSON.stringify({
							token_endpoint: 'https://auth.example.com/oauth/token',
						}),
						{ status: 200 },
					);
				}
				if (url === 'https://auth.example.com/oauth/token') {
					const bodyStr =
						typeof (init as any)?.body === 'string'
							? (init as any).body
							: (init as any)?.body?.toString?.();
					if (bodyStr && String(bodyStr).includes('client_id=perfagent')) {
						return new Response(
							JSON.stringify({
								access_token: 'alt-access',
								refresh_token: 'alt-refresh',
								expires_in: 1800,
							}),
							{ status: 200 },
						);
					}
					return new Response('invalid_client', { status: 401 });
				}
				return new Response('not found', { status: 404 });
			});

			const result = await refreshOAuthToken(
				'https://api.example.com/mcp',
				'old-refresh',
				'sid',
				'uid',
				'wrong-client',
			);
			expect(result).toBeDefined();
			expect(result!.accessToken).toBe('alt-access');
		});
		it('returns null on invalid_grant refresh failure (may require re-auth)', async () => {
			vi.stubGlobal('fetch', async (input: any, init?: any) => {
				const url = typeof input === 'string' ? input : input.url;
				if (url.endsWith('/.well-known/oauth-authorization-server')) {
					return new Response('not found', { status: 404 });
				}
				if (url.includes('/oauth/token')) {
					return new Response('invalid_grant', { status: 401 });
				}
				return new Response('not found', { status: 404 });
			});

			const res = await refreshOAuthToken(
				'https://api.example.com/mcp',
				'refresh-x',
				'sid-x',
				'uid-x',
			);
			expect(res).toBeNull();
		});
	});

	describe('testMcpServerConnection', () => {
		it('returns auth_required with discovered authorization URL on 401', async () => {
			// Prepare DB row for server without tokens
			selectResult = [
				{
					id: 'server-1',
					userId: 'user-1',
					name: 'Test Server',
					url: 'https://api.example.com/mcp',
					enabled: true,
					authStatus: 'none',
					accessToken: null,
					refreshToken: null,
					tokenExpiresAt: null,
				},
			];

			// Mock fetch sequence: initial 401 with WWW-Authenticate, then discovery endpoints
			vi.stubGlobal('fetch', async (input: any, init?: any) => {
				const url = typeof input === 'string' ? input : input.url;
				if (url === 'https://api.example.com/mcp') {
					return new Response('unauthorized', {
						status: 401,
						headers: {
							'www-authenticate':
								'Bearer realm="example", resource="https://api.example.com", as_uri="https://auth.example.com", resource_metadata="https://api.example.com/.well-known/oauth-protected-resource"',
						},
					});
				}
				if (
					url === 'https://api.example.com/.well-known/oauth-protected-resource'
				) {
					return new Response(
						JSON.stringify({
							authorization_servers: ['https://auth.example.com'],
						}),
						{ status: 200 },
					);
				}
				if (
					url ===
					'https://auth.example.com/.well-known/oauth-authorization-server'
				) {
					return new Response(
						JSON.stringify({
							authorization_endpoint:
								'https://auth.example.com/oauth/authorize',
						}),
						{ status: 200 },
					);
				}
				return new Response('not found', { status: 404 });
			});

			const res = await testMcpServerConnection('user-1', 'server-1');
			expect(res.status).toBe('auth_required');
			expect(res.authUrl).toContain('https://auth.example.com/oauth/authorize');
			// Sanity check: expected OAuth params present
			expect(res.authUrl).toContain('response_type=code');
			expect(res.authUrl).toContain('redirect_uri=');
			expect(storePKCEVerifierMock).toHaveBeenCalledOnce();
		});

		it('returns authorized when stored token is valid', async () => {
			selectResult = [
				{
					id: 's-valid',
					userId: 'user-1',
					name: 'Srv',
					url: 'https://api.example.com/mcp',
					enabled: true,
					authStatus: 'authorized',
					accessToken: 'tok',
					refreshToken: null,
					tokenExpiresAt: null,
				},
			];
			vi.stubGlobal('fetch', async (input: any, init?: any) => {
				const url = typeof input === 'string' ? input : input.url;
				if (url === 'https://api.example.com/mcp') {
					return new Response('{}', { status: 200 });
				}
				return new Response('not found', { status: 404 });
			});
			const res = await testMcpServerConnection('user-1', 's-valid');
			expect(res.status).toBe('authorized');
			// No DB updates expected
			expect(updateCalls.length).toBe(0);
		});

		it('refreshes invalid token and authorizes on success', async () => {
			selectResult = [
				{
					id: 's-refresh',
					userId: 'user-1',
					name: 'Srv2',
					url: 'https://api.example.com/mcp',
					enabled: true,
					authStatus: 'authorized',
					accessToken: 'old',
					refreshToken: 'ref',
					tokenExpiresAt: null,
					clientId: 'cid',
				},
			];
			let refreshAttempt = 0;
			vi.stubGlobal('fetch', async (input: any, init?: any) => {
				const url = typeof input === 'string' ? input : input.url;
				if (url === 'https://api.example.com/mcp') {
					// First validate old token -> 401, then validate new token -> 200
					return new Response('{}', {
						status: refreshAttempt++ === 0 ? 401 : 200,
					});
				}
				if (url.endsWith('/.well-known/oauth-authorization-server')) {
					return new Response(
						JSON.stringify({
							token_endpoint: 'https://auth.example.com/oauth/token',
						}),
						{ status: 200 },
					);
				}
				if (url === 'https://auth.example.com/oauth/token') {
					return new Response(
						JSON.stringify({
							access_token: 'new',
							refresh_token: 'newr',
							expires_in: 3600,
						}),
						{ status: 200 },
					);
				}
				return new Response('not found', { status: 404 });
			});
			const res = await testMcpServerConnection('user-1', 's-refresh');
			expect(res.status).toBe('authorized');
			// DB updated by refresh
			expect(updateCalls.some((u) => u.accessToken === 'new')).toBe(true);
		});
	});

	describe('getMcpServerInfo', () => {
		it('returns cached capabilities without creating a client when cache hit', async () => {
			// Arrange cache hit
			(mcpToolCache.getServerTools as any).mockResolvedValueOnce({
				capabilities: {
					tools: { A: {} },
					resources: { resources: [] },
					prompts: {},
				},
			});
			// DB row needed for response
			selectResult = [
				{
					id: 'server-1',
					userId: 'user-1',
					name: 'Cached Server',
					url: 'https://cached.example.com/mcp',
					enabled: true,
					authStatus: 'authorized',
					accessToken: 't',
					refreshToken: 'r',
					tokenExpiresAt: null,
				},
			];

			const info = await getMcpServerInfo('user-1', 'server-1');
			expect(info).toBeDefined();
			expect(info!.toolsets).toEqual({ A: {} });
			// Should not build client nor register/cache new data on cache hit
			expect(toolCatalog.registerCatalog).not.toHaveBeenCalled();
			expect(mcpToolCache.cacheServerTools).not.toHaveBeenCalled();
		});

		it('fetches capabilities, registers catalog, caches results', async () => {
			// Arrange DB
			selectResult = [
				{
					id: 's-info',
					userId: 'u1',
					name: 'SrvInfo',
					url: 'https://api.example.com/mcp',
					enabled: true,
					authStatus: 'authorized',
					accessToken: 'tok',
					refreshToken: null,
					tokenExpiresAt: null,
				},
			];
			// Validate token OK
			vi.stubGlobal('fetch', async (input: any, init?: any) => {
				const url = typeof input === 'string' ? input : input.url;
				if (url === 'https://api.example.com/mcp')
					return new Response('{}', { status: 200 });
				return new Response('not found', { status: 404 });
			});
			setMCPState({
				toolsetsResult: { SrvInfo: { t: {} } },
				resourcesListImpl: null,
				resourcesListResult: {
					resources: [{ uri: 'u://1', name: 'n', extra: 'x' }],
				},
				promptsListResult: { prompts: [] },
			});
			const info = await getMcpServerInfo('u1', 's-info');
			expect(info).toBeDefined();
			expect(info!.resources).toEqual({
				resources: [{ uri: 'u://1', name: 'n' }],
			});
			expect(toolCatalog.registerCatalog).toHaveBeenCalledTimes(1);
			expect(mcpToolCache.cacheServerTools).toHaveBeenCalledTimes(1);
		});

		it('handles resources list date errors gracefully returning {}', async () => {
			selectResult = [
				{
					id: 's-info2',
					userId: 'u1',
					name: 'SrvInfo2',
					url: 'https://api.example.com/mcp',
					authStatus: 'authorized',
					accessToken: 'tok',
					refreshToken: null,
					tokenExpiresAt: null,
				},
			];
			vi.stubGlobal(
				'fetch',
				async (input: any, init?: any) => new Response('{}', { status: 200 }),
			);
			setMCPState({
				toolsetsResult: {},
				resourcesListImpl: () => {
					throw new Error('toISOString is not a function');
				},
				promptsListResult: {},
			});
			const info = await getMcpServerInfo('u1', 's-info2');
			expect(info!.resources).toEqual({});
		});

		it('throws when server requires authorization', async () => {
			selectResult = [
				{
					id: 's-req',
					userId: 'u1',
					name: 'SrvReq',
					url: 'https://api.example.com/mcp',
					authStatus: 'required',
					enabled: true,
				},
			];
			await expect(getMcpServerInfo('u1', 's-req')).rejects.toThrow(
				/requires OAuth authorization/,
			);
		});
	});

	describe('misc wrappers', () => {
		it('listMcpPrompts returns prompts', async () => {
			setMCPState({ promptsListResult: { prompts: [{ name: 'p' }] } });
			const client = new MockedMCPClient({ servers: {} }) as any;
			const res = await listMcpPrompts(client);
			expect(res).toEqual({ prompts: [{ name: 'p' }] });
		});

		it('getMcpPrompt delegates to client', async () => {
			const client = new MockedMCPClient({ servers: {} }) as any;
			const res = await getMcpPrompt(client, 's', 'p');
			expect(res).toEqual({});
		});

		it('registerElicitationHandler registers handler', async () => {
			const client = new MockedMCPClient({ servers: {} }) as any;
			await registerElicitationHandler(client, 's', async () => ({
				action: 'accept',
			}));
			expect(client.elicitation.onRequest).toHaveBeenCalledTimes(1);
		});

		it('handleOAuthAuthorizationCode returns success', async () => {
			const client = new MockedMCPClient({ servers: {} }) as any;
			const res = await handleOAuthAuthorizationCode(
				'u',
				's',
				'code',
				'state',
				client,
			);
			expect(res).toEqual({ success: true });
		});

		it('storeOAuthTokens updates DB with ISO date', async () => {
			const exp = new Date('2025-01-01T00:00:00.000Z');
			await storeOAuthTokens('u', 's', 'a', 'r', exp);
			expect(
				updateCalls.some(
					(u) =>
						u.accessToken === 'a' &&
						u.refreshToken === 'r' &&
						u.tokenExpiresAt === exp.toISOString(),
				),
			).toBe(true);
		});

		it('getStoredOAuthTokens returns tokens with Date expiresAt', async () => {
			selectResult = [
				{
					accessToken: 'a',
					refreshToken: 'r',
					tokenExpiresAt: '2025-01-01T00:00:00.000Z',
				},
			];
			const res = await getStoredOAuthTokens('u', 's');
			expect(res!.accessToken).toBe('a');
			expect(res!.refreshToken).toBe('r');
			expect(res!.expiresAt instanceof Date).toBe(true);
		});

		it('catalog wrappers forward to toolCatalog', () => {
			getAllCatalogTools();
			getCatalogToolsByServer('s');
			getCatalogStats();
			searchCatalogTools('q');
			expect(toolCatalog.getAllTools).toHaveBeenCalled();
			expect(toolCatalog.getToolsByServer).toHaveBeenCalledWith('s');
			expect(toolCatalog.getStats).toHaveBeenCalled();
			expect(toolCatalog.searchTools).toHaveBeenCalledWith('q');
		});
	});
});
