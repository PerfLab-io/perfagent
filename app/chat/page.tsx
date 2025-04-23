'use client';

import type React from 'react';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Send, X } from 'lucide-react';
import { ChatMessage } from '@/components/chat-message';
import { FilePreview } from '@/components/file-preview';
import { SuggestedMessages } from '@/components/suggested-messages';
import { FileDropzone } from '@/components/file-dropzone';
import { DataPanel } from '@/components/data-panel';
import { MarkdownReport } from '@/components/markdown-report';
import { cn, yieldToMain } from '@/lib/utils';
import { useChat } from '@ai-sdk/react';
import { analyzeTraceFromFile, TraceAnalysis } from '@/lib/trace';
import { FileContextSection } from '@/components/trace-details';
import { analyseInsightsForCWV } from '@/lib/insights';
import { DataStreamHandler } from '@/components/data-stream-handler';

/**
 * Type definition for the report data structure
 */
type Report = {
	data: any;
	topic: string;
	toolCallId: string;
};

export interface AttachedFile {
	id: string;
	name: string;
	size: number;
	type: string;
}

const isDragEvent = (
	e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>,
): e is React.DragEvent<HTMLDivElement & { files: FileList }> => {
	return 'dataTransfer' in e && 'files' in e.dataTransfer;
};

const isFileInputEvent = (
	e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>,
): e is React.ChangeEvent<HTMLInputElement & { files: FileList }> => {
	return 'target' in e && 'files' in e.target;
};

const DEFAULT_DEBOUNCE_TIME = 120;

/**
 * AiChatPage - Main chat interface component with file handling, messaging,
 * and side panel functionality for data visualization and reports
 */
export default function AiChatPage() {
	const {
		messages,
		input,
		setInput,
		handleSubmit: originalHandleSubmit,
		status,
		stop,
		handleInputChange,
	} = useChat({
		api: '/api/chat',
		experimental_throttle: 500,
		id: 'current-chat',
	});

	// UI state management
	const [chatStarted, setChatStarted] = useState(false);
	const [messagesVisible, setMessagesVisible] = useState(false);
	const [showFileSection, setShowFileSection] = useState(false);

	// Side panel state management
	const [showSidePanel, setShowSidePanel] = useState<boolean | null>(null);
	const [panelAnimationComplete, setPanelAnimationComplete] = useState(false);
	const [panelExiting, setPanelExiting] = useState(false);
	const [panelContentType, setPanelContentType] = useState<'data' | 'report'>(
		'data',
	);

	// Report state management
	const [isGeneratingReport, setIsGeneratingReport] = useState(false);
	const [reportData, setReportData] = useState<string | null>(null);
	const [activeReportId, setActiveReportId] = useState<string | null>(null);
	const [reportsMap, setReportsMap] = useState<Record<string, Report>>({});
	const [currentNavigation, setCurrentNavigation] = useState<string | null>(
		null,
	);

	const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
	const [suggestionsLoading, setSuggestionsLoading] = useState(false);
	const [suggestions, setSuggestions] = useState<string[]>([]);

	const [traceAnalysis, setTraceAnalysis] = useState<TraceAnalysis | null>(
		null,
	);
	// Add a new state for the current file in context
	const [currentContextFile, setCurrentContextFile] =
		useState<AttachedFile | null>(null);
	const [showContextFile, setShowContextFile] = useState(false);

	// Refs
	const fileInputRef = useRef<HTMLInputElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const formRef = useRef<HTMLFormElement>(null);

	// Check if a message is currently being streamed
	const isLoading = status === 'submitted' || status === 'streaming';

	/**
	 * Smoothly scrolls to the bottom of the chat messages
	 */
	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, []);

	const processFiles = useCallback(
		(
			e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>,
		) => {
			const files = isDragEvent(e)
				? e.dataTransfer?.files
				: isFileInputEvent(e)
					? e.target?.files
					: [];

			// Validate: only accept 1 file and it must be JSON
			if (!files || files.length === 0) {
				return;
			}

			// Only process the first file and ensure it's a JSON file
			const file = files[0];
			if (!file.name.endsWith('.json') && file.type !== 'application/json') {
				// Could add error handling/notification here
				console.error('Only JSON files are supported');
				return;
			}

			// Create a single file entry
			const newFile: AttachedFile = {
				id: Math.random().toString(36).substring(7),
				name: file.name,
				size: file.size,
				type: file.type,
			};

			requestAnimationFrame(async () => {
				await yieldToMain();

				setTimeout(() => {
					analyzeTraceFromFile(file).then((trace) => {
						setTraceAnalysis(trace);

						setCurrentContextFile(newFile);
						setShowContextFile(true);

						requestAnimationFrame(async () => {
							const insights = analyseInsightsForCWV(
								trace?.insights ?? new Map(),
								trace?.parsedTrace ?? {},
								currentNavigation ?? '',
							);

							const suggestedMessages = await fetch('/api/suggest', {
								method: 'POST',
								body: JSON.stringify({ insights }),
							}).then((res) => res.json());

							setSuggestions(suggestedMessages);
							setSuggestionsLoading(false);
						});
					});
				}, 100);
			});

			// Replace any existing files with just this one
			setAttachedFiles([newFile]);

			// Trigger suggestions for the new file
			setSuggestionsLoading(true);
		},
		[],
	);

	const handleFileChange = processFiles;

	// Handle files dropped into the dropzone
	const handleFilesDrop = processFiles;

	// Remove a file by ID
	const removeFile = useCallback(
		(id: string) => {
			setTraceAnalysis(null);
			setCurrentContextFile(null);
			setAttachedFiles((prev) => {
				const updated = prev.filter((file) => file.id !== id);

				// If all files are removed, reset suggestions
				if (updated.length === 0) {
					setSuggestions([]);
					setSuggestionsLoading(false);
				}

				return updated;
			});
		},
		[setAttachedFiles, setSuggestions, setSuggestionsLoading],
	);

	const handleTraceNavigationChange = useCallback(
		(navigationId: string) => {
			setCurrentNavigation(navigationId);
		},
		[setCurrentNavigation],
	);

	/**
	 * Handles submission of chat messages
	 */
	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();

			// Only proceed if there's input
			if (input.trim()) {
				originalHandleSubmit(e as any, {
					body: {
						insights: traceAnalysis
							? analyseInsightsForCWV(
									traceAnalysis?.insights ?? new Map(),
									traceAnalysis?.parsedTrace ?? {},
									currentNavigation ?? '',
								)
							: null,
						userInteractions: traceAnalysis?.parsedTrace.UserInteractions,
						traceFile: currentContextFile,
					},
				});
				// Hide file section after submission
				setShowFileSection(false);
				setShowContextFile(true);
				setAttachedFiles([]);
				// Clear suggestions when submitting a message
				setSuggestions([]);
				setSuggestionsLoading(false);
				scrollToBottom();
			}
		},
		[input, attachedFiles?.length, originalHandleSubmit],
	);

	/**
	 * Handles keyboard shortcuts for message submission
	 */
	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (event.key === 'Enter' && !event.shiftKey) {
				handleSubmit(event as any);
			}
		},
		[handleSubmit],
	);

	/**
	 * Toggles the visibility of the side panel
	 */
	const toggleSidePanel = useCallback(() => {
		setShowSidePanel((prev) => !prev);
	}, []);

	/**
	 * Marks a report as complete
	 */
	const handleReportComplete = useCallback(() => {
		setIsGeneratingReport(false);
	}, []);

	/**
	 * Aborts the current report generation
	 */
	const handleAbortReport = useCallback(() => {
		// Stop the current message stream
		stop();

		// Update UI state
		setShowSidePanel(false);
		setPanelExiting(true);
		setReportData(null);
		setIsGeneratingReport(false);

		// Reset the report state after the exit animation completes
		setTimeout(() => {
			setPanelExiting(false);
		}, 300);
	}, [stop]);

	/**
	 * Opens a specific report in the side panel
	 */
	const openReport = useCallback(
		(reportId: string, reportData: string) => {
			if (reportId && reportData) {
				setActiveReportId(reportId);
				setShowSidePanel(true);
				setPanelContentType('report');
				setIsGeneratingReport(false);
				setReportData(reportData);
			}
		},
		[reportsMap],
	);

	/**
	 * Closes the current report panel
	 */
	const closeReport = useCallback(() => {
		setShowSidePanel(false);
		setActiveReportId(null);
	}, []);

	// Effect: Initialize chat and handle message visibility
	useEffect(() => {
		if (messages.length > 0) {
			if (!chatStarted) {
				setChatStarted(true);
				// Delay showing messages until input animation completes
				setTimeout(() => {
					setMessagesVisible(true);
				}, 500);
			}
		}
	}, [messages, chatStarted]);

	// Effect: Handle file section visibility based on attached files
	useEffect(() => {
		setShowFileSection(attachedFiles?.length > 0);
	}, [attachedFiles, isLoading]);

	// Effect: Adjust layout when file section visibility changes
	useEffect(() => {
		if (showFileSection) {
			document.body.style.overflowAnchor = 'none';
			setTimeout(() => {
				document.body.style.overflowAnchor = 'auto';
				scrollToBottom();
			}, 50);
		}
	}, [showFileSection, scrollToBottom]);

	// Effect: Auto-focus textarea when chat starts
	useEffect(() => {
		if (chatStarted && textareaRef.current) {
			setTimeout(() => {
				textareaRef.current?.focus();
			}, 500);
		}
	}, [chatStarted]);

	// Effect: Handle side panel animation sequencing
	useEffect(() => {
		if (showSidePanel) {
			setPanelExiting(false);
			const timer = setTimeout(() => {
				setPanelAnimationComplete(true);
			}, 300);
			return () => clearTimeout(timer);
		} else {
			if (panelAnimationComplete) {
				setPanelExiting(true);
				const timer = setTimeout(() => {
					setPanelAnimationComplete(false);
					setPanelExiting(false);
				}, 250);
				return () => clearTimeout(timer);
			} else {
				setPanelAnimationComplete(false);
			}
		}
	}, [showSidePanel, panelAnimationComplete]);

	const currentAssistantMessageId = useMemo(() => {
		return messages.findLast((message) => message.role === 'assistant')?.id;
	}, [messages]);

	return (
		<main className="relative flex flex-1 flex-col">
			{/* Dual panel container */}
			<div
				className={cn(
					'dual-panel-container group relative flex-1',
					showSidePanel
						? 'panel-active'
						: showSidePanel === null
							? ''
							: 'panel-inactive',
				)}
			>
				{/* Left panel with chat */}
				<div className="panel-left relative flex flex-col-reverse">
					{/* Outer main container with dropzone */}
					<FileDropzone
						onFilesDrop={handleFilesDrop}
						className="relative flex max-h-[90dvh] flex-1 flex-col px-4 focus-within:outline-hidden"
						disabled={isLoading}
					>
						{/* File context section */}
						<FileContextSection
							onTraceNavigationChange={handleTraceNavigationChange}
							currentFile={currentContextFile}
							isVisible={showContextFile}
							traceAnalysis={traceAnalysis}
						/>
						{/* Chat messages container */}
						<div
							className={cn(
								'flex-1 shrink overflow-y-auto rounded-lg border border-border bg-card shadow-xs',
								'transition-all duration-500 ease-in-out',
								messagesVisible
									? 'messages-container-active'
									: 'messages-container-initial',
								showFileSection ? 'messages-with-files' : '',
							)}
						>
							<div className="space-y-4 p-4 pb-20">
								{messages.map((message, index) => (
									<ChatMessage
										key={message.id}
										message={message}
										isStreaming={isLoading && index === messages.length - 1}
										onAbort={stop}
										openArtifact={openReport}
									/>
								))}
								<DataStreamHandler
									chatId="current-chat"
									currentMessageId={currentAssistantMessageId}
								/>
								<div ref={messagesEndRef} />
							</div>
						</div>

						{/* Input area container */}
						<div
							className={cn(
								'max-w-[calc(100%-2rem)] rounded-lg border border-border bg-card shadow-xs',
								'transition-all duration-500 ease-in-out',
								chatStarted
									? 'input-container-active'
									: 'input-container-initial translate-x-[25%] translate-y-[26%] xl:translate-y-[-50%]',
							)}
							style={{ transformOrigin: 'center bottom' }}
						>
							{/* File previews */}
							{attachedFiles?.length > 0 && (
								<div
									className={cn(
										'file-section rounded-t-lg border-b bg-peppermint-100 px-4 py-2 dark:bg-peppermint-900',
										showFileSection
											? 'max-h-[500px] opacity-100'
											: 'max-h-0 py-0 opacity-0',
									)}
								>
									<div className="flex flex-wrap gap-2">
										{attachedFiles?.map((file) => (
											<FilePreview
												key={file.id}
												file={file}
												onRemove={() => removeFile(file.id)}
											/>
										))}
									</div>
									<SuggestedMessages
										files={attachedFiles}
										onSelectSuggestion={setInput}
										isLoading={suggestionsLoading}
										suggestions={suggestions}
									/>
								</div>
							)}

							{/* Textarea and buttons */}
							<form onSubmit={handleSubmit} className="p-4" ref={formRef}>
								<div className="relative">
									<textarea
										ref={textareaRef}
										value={input}
										onChange={handleInputChange}
										onKeyDown={handleKeyDown}
										placeholder="Ask me anything about web vitals..."
										className={cn(
											'w-full resize-none rounded-xl p-4',
											'border border-border bg-background focus:border-peppermint-800 focus:ring-0',
											'text-foreground outline-hidden transition-all placeholder:text-foreground',
											chatStarted
												? 'max-h-[200px] min-h-[60px]'
												: 'min-h-[100px]',
											isLoading && 'cursor-not-allowed opacity-50',
										)}
										rows={chatStarted ? 2 : 3}
										disabled={isLoading}
									/>

									<div className="pointer-events-auto absolute bottom-4 right-4 flex gap-2">
										<input
											type="file"
											ref={fileInputRef}
											onChange={handleFileChange}
											className="hidden"
											multiple
										/>
										<Button
											type="button"
											variant="outline"
											size="icon"
											onClick={() => fileInputRef.current?.click()}
											title="Attach file"
											disabled={isLoading}
										>
											<Paperclip className="h-5 w-5" />
										</Button>

										{isLoading ? (
											<Button
												onClick={stop}
												variant="destructive"
												title="Cancel"
												size="icon"
											>
												<X className="h-5 w-5" />
											</Button>
										) : (
											<Button
												type="submit"
												disabled={
													isLoading ||
													(!input.trim() && attachedFiles?.length === 0)
												}
												variant="secondary"
												title="Send message"
												size="icon"
											>
												<Send className="h-5 w-5" />
											</Button>
										)}
									</div>
								</div>
							</form>
						</div>
					</FileDropzone>
				</div>

				{/* Right panel container */}
				<div className="max-h-[90dvh]">
					{panelContentType === 'data' ? (
						<DataPanel
							visible={!!showSidePanel && panelAnimationComplete}
							onClose={() => setShowSidePanel(false)}
							exiting={panelExiting}
						/>
					) : (
						<MarkdownReport
							visible={!!showSidePanel && panelAnimationComplete}
							onClose={() => {
								setShowSidePanel(false);
								setActiveReportId(null);
							}}
							exiting={panelExiting}
							isGenerating={isGeneratingReport}
							reportData={reportData || undefined}
							onAbort={handleAbortReport}
							reportId={activeReportId}
						/>
					)}
				</div>
			</div>
		</main>
	);
}
