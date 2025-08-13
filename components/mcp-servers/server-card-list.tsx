'use client';

import { useEffect, useState, useOptimistic } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Server } from 'lucide-react';
import { toast } from 'sonner';
import {
	useMCPServersStore,
	type MCPServer,
} from '@/lib/stores/mcp-servers-store';
import { ServerCard } from './server-card';
import {
	toggleMcpServerAction,
	deleteMcpServerAction,
} from '@/app/actions/mcp-servers';
import { useTestServerConnection } from '@/lib/hooks/use-mcp-server-test';
import { useUIStore } from '@/lib/stores/ui-store';
import { useShallow } from 'zustand/react/shallow';

interface ServerCardListProps {
	initialServers: MCPServer[];
}

export function ServerCardList({ initialServers }: ServerCardListProps) {
	const [serverToDelete, setServerToDelete] = useState<MCPServer | null>(null);

	const servers = useMCPServersStore((s) => s.servers);
	const setServers = useMCPServersStore((s) => s.setServers);
	const updateServer = useMCPServersStore((s) => s.updateServer);
	const removeServer = useMCPServersStore((s) => s.removeServer);
	const setLoading = useMCPServersStore((s) => s.setLoading);
	const setServersRequiringAuth = useMCPServersStore(
		(s) => s.setServersRequiringAuth,
	);
	const testServerConnection = useTestServerConnection();

	const [optimisticServers, addOptimisticUpdate] = useOptimistic(
		servers.length > 0 ? servers : initialServers,
		(
			currentServers,
			update: {
				type: 'toggle' | 'delete';
				server: MCPServer;
				enabled?: boolean;
			},
		) => {
			if (update.type === 'toggle') {
				return currentServers.map((s) =>
					s.id === update.server.id
						? { ...s, enabled: update.enabled ?? !s.enabled }
						: s,
				);
			}
			if (update.type === 'delete') {
				return currentServers.filter((s) => s.id !== update.server.id);
			}
			return currentServers;
		},
	);

	const { setIsEditable, setPageTitle } = useUIStore(
		useShallow((state) => ({
			setIsEditable: state.setIsEditable,
			setPageTitle: state.setPageTitle,
		})),
	);

	useEffect(() => {
		setPageTitle('MCP Servers');
		setIsEditable(false);

		return () => {
			setPageTitle('Loading...');
			setIsEditable(false);
		};
	}, []);

	useEffect(() => {
		if (servers.length > 0) {
			setLoading(false);
			return;
		}

		// Ensure offline and failed servers are disabled (data consistency check)
		const normalizedData = initialServers.map((server: MCPServer) =>
			(server.authStatus === 'offline' || server.authStatus === 'failed') &&
			server.enabled
				? { ...server, enabled: false }
				: server,
		);
		setServers(normalizedData);

		// Initialize serversRequiringAuth for servers that require/required auth
		const serversWithAuthRequired = normalizedData
			.filter(
				(server: MCPServer) =>
					server.authStatus === 'required' ||
					(server.authStatus === 'authorized' && server.accessToken),
			)
			.map((server: MCPServer) => server.id);
		setServersRequiringAuth(serversWithAuthRequired);

		// Test connection for each server to update auth status
		normalizedData.forEach((server: MCPServer) => {
			if (server.enabled) {
				// For authorized servers, SWR will automatically fetch server info in ServerCard
				// For other statuses, we need to test the connection
				if (
					server.authStatus === 'unknown' ||
					server.authStatus === 'required'
				) {
					testServerConnection(server.id);
				}
			}
		});

		setLoading(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleToggleServer = async (server: MCPServer) => {
		const newEnabledState = !server.enabled;

		addOptimisticUpdate({ type: 'toggle', server, enabled: newEnabledState });
		updateServer(server.id, { enabled: newEnabledState });

		try {
			const result = await toggleMcpServerAction(server.id, newEnabledState);

			if (result.success) {
				if (newEnabledState) {
					testServerConnection(server.id);
				}
				toast.success(`Server ${newEnabledState ? 'enabled' : 'disabled'}`);
			} else {
				throw new Error(result.error || 'Failed to update server');
			}
		} catch (error) {
			// Rollback optimistic update
			updateServer(server.id, { enabled: server.enabled });
			toast.error('Failed to update server');
		}
	};

	const handleDeleteServer = async () => {
		if (!serverToDelete) return;

		addOptimisticUpdate({ type: 'delete', server: serverToDelete });

		try {
			const result = await deleteMcpServerAction(serverToDelete.id);

			if (result.success) {
				removeServer(serverToDelete.id);
				setServerToDelete(null);
				toast.success('MCP server deleted');
			} else {
				throw new Error(result.error || 'Failed to delete server');
			}
		} catch (error) {
			// Rollback
			window.location.reload();
			toast.error('Failed to delete server');
		}
	};

	return (
		<>
			<div className="space-y-4">
				{optimisticServers.length === 0 ? (
					<Card>
						<CardContent className="flex flex-col items-center justify-center py-12">
							<Server className="text-muted-foreground mb-4 h-12 w-12" />
							<p className="text-lg font-medium">No servers configured</p>
							<p className="text-muted-foreground text-sm">
								Add your first MCP server to get started
							</p>
						</CardContent>
					</Card>
				) : (
					optimisticServers.map((server) => (
						<ServerCard
							key={server.id}
							server={server}
							onToggle={handleToggleServer}
							onDelete={(s) => setServerToDelete(s)}
						/>
					))
				)}
			</div>

			<AlertDialog
				open={!!serverToDelete}
				onOpenChange={() => setServerToDelete(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Server</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{serverToDelete?.name}"? This
							action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleDeleteServer}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
