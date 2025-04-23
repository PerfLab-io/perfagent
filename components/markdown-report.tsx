'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
	XCircle,
	FileText,
	Clipboard,
	ClipboardCheck,
	Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './markdown-renderer';
import { FeedbackButtons } from '@/components/feedback-buttons';

/**
 * Types and Interfaces
 */

/**
 * MarkdownReport component props
 */
interface MarkdownReportProps {
	visible: boolean;
	onClose: () => void;
	exiting?: boolean;
	isGenerating: boolean;
	onAbort?: () => void;
	reportData?: string;
	reportId?: string | null;
}

/**
 * MarkdownReport Component
 * Displays a report with markdown content in a sliding panel
 */
export function MarkdownReport({
	visible,
	onClose,
	exiting = false,
	isGenerating,
	onAbort,
	reportData,
	reportId,
}: MarkdownReportProps) {
	const [animate, setAnimate] = useState(false);
	const [isCopied, setIsCopied] = useState(false);
	const reportRef = useRef<HTMLDivElement>(null);

	/**
	 * Generate a unique ID for the report for feedback
	 */
	const reportFeedbackId = useMemo(
		() => `report-${reportId?.toLowerCase()}`,
		[reportId],
	);

	/**
	 * Animation effect
	 */
	useEffect(() => {
		if (visible) {
			const timer = setTimeout(() => {
				setAnimate(true);
			}, 300);
			return () => clearTimeout(timer);
		} else {
			setAnimate(false);
		}
	}, [visible]);

	/**
	 * Copy report content to clipboard
	 */
	const copyToClipboard = useCallback(() => {
		// Create a string of all the report content

		navigator.clipboard.writeText(reportData || '').catch((err) => {
			console.error('Failed to copy: ', err);
		});

		setIsCopied(true);
		setTimeout(() => setIsCopied(false), 2000);
	}, [reportData]);

	/**
	 * Download report as markdown file
	 */
	const downloadReport = useCallback(() => {
		// Create a blob with the content
		const blob = new Blob([reportData || ''], { type: 'text/markdown' });

		// Create a URL for the blob
		const url = URL.createObjectURL(blob);

		// Create a filename with reportId to make it unique
		const filename = `report${reportId ? `-${reportId.substring(0, 8)}` : ''}.md`;

		// Create a temporary anchor element to trigger the download
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();

		// Clean up
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, [reportId]);

	/**
	 * Animation styles
	 */
	const animationStyles = useMemo(
		() => ({
			animationName: animate && !exiting ? 'slideRight' : 'none',
			animationDuration: '250ms',
			animationTimingFunction: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
			animationFillMode: 'forwards',
		}),
		[animate, exiting],
	);

	/**
	 * Panel container classes
	 */
	const containerClasses = useMemo(
		() =>
			cn(
				'panel-right flex flex-col overflow-hidden bg-background p-6 transition-all duration-300',
				animate ? 'opacity-100' : 'opacity-0',
				exiting && 'panel-right-exit',
			),
		[animate, exiting],
	);

	// Don't render anything if not visible
	if (!visible) return null;

	return (
		<div className={containerClasses} style={animationStyles}>
			{/* Header area with title and actions */}
			<div className="sticky top-0 z-10 mb-4 flex items-center justify-between border-b border-border bg-background pb-2">
				<div className="flex items-center gap-2">
					<FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
					<h2 className="text-xl font-bold text-foreground">
						Report
						{reportId && (
							<span className="ml-2 text-sm font-normal text-foreground/60">
								#{reportId}
							</span>
						)}
					</h2>
				</div>

				<div className="flex items-center gap-2">
					{/* Feedback buttons - only shown when report is complete */}
					{reportData && (
						<FeedbackButtons messageId={reportFeedbackId} source="report" />
					)}

					{/* Copy button */}
					<Button
						variant="ghost"
						size="sm"
						onClick={copyToClipboard}
						disabled={!reportData}
						className="flex items-center gap-1"
						aria-label={isCopied ? 'Copied to clipboard' : 'Copy to clipboard'}
					>
						{isCopied ? (
							<>
								<ClipboardCheck className="h-4 w-4 text-peppermint-600 dark:text-peppermint-400" />
								<span className="text-peppermint-600 dark:text-peppermint-400">
									Copied!
								</span>
							</>
						) : (
							<>
								<Clipboard className="h-4 w-4" />
								<span>Copy</span>
							</>
						)}
					</Button>

					{/* Download button */}
					<Button
						variant="ghost"
						size="sm"
						onClick={downloadReport}
						disabled={!reportData}
						className="flex items-center gap-1"
						aria-label="Download report as markdown"
					>
						<Download className="h-4 w-4" />
						<span>Download</span>
					</Button>

					{/* Abort button - only shown while generating */}
					{isGenerating && onAbort && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onAbort}
							className="flex items-center gap-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
							aria-label="Stop report generation"
						>
							<XCircle className="h-4 w-4" />
							<span>Stop</span>
						</Button>
					)}

					{/* Close button */}
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="h-8 w-8 rounded-full"
						aria-label="Close report"
					>
						<XCircle className="h-5 w-5" />
					</Button>
				</div>
			</div>

			{/* Content area with report sections */}
			<div
				ref={reportRef}
				className="max-h-full grow overflow-y-auto pr-1"
				aria-live="polite"
			>
				<MarkdownRenderer content={reportData || ''} />
			</div>
		</div>
	);
}
