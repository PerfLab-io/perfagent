'use client';

import { useEffect, useState, useRef } from 'react';
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

// Add a utility function to generate a random hash
function generateReportId(): string {
	return Math.random().toString(36).substring(2, 10);
}

// Update the ChatMessageProps interface to include the streaming state
interface ChatMessageProps {
	message: Message;
	onAbort: (toolCallId?: string) => void;
	openReport?: (reportId: string) => void;
	closeReport?: () => void;
	isActiveReport?: boolean;
	hasReport?: boolean;
	isGeneratingAnyReport?: boolean;
}

// In the ChatMessage component, add a state for the report ID
export function ChatMessage({
	message,
	onAbort,
	openReport,
	closeReport,
	isActiveReport = false,
	hasReport = false,
	isGeneratingAnyReport = false,
}: ChatMessageProps) {
	// Keep existing state variables
	const [visible, setVisible] = useState(false);
	const [showGenerativeUI, setShowGenerativeUI] = useState(false);
	const [showResearchUI, setShowResearchUI] = useState(false);
	const [expanded, setExpanded] = useState(true);
	const [initialResearchStarted, setInitialResearchStarted] = useState(false);
	const messageEndRef = useRef<HTMLDivElement>(null);

	// Add a state for showing report UI
	const [showReportUI, setShowReportUI] = useState(false);

	// Add a state for the unique report ID
	const [reportId] = useState(generateReportId());

	// Keep other state variables
	const [researchId] = useState(Math.random().toString(36).substring(7));
	const [toolCallId, setToolCallId] = useState<string | null>(null);
	const [researchAnnotations, setResearchAnnotations] = useState<
		MessageAnnotation[]
	>([]);
	const [breakdownAnnotations, setBreakdownAnnotations] = useState<
		MessageAnnotation[]
	>([]);
	const [isBreakdownStreaming, setIsBreakdownStreaming] = useState(false);
	const [isCancelled, setIsCancelled] = useState(false);

	// Update the useEffect to also set showReportUI when a report is detected
	useEffect(() => {
		// Delay to allow for animation
		const timer = setTimeout(() => {
			setVisible(true);
		}, 100);

		// Check for tool calls
		if (message.toolCall) {
			// Extract and store the toolCallId if present
			if (message.toolCall.toolCallId) {
				setToolCallId(message.toolCall.toolCallId);
			}

			if (message.toolCall.type === 'breakdown') {
				const uiTimer = setTimeout(() => {
					setShowGenerativeUI(true);
					// Set breakdown streaming to true initially
					setIsBreakdownStreaming(true);

					// Add a timeout to ensure streaming state is turned off after a reasonable time
					// This is a fallback in case the annotations don't properly signal completion
					setTimeout(() => {
						setIsBreakdownStreaming(false);
					}, 10000); // 10 seconds should be enough for most breakdowns to complete
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

		// Rest of the existing useEffect code...
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

	// Keep existing useEffect hooks...

	const isUser = message.role === 'user';

	// Keep existing handler functions...
	const handleAbortBreakdown = (toolCallId?: string) => {
		setIsCancelled(true);
		onAbort(toolCallId);
	};

	const handleAbortResearch = (toolCallId?: string) => {
		onAbort(toolCallId);
	};

	const handleReportToggle = () => {
		if (isActiveReport && closeReport) {
			closeReport();
		} else if (openReport) {
			openReport(message.id);
		}
	};

	// Get the first paragraph of the report for the snippet
	const getReportSnippet = () => {
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
	};

	return (
		<div
			className={cn(
				'flex gap-3 transition-all duration-300',
				visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
				isUser ? 'justify-end' : 'justify-start',
			)}
		>
			{!isUser && (
				<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-700">
					<Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-100" />
				</div>
			)}

			<div className="flex max-w-[80%] flex-col">
				{/* Only show the message bubble if we're not in waiting state or if there's content */}
				{(!message.isWaiting || message.content !== '') && (
					<div
						className={cn(
							'rounded-lg p-3',
							isUser
								? 'bg-indigo-600 text-white'
								: 'group relative border border-border bg-background text-foreground transition-all duration-300 hover:-translate-y-1 hover:translate-x-1 hover:shadow-[-4px_4px_0_hsl(var(--border-color))]',
						)}
					>
						<div className="whitespace-pre-wrap">
							{message.content}
							{/* Only show streaming cursor if isStreaming is true */}
							{message.role === 'assistant' && message.isStreaming && (
								<span className="ml-1 inline-block h-4 w-2 animate-pulse bg-foreground"></span>
							)}
						</div>

						{/* Timestamp and feedback buttons in a single row */}
						<div className="mt-1 flex items-center justify-between">
							<div
								className={cn(
									'text-xs',
									isUser
										? 'text-indigo-100'
										: 'text-foreground dark:text-foreground',
								)}
							>
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

				{/* Show typing indicator outside the bubble when in waiting state and no content */}
				{message.role === 'assistant' &&
					message.isWaiting &&
					!message.isStreaming &&
					message.content === '' && (
						<div className="typing-indicator">
							<span></span>
							<span></span>
							<span></span>
						</div>
					)}

				{/* Report section - similar to breakdown and research sections */}
				{(message.toolCall?.type === 'report' || hasReport) && (
					<div className="mt-1">
						<div className="mb-1 flex items-center justify-between">
							<div className="text-xs text-merino-400 dark:text-merino-800">
								<span>Report</span>
							</div>
							<button
								onClick={() => setExpanded(!expanded)}
								className="flex items-center gap-1 rounded-md p-1 text-xs text-merino-400 hover:bg-merino-100 hover:text-merino-800 dark:text-merino-800 dark:hover:bg-merino-900 dark:hover:text-merino-100"
							>
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

						{expanded && (
							<div
								className={cn(
									'rounded-lg border border-border p-3 transition-all duration-300',
									'bg-merino-50 dark:bg-merino-950',
									'hover:-translate-y-1 hover:translate-x-1 hover:shadow-[-4px_4px_0_hsl(var(--border-color))]',
									(message.isStreaming || isGeneratingAnyReport) &&
										'-translate-y-1 translate-x-1 shadow-[-4px_4px_0_hsl(var(--border-color))]',
								)}
							>
								<div className="flex items-center justify-between">
									<h3 className="mr-2 flex-1 truncate text-sm font-bold text-merino-800 dark:text-merino-200">
										{message.toolCall?.data?.reportData?.title ||
											'Web Vitals Report'}
									</h3>
									<Button
										variant={isActiveReport ? 'default' : 'outline'}
										size="sm"
										className={cn(
											'flex items-center gap-2',
											isActiveReport
												? 'border-merino-600 bg-merino-600 text-white hover:bg-merino-700'
												: 'border-merino-300 bg-merino-100 text-merino-800 hover:bg-merino-200 dark:border-merino-700 dark:bg-merino-800 dark:text-merino-100 dark:hover:bg-merino-700',
											'min-w-[40px]',
											'report-button',
										)}
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
									{getReportSnippet()}
								</p>
							</div>
						)}
					</div>
				)}

				{/* Keep existing breakdown section */}
				{message.toolCall?.type === 'breakdown' && (
					<div className="mt-1">
						<div className="mb-1 flex items-center justify-between">
							<div className="text-xs text-merino-400 dark:text-merino-800">
								<span>Generated UI</span>
							</div>
							<button
								onClick={() => setExpanded(!expanded)}
								className="flex items-center gap-1 rounded-md p-1 text-xs text-merino-400 hover:bg-merino-100 hover:text-merino-800 dark:text-merino-800 dark:hover:bg-merino-900 dark:hover:text-merino-100"
							>
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

						{expanded && (
							<GenerativeCard
								title="Go Course Level Distribution"
								data={
									message.toolCall.data || {
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
				)}

				{/* Keep existing research section */}
				{(message.toolCall?.type === 'research' ||
					researchAnnotations.length > 0 ||
					(message.parts &&
						message.parts.some(
							(part) =>
								part.type === 'tool-invocation' &&
								part.toolInvocation?.toolName === 'trace_analysis',
						))) && (
					<div className="mt-1">
						<div className="mb-1 flex items-center justify-between">
							<div className="text-xs text-merino-400 dark:text-merino-800">
								<span>Research Results</span>
							</div>
							<button
								onClick={() => setExpanded(!expanded)}
								className="flex items-center gap-1 rounded-md p-1 text-xs text-merino-400 hover:bg-merino-100 hover:text-merino-800 dark:text-merino-800 dark:hover:bg-merino-900 dark:hover:text-merino-100"
							>
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
				)}
			</div>

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
