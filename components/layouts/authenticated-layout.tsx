import type React from 'react';
import '@/app/globals.css';
import { SidebarInset } from '@/components/ui/sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { cookies } from 'next/headers';
import { requireUserWithRole, SessionData } from '@/lib/session.server';
import { redirect } from 'next/navigation';

interface AuthenticatedLayoutProps {
	children: React.ReactNode;
	className?: string;
}

export default async function AuthenticatedLayout({
	children,
	className,
}: AuthenticatedLayoutProps) {
	let user: SessionData | null = null;
	try {
		user = await requireUserWithRole('agent-user');
	} catch (error) {
		console.error(error);
		return redirect('/login');
	}

	// Read the sidebar cookie from the server
	const cookieStore = await cookies();
	const sidebarCookie = cookieStore.get('sidebar:state');
	const sidebarOpen = sidebarCookie?.value === 'false' ? false : true;

	return (
		<SidebarProvider open={sidebarOpen} user={user}>
			<AppSidebar variant="inset" />
			<SidebarInset>
				<SiteHeader />
				<div className="flex h-full flex-1 flex-col">
					<div className="@container/main flex flex-1 flex-col gap-2">
						<div
							className={`flex h-full flex-col gap-4 py-4 md:gap-6 md:py-6 ${className || ''}`}
						>
							{children}
						</div>
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
