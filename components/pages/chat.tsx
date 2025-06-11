'use client';

import type React from 'react';
import { useRef, useEffect, useCallback, useMemo } from 'react';
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
import { analyzeTrace, analyzeTraceFromFile, TraceAnalysis } from '@/lib/trace';
import { FileContextSection } from '@/components/trace-details';
import { analyseInsightsForCWV } from '@/lib/insights';
import { DataStreamHandler } from '@/components/data-stream-handler';
import type { StandaloneCallTreeContext } from '@perflab/trace_engine/panels/ai_assistance/standalone';
import { useSerializationWorker } from '@/lib/hooks/useSerializationWorker';
import useSWR from 'swr';
import { useScrollToBottom } from '@/lib/hooks/use-scroll-to-bottom';
import { useChatStore } from '@/lib/stores';

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

export const ChatPageComponent = () => {
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

	// Side panel state
	const showSidePanel = useChatStore((state) => state.showSidePanel);
	const setShowSidePanel = useChatStore((state) => state.setShowSidePanel);

	// File and trace state
	const traceContents = useChatStore((state) => state.traceContents);
	const setTraceContents = useChatStore((state) => state.setTraceContents);
	const attachedFiles = useChatStore((state) => state.attachedFiles);
	const setAttachedFiles = useChatStore((state) => state.setAttachedFiles);
	const suggestions = useChatStore((state) => state.suggestions);
	const setSuggestions = useChatStore((state) => state.setSuggestions);

	// Context file state
	const currentContextFile = useChatStore((state) => state.currentContextFile);
	const setCurrentContextFile = useChatStore(
		(state) => state.setCurrentContextFile,
	);
	const contextFileInsights = useChatStore(
		(state) => state.contextFileInsights,
	);
	const setContextFileInsights = useChatStore(
		(state) => state.setContextFileInsights,
	);
	const contextFileINPInteractionAnimation = useChatStore(
		(state) => state.contextFileINPInteractionAnimation,
	);
	const setContextFileINPInteractionAnimation = useChatStore(
		(state) => state.setContextFileINPInteractionAnimation,
	);

	// Report state
	const isGeneratingReport = useChatStore((state) => state.isGeneratingReport);
	const setIsGeneratingReport = useChatStore(
		(state) => state.setIsGeneratingReport,
	);
	const reportData = useChatStore((state) => state.reportData);
	const setReportData = useChatStore((state) => state.setReportData);
	const activeReportId = useChatStore((state) => state.activeReportId);
	const setActiveReportId = useChatStore((state) => state.setActiveReportId);

	// Serialized context
	const serializedContext = useChatStore((state) => state.serializedContext);
	const setSerializedContext = useChatStore(
		(state) => state.setSerializedContext,
	);

	// Pure functions to derive state
	const getChatUIState = () => {
		const chatStarted = messages.length > 0;
		const messagesVisible = chatStarted; // Simple CSS-driven animation
		const showFileSection = attachedFiles.length > 0;
		const hasActiveFile = currentContextFile !== null;

		return {
			chatStarted,
			messagesVisible,
			showFileSection,
			hasActiveFile,
		};
	};

	const getPanelState = () => {
		const isPanelOpen = showSidePanel === true;
		const isPanelInitial = showSidePanel === null;

		return {
			isPanelOpen,
			isPanelInitial,
		};
	};

	// Derived state from pure functions
	const { chatStarted, messagesVisible, showFileSection, hasActiveFile } =
		getChatUIState();
	const { isPanelOpen, isPanelInitial } = getPanelState();

	// Refs
	const fileInputRef = useRef<HTMLInputElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const formRef = useRef<HTMLFormElement>(null);

	// Check if a message is currently being streamed
	const isLoading = status === 'submitted' || status === 'streaming';
	const [messagesContainerRef, messagesEndRef] = useCallback(
		() => useScrollToBottom<HTMLDivElement>(),
		[],
	)();

	const { serializeInWorker } = useSerializationWorker();

	// Keep the traceAnalysis from SWR for compatibility
	const { data: traceAnalysis, mutate: setTraceAnalysis } =
		useSWR<TraceAnalysis | null>('trace-analysis', null, {
			fallbackData: null,
		});

	// SWR for navigation ID
	const { data: currentNavigation } = useSWR<string | null>(
		'navigation-id',
		null,
		{
			fallbackData: null,
		},
	);

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
					analyzeTraceFromFile(file)
						.then((contents) => {
							setTraceContents(contents);
							return analyzeTrace(contents);
						})
						.then((trace) => {
							setTraceAnalysis(trace);

							setCurrentContextFile(newFile);
						});
				}, 100);
			});

			// Replace any existing files with just this one
			setAttachedFiles([newFile]);

			setSuggestions([]);
		},
		[],
	);

	useEffect(() => {
		if (!contextFileInsights) return;
		setSuggestions([]);

		requestAnimationFrame(async () => {
			const insights = (
				Object.keys(contextFileInsights) as Array<
					keyof typeof contextFileInsights
				>
			).reduce(
				(acc, key) => ({
					...acc,
					[key]: {
						// Map insights to remove noise out of the request
						// The suggestions assitant does not require any of the 'extras' or 'rawEvent' info
						metric: contextFileInsights[key].metric,
						metricValue: contextFileInsights[key].metricValue,
						metricType: contextFileInsights[key].metricType,
						metricBreakdown: contextFileInsights[key].metricBreakdown,
						metricScore: contextFileInsights[key].metricScore,
						infoContent: contextFileInsights[key].infoContent,
						recommendations: contextFileInsights[key].recommendations,
					},
				}),
				{},
			);

			const suggestedMessages = await fetch('/api/suggest', {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ insights }),
			}).then((res) => res.json());

			setSuggestions(suggestedMessages);
		});
	}, [contextFileInsights]);

	const handleFileChange = processFiles;

	// Handle files dropped into the dropzone
	const handleFilesDrop = processFiles;

	// Remove a file by ID
	const removeFile = useCallback(
		(id: string) => {
			setTraceAnalysis(null);
			setCurrentContextFile(null);
			setAttachedFiles([]);
			setSuggestions([]);
		},
		[setAttachedFiles, setSuggestions],
	);

	const handleTraceNavigationChange = useCallback(
		(navigationId: string) => {
			if (!traceAnalysis) return;

			const insights = analyseInsightsForCWV(
				traceAnalysis.insights ?? new Map(),
				traceAnalysis.parsedTrace ?? {},
				navigationId,
			);

			requestAnimationFrame(() => setContextFileInsights(insights));
		},
		[traceAnalysis],
	);

	const handleAIContextChange = useCallback(
		(callTreeContext: StandaloneCallTreeContext) => {
			if (!traceContents || !currentNavigation) return;

			serializeInWorker(traceContents, currentNavigation)
				.then((serializedData) => {
					requestAnimationFrame(() => {
						setSerializedContext(serializedData);
					});
				})
				.catch((error) => {
					console.error('Error serializing context:', error);
					// Fallback to synchronous serialization if worker fails
					requestAnimationFrame(() => {
						setSerializedContext(callTreeContext.getItem()?.serialize());
					});
				});
		},
		[traceContents, currentNavigation, serializeInWorker],
	);

	/**
	 * Handles submission of chat messages
	 */
	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();

			// Only proceed if there's input
			if (input.trim()) {
				const body = {
					insights: contextFileInsights,
					userInteractions: traceAnalysis?.parsedTrace.UserInteractions,
					traceFile: currentContextFile,
					inpInteractionAnimation:
						contextFileINPInteractionAnimation?.animationFrameInteractionImageUrl ??
						null,
					aiContext: serializedContext,
				};

				originalHandleSubmit(e as any, {
					body,
				});
				// Clear attached files after submission
				setAttachedFiles([]);
				// Clear suggestions when submitting a message
				setSuggestions([]);
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
	 * Aborts the current report generation
	 */
	const handleAbortReport = useCallback(() => {
		// Stop the current message stream
		stop();

		// Update UI state
		setShowSidePanel(false);
		setReportData(null);
		setIsGeneratingReport(false);
	}, [stop]);

	/**
	 * Opens a specific report in the side panel
	 */
	const openReport = (reportId: string, reportData: string) => {
		if (reportId && reportData) {
			setActiveReportId(reportId);
			setShowSidePanel(true);
			setIsGeneratingReport(false);
			setReportData(reportData);
		}
	};

	// No effects needed for derived state - animations handled by CSS

	const currentAssistantMessageId = useMemo(() => {
		return messages.findLast((message) => message.role === 'assistant')?.id;
	}, [messages]);

	return (
		<div
			className={cn(
				'dual-panel-container group relative flex-1',
				isPanelOpen ? 'panel-active' : isPanelInitial ? '' : 'panel-inactive',
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
						metrics={contextFileInsights}
						onTraceNavigationChange={handleTraceNavigationChange}
						currentFile={currentContextFile}
						isVisible={hasActiveFile}
						traceAnalysis={traceAnalysis || null}
						onINPInteractionAnimationChange={
							setContextFileINPInteractionAnimation
						}
						onAIContextChange={handleAIContextChange}
					/>
					{/* Chat messages container */}
					<div
						className={cn(
							'border-border bg-card flex-1 shrink overflow-y-auto rounded-lg border shadow-xs',
							'transition-all duration-500 ease-in-out',
							messagesVisible
								? 'messages-container-active'
								: 'messages-container-initial',
							showFileSection ? 'messages-with-files' : '',
						)}
					>
						<div className="space-y-4 p-4 pb-20" ref={messagesContainerRef}>
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
							<div
								ref={
									status === 'streaming' || status === 'submitted'
										? messagesEndRef
										: null
								}
								className="min-h-[24px] min-w-[24px] shrink-0"
							/>
						</div>
					</div>

					{/* Input area container */}
					<div
						className={cn(
							'border-border bg-card max-w-[calc(100%-2rem)] rounded-lg border shadow-xs',
							'transition-all duration-500 ease-in-out',
							chatStarted
								? 'input-container-active'
								: 'input-container-initial translate-x-[25%] translate-y-[-20dvh]',
						)}
						style={{ transformOrigin: 'center bottom' }}
					>
						{/* File previews */}
						{attachedFiles?.length > 0 && (
							<div
								className={cn(
									'file-section bg-peppermint-100 dark:bg-peppermint-900 rounded-t-lg border-b px-4 py-2',
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
									isLoading={Boolean(!suggestions.length)}
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
									autoFocus
									onChange={handleInputChange}
									onKeyDown={handleKeyDown}
									placeholder="Ask me anything about web vitals..."
									className={cn(
										'w-full resize-none rounded-xl p-4',
										'border-border bg-background focus:border-peppermint-800 border focus:ring-0',
										'text-foreground placeholder:text-foreground outline-hidden transition-all',
										chatStarted
											? 'max-h-[200px] min-h-[60px]'
											: 'min-h-[100px]',
										isLoading && 'cursor-not-allowed opacity-50',
									)}
									rows={chatStarted ? 2 : 3}
									disabled={isLoading}
								/>

								<div className="pointer-events-auto absolute right-4 bottom-4 flex gap-2">
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
				<MarkdownReport
					visible={isPanelOpen}
					onClose={() => {
						setShowSidePanel(false);
						setActiveReportId(null);
					}}
					exiting={false}
					isGenerating={isGeneratingReport}
					reportData={reportData || undefined}
					onAbort={handleAbortReport}
					reportId={activeReportId}
				/>
			</div>
		</div>
	);
};
