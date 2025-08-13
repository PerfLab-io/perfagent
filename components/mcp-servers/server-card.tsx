'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
	Loader2,
	Server,
	Trash2,
	ExternalLink,
	AlertCircle,
	ChevronDown,
	ChevronRight,
} from 'lucide-react';
import type { MCPServer, ServerInfo } from '@/lib/stores/mcp-servers-store';
import { useMCPServersStore } from '@/lib/stores/mcp-servers-store';
import { useServerInfo } from '@/lib/hooks/use-mcp-server-info';

export interface CapabilitiesCount {
	toolCount: number;
	resourceCount: number;
	promptCount: number;
}

export function getCapabilitiesCountFromInfo(
	info: ServerInfo | undefined | null,
): CapabilitiesCount | null {
	if (!info) return null;

	const toolCount = Object.keys(info.toolsets || {}).reduce(
		(sum, serverName) => {
			const serverToolset = (info.toolsets as any)[serverName];
			if (serverToolset && typeof serverToolset === 'object') {
				return sum + Object.keys(serverToolset).length;
			}
			return sum;
		},
		0,
	);

	let resourceCount = 0;
	let promptCount = 0;

	if (info.resources) {
		if (Array.isArray(info.resources)) {
			resourceCount = info.resources.length;
		} else if (typeof info.resources === 'object') {
			resourceCount = Object.values(info.resources).reduce(
				(sum: number, value: any) => {
					if (Array.isArray(value)) {
						return sum + value.length;
					} else if (value && typeof value === 'object') {
						return sum + Object.keys(value).length;
					}
					return sum;
				},
				0,
			);
		}
	}

	if (info.prompts) {
		if (Array.isArray(info.prompts)) {
			promptCount = info.prompts.length;
		} else if (typeof info.prompts === 'object') {
			promptCount = Object.values(info.prompts).reduce(
				(sum: number, value: any) => {
					if (Array.isArray(value)) {
						return sum + value.length;
					} else if (value && typeof value === 'object') {
						return sum + Object.keys(value).length;
					}
					return sum;
				},
				0,
			);
		}
	}

	return { toolCount, resourceCount, promptCount };
}

function ToolDetails({ info }: { info: ServerInfo | undefined }) {
	if (!info?.toolsets) return null;

	const tools: Array<{ name: string; description?: string; server: string }> =
		[];

	Object.entries(info.toolsets).forEach(([serverName, serverToolset]) => {
		if (serverToolset && typeof serverToolset === 'object') {
			Object.entries(serverToolset as Record<string, any>).forEach(
				([toolName, toolConfig]) => {
					tools.push({
						name: toolName,
						description:
							(toolConfig as any)?.description || 'No description available',
						server: serverName,
					});
				},
			);
		}
	});

	if (tools.length === 0) return null;

	return (
		<div className="mt-4 space-y-2">
			<div className="space-y-2">
				{tools.map((tool, index) => (
					<div
						key={`${tool.server}-${tool.name}-${index}`}
						className="bg-muted/50 rounded-md p-3"
					>
						<div className="flex flex-col gap-3">
							<div className="flex items-center space-x-2">
								<code className="bg-secondary rounded-md px-2 py-1 font-mono text-sm">
									{tool.name}
								</code>
							</div>
							<p className="text-muted-foreground mt-2 overflow-hidden text-sm text-pretty text-ellipsis">
								{tool.description}
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function AuthStatusBadge({
	server,
	requiredAuthServerIds,
}: {
	server: MCPServer;
	requiredAuthServerIds: Set<string>;
}) {
	switch (server.authStatus) {
		case 'authorized':
			return requiredAuthServerIds.has(server.id) ? (
				<Badge variant="outline" className="text-xs text-green-600">
					Authorized
				</Badge>
			) : null;
		case 'required':
			return (
				<Badge variant="outline" className="text-xs text-yellow-600">
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
}

interface ServerCardProps {
	server: MCPServer;
	onToggle: (server: MCPServer) => Promise<void> | void;
	onDelete: (server: MCPServer) => void;
}

export function ServerCard({ server, onToggle, onDelete }: ServerCardProps) {
	const {
		serverInfo,
		error: serverInfoError,
		isLoading: isLoadingInfo,
		forceRefresh: forceRefreshServerInfo,
	} = useServerInfo(server.id, {
		enabled: server.enabled && server.authStatus === 'authorized',
		// Refresh every 5 minutes if the page is focused
		refreshInterval: 5 * 60 * 1000,
		errorRetryCount: 3,
	});

	const authUrl = useMCPServersStore((s) => s.authUrls[server.id]);
	const requiredAuthServerIds = useMCPServersStore(
		(s) => s.serversRequiringAuth,
	);
	const failureReason = useMCPServersStore(
		(s) => s.serverFailureReasons[server.id],
	);
	const isExpanded = useMCPServersStore(
		(s) => s.expandedServers[server.id] ?? false,
	);
	const toggleServerExpansion = useMCPServersStore(
		(s) => s.toggleServerExpansion,
	);

	const counts = getCapabilitiesCountFromInfo(serverInfo);
	const hasInfoError = !!serverInfoError;

	// Trigger a refresh when the server becomes authorized and enabled
	useEffect(() => {
		if (
			server.enabled &&
			server.authStatus === 'authorized' &&
			!serverInfo &&
			!isLoadingInfo
		) {
			forceRefreshServerInfo();
		}
	}, [
		server.enabled,
		server.authStatus,
		serverInfo,
		isLoadingInfo,
		forceRefreshServerInfo,
	]);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<div className="relative">
							<Server className="h-5 w-5" />
						</div>
						<div>
							<div className="flex items-center space-x-2">
								<CardTitle className="text-xl">{server.name}</CardTitle>
								<AuthStatusBadge
									server={server}
									requiredAuthServerIds={requiredAuthServerIds}
								/>
							</div>
							<CardDescription>{server.url}</CardDescription>
						</div>
					</div>
					<div className="flex items-center space-x-2">
						<Switch
							checked={server.enabled}
							onCheckedChange={async () => {
								await onToggle(server);
								forceRefreshServerInfo();
							}}
						/>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => onDelete(server)}
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
										OAuth authentication required but could not auto-discover
										authorization server. Please check server documentation for
										OAuth setup instructions.
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

					{server.authStatus === 'failed' && failureReason && (
						<div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
							<p className="mb-2 text-sm text-red-800">
								Server connection failed.
							</p>
							<p className="text-xs text-red-700">{failureReason}</p>
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
									{counts.toolCount} {counts.toolCount === 1 ? 'Tool' : 'Tools'}
								</Badge>
								<Badge variant="secondary">
									{counts.resourceCount}{' '}
									{counts.resourceCount === 1 ? 'Resource' : 'Resources'}
								</Badge>
								<Badge variant="secondary">
									{counts.promptCount}{' '}
									{counts.promptCount === 1 ? 'Prompt' : 'Prompts'}
								</Badge>
							</div>

							{counts.toolCount > 0 && (
								<Collapsible
									open={isExpanded}
									onOpenChange={() => toggleServerExpansion(server.id)}
								>
									<CollapsibleTrigger asChild>
										<Button variant="ghost" size="sm">
											{isExpanded ? (
												<ChevronDown className="h-4 w-4" />
											) : (
												<ChevronRight className="h-4 w-4" />
											)}
											<span>View Tool Details</span>
										</Button>
									</CollapsibleTrigger>
									<CollapsibleContent>
										<ToolDetails info={serverInfo} />
									</CollapsibleContent>
								</Collapsible>
							)}
						</div>
					) : hasInfoError ? (
						<p className="text-muted-foreground text-sm">
							Unable to fetch server capabilities
						</p>
					) : null}
				</CardContent>
			)}
		</Card>
	);
}
