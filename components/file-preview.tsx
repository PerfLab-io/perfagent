'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, FileText, FileCode, FileImage, File } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Types and Interfaces
 */
interface FileInfo {
	id: string;
	name: string;
	size: number;
	type: string;
}

interface FilePreviewProps {
	/** File information to display */
	file: FileInfo;
	/** Callback when file is removed */
	onRemove: () => void;
	/** Delay before animation in milliseconds */
	animationDelay?: number;
}

/**
 * File size units in bytes
 */
const FILE_SIZE_UNITS = {
	BYTE: 1,
	KILOBYTE: 1024,
	MEGABYTE: 1048576,
};

/**
 * FilePreview Component
 *
 * Displays a preview of a file with name, size, appropriate icon,
 * and a remove button with animation effects.
 */
export function FilePreview({
	file,
	onRemove,
	animationDelay = 100,
}: FilePreviewProps) {
	const [visible, setVisible] = useState(false);

	// Animation effect on mount
	useEffect(() => {
		const timer = setTimeout(() => {
			setVisible(true);
		}, animationDelay);

		return () => clearTimeout(timer);
	}, [animationDelay]);

	/**
	 * Format file size to human-readable format
	 */
	const formatFileSize = useCallback((bytes: number): string => {
		if (bytes < FILE_SIZE_UNITS.KILOBYTE) {
			return `${bytes} B`;
		} else if (bytes < FILE_SIZE_UNITS.MEGABYTE) {
			return `${(bytes / FILE_SIZE_UNITS.KILOBYTE).toFixed(1)} KB`;
		} else {
			return `${(bytes / FILE_SIZE_UNITS.MEGABYTE).toFixed(1)} MB`;
		}
	}, []);

	/**
	 * Get appropriate icon based on file type
	 */
	const getFileIcon = useCallback(() => {
		if (file.type.startsWith('image/')) {
			return <FileImage className="h-4 w-4" aria-hidden="true" />;
		}

		if (file.name.endsWith('.go')) {
			return <FileCode className="h-4 w-4" aria-hidden="true" />;
		}

		if (file.type.includes('text') || file.name.endsWith('.md')) {
			return <FileText className="h-4 w-4" aria-hidden="true" />;
		}

		return <File className="h-4 w-4" aria-hidden="true" />;
	}, [file.type, file.name]);

	/**
	 * Handle keyboard events for accessibility
	 */
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				onRemove();
			}
		},
		[onRemove],
	);

	/**
	 * Component container classes
	 */
	const containerClasses = useMemo(
		() =>
			cn(
				'flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm',
				'transition-all duration-300 ease-out',
				visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
			),
		[visible],
	);

	// Formatted file size for display
	const formattedSize = useMemo(
		() => formatFileSize(file.size),
		[file.size, formatFileSize],
	);

	// Accessible label for the remove button
	const removeButtonLabel = `Remove file ${file.name}`;

	return (
		<div
			className={containerClasses}
			role="listitem"
			aria-label={`File: ${file.name}, Size: ${formattedSize}`}
		>
			{getFileIcon()}

			<div className="max-w-[200px] flex-1 truncate">
				<div className="truncate font-medium">{file.name}</div>
				<div className="text-xs text-foreground">{formattedSize}</div>
			</div>

			<button
				onClick={onRemove}
				onKeyDown={handleKeyDown}
				className="rounded p-1 text-foreground transition-colors hover:bg-neutral-100 hover:text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/50 dark:hover:bg-neutral-800"
				aria-label={removeButtonLabel}
				title={removeButtonLabel}
				tabIndex={0}
			>
				<X className="h-4 w-4" />
			</button>
		</div>
	);
}
