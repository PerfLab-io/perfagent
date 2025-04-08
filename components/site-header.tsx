'use client';

import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { FilePenIcon, Paperclip, PencilIcon, PenIcon } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Input } from './ui/input';

export function SiteHeader() {
	const [pageTitle, setPageTitle] = useState('Agent Insight #20');
	const [isEditing, setIsEditing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setPageTitle(e.target.value);
	};

	const handleKeyUp = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Enter' || event.key === 'Escape') {
				setIsEditing(false);
			}
		},
		[],
	);

	return (
		<header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
			<div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
				<SidebarTrigger className="-ml-1" />
				<Separator
					orientation="vertical"
					className="mx-2 data-[orientation=vertical]:h-4"
				/>
				{isEditing ? (
					<Input
						type="text"
						className="h-6 w-56 rounded-sm border-dashed border-primary text-primary-foreground ring-primary-foreground/20 placeholder:text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary"
						ref={inputRef}
						autoFocus
						value={pageTitle}
						onChange={handleTitleChange}
						onKeyUp={handleKeyUp}
					/>
				) : (
					<Button
						variant="ghost"
						size="sm"
						className="group gap-2"
						onClick={() => {
							setIsEditing(true);
							inputRef.current?.focus();
						}}
					>
						<h1 className="font-medium">{pageTitle}</h1>
						<FilePenIcon className="h-4 w-4 origin-left scale-0 transition-all group-hover:block group-hover:scale-100" />
					</Button>
				)}
			</div>
		</header>
	);
}
