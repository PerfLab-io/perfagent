import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { AddServerDialog } from '@/components/mcp-servers/add-server-dialog';
import { ServerCardList } from '@/components/mcp-servers/server-card-list';
import { ServerCardSkeleton } from '@/components/mcp-servers/server-card-skeleton';
import type { MCPServer } from '@/lib/stores/mcp-servers-store';
import { requireUserWithRole } from '@/lib/session.server';
import { redirect } from 'next/navigation';

async function getServers(): Promise<MCPServer[]> {
	try {
		const cookieStore = await cookies();
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/mcp/servers`,
			{
				cache: 'no-store',
				headers: {
					Cookie: cookieStore.toString(),
				},
			},
		);

		if (!response.ok) {
			console.error('Failed to fetch servers:', response.status);
			return [];
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('Failed to fetch MCP servers:', error);
		return [];
	}
}

async function ServerListSection() {
	const servers = await getServers();

	return <ServerCardList initialServers={servers} />;
}

export default async function MCPServersPage() {
	try {
		await requireUserWithRole('admin');
	} catch (error) {
		return redirect('/');
	}

	return (
		<div className="mx-auto w-3xl space-y-6 px-4 sm:px-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">MCP Servers</h1>
					<p className="text-muted-foreground">Manage your MCP servers</p>
				</div>
				<AddServerDialog />
			</div>

			<Suspense fallback={<ServerCardSkeleton />}>
				<ServerListSection />
			</Suspense>
		</div>
	);
}
