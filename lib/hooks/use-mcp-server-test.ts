'use client';

import useSWR from 'swr';
import { useMCPServersStore } from '@/lib/stores/mcp-servers-store';
import { toast } from 'sonner';
import { toggleMcpServerAction } from '@/app/actions/mcp-servers';

interface ServerTestResult {
	status: 'auth_required' | 'authorized' | 'failed' | 'offline';
	authUrl?: string | null;
	error?: string;
}

const serverTestFetcher = async (url: string): Promise<ServerTestResult> => {
	const response = await fetch(url, {
		method: 'POST',
	});

	if (!response.ok) {
		// If response is not ok, check if it's a connection/network error
		if (response.status >= 500 || response.status === 0) {
			return {
				status: 'offline',
				error: 'Server is offline',
			};
		} else {
			// Other HTTP errors (4xx)
			const errorMessage =
				response.status === 400
					? 'Invalid server configuration'
					: response.status === 404
						? 'Server endpoint not found'
						: response.status === 403
							? 'Access forbidden'
							: `Server error (${response.status})`;

			return {
				status: 'failed',
				error: errorMessage,
			};
		}
	}

	return response.json();
};

interface UseServerTestOptions {
	enabled?: boolean;
	onSuccess?: (result: ServerTestResult) => void;
	onError?: (error: Error) => void;
	autoUpdateState?: boolean;
}

export function useServerTest(
	serverId: string | null,
	options: UseServerTestOptions = {},
) {
	const {
		enabled = false,
		onSuccess,
		onError,
		autoUpdateState = true,
	} = options;

	const updateServer = useMCPServersStore((s) => s.updateServer);
	const setAuthUrl = useMCPServersStore((s) => s.setAuthUrl);
	const removeAuthUrl = useMCPServersStore((s) => s.removeAuthUrl);
	const addServerRequiringAuth = useMCPServersStore(
		(s) => s.addServerRequiringAuth,
	);
	const setServerFailureReason = useMCPServersStore(
		(s) => s.setServerFailureReason,
	);

	const { data, error, isLoading, isValidating, mutate } =
		useSWR<ServerTestResult>(
			// Only test if serverId exists and testing is enabled
			serverId && enabled ? `/api/mcp/servers/${serverId}/test` : null,
			serverTestFetcher,
			{
				// Don't auto-revalidate test endpoints
				revalidateOnFocus: false,
				revalidateOnReconnect: false,
				// Keep test results for 30 seconds
				dedupingInterval: 30000,
				// Don't retry test failures automatically
				errorRetryCount: 0,
				onSuccess: async (result) => {
					if (!serverId || !autoUpdateState) return;

					switch (result.status) {
						case 'auth_required':
							// Store the auth URL even if it's null (for manual setup cases)
							setAuthUrl(serverId, result.authUrl || 'manual_setup');
							addServerRequiringAuth(serverId);
							updateServer(serverId, { authStatus: 'required' });
							break;

						case 'authorized':
							removeAuthUrl(serverId);
							updateServer(serverId, { authStatus: 'authorized' });
							break;

						case 'offline':
							updateServer(serverId, { authStatus: 'offline', enabled: false });
							await toggleMcpServerAction(serverId, false);
							toast.warning(
								'Server is offline and has been automatically disabled',
							);
							break;

						case 'failed':
							updateServer(serverId, { authStatus: 'failed', enabled: false });
							if (result.error) {
								setServerFailureReason(serverId, result.error);
							}
							await toggleMcpServerAction(serverId, false);
							toast.error('Server failed and has been automatically disabled');
							break;
					}

					onSuccess?.(result);
				},
				onError: (err) => {
					if (!serverId || !autoUpdateState) return;

					console.error('Failed to test server connection:', err);

					// Determine if it's a network error or a server configuration error
					const isNetworkError =
						err instanceof TypeError ||
						(err instanceof Error && err.message.includes('fetch'));

					if (isNetworkError) {
						// Mark server as offline for network/connection errors
						updateServer(serverId, { authStatus: 'offline', enabled: false });
						toast.warning(
							'Server is offline and has been automatically disabled',
						);
					} else {
						// Mark server as failed for other errors
						updateServer(serverId, { authStatus: 'failed', enabled: false });
						setServerFailureReason(
							serverId,
							err instanceof Error ? err.message : 'Unknown error',
						);
						toast.error('Server failed and has been automatically disabled');
					}

					// Also disable in backend to persist the change
					toggleMcpServerAction(serverId, false);

					// Call custom error handler if provided
					onError?.(err instanceof Error ? err : new Error('Unknown error'));
				},
			},
		);

	return {
		testResult: data,
		error,
		isLoading,
		isValidating,
		mutate,
		testConnection: () => mutate(),
	};
}

export function useTestServerConnection() {
	const updateServer = useMCPServersStore((s) => s.updateServer);
	const setAuthUrl = useMCPServersStore((s) => s.setAuthUrl);
	const removeAuthUrl = useMCPServersStore((s) => s.removeAuthUrl);
	const addServerRequiringAuth = useMCPServersStore(
		(s) => s.addServerRequiringAuth,
	);
	const setServerFailureReason = useMCPServersStore(
		(s) => s.setServerFailureReason,
	);

	return async (serverId: string) => {
		try {
			const result = await serverTestFetcher(
				`/api/mcp/servers/${serverId}/test`,
			);

			switch (result.status) {
				case 'auth_required':
					setAuthUrl(serverId, result.authUrl || 'manual_setup');
					addServerRequiringAuth(serverId);
					updateServer(serverId, { authStatus: 'required' });
					break;

				case 'authorized':
					removeAuthUrl(serverId);
					updateServer(serverId, { authStatus: 'authorized' });
					break;

				case 'offline':
					updateServer(serverId, { authStatus: 'offline', enabled: false });
					await toggleMcpServerAction(serverId, false);
					toast.warning(
						'Server is offline and has been automatically disabled',
					);
					break;

				case 'failed':
					updateServer(serverId, { authStatus: 'failed', enabled: false });
					if (result.error) {
						setServerFailureReason(serverId, result.error);
					}
					await toggleMcpServerAction(serverId, false);
					toast.error('Server failed and has been automatically disabled');
					break;
			}

			return result;
		} catch (error) {
			console.error('Failed to test server connection:', error);

			const isNetworkError =
				error instanceof TypeError ||
				(error instanceof Error && error.message.includes('fetch'));

			if (isNetworkError) {
				updateServer(serverId, { authStatus: 'offline', enabled: false });
				toast.warning('Server is offline and has been automatically disabled');
			} else {
				updateServer(serverId, { authStatus: 'failed', enabled: false });
				setServerFailureReason(
					serverId,
					error instanceof Error ? error.message : 'Unknown error',
				);
				toast.error('Server failed and has been automatically disabled');
			}

			await toggleMcpServerAction(serverId, false);
			throw error;
		}
	};
}
