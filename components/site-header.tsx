'use client';

import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { FilePenIcon, Paperclip, PencilIcon, PenIcon } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { Input } from './ui/input';
import { useUIStore } from '@/lib/stores';

export function SiteHeader() {
	const { pageTitle, setPageTitle, isEditing, setIsEditing } = useUIStore();
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

	const startEditing = useCallback(() => {
		setIsEditing(true);
		setTimeout(() => {
			inputRef.current?.focus();
		}, 0);
	}, [setIsEditing]);

	// Either display the title as text or as an input field when editing
	return (
		<div className="bg-background sticky top-0 z-10 flex h-16 w-full items-center border-b px-4">
			<SidebarTrigger />

			<div className="flex h-full w-full items-center justify-between">
				<div className="flex h-full w-full items-center justify-between px-4 md:px-6">
					<div className="flex items-center gap-2">
						{isEditing ? (
							<Input
								ref={inputRef}
								value={pageTitle}
								onChange={handleTitleChange}
								onKeyUp={handleKeyUp}
								onBlur={() => setIsEditing(false)}
								className="max-w-[240px] focus-visible:ring-0"
							/>
						) : (
							<div
								className="text-xl font-semibold tracking-tight hover:cursor-pointer"
								onClick={startEditing}
							>
								{pageTitle}
							</div>
						)}
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="icon"
							className="rounded-full"
							onClick={startEditing}
						>
							<PencilIcon className="h-4 w-4" />
							<span className="sr-only">Edit title</span>
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
