'use client';

import React, {
	useState,
	useRef,
	useCallback,
	useEffect,
	useMemo,
} from 'react';
import { cn } from '@/lib/utils';
import { Upload, FileUp, Check } from 'lucide-react';

/**
 * Types and Interfaces
 */
interface FileDropzoneProps {
	/** Content to render inside the dropzone */
	children: React.ReactNode;
	/** Callback function triggered when files are dropped */
	onFilesDrop: (e: React.DragEvent<HTMLDivElement>) => void;
	/** Additional CSS classes */
	className?: string;
	/** Whether the dropzone is disabled */
	disabled?: boolean;
	/** Animation duration in milliseconds */
	animationDuration?: number;
}

/**
 * Dropzone state type
 */
type DropzoneState = {
	isDragging: boolean;
	isHovering: boolean;
	isDropping: boolean;
	dropSuccess: boolean;
};

/**
 * FileDropzone Component
 *
 * A component that provides drag-and-drop file upload functionality with
 * visual feedback for different states.
 */
export function FileDropzone({
	children,
	onFilesDrop,
	className,
	disabled = false,
	animationDuration = 600,
}: FileDropzoneProps) {
	// Tracking state for the drag and drop interactions
	const [state, setState] = useState<DropzoneState>({
		isDragging: false,
		isHovering: false,
		isDropping: false,
		dropSuccess: false,
	});

	// Destructure state for easier access
	const { isDragging, isHovering, isDropping, dropSuccess } = state;

	// Counter to track dragging events
	const dragCounterRef = useRef(0);

	/**
	 * Updates specific properties of the state
	 */
	const updateState = useCallback((updates: Partial<DropzoneState>) => {
		setState((prev) => ({ ...prev, ...updates }));
	}, []);

	/**
	 * Resets all state to default values
	 */
	const resetState = useCallback(() => {
		dragCounterRef.current = 0;
		setState({
			isDragging: false,
			isHovering: false,
			isDropping: false,
			dropSuccess: false,
		});
	}, []);

	/**
	 * Handler for when a drag operation enters the dropzone
	 */
	const handleDragIn = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			if (disabled) return;

			e.preventDefault();
			e.stopPropagation();
			dragCounterRef.current++;

			if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
				updateState({ isDragging: true });
			}
		},
		[disabled, updateState],
	);

	/**
	 * Handler for when a drag operation leaves the dropzone
	 */
	const handleDragOut = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			if (disabled) return;

			e.preventDefault();
			e.stopPropagation();
			dragCounterRef.current--;

			if (dragCounterRef.current === 0) {
				updateState({ isDragging: false, isHovering: false });
			}
		},
		[disabled, updateState],
	);

	/**
	 * Handler for when a drag operation is over the dropzone
	 */
	const handleDragOver = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			if (disabled) return;

			e.preventDefault();
			e.stopPropagation();
			updateState({ isHovering: true });

			if (e.dataTransfer.files) {
				// Explicitly set the dropEffect to 'copy' to indicate a copy operation
				e.dataTransfer.dropEffect = 'copy';
			}
		},
		[disabled, updateState],
	);

	/**
	 * Handler for when files are dropped onto the dropzone
	 */
	const handleDrop = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			if (disabled) return;

			e.preventDefault();
			e.stopPropagation();

			// Show dropping animation
			updateState({ isDropping: true });

			// Reset drag counter
			dragCounterRef.current = 0;

			if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
				// Process the files immediately - don't wait for animations
				onFilesDrop(e);

				// Show success animation briefly
				updateState({ dropSuccess: true });

				// Clean up animations after they complete
				setTimeout(() => {
					resetState();
				}, animationDuration);

				e.dataTransfer.clearData();
			} else {
				// If no files, just reset states
				setTimeout(() => {
					resetState();
				}, animationDuration / 2);
			}
		},
		[onFilesDrop, disabled, resetState, updateState, animationDuration],
	);

	/**
	 * Global document event handlers
	 */
	useEffect(() => {
		if (disabled) return;

		const handleDocumentDragOver = (e: DragEvent) => {
			e.preventDefault();
			if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
				updateState({ isDragging: true });
			}
		};

		const handleDocumentDrop = (e: DragEvent) => {
			e.preventDefault();
			updateState({ isDragging: false, isHovering: false });
			dragCounterRef.current = 0;
		};

		document.addEventListener('dragover', handleDocumentDragOver);
		document.addEventListener('drop', handleDocumentDrop);

		return () => {
			document.removeEventListener('dragover', handleDocumentDragOver);
			document.removeEventListener('drop', handleDocumentDrop);
		};
	}, [disabled, updateState]);

	/**
	 * Dropzone overlay container classes
	 */
	const overlayClasses = useMemo(
		() =>
			cn(
				'absolute inset-0 z-50 flex flex-col items-center justify-center',
				'rounded-lg border-4 border-dashed transition-all duration-300',
				'backdrop-blur-xs animate-in fade-in zoom-in-95',
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
			),
		[isHovering, isDropping, dropSuccess],
	);

	/**
	 * Icon container classes
	 */
	const iconContainerClasses = useMemo(
		() =>
			cn(
				'flex flex-col items-center justify-center gap-4 p-6 text-center',
				'transition-all duration-300',
				isHovering ? 'scale-110' : 'scale-100',
				dropSuccess ? 'scale-125' : '',
			),
		[isHovering, dropSuccess],
	);

	/**
	 * Icon background classes
	 */
	const iconBgClasses = useMemo(
		() =>
			cn(
				'flex h-16 w-16 items-center justify-center rounded-full',
				'transition-all duration-300',
				isHovering
					? 'bg-peppermint-200 dark:bg-peppermint-800'
					: 'bg-background dark:bg-peppermint-950',
			),
		[isHovering],
	);

	/**
	 * Heading text classes
	 */
	const headingClasses = useMemo(
		() =>
			cn(
				'text-lg font-medium transition-all duration-300',
				isHovering
					? 'text-peppermint-800 dark:text-peppermint-200'
					: 'text-foreground',
				dropSuccess ? 'text-peppermint-800 dark:text-peppermint-200' : '',
			),
		[isHovering, dropSuccess],
	);

	/**
	 * Description text classes
	 */
	const descriptionClasses = useMemo(
		() =>
			cn(
				'text-sm transition-all duration-300',
				isHovering
					? 'text-peppermint-700 dark:text-peppermint-300'
					: 'text-foreground/70',
			),
		[isHovering],
	);

	/**
	 * Render file upload icon based on state
	 */
	const renderIcon = useCallback(() => {
		if (dropSuccess) {
			return (
				<div className="flex h-16 w-16 items-center justify-center rounded-full bg-peppermint-200 duration-300 animate-in zoom-in dark:bg-peppermint-800">
					<Check
						className="h-8 w-8 text-peppermint-700 dark:text-peppermint-300"
						aria-hidden="true"
					/>
				</div>
			);
		}

		return (
			<div className={iconBgClasses}>
				{isHovering ? (
					<FileUp
						className="animate-spin-slow h-8 w-8 text-peppermint-700 dark:text-peppermint-300"
						aria-hidden="true"
					/>
				) : (
					<Upload className="h-8 w-8 text-foreground/70" aria-hidden="true" />
				)}
			</div>
		);
	}, [dropSuccess, iconBgClasses, isHovering]);

	/**
	 * Render appropriate dropzone text based on state
	 */
	const renderText = useCallback(() => {
		let heading = 'Drop your trace file here';
		let description = 'Drag and drop your trace file to upload';

		if (dropSuccess) {
			heading = 'Trace file added!';
			description = '';
		} else if (isHovering) {
			heading = 'Release to process trace data';
			description = 'Your trace file will be processed';
		}

		return (
			<div className="space-y-2">
				<h3 className={headingClasses}>{heading}</h3>

				{description && <p className={descriptionClasses}>{description}</p>}
			</div>
		);
	}, [dropSuccess, isHovering, headingClasses, descriptionClasses]);

	return (
		<div
			className={cn('relative', className)}
			onDragEnter={handleDragIn}
			onDragLeave={handleDragOut}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
			tabIndex={disabled ? -1 : 0}
			aria-disabled={disabled}
			aria-label="File upload dropzone"
		>
			{children}

			{/* Dropzone overlay - visible when dragging anywhere on the page */}
			{isDragging && !disabled && (
				<div className={overlayClasses} role="region" aria-live="polite">
					<div className={iconContainerClasses}>
						{renderIcon()}
						{renderText()}
					</div>
				</div>
			)}
		</div>
	);
}
