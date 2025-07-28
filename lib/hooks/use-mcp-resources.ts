'use client';

import { useState, useCallback } from 'react';

interface MCPResource {
	uri: string;
	name?: string;
	description?: string;
	mimeType?: string;
	annotations?: {
		audience?: string[];
		priority?: number;
	};
}

interface MCPResourceContent {
	uri: string;
	mimeType: string;
	text?: string;
	blob?: string;
}

interface MCPResourceState {
	loading: Record<string, boolean>;
	contents: Record<string, MCPResourceContent>;
	errors: Record<string, string>;
}

export function useMCPResources() {
	const [state, setState] = useState<MCPResourceState>({
		loading: {},
		contents: {},
		errors: {},
	});

	const loadResourceContent = useCallback(
		async (resource: MCPResource, serverName?: string) => {
			const { uri } = resource;

			// Set loading state
			setState((prev) => ({
				...prev,
				loading: { ...prev.loading, [uri]: true },
				errors: { ...prev.errors, [uri]: '' },
			}));

			try {
				const response = await fetch('/api/mcp/resource', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ uri, serverName }),
				});

				if (!response.ok) {
					throw new Error(`Failed to load resource: ${response.statusText}`);
				}

				const content: MCPResourceContent = await response.json();

				setState((prev) => ({
					...prev,
					loading: { ...prev.loading, [uri]: false },
					contents: { ...prev.contents, [uri]: content },
				}));
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : 'Unknown error';
				setState((prev) => ({
					...prev,
					loading: { ...prev.loading, [uri]: false },
					errors: { ...prev.errors, [uri]: errorMessage },
				}));
			}
		},
		[],
	);

	return {
		loadingStates: state.loading,
		contents: state.contents,
		errors: state.errors,
		loadResourceContent,
	};
}

// Helper function to extract MCP resources from AI SDK tool invocations
export function extractMCPResourcesFromMessage(
	message: any,
): { serverName: string; resources: MCPResource[] }[] {
	if (!message.parts) return [];

	const resourceGroups: { serverName: string; resources: MCPResource[] }[] = [];

	message.parts.forEach((part: any) => {
		if (part.type === 'tool-invocation' && part.toolInvocation) {
			const { toolName, args, result } = part.toolInvocation;

			// Check if this is an MCP resource listing tool
			// Tool names may be normalized, so check for various patterns
			const isResourceListingTool =
				toolName?.includes('list_resources') ||
				toolName?.includes('listResources') ||
				toolName?.includes('resources_list');

			if (isResourceListingTool && result) {
				// Extract server name from tool name
				// Handle different naming patterns: serverName_list_resources, serverName__list_resources, etc.
				const parts = toolName.split(/[_-]+/);
				const serverName = parts[0] || 'Unknown Server';

				// Handle different result structures
				let resources: MCPResource[] = [];

				if (result.resources && Array.isArray(result.resources)) {
					resources = result.resources;
				} else if (Array.isArray(result)) {
					resources = result;
				} else if (result.data && Array.isArray(result.data)) {
					resources = result.data;
				}

				// Only add if we found resources
				if (resources.length > 0) {
					resourceGroups.push({
						serverName,
						resources,
					});
				}
			}
		}
	});

	return resourceGroups;
}
