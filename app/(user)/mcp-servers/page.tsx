'use client';

import { useEffect, useOptimistic, useRef } from 'react';
import { useFormStatus } from 'react-dom';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
	addMcpServerAction,
	toggleMcpServerAction,
	deleteMcpServerAction,
} from '@/app/actions/mcp-servers';
import {
	useMCPServersStore,
	type MCPServer,
	type ServerInfo,
} from '@/lib/stores/mcp-servers-store';

function SubmitButton() {
	const { pending } = useFormStatus();
	return (
		<Button type="submit" disabled={pending}>
			{pending ? 'Adding...' : 'Add Server'}
		</Button>
	);
}

export default function MCPServersPage() {
	// Zustand store
	const {
		servers,
		setServers,
		updateServer,
		removeServer,
		loading,
		setLoading,
		isAddDialogOpen,
		setIsAddDialogOpen,
		formError,
		setFormError,
		serverToDelete,
		setServerToDelete,
		serverInfo,
		setServerInfo,
		loadingServerInfo,
		setLoadingServerInfo,
		serverInfoErrors,
		setServerInfoErrors,
		authUrls,
		setAuthUrl,
		removeAuthUrl,
		serversRequiringAuth,
		addServerRequiringAuth,
		setServersRequiringAuth,
		serverFailureReasons,
		setServerFailureReason,
		expandedServers,
		toggleServerExpansion,
	} = useMCPServersStore();

	// Optimistic updates for adding servers
	const [optimisticServers, addOptimisticServer] = useOptimistic(
		servers,
		(currentServers, newServer: MCPServer) => [...currentServers, newServer],
	);

	// Refs for non-UI state
	const formRef = useRef<HTMLFormElement>(null);

	useEffect(() => {
		fetchServers();
	}, []);

	const fetchServers = async () => {
		try {
			const response = await fetch('/api/mcp/servers');
			if (!response.ok) throw new Error('Failed to fetch servers');
			const data = await response.json();
			// Ensure offline and failed servers are disabled (data consistency check)
			const normalizedData = data.map((server: MCPServer) =>
				(server.authStatus === 'offline' || server.authStatus === 'failed') &&
				server.enabled
					? { ...server, enabled: false }
					: server,
			);
			setServers(normalizedData);

			// Initialize serversRequiringAuth for servers that require/required auth
			// This includes servers currently requiring auth OR servers that have tokens (meaning they required auth before)
			const serversWithAuthRequired = normalizedData
				.filter(
					(server: MCPServer) =>
						server.authStatus === 'required' ||
						(server.authStatus === 'authorized' && server.accessToken),
				)
				.map((server: MCPServer) => server.id);
			setServersRequiringAuth(serversWithAuthRequired);

			// Test connection for each server to update auth status
			normalizedData.forEach((server: MCPServer, index: number) => {
				if (server.enabled) {
					if (server.authStatus === 'authorized') {
						// Enhanced delay for authorized servers to handle SSE connection establishment on refresh
						// This helps with both OAuth token race conditions and SSE connection timing issues
						const refreshDelay = index * 300 + 1000; // Longer staggering (300ms) and base delay (1s) for SSE
						console.log(
							`[Server Init] Scheduling server info fetch for ${server.name} in ${refreshDelay}ms`,
						);
						setTimeout(() => {
							console.log(
								`[Server Init] Starting server info fetch for ${server.name}`,
							);
							fetchServerInfo(server.id);
						}, refreshDelay);
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

	const fetchServerInfo = async (serverId: string, retryCount = 0) => {
		const maxRetries = 3;
		const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s

		setLoadingServerInfo(serverId, true);

		let shouldRetry = false;
		let currentError: Error | null = null;

		try {
			// Add timeout to the fetch request to handle SSE connection issues
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

			const response = await fetch(`/api/mcp/server-info/${serverId}`, {
				signal: controller.signal,
				// Add cache-busting headers to prevent stale responses on refresh
				headers: {
					'Cache-Control': 'no-cache',
					Pragma: 'no-cache',
				},
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`Failed to fetch server info: ${response.status} ${errorText}`,
				);
			}
			const data = await response.json();
			setServerInfo(serverId, data);
			setServerInfoErrors(serverId, false); // Clear any previous error
			console.log(
				`[Server Info] Successfully fetched info for ${serverId} on attempt ${retryCount + 1}`,
			);
		} catch (error) {
			currentError =
				error instanceof Error ? error : new Error('Unknown error');
			console.error(
				`[Server Info] Failed to fetch server info (attempt ${retryCount + 1}):`,
				currentError,
			);

			// Enhanced retry logic for SSE and authentication issues
			const isRetryableError =
				retryCount < maxRetries &&
				// Authentication/authorization errors (token issues)
				(currentError.message.includes('authentication') ||
					currentError.message.includes('401') ||
					currentError.message.includes('authorization') ||
					currentError.message.includes('OAuth') ||
					// Network/connection errors (SSE issues)
					currentError.message.includes('fetch') ||
					currentError.message.includes('network') ||
					currentError.message.includes('timeout') ||
					currentError.message.includes('aborted') ||
					// Server errors that might be temporary
					currentError.message.includes('500') ||
					currentError.message.includes('502') ||
					currentError.message.includes('503') ||
					currentError.message.includes('504'));

			if (isRetryableError) {
				shouldRetry = true;
				console.log(
					`[Server Info] Retrying server info fetch for ${serverId} in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`,
				);
				setTimeout(() => {
					fetchServerInfo(serverId, retryCount + 1);
				}, retryDelay);
			} else {
				console.error(
					`[Server Info] Max retries exceeded or non-retryable error for ${serverId}:`,
					currentError.message,
				);
				setServerInfoErrors(serverId, true); // Mark as having an error
			}
		} finally {
			// Only clear loading state if we're not retrying
			if (!shouldRetry) {
				setLoadingServerInfo(serverId, false);
			}
		}
	};

	const testServerConnection = async (serverId: string) => {
		try {
			const response = await fetch(`/api/mcp/servers/${serverId}/test`, {
				method: 'POST',
			});

			if (!response.ok) {
				// If response is not ok, check if it's a connection/network error
				if (response.status >= 500 || response.status === 0) {
					// Mark server as offline and disable it for server errors or network failures
					updateServer(serverId, { authStatus: 'offline', enabled: false });
					// Also disable in backend to persist the change
					await toggleMcpServerAction(serverId, false);
					toast.warning(
						'Server is offline and has been automatically disabled',
					);
					return;
				} else {
					// Other HTTP errors (4xx) - mark as failed and disable
					const errorMessage =
						response.status === 400
							? 'Invalid server configuration'
							: response.status === 404
								? 'Server endpoint not found'
								: response.status === 403
									? 'Access forbidden'
									: `Server error (${response.status})`;

					updateServer(serverId, { authStatus: 'failed', enabled: false });
					setServerFailureReason(serverId, errorMessage);
					// Also disable in backend to persist the change
					await toggleMcpServerAction(serverId, false);
					toast.error('Server failed and has been automatically disabled');
					return;
				}
			}

			const result = await response.json();

			if (result.status === 'auth_required') {
				// Store the auth URL even if it's null (for manual setup cases)
				setAuthUrl(serverId, result.authUrl || 'manual_setup');
				// Mark this server as requiring auth
				addServerRequiringAuth(serverId);
				// Update server status to 'required' to show the Auth Required badge
				updateServer(serverId, { authStatus: 'required' });
			} else if (result.status === 'authorized') {
				// Remove from auth URLs if it was there
				removeAuthUrl(serverId);
				// Update server status to 'authorized'
				updateServer(serverId, { authStatus: 'authorized' });
				// Fetch server info since it's now authorized
				fetchServerInfo(serverId);
			}
		} catch (error) {
			console.error('Failed to test server connection:', error);
			// Determine if it's a network error or a server configuration error
			const isNetworkError =
				error instanceof TypeError ||
				(error instanceof Error && error.message.includes('fetch'));

			if (isNetworkError) {
				// Mark server as offline for network/connection errors
				updateServer(serverId, { authStatus: 'offline', enabled: false });
				toast.warning('Server is offline and has been automatically disabled');
			} else {
				// Mark server as failed for other errors
				updateServer(serverId, { authStatus: 'failed', enabled: false });
				setServerFailureReason(
					serverId,
					error instanceof Error ? error.message : 'Unknown error',
				);
				toast.error('Server failed and has been automatically disabled');
			}
			// Also disable in backend to persist the change
			await toggleMcpServerAction(serverId, false);
		}
	};

	// Simplified server action with optimistic updates
	const formAction = async (formData: FormData) => {
		const name = formData.get('name') as string;
		const url = formData.get('url') as string;

		// Create optimistic server
		const optimisticServer: MCPServer = {
			id: crypto.randomUUID(),
			name: name.trim(),
			url: url.trim(),
			enabled: true,
			authStatus: 'unknown',
			accessToken: null,
			refreshToken: null,
			tokenExpiresAt: null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		// Add optimistically
		addOptimisticServer(optimisticServer);

		try {
			const result = await addMcpServerAction(formData);

			if (result.success) {
				// Success: update actual state and test connection
				setServers([...servers, result.data]);
				setIsAddDialogOpen(false);
				formRef.current?.reset();
				setFormError(null);
				toast.success('MCP server added successfully');
				testServerConnection(result.data.id);
			} else {
				// Error: show error (optimistic update will be reverted automatically)
				setFormError(result.error || 'Failed to add MCP server');
				toast.error(result.error || 'Failed to add MCP server');
			}
		} catch (error) {
			// Error: show error (optimistic update will be reverted automatically)
			const errorMessage = 'Failed to add MCP server';
			setFormError(errorMessage);
			toast.error(errorMessage);
		}
	};

	const handleToggleServer = async (server: MCPServer) => {
		const newEnabledState = !server.enabled;

		// Optimistic update
		updateServer(server.id, { enabled: newEnabledState });

		try {
			const result = await toggleMcpServerAction(server.id, newEnabledState);

			if (result.success) {
				// Test connection and fetch server info if enabling
				if (newEnabledState) {
					// Small delay to ensure database transaction is committed
					setTimeout(() => {
						testServerConnection(server.id);
					}, 100);
				}
				toast.success(`Server ${newEnabledState ? 'enabled' : 'disabled'}`);
			} else {
				// Rollback optimistic update
				updateServer(server.id, { enabled: server.enabled });
				toast.error(result.error || 'Failed to update server');
			}
		} catch (error) {
			// Rollback optimistic update
			updateServer(server.id, { enabled: server.enabled });
			toast.error('Failed to update server');
		}
	};

	const handleDeleteServer = async () => {
		if (!serverToDelete) return;

		try {
			const result = await deleteMcpServerAction(serverToDelete.id);

			if (result.success) {
				removeServer(serverToDelete.id);
				setServerToDelete(null);
				toast.success('MCP server deleted');
			} else {
				toast.error(result.error || 'Failed to delete server');
			}
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
			<div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6">
				<div className="flex items-center justify-between">
					<div>
						<Skeleton className="h-9 w-48" />
						<Skeleton className="mt-2 h-5 w-64" />
					</div>
					<Skeleton className="h-10 w-32" />
				</div>

				<div className="space-y-4">
					{/* Skeleton for server cards */}
					{[1, 2, 3].map((i) => (
						<Card key={i}>
							<CardHeader>
								<div className="flex items-center justify-between">
									<div className="flex items-center space-x-4">
										<Skeleton className="h-10 w-10 rounded-full" />
										<div>
											<Skeleton className="h-6 w-32" />
											<Skeleton className="mt-2 h-4 w-48" />
										</div>
									</div>
									<div className="flex items-center space-x-2">
										<Skeleton className="h-6 w-11 rounded-full" />
										<Skeleton className="h-9 w-9" />
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<div className="flex space-x-4">
									<Skeleton className="h-6 w-20" />
									<Skeleton className="h-6 w-28" />
									<Skeleton className="h-6 w-24" />
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">MCP Servers</h1>
					<p className="text-muted-foreground">
						Manage your Model Context Protocol servers
					</p>
				</div>
				<Dialog
					open={isAddDialogOpen}
					onOpenChange={(open) => {
						setIsAddDialogOpen(open);
						if (open) {
							setFormError(null); // Clear errors when opening dialog
						}
					}}
				>
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
						{/* TODO: Future migration to TanStack Form for enhanced validation and type safety
						     Current native form approach provides good foundation for migration:
						     - FormData already structured for server actions
						     - Loading states implemented
						     - Error handling patterns established
						     Migration benefits: field-level validation, better TypeScript integration */}
						<form ref={formRef} action={formAction} className="space-y-4">
							{formError && (
								<Alert variant="destructive">
									<AlertCircle className="h-4 w-4" />
									<AlertDescription>{formError}</AlertDescription>
								</Alert>
							)}
							<div>
								<Label htmlFor="name">Server Name</Label>
								<Input
									id="name"
									name="name"
									required
									placeholder="My MCP Server"
								/>
							</div>
							<div>
								<Label htmlFor="url">Server URL</Label>
								<Input
									id="url"
									name="url"
									type="url"
									required
									placeholder="https://example.com/api/mcp"
								/>
							</div>
							<p className="text-muted-foreground text-sm">
								OAuth authentication will be automatically detected and
								configured if required by the server.
							</p>
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={() => setIsAddDialogOpen(false)}
								>
									Cancel
								</Button>
								<SubmitButton />
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			</div>

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
					optimisticServers.map((server) => {
						const counts = getCapabilitiesCount(server.id);
						const isLoadingInfo = loadingServerInfo[server.id];
						const authUrl = authUrls[server.id];

						const getAuthStatusBadge = () => {
							switch (server.authStatus) {
								case 'authorized':
									// Only show badge if this server actually required auth
									return serversRequiringAuth.has(server.id) ? (
										<Badge variant="outline" className="text-xs text-green-600">
											Authorized
										</Badge>
									) : null;
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
								case 'offline':
									return (
										<Badge variant="outline" className="text-xs text-gray-600">
											Offline
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
								{(server.enabled || server.authStatus === 'failed') && (
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

										{server.authStatus === 'failed' &&
											serverFailureReasons[server.id] && (
												<div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
													<p className="mb-2 text-sm text-red-800">
														Server connection failed.
													</p>
													<p className="text-xs text-red-700">
														{serverFailureReasons[server.id]}
													</p>
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
										) : serverInfoErrors[server.id] ? (
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
