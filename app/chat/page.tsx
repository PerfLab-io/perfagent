'use client';

import type React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Paperclip, Send, X } from 'lucide-react';
import { ChatMessage } from '@/components/chat-message';
import { FilePreview } from '@/components/file-preview';
import { SuggestedMessages } from '@/components/suggested-messages';
import { FileDropzone } from '@/components/file-dropzone';
import { DataPanel } from '@/components/data-panel';
import { MarkdownReport } from '@/components/markdown-report';
import { cn } from '@/lib/utils';
import { ResearchProvider } from '@/components/research-card';
import { useChat } from '@/lib/hooks/use-chat';

/**
 * Type definition for the report data structure
 */
type Report = {
	data: any;
	topic: string;
	toolCallId: string;
};

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
		isLoading,
		stop,
		attachedFiles,
		setAttachedFiles,
		handleFileChange,
		handleFilesDrop,
		removeFile,
		suggestionsLoading,
		suggestions,
	} = useChat();

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
	const [reportTopic, setReportTopic] = useState('');
	const [reportData, setReportData] = useState(null);
	const [toolCallId, setToolCallId] = useState<string | undefined>(undefined);
	const [activeReportId, setActiveReportId] = useState<string | null>(null);
	const [reportsMap, setReportsMap] = useState<Record<string, Report>>({});

	// Refs
	const fileInputRef = useRef<HTMLInputElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	/**
	 * Smoothly scrolls to the bottom of the chat messages
	 */
	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, []);

	/**
	 * Handles submission of chat messages
	 */
	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			// Only proceed if there's input text or files attached
			if (input.trim() || attachedFiles.length > 0) {
				originalHandleSubmit(e as any);
				// Hide file section after submission
				setShowFileSection(false);
			} else {
				e.preventDefault();
			}
		},
		[input, attachedFiles.length, originalHandleSubmit],
	);

	/**
	 * Handles keyboard shortcuts for message submission
	 */
	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (event.key === 'Enter' && !event.shiftKey) {
				event.preventDefault();
				originalHandleSubmit(event as any);
			}
		},
		[originalHandleSubmit],
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
		stop(toolCallId);

		// Update UI state
		setShowSidePanel(false);
		setPanelExiting(true);
		setReportData(null);
		setIsGeneratingReport(false);

		// Reset the report state after the exit animation completes
		setTimeout(() => {
			setPanelExiting(false);
		}, 300);
	}, [stop, toolCallId]);

	/**
	 * Aborts ongoing research
	 */
	const handleAbortResearch = useCallback(
		(callId?: string) => {
			stop(callId);
		},
		[stop],
	);

	/**
	 * Opens a specific report in the side panel
	 */
	const openReport = useCallback(
		(reportId: string) => {
			const report = reportsMap[reportId];
			if (report) {
				setActiveReportId(reportId);
				setShowSidePanel(true);
				setPanelContentType('report');
				setIsGeneratingReport(false);
				setReportTopic(report.topic);
				setReportData(report.data);
				setToolCallId(report.toolCallId);
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
					setTimeout(scrollToBottom, 100);
				}, 500);
			} else {
				scrollToBottom();
			}
		}
	}, [messages, chatStarted, scrollToBottom]);

	// Effect: Handle file section visibility based on attached files
	useEffect(() => {
		setShowFileSection(attachedFiles.length > 0);
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

	// Effect: Check for tool calls that should open the side panel
	useEffect(() => {
		const latestMessage = messages[messages.length - 1];
		if (latestMessage?.toolCall) {
			if (latestMessage.toolCall.id) {
				setToolCallId(latestMessage.toolCall.id);
			}

			if (latestMessage.toolCall.type === 'report') {
				if (
					latestMessage.toolCall.data &&
					latestMessage.toolCall.data.reportData
				) {
					const reportId = latestMessage.id;
					setReportsMap((prev) => ({
						...prev,
						[reportId]: {
							data: latestMessage.toolCall.data.reportData,
							topic: latestMessage.toolCall.reportType || 'go-overview',
							toolCallId: latestMessage.toolCall.id,
						},
					}));

					// Set as active report and open panel
					setActiveReportId(reportId);
					setShowSidePanel(true);
					setPanelContentType('report');
					setIsGeneratingReport(true);
					setReportTopic(latestMessage.toolCall.reportType || 'go-overview');
					setReportData(latestMessage.toolCall.data.reportData);
				}
			} else if (latestMessage.toolCall.type === 'sidePanel') {
				setShowSidePanel(true);
				setPanelContentType('data');
			}
		}
	}, [messages]);

	// Effect: Ensure proper scroll behavior when file section visibility changes
	useEffect(() => {
		if (messagesEndRef.current && messages.length > 0) {
			setTimeout(scrollToBottom, 300);
		}
	}, [showFileSection, attachedFiles.length, messages.length, scrollToBottom]);

	// Common height classes for both panels
	const panelHeightClasses =
		'min-h-[calc(70vh-200px)] max-h-[calc(90vh-200px)]';

	return (
		<ResearchProvider onAbort={handleAbortResearch}>
			<div className="flex min-h-screen flex-col bg-background">
				<div className="relative mb-20 bg-peppermint-200 dark:bg-background">
					<Header />
				</div>

				<main className="container relative mx-auto flex min-h-[500px] flex-1 flex-col px-4 py-6 md:min-h-[600px] lg:min-h-[700px]">
					{/* Dual panel container */}
					<div
						className={cn(
							'dual-panel-container relative flex-1',
							showSidePanel
								? 'panel-active'
								: showSidePanel === null
									? ''
									: 'panel-inactive',
						)}
					>
						{/* Left panel with chat */}
						<div
							className={cn(
								'panel-left relative flex flex-col overflow-hidden',
								panelHeightClasses,
							)}
						>
							{/* Outer main container with dropzone */}
							<FileDropzone
								onFilesDrop={handleFilesDrop}
								className="relative flex h-full flex-1 flex-col"
								disabled={isLoading}
							>
								{/* Chat messages container */}
								<div
									className={cn(
										'flex-1 overflow-y-auto rounded-lg border border-border bg-card shadow-sm',
										'transition-all duration-500 ease-in-out',
										'h-[calc(100%-80px)] pb-20',
										messagesVisible
											? 'messages-container-active'
											: 'messages-container-initial',
										showFileSection ? 'messages-with-files' : '',
									)}
								>
									<div className="space-y-4 p-4">
										{messages.map((message) => (
											<ChatMessage
												key={message.id}
												message={message}
												onAbort={stop}
												openReport={openReport}
												closeReport={closeReport}
												isActiveReport={activeReportId === message.id}
												hasReport={Boolean(reportsMap[message.id])}
												isGeneratingAnyReport={isGeneratingReport}
											/>
										))}
										<div ref={messagesEndRef} />
									</div>
								</div>

								{/* Input area container */}
								<div
									className={cn(
										'rounded-lg border border-border bg-card shadow-sm',
										'transition-all duration-500 ease-in-out',
										chatStarted
											? 'input-container-active'
											: 'input-container-initial',
									)}
									style={{ transformOrigin: 'center bottom' }}
								>
									{/* File previews */}
									{attachedFiles.length > 0 && (
										<div
											className={cn(
												'file-section rounded-t-lg border-b bg-peppermint-100 px-4 py-2 dark:bg-peppermint-900',
												showFileSection
													? 'max-h-[500px] opacity-100'
													: 'max-h-0 py-0 opacity-0',
											)}
										>
											<div className="flex flex-wrap gap-2">
												{attachedFiles.map((file) => (
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
									<form onSubmit={handleSubmit} className="p-4">
										<div className="relative">
											<textarea
												ref={textareaRef}
												value={input}
												onChange={(e) => setInput(e.target.value)}
												onKeyDown={handleKeyDown}
												placeholder="Ask me anything about web vitals..."
												className={cn(
													'w-full resize-none rounded-xl p-4',
													'border border-border bg-background focus:border-peppermint-800 focus:ring-0',
													'text-foreground outline-none transition-all placeholder:text-foreground',
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
															(!input.trim() && attachedFiles.length === 0)
														}
														variant="default"
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
						<div className={panelHeightClasses}>
							{panelContentType === 'data' ? (
								<DataPanel
									visible={showSidePanel && panelAnimationComplete}
									onClose={() => setShowSidePanel(false)}
									exiting={panelExiting}
								/>
							) : (
								<MarkdownReport
									visible={showSidePanel && panelAnimationComplete}
									onClose={() => {
										setShowSidePanel(false);
										setActiveReportId(null);
									}}
									exiting={panelExiting}
									isGenerating={isGeneratingReport}
									topic={reportTopic}
									onComplete={handleReportComplete}
									reportData={reportData}
									onAbort={handleAbortReport}
									reportId={activeReportId}
								/>
							)}
						</div>
					</div>
				</main>
			</div>
		</ResearchProvider>
	);
}
