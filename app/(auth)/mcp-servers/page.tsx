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
import {
	Loader2,
	Plus,
	Server,
	Trash2,
	ExternalLink,
	AlertCircle,
	CheckCircle,
	XCircle,
	ChevronDown,
	ChevronRight,
	Wrench,
} from 'lucide-react';
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
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface MCPServer {
	id: string;
	name: string;
	url: string;
	enabled: boolean;
	authStatus?: 'unknown' | 'required' | 'authorized' | 'failed';
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
	const [authUrls, setAuthUrls] = useState<Record<string, string>>({});
	const [expandedServers, setExpandedServers] = useState<
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

			// Test connection for each server to update auth status
			data.forEach((server: MCPServer) => {
				if (server.enabled) {
					if (server.authStatus === 'authorized') {
						fetchServerInfo(server.id);
					} else if (server.authStatus === 'unknown') {
						testServerConnection(server.id);
					} else if (server.authStatus === 'required' && !authUrls[server.id]) {
						// If auth is required but we don't have the auth URL yet, test to get it
						testServerConnection(server.id);
					}
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

	const testServerConnection = async (serverId: string) => {
		try {
			const response = await fetch(`/api/mcp/servers/${serverId}/test`, {
				method: 'POST',
			});
			const result = await response.json();

			if (result.status === 'auth_required') {
				// Store the auth URL even if it's null (for manual setup cases)
				setAuthUrls((prev) => ({
					...prev,
					[serverId]: result.authUrl || 'manual_setup',
				}));
			} else if (result.status === 'authorized') {
				// Remove from auth URLs if it was there
				setAuthUrls((prev) => {
					const newUrls = { ...prev };
					delete newUrls[serverId];
					return newUrls;
				});
				// Fetch server info since it's now authorized
				fetchServerInfo(serverId);
			}
		} catch (error) {
			console.error('Failed to test server connection:', error);
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

			// Reset form
			setNewServerName('');
			setNewServerUrl('');

			toast.success('MCP server added successfully');

			// Fetch the updated servers list to get the auth status
			fetchServers();
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

		// Fix toolsets counting - toolsets are objects where each key is a tool name
		const toolCount = Object.keys(info.toolsets || {}).reduce(
			(sum, serverName) => {
				const serverToolset = info.toolsets[serverName];
				if (serverToolset && typeof serverToolset === 'object') {
					// Count the number of tool keys in this server's toolset
					return sum + Object.keys(serverToolset).length;
				}
				return sum;
			},
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

	const toggleServerExpansion = (serverId: string) => {
		setExpandedServers((prev) => ({
			...prev,
			[serverId]: !prev[serverId],
		}));
	};

	const renderToolDetails = (serverId: string) => {
		const info = serverInfo[serverId];
		if (!info?.toolsets) return null;

		const tools: Array<{ name: string; description?: string; server: string }> =
			[];

		// Extract all tools from all servers in toolsets
		Object.entries(info.toolsets).forEach(([serverName, serverToolset]) => {
			if (serverToolset && typeof serverToolset === 'object') {
				Object.entries(serverToolset).forEach(
					([toolName, toolConfig]: [string, any]) => {
						tools.push({
							name: toolName,
							description:
								toolConfig?.description || 'No description available',
							server: serverName,
						});
					},
				);
			}
		});

		if (tools.length === 0) return null;

		return (
			<div className="mt-4 space-y-2">
				<h4 className="flex items-center text-sm font-medium">
					<Wrench className="mr-2 h-4 w-4" />
					Available Tools
				</h4>
				<div className="space-y-2">
					{tools.map((tool, index) => (
						<div
							key={`${tool.server}-${tool.name}-${index}`}
							className="bg-muted/50 rounded-md p-3"
						>
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<div className="flex items-center space-x-2">
										<code className="bg-background rounded px-2 py-1 font-mono text-sm">
											{tool.name}
										</code>
										<Badge variant="outline" className="text-xs">
											{tool.server}
										</Badge>
									</div>
									<p className="text-muted-foreground mt-2 text-sm">
										{tool.description}
									</p>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		);
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
							<p className="text-muted-foreground text-sm">
								OAuth authentication will be automatically detected and
								configured if required by the server.
							</p>
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
						const authUrl = authUrls[server.id];

						const getAuthStatusIcon = () => {
							switch (server.authStatus) {
								case 'authorized':
									return <CheckCircle className="h-4 w-4 text-green-500" />;
								case 'required':
									return <AlertCircle className="h-4 w-4 text-yellow-500" />;
								case 'failed':
									return <XCircle className="h-4 w-4 text-red-500" />;
								default:
									return (
										<Loader2 className="h-4 w-4 animate-spin text-gray-400" />
									);
							}
						};

						const getAuthStatusBadge = () => {
							switch (server.authStatus) {
								case 'authorized':
									return (
										<Badge variant="outline" className="text-xs text-green-600">
											Authorized
										</Badge>
									);
								case 'required':
									return (
										<Badge
											variant="outline"
											className="text-xs text-yellow-600"
										>
											Auth Required
										</Badge>
									);
								case 'failed':
									return (
										<Badge variant="outline" className="text-xs text-red-600">
											Failed
										</Badge>
									);
								default:
									return (
										<Badge variant="outline" className="text-xs text-gray-600">
											Checking...
										</Badge>
									);
							}
						};

						return (
							<Card key={server.id}>
								<CardHeader>
									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-4">
											<div className="relative">
												<Server className="h-5 w-5" />
												<div className="absolute -top-1 -right-1">
													{getAuthStatusIcon()}
												</div>
											</div>
											<div>
												<div className="flex items-center space-x-2">
													<CardTitle className="text-xl">
														{server.name}
													</CardTitle>
													{getAuthStatusBadge()}
												</div>
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
										{server.authStatus === 'required' && authUrl && (
											<div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 p-3">
												<p className="mb-2 text-sm text-yellow-800">
													Authentication required.
												</p>
												{authUrl === 'manual_setup' ? (
													<div>
														<p className="mb-2 text-xs text-yellow-700">
															OAuth authentication required but could not
															auto-discover authorization server. Please check
															server documentation for OAuth setup instructions.
														</p>
														<Button
															variant="outline"
															size="sm"
															disabled
															className="border-yellow-300 text-yellow-600"
														>
															<AlertCircle className="mr-2 h-4 w-4" />
															Manual Setup Required
														</Button>
													</div>
												) : (
													<div>
														<p className="mb-2 text-sm text-yellow-800">
															Click here to continue:
														</p>
														<Button
															variant="outline"
															size="sm"
															onClick={() => window.open(authUrl, '_blank')}
															className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
														>
															<ExternalLink className="mr-2 h-4 w-4" />
															Authorize Access
														</Button>
													</div>
												)}
											</div>
										)}

										{isLoadingInfo ? (
											<div className="text-muted-foreground flex items-center space-x-2 text-sm">
												<Loader2 className="h-4 w-4 animate-spin" />
												<span>Loading capabilities...</span>
											</div>
										) : counts ? (
											<div className="space-y-3">
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

												{counts.toolCount > 0 && (
													<Collapsible
														open={expandedServers[server.id]}
														onOpenChange={() =>
															toggleServerExpansion(server.id)
														}
													>
														<CollapsibleTrigger asChild>
															<Button
																variant="ghost"
																size="sm"
																className="flex h-auto items-center space-x-2 p-0 text-sm"
															>
																{expandedServers[server.id] ? (
																	<ChevronDown className="h-4 w-4" />
																) : (
																	<ChevronRight className="h-4 w-4" />
																)}
																<span>View Tool Details</span>
															</Button>
														</CollapsibleTrigger>
														<CollapsibleContent>
															{renderToolDetails(server.id)}
														</CollapsibleContent>
													</Collapsible>
												)}
											</div>
										) : server.authStatus === 'authorized' ? (
											<p className="text-muted-foreground text-sm">
												Unable to fetch server capabilities
											</p>
										) : null}
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
