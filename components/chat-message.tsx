'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import type { UIMessage } from '@ai-sdk/ui-utils';
import { FeedbackButtons } from '@/components/feedback-buttons';
import { MarkdownRenderer } from './markdown-renderer';
import { ArtifactComponent } from '@/components/data-stream-handler';

/**
 * Chat message component props
 */
interface ChatMessageProps {
	message: UIMessage;
	isStreaming: boolean;
	onAbort?: (toolCallId?: string) => void;
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
export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
	// Animation and visibility state
	const [visible, setVisible] = useState(false);

	// Refs
	const messageEndRef = useRef<HTMLDivElement>(null);

	const isMessageIsWaiting = useMemo(
		() => isMessageWaiting(message),
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
				: 'group relative border border-border bg-background text-foreground transition-all duration-300 hover:-translate-y-1 hover:translate-x-1 hover:shadow-[-4px_4px_0_hsl(var(--border-color))]',
			isStreaming &&
				message.role === 'assistant' &&
				'-translate-y-1 translate-x-1 shadow-[-4px_4px_0_hsl(var(--border-color))]',
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
				<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-merino-100 dark:bg-merino-700">
					<Bot className="h-5 w-5 text-merino-600 dark:text-merino-100" />
				</div>
			)}

			<div className="flex max-w-[80%] flex-col">
				{/* Render artifacts */}
				{message.role === 'assistant' && (
					<ArtifactComponent
						message={message}
						key={message.id}
						chatId="current-chat"
					/>
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
				<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-midnight-600">
					<User className="h-5 w-5 text-white" />
				</div>
			)}

			{/* Invisible element for scrolling reference */}
			<div ref={messageEndRef} />
		</div>
	);
}
