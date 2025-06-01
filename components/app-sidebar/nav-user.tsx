'use client';

import {
	BellIcon,
	CreditCardIcon,
	LogOutIcon,
	MoreVerticalIcon,
	UserCircleIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from '@/components/ui/sidebar';
import { SessionData } from '@/lib/session.server';
import { logout } from '@/app/actions/login';

export function NavUser({ user }: { user: SessionData }) {
	const { isMobile } = useSidebar();
	const router = useRouter();

	const handleLogout = async () => {
		try {
			const success = await logout();
			if (success) {
				router.push('/');
				router.refresh(); // Refresh to update UI state
			} else {
				console.error('Logout failed');
				// Optionally show a toast notification here
			}
		} catch (error) {
			console.error('Error during logout:', error);
			// Optionally show an error message to the user
		}
	};

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="border-sidebar-accent-foreground text-sidebar-accent-foreground bg-peppermint-100 border border-dashed data-[state=open]:border-solid"
						>
							<Avatar className="h-8 w-8 rounded-lg grayscale">
								<AvatarImage
									src="https://github.com/perflab-io.png"
									alt={user.user?.name ?? ''}
								/>
								<AvatarFallback className="bg-primary-foreground text-primary rounded-lg">
									VD
								</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">{user.user?.name}</span>
								<span className="text-muted-foreground truncate text-xs">
									{user.user?.email}
								</span>
							</div>
							<MoreVerticalIcon className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						side={isMobile ? 'bottom' : 'right'}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel className="p-0 font-normal">
							<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
								<Avatar className="h-8 w-8 rounded-lg">
									<AvatarImage
										src="https://github.com/perflab-io.png"
										alt={user.user?.name ?? ''}
									/>
									<AvatarFallback className="rounded-lg">VD</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium">
										{user.user?.name}
									</span>
									<span className="text-muted-foreground truncate text-xs">
										{user.user?.email}
									</span>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem>
								<UserCircleIcon />
								Account
							</DropdownMenuItem>
							<DropdownMenuItem>
								<CreditCardIcon />
								Billing
							</DropdownMenuItem>
							<DropdownMenuItem>
								<BellIcon />
								Notifications
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={handleLogout}>
							<LogOutIcon />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
