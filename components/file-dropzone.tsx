'use client';

import React from 'react';

import { useState, useRef, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Upload, FileUp, Check } from 'lucide-react';

interface FileDropzoneProps {
	children: ReactNode;
	onFilesDrop: (files: File[]) => void;
	className?: string;
	disabled?: boolean;
}

export function FileDropzone({
	children,
	onFilesDrop,
	className,
	disabled = false,
}: FileDropzoneProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [isHovering, setIsHovering] = useState(false);
	const [isDropping, setIsDropping] = useState(false);
	const [dropSuccess, setDropSuccess] = useState(false);
	const dragCounterRef = useRef(0);

	const handleDragIn = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			if (disabled) return;

			e.preventDefault();
			e.stopPropagation();
			dragCounterRef.current++;

			if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
				setIsDragging(true);
			}
		},
		[disabled],
	);

	const handleDragOut = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			if (disabled) return;

			e.preventDefault();
			e.stopPropagation();
			dragCounterRef.current--;

			if (dragCounterRef.current === 0) {
				setIsDragging(false);
				setIsHovering(false);
			}
		},
		[disabled],
	);

	const handleDragOver = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			if (disabled) return;

			e.preventDefault();
			e.stopPropagation();
			setIsHovering(true);

			if (e.dataTransfer.files) {
				// Explicitly set the dropEffect to 'copy' to indicate a copy operation
				e.dataTransfer.dropEffect = 'copy';
			}
		},
		[disabled],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			if (disabled) return;

			e.preventDefault();
			e.stopPropagation();

			// Show dropping animation
			setIsDropping(true);

			// Reset drag states
			dragCounterRef.current = 0;

			if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
				const files = Array.from(e.dataTransfer.files);

				// Process the files immediately - don't wait for animations
				onFilesDrop(files);

				// Show success animation briefly
				setDropSuccess(true);

				// Clean up animations after they complete
				setTimeout(() => {
					setDropSuccess(false);
					setIsDropping(false);
					setIsDragging(false);
					setIsHovering(false);
				}, 600);

				e.dataTransfer.clearData();
			} else {
				// If no files, just reset states
				setTimeout(() => {
					setIsDropping(false);
					setIsDragging(false);
					setIsHovering(false);
				}, 300);
			}
		},
		[onFilesDrop, disabled],
	);

	// Add global drag event listeners to the document
	React.useEffect(() => {
		if (disabled) return;

		const handleDocumentDragOver = (e: DragEvent) => {
			e.preventDefault();
			if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
				setIsDragging(true);
			}
		};

		const handleDocumentDrop = (e: DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			setIsHovering(false);
			dragCounterRef.current = 0;
		};

		document.addEventListener('dragover', handleDocumentDragOver);
		document.addEventListener('drop', handleDocumentDrop);

		return () => {
			document.removeEventListener('dragover', handleDocumentDragOver);
			document.removeEventListener('drop', handleDocumentDrop);
		};
	}, [disabled]);

	return (
		<div
			className={cn('relative', className)}
			onDragEnter={handleDragIn}
			onDragLeave={handleDragOut}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			{children}

			{/* Dropzone overlay - visible when dragging anywhere on the page */}
			{isDragging && !disabled && (
				<div
					className={cn(
						'absolute inset-0 z-50 flex flex-col items-center justify-center',
						'rounded-lg border-4 border-dashed transition-all duration-300',
						'backdrop-blur-sm duration-300 animate-in fade-in zoom-in-95',
						isHovering
							? 'animate-pulse-border border-peppermint-500 dark:border-peppermint-400'
							: 'shadow-none',
						isDropping
							? 'scale-95 border-peppermint-500 opacity-90 dark:border-peppermint-400'
							: 'scale-100',
						dropSuccess
							? 'border-peppermint-500 bg-peppermint-100/90 dark:border-peppermint-400 dark:bg-peppermint-900/90'
							: isHovering
								? 'border-peppermint-500 bg-peppermint-100/80 dark:border-peppermint-400 dark:bg-peppermint-900/80'
								: 'border-peppermint-300/50 bg-background/70 dark:border-peppermint-700/50',
					)}
				>
					<div
						className={cn(
							'flex flex-col items-center justify-center gap-4 p-6 text-center',
							'transition-all duration-300',
							isHovering ? 'scale-110' : 'scale-100',
							dropSuccess ? 'scale-125' : '',
						)}
					>
						{dropSuccess ? (
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-peppermint-200 duration-300 animate-in zoom-in dark:bg-peppermint-800">
								<Check className="h-8 w-8 text-peppermint-700 dark:text-peppermint-300" />
							</div>
						) : (
							<div
								className={cn(
									'flex h-16 w-16 items-center justify-center rounded-full',
									'transition-all duration-300',
									isHovering
										? 'bg-peppermint-200 dark:bg-peppermint-800'
										: 'bg-background dark:bg-peppermint-950',
								)}
							>
								{isHovering ? (
									<FileUp className="animate-spin-slow h-8 w-8 text-peppermint-700 dark:text-peppermint-300" />
								) : (
									<Upload className="h-8 w-8 text-foreground/70" />
								)}
							</div>
						)}

						<div className="space-y-2">
							<h3
								className={cn(
									'text-lg font-medium transition-all duration-300',
									isHovering
										? 'text-peppermint-800 dark:text-peppermint-200'
										: 'text-foreground',
									dropSuccess
										? 'text-peppermint-800 dark:text-peppermint-200'
										: '',
								)}
							>
								{dropSuccess
									? 'Files added!'
									: isHovering
										? 'Release to upload'
										: 'Drop files here'}
							</h3>

							{!dropSuccess && (
								<p
									className={cn(
										'text-sm transition-all duration-300',
										isHovering
											? 'text-peppermint-700 dark:text-peppermint-300'
											: 'text-foreground/70',
									)}
								>
									{isHovering
										? 'Your files will be uploaded'
										: 'Drag and drop your files to upload'}
								</p>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
