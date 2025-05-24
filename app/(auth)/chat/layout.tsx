import type React from 'react';
import '@/app/globals.css';
import './chat.css';
import { SidebarInset } from '@/components/ui/sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { Metadata } from 'next';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
	title: 'PerfAgent - Agent insights for web performance',
	description:
		"PerfAgent is an AI-powered web performance insights tool that helps you understand your website's performance and identify opportunities for improvement.",
};

export default async function AiChatLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	// Read the sidebar cookie from the server
	const cookieStore = await cookies();
	const sidebarCookie = cookieStore.get('sidebar:state');
	const sidebarOpen = sidebarCookie?.value === 'false' ? false : true;

	return (
		<>
			<SidebarProvider open={sidebarOpen}>
				<AppSidebar variant="inset" />
				<SidebarInset>
					<SiteHeader />
					<div className="flex h-full flex-1 flex-col">
						<div className="@container/main flex flex-1 flex-col gap-2">
							<div className="flex h-full flex-col gap-4 py-4 md:gap-6 md:py-6">
								{children}
							</div>
						</div>
					</div>
				</SidebarInset>
			</SidebarProvider>
		</>
	);
}
