'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Plus, Server, Settings, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

interface MCPServer {
	id: string;
	name: string;
	url: string;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
}

interface ServerInfo {
	server: MCPServer;
	toolsets: any;
	resources: any;
	prompts: any;
}

export default function MCPServersPage() {
	const [servers, setServers] = useState<MCPServer[]>([]);
	const [loading, setLoading] = useState(true);
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [newServerName, setNewServerName] = useState('');
	const [newServerUrl, setNewServerUrl] = useState('');
	const [serverToDelete, setServerToDelete] = useState<MCPServer | null>(null);
	const [serverInfo, setServerInfo] = useState<Record<string, ServerInfo>>({});
	const [loadingServerInfo, setLoadingServerInfo] = useState<
		Record<string, boolean>
	>({});

	useEffect(() => {
		fetchServers();
	}, []);

	const fetchServers = async () => {
		try {
			const response = await fetch('/api/mcp/servers');
			if (!response.ok) throw new Error('Failed to fetch servers');
			const data = await response.json();
			setServers(data);

			// Fetch info for each server
			data.forEach((server: MCPServer) => {
				if (server.enabled) {
					fetchServerInfo(server.id);
				}
			});
		} catch (error) {
			toast.error('Failed to fetch MCP servers');
		} finally {
			setLoading(false);
		}
	};

	const fetchServerInfo = async (serverId: string) => {
		setLoadingServerInfo((prev) => ({ ...prev, [serverId]: true }));
		try {
			const response = await fetch(`/api/mcp/server-info/${serverId}`);
			if (!response.ok) throw new Error('Failed to fetch server info');
			const data = await response.json();
			setServerInfo((prev) => ({ ...prev, [serverId]: data }));
		} catch (error) {
			console.error('Failed to fetch server info:', error);
		} finally {
			setLoadingServerInfo((prev) => ({ ...prev, [serverId]: false }));
		}
	};

	const handleAddServer = async () => {
		if (!newServerName || !newServerUrl) {
			toast.error('Please provide both name and URL');
			return;
		}

		try {
			const response = await fetch('/api/mcp/servers', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newServerName,
					url: newServerUrl,
				}),
			});

			if (!response.ok) throw new Error('Failed to add server');

			const newServer = await response.json();
			setServers([...servers, newServer]);
			setIsAddDialogOpen(false);
			setNewServerName('');
			setNewServerUrl('');

			toast.success('MCP server added successfully');

			// Fetch info for the new server
			fetchServerInfo(newServer.id);
		} catch (error) {
			toast.error('Failed to add MCP server');
		}
	};

	const handleToggleServer = async (server: MCPServer) => {
		try {
			const response = await fetch(`/api/mcp/servers/${server.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					enabled: !server.enabled,
				}),
			});

			if (!response.ok) throw new Error('Failed to update server');

			setServers(
				servers.map((s) =>
					s.id === server.id ? { ...s, enabled: !s.enabled } : s,
				),
			);

			// Fetch server info if enabling
			if (!server.enabled) {
				fetchServerInfo(server.id);
			}

			toast.success(`Server ${!server.enabled ? 'enabled' : 'disabled'}`);
		} catch (error) {
			toast.error('Failed to update server');
		}
	};

	const handleDeleteServer = async () => {
		if (!serverToDelete) return;

		try {
			const response = await fetch(`/api/mcp/servers/${serverToDelete.id}`, {
				method: 'DELETE',
			});

			if (!response.ok) throw new Error('Failed to delete server');

			setServers(servers.filter((s) => s.id !== serverToDelete.id));
			setServerToDelete(null);

			toast.success('MCP server deleted');
		} catch (error) {
			toast.error('Failed to delete server');
		}
	};

	const getCapabilitiesCount = (serverId: string) => {
		const info = serverInfo[serverId];
		if (!info) return null;

		const toolCount = Object.keys(info.toolsets || {}).reduce(
			(sum, key) => sum + (info.toolsets[key]?.length || 0),
			0,
		);
		const resourceCount = Object.keys(info.resources || {}).reduce(
			(sum, key) => sum + (info.resources[key]?.length || 0),
			0,
		);
		const promptCount = Object.keys(info.prompts || {}).reduce(
			(sum, key) => sum + (info.prompts[key]?.length || 0),
			0,
		);

		return { toolCount, resourceCount, promptCount };
	};

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-4xl space-y-6 p-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">MCP Servers</h1>
					<p className="text-muted-foreground">
						Manage your Model Context Protocol servers
					</p>
				</div>
				<Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
					<DialogTrigger asChild>
						<Button>
							<Plus className="mr-2 h-4 w-4" />
							Add Server
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Add MCP Server</DialogTitle>
							<DialogDescription>
								Connect to a new Model Context Protocol server
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4">
							<div>
								<Label htmlFor="name">Server Name</Label>
								<Input
									id="name"
									value={newServerName}
									onChange={(e) => setNewServerName(e.target.value)}
									placeholder="My MCP Server"
								/>
							</div>
							<div>
								<Label htmlFor="url">Server URL</Label>
								<Input
									id="url"
									value={newServerUrl}
									onChange={(e) => setNewServerUrl(e.target.value)}
									placeholder="https://example.com/api/mcp"
								/>
							</div>
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setIsAddDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button onClick={handleAddServer}>Add Server</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			<div className="space-y-4">
				{servers.length === 0 ? (
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
					servers.map((server) => {
						const counts = getCapabilitiesCount(server.id);
						const isLoadingInfo = loadingServerInfo[server.id];

						return (
							<Card key={server.id}>
								<CardHeader>
									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-4">
											<Server className="h-5 w-5" />
											<div>
												<CardTitle className="text-xl">{server.name}</CardTitle>
												<CardDescription>{server.url}</CardDescription>
											</div>
										</div>
										<div className="flex items-center space-x-2">
											<Switch
												checked={server.enabled}
												onCheckedChange={() => handleToggleServer(server)}
											/>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setServerToDelete(server)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									</div>
								</CardHeader>
								{server.enabled && (
									<CardContent>
										{isLoadingInfo ? (
											<div className="text-muted-foreground flex items-center space-x-2 text-sm">
												<Loader2 className="h-4 w-4 animate-spin" />
												<span>Loading capabilities...</span>
											</div>
										) : counts ? (
											<div className="flex space-x-4">
												<Badge variant="secondary">
													{counts.toolCount}{' '}
													{counts.toolCount === 1 ? 'Tool' : 'Tools'}
												</Badge>
												<Badge variant="secondary">
													{counts.resourceCount}{' '}
													{counts.resourceCount === 1
														? 'Resource'
														: 'Resources'}
												</Badge>
												<Badge variant="secondary">
													{counts.promptCount}{' '}
													{counts.promptCount === 1 ? 'Prompt' : 'Prompts'}
												</Badge>
											</div>
										) : (
											<p className="text-muted-foreground text-sm">
												Unable to fetch server capabilities
											</p>
										)}
									</CardContent>
								)}
							</Card>
						);
					})
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
		</div>
	);
}
