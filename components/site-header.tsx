import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { FilePenIcon, Paperclip, PencilIcon, PenIcon } from 'lucide-react';

export function SiteHeader() {
	return (
		<header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
			<div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
				<SidebarTrigger className="-ml-1" />
				<Separator
					orientation="vertical"
					className="mx-2 data-[orientation=vertical]:h-4"
				/>
				<Button variant="ghost" size="sm" className="group gap-2">
					<h1 className="font-medium">Agent Insight #20</h1>
					<FilePenIcon className="h-4 w-4 origin-left scale-0 transition-all group-hover:block group-hover:scale-100" />
				</Button>
			</div>
		</header>
	);
}
