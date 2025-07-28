'use client';

import * as React from 'react';
import {
	BotMessageSquareIcon,
	CameraIcon,
	ClipboardListIcon,
	DatabaseIcon,
	FileCodeIcon,
	FileTextIcon,
	HelpCircleIcon,
	SettingsIcon,
	ServerIcon,
} from 'lucide-react';

import { NavDocuments } from './nav-documents';
import { NavMain } from './nav-main';
import { NavSecondary } from './nav-secondary';
import { NavUser } from './nav-user';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
	useSidebar,
} from '@/components/ui/sidebar';
import { SimpleThemeToggle } from '../simple-theme-toggle';
import { SessionData } from '@/lib/session.server';

const data = {
	navMain: [
		{
			title: 'Agent insights',
			url: '#',
			icon: BotMessageSquareIcon,
		},
	],
	navClouds: [
		{
			title: 'Capture',
			icon: CameraIcon,
			isActive: true,
			url: '#',
			items: [
				{
					title: 'Active Proposals',
					url: '#',
				},
				{
					title: 'Archived',
					url: '#',
				},
			],
		},
		{
			title: 'Proposal',
			icon: FileTextIcon,
			url: '#',
			items: [
				{
					title: 'Active Proposals',
					url: '#',
				},
				{
					title: 'Archived',
					url: '#',
				},
			],
		},
		{
			title: 'Prompts',
			icon: FileCodeIcon,
			url: '#',
			items: [
				{
					title: 'Active Proposals',
					url: '#',
				},
				{
					title: 'Archived',
					url: '#',
				},
			],
		},
	],
	navSecondary: [
		{
			title: 'MCP Servers',
			url: '/mcp-servers',
			icon: ServerIcon,
		},
		{
			title: 'Settings',
			url: '#',
			icon: SettingsIcon,
		},
		{
			title: 'Get Help',
			url: '#',
			icon: HelpCircleIcon,
		},
	],
	documents: [
		{
			name: 'Saved Traces',
			url: '#',
			icon: DatabaseIcon,
		},
		{
			name: 'Saved Reports',
			url: '#',
			icon: ClipboardListIcon,
		},
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { user } = useSidebar();

	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem className="flex items-center justify-between">
						<a
							href="#"
							className="hover:bg-none data-[slot=sidebar-menu-button]:p-1.5!"
						>
							<span className="text-primary-foreground text-xl font-bold">
								PerfAgent
							</span>
						</a>
						<SimpleThemeToggle />
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={data.navMain} />
				<NavDocuments items={data.documents} />
				<NavSecondary items={data.navSecondary} className="mt-auto" />
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={user ?? ({} as SessionData)} />
			</SidebarFooter>
		</Sidebar>
	);
}
