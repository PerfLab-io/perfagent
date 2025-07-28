'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import type { UIMessage } from '@ai-sdk/ui-utils';
import { FeedbackButtons } from '@/components/feedback-buttons';
import { MarkdownRenderer } from './markdown-renderer';
import { ArtifactComponent } from '@/components/data-stream-handler';
import { MCPResourceList } from '@/components/mcp-resource';
import {
	useMCPResources,
	extractMCPResourcesFromMessage,
} from '@/lib/hooks/use-mcp-resources';

/**
 * Chat message component props
 */
interface ChatMessageProps {
	message: UIMessage;
	isStreaming: boolean;
	onAbort?: (toolCallId?: string) => void;
	openArtifact: (artifactId: string, artifactData: string) => void;
}

/**
 * Utility function to determine if a message is waiting to be processed
 */
export function isMessageWaiting(message: UIMessage): boolean {
	// A message is waiting if it has no content and no tool invocations yet
	return (
		message.content === '' &&
		!message.parts?.some((part) => part.type === 'tool-invocation')
	);
}

/**
 * ChatMessage Component
 * Displays a chat message with optional artifacts
 */
export function ChatMessage({
	message,
	isStreaming,
	openArtifact,
}: ChatMessageProps) {
	// Animation and visibility state
	const [visible, setVisible] = useState(false);

	// Refs
	const messageEndRef = useRef<HTMLDivElement>(null);

	// MCP resources hook
	const { loadingStates, contents, loadResourceContent } = useMCPResources();

	const isMessageIsWaiting = useMemo(
		() => isMessageWaiting(message),
		[message],
	);

	// Extract MCP resources from tool invocations
	const mcpResourceGroups = useMemo(
		() => extractMCPResourcesFromMessage(message),
		[message],
	);

	/**
	 * Set up animation effect
	 */
	useEffect(() => {
		// Delay to allow for animation
		const timer = setTimeout(() => {
			setVisible(true);
		}, 100);

		return () => clearTimeout(timer);
	}, []);

	// Get the message text from parts
	const messageText = message.parts
		?.find((part) => part.type === 'text')
		?.text.trim();

	/**
	 * Style utilities
	 */
	const styles = {
		// Message container style
		messageContainer: cn(
			'flex gap-3 transition-all duration-300 [&_p]:m-0',
			visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
			message.role === 'user' ? 'justify-end' : 'justify-start',
		),

		// Message bubble style
		messageBubble: cn(
			'rounded-lg p-3',
			message.role === 'user'
				? 'bg-midnight-600 text-white'
				: 'group border-border bg-background text-foreground relative border transition-all duration-300 hover:translate-x-1 hover:-translate-y-1 hover:shadow-[-4px_4px_0_hsl(var(--border-color))]',
			isStreaming &&
				message.role === 'assistant' &&
				'translate-x-1 -translate-y-1 shadow-[-4px_4px_0_hsl(var(--border-color))]',
		),

		// Timestamp style
		timestamp: cn(
			'text-xs',
			message.role === 'user'
				? 'text-midnight-100'
				: 'text-foreground dark:text-foreground',
		),
	};

	// Determine if this is a user or assistant message
	const isUser = message.role === 'user';

	return (
		<div className={styles.messageContainer}>
			{/* Bot avatar */}
			{!isUser && (
				<div className="bg-merino-100 dark:bg-merino-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
					<Bot className="text-merino-600 dark:text-merino-100 h-5 w-5" />
				</div>
			)}

			<div className="flex max-w-[80%] flex-col">
				{/* Render artifacts */}
				{message.role === 'assistant' && (
					<ArtifactComponent
						message={message}
						key={message.id}
						chatId="current-chat"
						openArtifact={openArtifact}
					/>
				)}

				{/* Render MCP resources */}
				{message.role === 'assistant' && mcpResourceGroups.length > 0 && (
					<div className="mb-4 space-y-4">
						{mcpResourceGroups.map((group, index) => (
							<MCPResourceList
								key={`${group.serverName}-${index}`}
								resources={group.resources}
								serverName={group.serverName}
								onLoadContent={(resource) => loadResourceContent(resource)}
								loadingStates={loadingStates}
								contents={contents}
							/>
						))}
					</div>
				)}

				{/* Message bubble - Always render for assistant, even if empty */}
				{messageText ? (
					<div className={styles.messageBubble}>
						<div className="whitespace-pre-wrap">
							<MarkdownRenderer content={messageText || ''} />
						</div>

						{/* Timestamp and feedback buttons */}
						<div className="mt-1 flex items-center justify-between">
							<div className={styles.timestamp}>
								{new Date(message.createdAt || Date.now()).toLocaleTimeString(
									[],
									{
										hour: '2-digit',
										minute: '2-digit',
									},
								)}
							</div>

							{/* Only show feedback for assistant messages that are not streaming or waiting */}
							{!isUser && !isStreaming && !isMessageIsWaiting && (
								<FeedbackButtons messageId={message.id} source="message" />
							)}
						</div>
					</div>
				) : (
					<div className="typing-indicator absolute bottom-2 left-4">
						<span></span>
						<span></span>
						<span></span>
					</div>
				)}
			</div>

			{/* User avatar */}
			{isUser && (
				<div className="bg-midnight-600 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
					<User className="h-5 w-5 text-white" />
				</div>
			)}

			{/* Invisible element for scrolling reference */}
			<div ref={messageEndRef} />
		</div>
	);
}
