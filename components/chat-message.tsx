'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
	Bot,
	User,
	ChevronDown,
	ChevronUp,
	FileText,
	ExternalLink,
} from 'lucide-react';
import { GenerativeCard } from '@/components/generative-card';
import { ResearchCard } from '@/components/research-card';
import { Button } from '@/components/ui/button';
import type { Message, MessageAnnotation } from '@/lib/hooks/use-chat';
import { FeedbackButtons } from '@/components/feedback-buttons';

/**
 * Types and Interfaces
 */

/**
 * Chat message component props
 */
interface ChatMessageProps {
	message: Message;
	onAbort: (toolCallId?: string) => void;
	openReport?: (reportId: string) => void;
	closeReport?: () => void;
	isActiveReport?: boolean;
	hasReport?: boolean;
	isGeneratingAnyReport?: boolean;
}

/**
 * Type of tool calls supported in messages
 */
type ToolCallType = 'breakdown' | 'research' | 'report';

/**
 * Utility function to generate a random report ID
 */
function generateReportId(): string {
	return Math.random().toString(36).substring(2, 10);
}

/**
 * ChatMessage Component
 * Displays a chat message with support for tool calls (breakdown, research, report)
 */
export function ChatMessage({
	message,
	onAbort,
	openReport,
	closeReport,
	isActiveReport = false,
	hasReport = false,
	isGeneratingAnyReport = false,
}: ChatMessageProps) {
	// Animation and visibility state
	const [visible, setVisible] = useState(false);
	const [expanded, setExpanded] = useState(true);

	// Tool UI state
	const [showGenerativeUI, setShowGenerativeUI] = useState(false);
	const [showResearchUI, setShowResearchUI] = useState(false);
	const [showReportUI, setShowReportUI] = useState(false);
	const [initialResearchStarted, setInitialResearchStarted] = useState(false);

	// Tool data state
	const [toolCallId, setToolCallId] = useState<string | null>(null);
	const [researchAnnotations, setResearchAnnotations] = useState<
		MessageAnnotation[]
	>([]);
	const [breakdownAnnotations, setBreakdownAnnotations] = useState<
		MessageAnnotation[]
	>([]);
	const [isBreakdownStreaming, setIsBreakdownStreaming] = useState(false);
	const [isCancelled, setIsCancelled] = useState(false);

	// Unique IDs for tools
	const [reportId] = useState(generateReportId());
	const [researchId] = useState(Math.random().toString(36).substring(7));

	// Refs
	const messageEndRef = useRef<HTMLDivElement>(null);

	/**
	 * Determine if this message contains tools of specific types
	 */
	const messageTools = useMemo(() => {
		const hasBreakdown = message.toolCall?.type === 'breakdown';
		const hasResearch =
			message.toolCall?.type === 'research' ||
			researchAnnotations.length > 0 ||
			(message.parts &&
				message.parts.some(
					(part) =>
						part.type === 'tool-invocation' &&
						part.toolInvocation?.toolName === 'trace_analysis',
				));
		const hasReportTool = message.toolCall?.type === 'report' || hasReport;

		return { hasBreakdown, hasResearch, hasReportTool };
	}, [message.toolCall, message.parts, researchAnnotations, hasReport]);

	/**
	 * Process message annotations and tool calls
	 */
	useEffect(() => {
		// Delay to allow for animation
		const timer = setTimeout(() => {
			setVisible(true);
		}, 100);

		// Process tool calls
		if (message.toolCall) {
			// Extract and store the toolCallId if present
			if (message.toolCall.toolCallId) {
				setToolCallId(message.toolCall.toolCallId);
			}

			// Handle different tool call types
			if (message.toolCall.type === 'breakdown') {
				const uiTimer = setTimeout(() => {
					setShowGenerativeUI(true);
					setIsBreakdownStreaming(true);

					// Safety timeout to ensure streaming stops after a reasonable time
					setTimeout(() => {
						setIsBreakdownStreaming(false);
					}, 10000);
				}, 500);

				return () => {
					clearTimeout(timer);
					clearTimeout(uiTimer);
				};
			} else if (message.toolCall.type === 'research') {
				const researchTimer = setTimeout(() => {
					setShowResearchUI(true);
					setInitialResearchStarted(true);
				}, 500);

				return () => {
					clearTimeout(timer);
					clearTimeout(researchTimer);
				};
			} else if (message.toolCall.type === 'report') {
				// Set showReportUI to true when a report is detected
				const reportTimer = setTimeout(() => {
					setShowReportUI(true);
				}, 500);

				return () => {
					clearTimeout(timer);
					clearTimeout(reportTimer);
				};
			}
		}

		// Check for tool invocations in parts
		if (message.parts) {
			const toolInvocationPart = message.parts.find(
				(part) =>
					part.type === 'tool-invocation' &&
					part.toolInvocation?.toolName === 'trace_analysis',
			);

			if (toolInvocationPart && toolInvocationPart.toolInvocation) {
				setToolCallId(toolInvocationPart.toolInvocation.toolCallId);
				setShowResearchUI(true);
				setInitialResearchStarted(true);
			}
		}

		// Process annotations
		if (message.annotations) {
			// Process research annotations
			const researchUpdates = message.annotations.filter(
				(annotation) => annotation.type === 'research_update',
			);
			if (researchUpdates.length > 0) {
				setResearchAnnotations(researchUpdates);
				setShowResearchUI(true);
				setInitialResearchStarted(true);
			}

			// Process breakdown annotations
			const breakdownUpdates = message.annotations.filter(
				(annotation) => annotation.type === 'breakdown_update',
			);
			if (breakdownUpdates.length > 0) {
				setBreakdownAnnotations(breakdownUpdates);
				setShowGenerativeUI(true);

				// Check if any annotation indicates completion
				const isComplete = breakdownUpdates.some(
					(annotation) =>
						annotation.data?.status === 'completed' &&
						annotation.data?.isComplete,
				);

				// Update streaming state based on completion status
				if (isComplete) {
					setIsBreakdownStreaming(false);
				}
			}
		}

		return () => clearTimeout(timer);
	}, [message.toolCall, message.parts, message.annotations]);

	/**
	 * Handler for aborting breakdown tool calls
	 */
	const handleAbortBreakdown = useCallback(
		(toolCallId?: string) => {
			setIsCancelled(true);
			onAbort(toolCallId);
		},
		[onAbort],
	);

	/**
	 * Handler for aborting research tool calls
	 */
	const handleAbortResearch = useCallback(
		(toolCallId?: string) => {
			onAbort(toolCallId);
		},
		[onAbort],
	);

	/**
	 * Handler for toggling report visibility
	 */
	const handleReportToggle = useCallback(() => {
		if (isActiveReport && closeReport) {
			closeReport();
		} else if (openReport) {
			openReport(message.id);
		}
	}, [isActiveReport, closeReport, openReport, message.id]);

	/**
	 * Toggle expanded state for all tools
	 */
	const toggleExpanded = useCallback(() => {
		setExpanded((prev) => !prev);
	}, []);

	/**
	 * Get the first paragraph of the report for the snippet
	 */
	const reportSnippet = useMemo(() => {
		if (
			message.toolCall?.type === 'report' &&
			message.toolCall.data?.reportData?.sections?.length > 0
		) {
			const firstSection = message.toolCall.data.reportData.sections[0];
			const content = firstSection.content || '';
			// Extract the first paragraph, limited to 120 characters
			const firstParagraph = content
				.split('\n\n')[0]
				.replace(/[#*_]/g, '')
				.trim();
			return firstParagraph.length > 120
				? firstParagraph.substring(0, 120) + '...'
				: firstParagraph;
		}
		return 'View detailed information about this topic in the report.';
	}, [message.toolCall]);

	/**
	 * Style utilities
	 */
	const styles = {
		// Message container style
		messageContainer: cn(
			'flex gap-3 transition-all duration-300',
			visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
			message.role === 'user' ? 'justify-end' : 'justify-start',
		),

		// Message bubble style
		messageBubble: cn(
			'rounded-lg p-3',
			message.role === 'user'
				? 'bg-indigo-600 text-white'
				: 'group relative border border-border bg-background text-foreground transition-all duration-300 hover:-translate-y-1 hover:translate-x-1 hover:shadow-[-4px_4px_0_hsl(var(--border-color))]',
			message.isStreaming &&
				'-translate-y-1 translate-x-1 shadow-[-4px_4px_0_hsl(var(--border-color))]',
		),

		// Timestamp style
		timestamp: cn(
			'text-xs',
			message.role === 'user'
				? 'text-indigo-100'
				: 'text-foreground dark:text-foreground',
		),

		// Tool section header style
		toolHeader: 'mb-1 flex items-center justify-between',

		// Tool toggle button style
		toolToggleButton:
			'flex items-center gap-1 rounded-md p-1 text-xs text-merino-400 hover:bg-merino-100 hover:text-merino-800 dark:text-merino-800 dark:hover:bg-merino-900 dark:hover:text-merino-100',

		// Report container style
		reportContainer: cn(
			'rounded-lg border border-border p-3 transition-all duration-300',
			'bg-merino-50 dark:bg-merino-950',
			'hover:-translate-y-1 hover:translate-x-1 hover:shadow-[-4px_4px_0_hsl(var(--border-color))]',
			(message.isStreaming || isGeneratingAnyReport) &&
				'-translate-y-1 translate-x-1 shadow-[-4px_4px_0_hsl(var(--border-color))]',
		),

		// Report button style
		reportButton: cn(
			'flex items-center gap-2',
			isActiveReport
				? 'border-merino-600 bg-merino-600 text-white hover:bg-merino-700'
				: 'border-merino-300 bg-merino-100 text-merino-800 hover:bg-merino-200 dark:border-merino-700 dark:bg-merino-800 dark:text-merino-100 dark:hover:bg-merino-700',
			'min-w-[40px]',
			'report-button',
		),
	};

	/**
	 * Render a tool section header
	 */
	const renderToolHeader = useCallback(
		(title: string) => (
			<div className={styles.toolHeader}>
				<div className="text-xs text-merino-400 dark:text-merino-800">
					<span>{title}</span>
				</div>
				<button onClick={toggleExpanded} className={styles.toolToggleButton}>
					{expanded ? (
						<>
							<ChevronUp className="h-3 w-3" /> Hide
						</>
					) : (
						<>
							<ChevronDown className="h-3 w-3" /> Show
						</>
					)}
				</button>
			</div>
		),
		[expanded, toggleExpanded, styles.toolHeader, styles.toolToggleButton],
	);

	/**
	 * Render the report section
	 */
	const renderReportSection = useCallback(() => {
		if (!messageTools.hasReportTool) return null;

		return (
			<div className="mt-1">
				{renderToolHeader('Report')}

				{expanded && (
					<div className={styles.reportContainer}>
						<div className="flex items-center justify-between">
							<h3 className="mr-2 flex-1 truncate text-sm font-bold text-merino-800 dark:text-merino-200">
								{message.toolCall?.data?.reportData?.title ||
									'Web Vitals Report'}
							</h3>
							<Button
								variant={isActiveReport ? 'default' : 'outline'}
								size="sm"
								className={styles.reportButton}
								onClick={handleReportToggle}
								disabled={isGeneratingAnyReport || message.isStreaming}
							>
								<FileText className="h-4 w-4 flex-shrink-0" />
								<span className="report-button-text overflow-hidden whitespace-nowrap">
									{isActiveReport ? 'Close Report' : 'Open Report'}
								</span>
								<ExternalLink className="h-3 w-3 flex-shrink-0" />
							</Button>
						</div>
						<p className="mt-2 line-clamp-2 text-sm italic text-foreground">
							{reportSnippet}
						</p>
					</div>
				)}
			</div>
		);
	}, [
		messageTools.hasReportTool,
		expanded,
		styles.reportContainer,
		styles.reportButton,
		message.toolCall?.data?.reportData?.title,
		message.isStreaming,
		isActiveReport,
		isGeneratingAnyReport,
		handleReportToggle,
		reportSnippet,
		renderToolHeader,
	]);

	/**
	 * Render the breakdown section
	 */
	const renderBreakdownSection = useCallback(() => {
		if (!messageTools.hasBreakdown) return null;

		return (
			<div className="mt-1">
				{renderToolHeader('Generated UI')}

				{expanded && (
					<GenerativeCard
						title="Performance Metrics Breakdown"
						data={
							message.toolCall?.data || {
								beginner: 8,
								intermediate: 5,
								advanced: 3,
							}
						}
						triggerAnimation={showGenerativeUI}
						isStreaming={isBreakdownStreaming}
						onAbort={handleAbortBreakdown}
						toolCallId={toolCallId}
						annotations={breakdownAnnotations}
						isCancelled={isCancelled}
					/>
				)}
			</div>
		);
	}, [
		messageTools.hasBreakdown,
		expanded,
		message.toolCall?.data,
		showGenerativeUI,
		isBreakdownStreaming,
		handleAbortBreakdown,
		toolCallId,
		breakdownAnnotations,
		isCancelled,
		renderToolHeader,
	]);

	/**
	 * Render the research section
	 */
	const renderResearchSection = useCallback(() => {
		if (!messageTools.hasResearch) return null;

		return (
			<div className="mt-1">
				{renderToolHeader('Research Results')}

				{expanded && (
					<ResearchCard
						query={
							message.toolCall?.data?.query ||
							message.parts?.find((p) => p.toolInvocation?.args?.metric)
								?.toolInvocation?.args?.metric ||
							'performance metrics'
						}
						triggerAnimation={showResearchUI && initialResearchStarted}
						preserveData={false}
						researchId={researchId}
						toolCallId={toolCallId}
						onAbort={handleAbortResearch}
						streamedData={message.toolCall?.data}
						annotations={researchAnnotations}
					/>
				)}
			</div>
		);
	}, [
		messageTools.hasResearch,
		expanded,
		message.toolCall?.data,
		message.parts,
		showResearchUI,
		initialResearchStarted,
		researchId,
		toolCallId,
		handleAbortResearch,
		researchAnnotations,
		renderToolHeader,
	]);

	const isUser = message.role === 'user';
	const hasMessageContent = !message.isWaiting || message.content !== '';
	const showTypingIndicator =
		message.role === 'assistant' &&
		message.isWaiting &&
		!message.isStreaming &&
		message.content === '';

	return (
		<div className={styles.messageContainer}>
			{/* Bot avatar */}
			{!isUser && (
				<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-700">
					<Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-100" />
				</div>
			)}

			<div className="flex max-w-[80%] flex-col">
				{/* Message bubble */}
				{hasMessageContent && (
					<div className={styles.messageBubble}>
						<div className="whitespace-pre-wrap">
							{message.content}
							{/* Streaming cursor */}
							{message.role === 'assistant' && message.isStreaming && (
								<span className="ml-1 inline-block h-4 w-2 animate-pulse bg-foreground"></span>
							)}
						</div>

						{/* Timestamp and feedback buttons */}
						<div className="mt-1 flex items-center justify-between">
							<div className={styles.timestamp}>
								{new Date(message.timestamp).toLocaleTimeString([], {
									hour: '2-digit',
									minute: '2-digit',
								})}
							</div>

							{/* Only show feedback for assistant messages that are not streaming or waiting */}
							{!isUser && !message.isStreaming && !message.isWaiting && (
								<FeedbackButtons messageId={message.id} source="message" />
							)}
						</div>
					</div>
				)}

				{/* Typing indicator */}
				{showTypingIndicator && (
					<div className="typing-indicator">
						<span></span>
						<span></span>
						<span></span>
					</div>
				)}

				{/* Tool sections */}
				{renderReportSection()}
				{renderBreakdownSection()}
				{renderResearchSection()}
			</div>

			{/* User avatar */}
			{isUser && (
				<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600">
					<User className="h-5 w-5 text-white" />
				</div>
			)}

			{/* Invisible element for scrolling reference */}
			<div ref={messageEndRef} />
		</div>
	);
}
