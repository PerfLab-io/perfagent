import { create } from 'zustand';

export interface MCPServer {
	id: string;
	name: string;
	url: string;
	enabled: boolean;
	authStatus?: 'unknown' | 'required' | 'authorized' | 'failed' | 'offline';
	accessToken?: string | null;
	refreshToken?: string | null;
	tokenExpiresAt?: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ServerInfo {
	server: MCPServer;
	toolsets: any;
	resources: any;
	prompts: any;
}

interface MCPServersState {
	servers: MCPServer[];
	setServers: (servers: MCPServer[]) => void;
	addServer: (server: MCPServer) => void;
	updateServer: (id: string, updates: Partial<MCPServer>) => void;
	removeServer: (id: string) => void;

	loading: boolean;
	setLoading: (loading: boolean) => void;

	isAddDialogOpen: boolean;
	setIsAddDialogOpen: (open: boolean) => void;

	formError: string | null;
	setFormError: (error: string | null) => void;

	// Auth state
	authUrls: Record<string, string>;
	setAuthUrl: (serverId: string, url: string) => void;
	removeAuthUrl: (serverId: string) => void;

	serversRequiringAuth: Set<string>;
	addServerRequiringAuth: (serverId: string) => void;
	removeServerRequiringAuth: (serverId: string) => void;
	setServersRequiringAuth: (serverIds: string[]) => void;

	// Failure reasons
	serverFailureReasons: Record<string, string>;
	setServerFailureReason: (serverId: string, reason: string) => void;
	removeServerFailureReason: (serverId: string) => void;

	// UI interaction state
	expandedServers: Record<string, boolean>;
	toggleServerExpansion: (serverId: string) => void;
}

export const useMCPServersStore = create<MCPServersState>((set) => ({
	servers: [],
	setServers: (servers) => set({ servers }),
	addServer: (server) =>
		set((state) => ({ servers: [...state.servers, server] })),
	updateServer: (id, updates) =>
		set((state) => ({
			servers: state.servers.map((server) =>
				server.id === id ? { ...server, ...updates } : server,
			),
		})),
	removeServer: (id) =>
		set((state) => ({
			servers: state.servers.filter((server) => server.id !== id),
		})),

	// UI state
	loading: true,
	setLoading: (loading) => set({ loading }),

	isAddDialogOpen: false,
	setIsAddDialogOpen: (isAddDialogOpen) => set({ isAddDialogOpen }),

	formError: null,
	setFormError: (formError) => set({ formError }),

	// Auth state
	authUrls: {},
	setAuthUrl: (serverId, url) =>
		set((state) => ({
			authUrls: { ...state.authUrls, [serverId]: url },
		})),
	removeAuthUrl: (serverId) =>
		set((state) => {
			const newUrls = { ...state.authUrls };
			delete newUrls[serverId];
			return { authUrls: newUrls };
		}),

	serversRequiringAuth: new Set(),
	addServerRequiringAuth: (serverId) =>
		set((state) => ({
			serversRequiringAuth: new Set([...state.serversRequiringAuth, serverId]),
		})),
	removeServerRequiringAuth: (serverId) =>
		set((state) => {
			const newSet = new Set(state.serversRequiringAuth);
			newSet.delete(serverId);
			return { serversRequiringAuth: newSet };
		}),
	setServersRequiringAuth: (serverIds) =>
		set({
			serversRequiringAuth: new Set(serverIds),
		}),

	// Failure reasons
	serverFailureReasons: {},
	setServerFailureReason: (serverId, reason) =>
		set((state) => ({
			serverFailureReasons: {
				...state.serverFailureReasons,
				[serverId]: reason,
			},
		})),
	removeServerFailureReason: (serverId) =>
		set((state) => {
			const newReasons = { ...state.serverFailureReasons };
			delete newReasons[serverId];
			return { serverFailureReasons: newReasons };
		}),

	// UI interaction state
	expandedServers: {},
	toggleServerExpansion: (serverId) =>
		set((state) => ({
			expandedServers: {
				...state.expandedServers,
				[serverId]: !state.expandedServers[serverId],
			},
		})),
}));
