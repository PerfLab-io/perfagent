'use client';

import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { FilePenIcon } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { Input } from './ui/input';
import { useUIStore } from '@/lib/stores';
import { useShallow } from 'zustand/react/shallow';

export function SiteHeader() {
	const { pageTitle, setPageTitle, isEditing, setIsEditing, isEditable } =
		useUIStore(
			useShallow((state) => ({
				pageTitle: state.pageTitle,
				setPageTitle: state.setPageTitle,
				isEditing: state.isEditing,
				setIsEditing: state.setIsEditing,
				isEditable: state.isEditable,
			})),
		);
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
		[setIsEditing],
	);

	const editableTitle = isEditing ? (
		<Input
			type="text"
			className="border-primary text-primary-foreground ring-primary-foreground/20 placeholder:text-primary-foreground focus-visible:ring-primary h-6 w-56 rounded-sm border-dashed focus-visible:ring-2"
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
			<h2 className="font-medium">{pageTitle}</h2>
			<FilePenIcon className="h-4 w-4 origin-left scale-0 transition-all group-hover:block group-hover:scale-100" />
		</Button>
	);

	const titleComponent = isEditable ? (
		editableTitle
	) : (
		<h2 className="font-medium">{pageTitle}</h2>
	);

	// Either display the title as text or as an input field when editing
	return (
		<header className="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
			<div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
				<SidebarTrigger className="-ml-1" />
				<Separator
					orientation="vertical"
					className="mx-2 data-[orientation=vertical]:h-4"
				/>
				{titleComponent}
			</div>
		</header>
	);
}
