import type React from 'react';
import AuthenticatedLayout from '@/components/layouts/authenticated-layout';
import { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'MCP Servers - PerfAgent',
	description:
		'Manage your Model Context Protocol servers for enhanced AI capabilities.',
};

export default async function MCPServersLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<AuthenticatedLayout>
			{children}
		</AuthenticatedLayout>
	);
}