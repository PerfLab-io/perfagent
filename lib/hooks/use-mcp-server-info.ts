'use client';

import useSWR from 'swr';
import type { ServerInfo } from '@/lib/stores/mcp-servers-store';

const serverInfoFetcher = async (url: string): Promise<ServerInfo> => {
	if (process.env.NODE_ENV === 'development') {
		console.log(`[SWR Fetcher] Fetching server info from: ${url}`);
	}

	const response = await fetch(url, {
		headers: {
			'Cache-Control': 'no-cache',
			Pragma: 'no-cache',
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error(
			`[SWR Fetcher] Failed to fetch from ${url}:`,
			response.status,
			errorText,
		);
		throw new Error(
			`Failed to fetch server info: ${response.status} ${errorText}`,
		);
	}

	const data = await response.json();

	if (process.env.NODE_ENV === 'development') {
		console.log(`[SWR Fetcher] Received data from ${url}:`, data);
	}

	return data;
};

interface UseServerInfoOptions {
	refreshInterval?: number;
	enabled?: boolean;
	errorRetryCount?: number;
	errorRetryInterval?: number;
}

export function useServerInfo(
	serverId: string | null,
	options: UseServerInfoOptions = {},
) {
	const {
		refreshInterval = 0, // No auto-refresh by default
		enabled = true,
		errorRetryCount = 3,
		errorRetryInterval = 5000,
	} = options;

	const swrKey =
		serverId && enabled ? `/api/mcp/server-info/${serverId}` : null;
	const cacheOnlyKey =
		serverId && enabled ? `/api/mcp/server-info/${serverId}?cacheOnly=1` : null;

	if (process.env.NODE_ENV === 'development') {
		console.log(
			`[useServerInfo] Called for server ${serverId}, enabled: ${enabled}, key: ${swrKey}`,
		);
	}

	// First, try cacheOnly endpoint for immediate render of cached data (if any)
	const { data: cachedData } = useSWR<ServerInfo>(
		cacheOnlyKey,
		serverInfoFetcher,
		{
			revalidateOnFocus: false,
			revalidateOnReconnect: false,
			shouldRetryOnError: () => false,
			dedupingInterval: 1000,
		},
	);

	// Then, fetch live data which will replace cachedData when ready
	const { data, error, isLoading, isValidating, mutate } = useSWR<ServerInfo>(
		swrKey,
		serverInfoFetcher,
		{
			refreshInterval,
			errorRetryCount,
			errorRetryInterval,
			revalidateOnFocus: true,
			revalidateOnReconnect: false,
			keepPreviousData: false,
			dedupingInterval: 1000,
			refreshWhenHidden: false,
			refreshWhenOffline: false,
			shouldRetryOnError: (error) => {
				if (!error?.message) return true;
				const message = error.message;
				return (
					message.includes('fetch') ||
					message.includes('network') ||
					message.includes('timeout') ||
					message.includes('500') ||
					message.includes('502') ||
					message.includes('503') ||
					message.includes('504')
				);
			},
			fallbackData: cachedData || undefined,
		},
	);

	return {
		serverInfo: data,
		error,
		isLoading,
		isValidating,
		mutate,
		// Helper to manually refresh
		refresh: () => mutate(),
		// Helper to force refresh (clears cache)
		forceRefresh: () => mutate(undefined, { revalidate: true }),
	};
}

// Hook to prefetch server info (useful for hover states)
export function usePrefetchServerInfo() {
	return (serverId: string) => {
		// This will populate the SWR cache
		return serverInfoFetcher(`/api/mcp/server-info/${serverId}`).catch(() => {
			// Silently fail prefetch
		});
	};
}

// Hook to invalidate server info cache
export function useInvalidateServerInfo() {
	return (serverId: string) => {
		// This will invalidate the cache for a specific server
		import('swr').then(({ mutate }) => {
			mutate(`/api/mcp/server-info/${serverId}`, undefined, {
				revalidate: false,
			});
		});
	};
}
