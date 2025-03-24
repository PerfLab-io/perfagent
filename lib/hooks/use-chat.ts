'use client';

import type React from 'react';
import { useState, useCallback, useRef } from 'react';

export interface MessageAnnotation {
	type: string;
	data: any;
}

export interface Message {
	id: string;
	content: string;
	role: 'user' | 'assistant';
	timestamp: Date;
	toolCall?: {
		type: string;
		data: any;
		toolCallId?: string; // Add toolCallId to the toolCall object
	};
	isStreaming?: boolean;
	isWaiting?: boolean;
	toolInvocations?: any[];
	annotations?: MessageAnnotation[]; // Add annotations array
	parts?: MessagePart[]; // Add parts array
}

// Add MessagePart interface to match the JSON structure
export interface MessagePart {
	type: string;
	text?: string;
	toolInvocation?: {
		state: string;
		step: number;
		toolCallId: string;
		toolName: string;
		args: any;
	};
}

export interface UseChat {
	messages: Message[];
	input: string;
	setInput: (input: string) => void;
	handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
	isLoading: boolean;
	error: Error | null;
	append: (message: Pick<Message, 'content' | 'role'>) => Promise<void>;
	reload: () => Promise<void>;
	stop: (toolCallId?: string) => void;
	attachedFiles: AttachedFile[];
	setAttachedFiles: (files: AttachedFile[]) => void;
	handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	handleFilesDrop: (files: File[]) => void;
	removeFile: (id: string) => void;
	suggestionsLoading: boolean;
	suggestions: string[];
	setSuggestions: (suggestions: string[]) => void;
}

export interface AttachedFile {
	id: string;
	name: string;
	size: number;
	type: string;
}

export function useChat(): UseChat {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
	const abortControllerRef = useRef<AbortController | null>(null);
	const [suggestionsLoading, setSuggestionsLoading] = useState(false);
	const [suggestions, setSuggestions] = useState<string[]>([]);
	// Add a suggestionsAbortController ref
	const suggestionsAbortControllerRef = useRef<AbortController | null>(null);
	// Add a ref to track the current streaming message ID
	const currentStreamingMessageIdRef = useRef<string | null>(null);

	// Function to trigger suggestions tool
	const triggerSuggestionsTool = useCallback(
		async (files: AttachedFile[]) => {
			if (!files || files.length === 0) {
				setSuggestionsLoading(false);
				return;
			}

			// Cancel any existing suggestions request
			if (suggestionsAbortControllerRef.current) {
				suggestionsAbortControllerRef.current.abort();
			}

			// Create a new AbortController for this suggestions request
			const controller = new AbortController();
			suggestionsAbortControllerRef.current = controller;
			setSuggestionsLoading(true);

			// Add a timeout to ensure loading state doesn't get stuck
			const timeoutId = setTimeout(() => {
				if (suggestionsAbortControllerRef.current === controller) {
					console.log('Suggestions request timed out');
					controller.abort();
					setSuggestionsLoading(false);
				}
			}, 10000); // 10 second timeout

			try {
				// Use the dedicated suggestions endpoint
				const response = await fetch('/api/suggestions', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						files: files,
					}),
					signal: controller.signal,
				});

				if (!response.ok || !response.body) {
					throw new Error(`API error: ${response.status}`);
				}

				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let suggestionsReceived = false;

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const chunk = decoder.decode(value);
					console.log('Suggestions chunk received:', chunk);

					const lines = chunk.split('\n').filter((line) => line.trim());

					for (const line of lines) {
						try {
							console.log('Processing line:', line);
							const parsedChunk = JSON.parse(line);
							console.log('Parsed chunk:', parsedChunk);

							// Check for different possible formats of suggestions in the response
							if (
								parsedChunk.type === 'tool-result' &&
								parsedChunk.toolResult &&
								parsedChunk.toolResult.type === 'suggestions'
							) {
								console.log(
									'Suggestions found in toolResult:',
									parsedChunk.toolResult.suggestions,
								);
								setSuggestions(parsedChunk.toolResult.suggestions || []);
								setSuggestionsLoading(false);
								suggestionsReceived = true;
							} else if (
								parsedChunk.type === 'data' &&
								parsedChunk.data &&
								parsedChunk.data.suggestions
							) {
								// Handle alternative format where suggestions might be in data.suggestions
								console.log(
									'Alternative suggestions format found in data:',
									parsedChunk.data.suggestions,
								);
								setSuggestions(parsedChunk.data.suggestions || []);
								setSuggestionsLoading(false);
								suggestionsReceived = true;
							} else if (parsedChunk.suggestions) {
								// Handle direct suggestions array
								console.log(
									'Direct suggestions array found:',
									parsedChunk.suggestions,
								);
								setSuggestions(parsedChunk.suggestions || []);
								setSuggestionsLoading(false);
								suggestionsReceived = true;
							} else if (
								parsedChunk.type === 'tool-call' &&
								parsedChunk.toolCall &&
								parsedChunk.toolCall.toolName === 'generateSuggestions'
							) {
								// This is just the tool call, not the result yet
								console.log('Suggestions tool call detected');
							} else if (parsedChunk.type === 'tool-result') {
								// Check if there's any suggestions-related data in the tool result
								console.log('Tool result detected:', parsedChunk.toolResult);
								if (
									parsedChunk.toolResult &&
									parsedChunk.toolResult.suggestions
								) {
									console.log(
										'Suggestions found in generic toolResult:',
										parsedChunk.toolResult.suggestions,
									);
									setSuggestions(parsedChunk.toolResult.suggestions || []);
									setSuggestionsLoading(false);
									suggestionsReceived = true;
								}
							}
						} catch (error) {
							console.error('Error parsing chunk:', error, line);
						}
					}
				}

				// If we completed the stream but didn't receive any suggestions, reset loading state
				if (!suggestionsReceived) {
					console.log('Stream completed but no suggestions received');
					setSuggestionsLoading(false);

					// Set some default suggestions as a fallback
					setSuggestions([
						'What can you tell me about these files?',
						'Can you analyze the content of these files?',
						'What are the key points in these documents?',
					]);
				}
			} catch (error) {
				if (error.name === 'AbortError') {
					console.log('Suggestions request aborted');
				} else {
					console.error('Error fetching suggestions:', error);
				}
				setSuggestionsLoading(false);
			} finally {
				clearTimeout(timeoutId);
				suggestionsAbortControllerRef.current = null;
				setSuggestionsLoading(false);
			}
		},
		[setSuggestionsLoading, setSuggestions],
	);

	// Function to send a message
	const sendMessage = useCallback(
		async (content: string, files?: AttachedFile[]) => {
			if (!content.trim() && (!files || files.length === 0)) return;

			// Add user message
			const userMessage: Message = {
				id: Date.now().toString(),
				content,
				role: 'user',
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, userMessage]);

			// Set loading state
			setIsLoading(true);

			// Create a new message for the assistant with waiting state
			const assistantMessageId = (Date.now() + 1).toString();
			const assistantMessage: Message = {
				id: assistantMessageId,
				content: '',
				role: 'assistant',
				timestamp: new Date(),
				isWaiting: true,
				annotations: [], // Initialize empty annotations array
				parts: [], // Initialize empty parts array
			};

			// Store the current streaming message ID
			currentStreamingMessageIdRef.current = assistantMessageId;

			// Add the empty message to the state
			setMessages((prev) => [...prev, assistantMessage]);

			try {
				// Create a new AbortController for this request
				const controller = new AbortController();
				abortControllerRef.current = controller;

				// Call the API
				const response = await fetch('/api/chat', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						messages: [...messages, userMessage],
						files: files || attachedFiles,
					}),
					signal: controller.signal,
				});

				// Check for HTTP errors and handle them
				if (!response.ok) {
					const errorText = await response.text().catch(() => 'Unknown error');
					console.error(`API error (${response.status}): ${errorText}`);
					throw new Error(
						`API error: ${response.status} ${response.statusText}`,
					);
				}

				// Check if the response body is readable
				if (!response.body) {
					throw new Error('Response body is null');
				}

				// Process the streaming response
				const reader = response.body.getReader();
				const decoder = new TextDecoder();

				let firstChunkReceived = false;
				const toolInvocations: any[] = [];

				while (true) {
					const { done, value } = await reader.read();

					if (done) {
						// Set isStreaming to false when the stream is complete
						setMessages((prev) => {
							const lastMessage = prev[prev.length - 1];
							return [
								...prev.slice(0, -1),
								{
									...lastMessage,
									isStreaming: false,
									isWaiting: false,
									toolInvocations:
										toolInvocations.length > 0 ? toolInvocations : undefined,
								},
							];
						});
						abortControllerRef.current = null;
						currentStreamingMessageIdRef.current = null;
						break;
					}

					// Parse the chunk
					const chunk = decoder.decode(value);
					const lines = chunk.split('\n').filter((line) => line.trim());

					for (const line of lines) {
						try {
							const parsedChunk = JSON.parse(line);

							// On first chunk, change from waiting to streaming state
							if (!firstChunkReceived) {
								firstChunkReceived = true;
								setMessages((prev) => {
									const lastMessage = prev[prev.length - 1];
									return [
										...prev.slice(0, -1),
										{
											...lastMessage,
											isWaiting: false,
											isStreaming: true,
										},
									];
								});
							}

							if (parsedChunk.type === 'text-delta') {
								// Update the message content
								setMessages((prev) => {
									const lastMessage = prev[prev.length - 1];

									// Update parts array with text part if it doesn't exist
									const updatedParts = [...(lastMessage.parts || [])];
									const textPartIndex = updatedParts.findIndex(
										(part) => part.type === 'text',
									);

									if (textPartIndex === -1) {
										// Add new text part
										updatedParts.push({
											type: 'text',
											text: parsedChunk.text || '',
										});
									} else {
										// Update existing text part
										updatedParts[textPartIndex] = {
											...updatedParts[textPartIndex],
											text:
												(updatedParts[textPartIndex].text || '') +
												(parsedChunk.text || ''),
										};
									}

									return [
										...prev.slice(0, -1),
										{
											...lastMessage,
											content: lastMessage.content + (parsedChunk.text || ''),
											isStreaming: true,
											isWaiting: false,
											parts: updatedParts,
										},
									];
								});
							} else if (parsedChunk.type === 'tool-call') {
								// Handle tool call
								const toolCall = parsedChunk.toolCall;

								// Add to toolInvocations array
								const toolInvocation = {
									state: 'call',
									step: toolInvocations.length,
									toolCallId: toolCall.toolCallId || `call_${Date.now()}`,
									toolName: toolCall.toolName,
									args: toolCall.toolParameters || {},
								};

								toolInvocations.push(toolInvocation);

								if (toolCall.toolName === 'generateSuggestions') {
									// No need to update messages for suggestions, just keep the loading state
									setSuggestionsLoading(true);
								} else {
									// For other tool calls, update the message
									setMessages((prev) => {
										const lastMessage = prev[prev.length - 1];

										// Update parts array with tool invocation
										const updatedParts = [...(lastMessage.parts || [])];
										updatedParts.push({
											type: 'tool-invocation',
											toolInvocation,
										});

										return [
											...prev.slice(0, -1),
											{
												...lastMessage,
												toolCall: {
													type: toolCall.toolName
														.replace(/^generate|^perform|^open/, '')
														.toLowerCase(),
													data: null, // Will be filled by the tool result
													toolCallId: toolCall.toolCallId, // Store the toolCallId
												},
												isWaiting: false,
												toolInvocations,
												parts: updatedParts,
											},
										];
									});
								}
							} else if (parsedChunk.type === 'tool-result') {
								// Handle tool result
								const toolResult = parsedChunk.toolResult;
								const toolCallId = parsedChunk.toolCallId;

								if (toolResult.type === 'suggestions') {
									// Update suggestions and turn off loading
									setSuggestions(toolResult.suggestions || []);
									setSuggestionsLoading(false);
								} else {
									// For other tool results, update the message with the data
									setMessages((prev) => {
										const lastMessage = prev[prev.length - 1];
										return [
											...prev.slice(0, -1),
											{
												...lastMessage,
												toolCall: {
													type: toolResult.type,
													data: toolResult.data || toolResult,
													toolCallId, // Store the toolCallId
												},
												isWaiting: false,
												toolInvocations,
											},
										];
									});
								}
							} else if (parsedChunk.type === 'message-annotation') {
								// Handle message annotation
								const annotation = parsedChunk.annotation;

								setMessages((prev) => {
									const lastMessage = prev[prev.length - 1];

									// Check if we need to update an existing annotation or add a new one
									const updatedAnnotations = [
										...(lastMessage.annotations || []),
									];

									if (annotation.data && annotation.data.overwrite) {
										// Find and replace existing annotation with the same ID
										const existingIndex = updatedAnnotations.findIndex(
											(a) => a.data && a.data.id === annotation.data.id,
										);

										if (existingIndex !== -1) {
											updatedAnnotations[existingIndex] = annotation;
										} else {
											updatedAnnotations.push(annotation);
										}
									} else {
										// Just add the new annotation
										updatedAnnotations.push(annotation);
									}

									return [
										...prev.slice(0, -1),
										{
											...lastMessage,
											annotations: updatedAnnotations,
										},
									];
								});
							}
						} catch (error) {
							console.error('Error parsing chunk:', error, line);
						}
					}
				}
			} catch (error) {
				// Don't show error message if it was an abort
				if (
					error.name === 'AbortError' ||
					(error.message && error.message.includes('499'))
				) {
					console.log('Fetch aborted or client closed request');

					// Only update the streaming state of the assistant message, don't remove it
					setMessages((prev) => {
						// Find the last message
						const lastMessage = prev[prev.length - 1];

						// If it's an assistant message that's streaming, mark it as not streaming
						if (lastMessage.role === 'assistant' && lastMessage.isStreaming) {
							return [
								...prev.slice(0, -1),
								{
									...lastMessage,
									isStreaming: false,
									isWaiting: false,
								},
							];
						}
						return prev;
					});
				} else {
					console.error('Error sending message:', error);
					setError(error);

					// Add a more detailed error message
					setMessages((prev) => {
						// Find the last message
						const lastMessage = prev[prev.length - 1];

						// If it's an assistant message that's waiting or streaming, replace it with an error message
						if (
							lastMessage.role === 'assistant' &&
							(lastMessage.isWaiting || lastMessage.isStreaming)
						) {
							return [
								...prev.slice(0, -1),
								{
									id: lastMessage.id,
									content: `I'm sorry, I encountered an error while processing your request. ${error.message || 'Please try again later.'}`,
									role: 'assistant',
									timestamp: new Date(),
									isWaiting: false,
									isStreaming: false,
								},
							];
						}

						// Otherwise, add a new error message
						return [
							...prev,
							{
								id: (Date.now() + 1).toString(),
								content: `I'm sorry, I encountered an error while processing your request. ${error.message || 'Please try again later.'}`,
								role: 'assistant',
								timestamp: new Date(),
							},
						];
					});
				}
			} finally {
				// Ensure loading state is reset
				setIsLoading(false);
			}
		},
		[messages, attachedFiles],
	);

	// Handle form submission
	const handleSubmit = useCallback(
		(e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault();

			// Don't proceed if input is empty and no files are attached
			if (!input.trim() && (!attachedFiles || attachedFiles.length === 0)) {
				return;
			}

			// Abort any ongoing suggestions request when submitting a message
			if (suggestionsAbortControllerRef.current) {
				suggestionsAbortControllerRef.current.abort();
				suggestionsAbortControllerRef.current = null;
			}

			// Clear suggestions when submitting a message
			setSuggestions([]);
			setSuggestionsLoading(false);

			// Send the message regardless of suggestions state
			sendMessage(input, attachedFiles);
			setInput('');

			// Clear attached files after sending
			setAttachedFiles([]);
		},
		[
			input,
			attachedFiles,
			sendMessage,
			setInput,
			setAttachedFiles,
			setSuggestions,
			setSuggestionsLoading,
		],
	);

	// Append a message programmatically
	const append = useCallback(
		async (message: Pick<Message, 'content' | 'role'>) => {
			await sendMessage(message.content);
		},
		[sendMessage],
	);

	// Reload the last user message
	const reload = useCallback(async () => {
		if (messages.length < 2) return;

		// Find the last user message
		const lastUserMessageIndex = [...messages]
			.reverse()
			.findIndex((m) => m.role === 'user');
		if (lastUserMessageIndex === -1) return;

		const lastUserMessage =
			messages[messages.length - 1 - lastUserMessageIndex];

		// Remove all messages after the last user message
		setMessages(messages.slice(0, messages.length - lastUserMessageIndex));

		// Resend the last user message
		await sendMessage(lastUserMessage.content);
	}, [messages, sendMessage]);

	// Update the stop function to handle both main stream and tool-specific streams
	const stop = useCallback(
		(toolCallId?: string) => {
			console.log('Stop called with toolCallId:', toolCallId);

			// Create a global array to track cancelled tool calls if it doesn't exist
			if (
				typeof window !== 'undefined' &&
				!(window as any).cancelledToolCalls
			) {
				(window as any).cancelledToolCalls = [];
			}

			// If a specific toolCallId is provided, add it to the cancelled list
			if (toolCallId && typeof window !== 'undefined') {
				(window as any).cancelledToolCalls.push(toolCallId);
				console.log('Added to cancelled tool calls:', toolCallId);
			}

			// If a specific toolCallId is provided, we need to find the message with that tool call
			if (toolCallId) {
				// Find the message with this toolCallId
				const messageWithToolCall = messages.find(
					(msg) => msg.toolCall && msg.toolCall.toolCallId === toolCallId,
				);

				if (messageWithToolCall) {
					console.log('Found message with toolCallId:', messageWithToolCall.id);

					// Mark the message as no longer streaming
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === messageWithToolCall.id
								? {
										...msg,
										isStreaming: false,
										isWaiting: false,
										// Clear the data to prevent it from being displayed
										toolCall: msg.toolCall
											? {
													...msg.toolCall,
													data: null, // Clear the data
												}
											: undefined,
									}
								: msg,
						),
					);
				}
			}

			// Always abort the main request if it exists
			if (abortControllerRef.current) {
				console.log('Aborting main request');
				abortControllerRef.current.abort();
				abortControllerRef.current = null;

				// If we're cancelling the main stream, update the current streaming message
				if (currentStreamingMessageIdRef.current) {
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === currentStreamingMessageIdRef.current
								? {
										...msg,
										isStreaming: false,
										isWaiting: false,
										// Clear any tool call data
										toolCall: msg.toolCall
											? {
													...msg.toolCall,
													data: null, // Clear the data
												}
											: undefined,
									}
								: msg,
						),
					);
					currentStreamingMessageIdRef.current = null;
				}
			}

			// Also abort any ongoing suggestions request
			if (suggestionsAbortControllerRef.current) {
				console.log('Aborting suggestions request');
				suggestionsAbortControllerRef.current.abort();
				suggestionsAbortControllerRef.current = null;
				setSuggestionsLoading(false);
			}

			// Reset loading state
			setIsLoading(false);
		},
		[messages.length, setMessages],
	);

	// Handle file change from input
	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			if (e.target.files && e.target.files.length > 0) {
				const newFiles: AttachedFile[] = Array.from(e.target.files).map(
					(file) => ({
						id: Math.random().toString(36).substring(7),
						name: file.name,
						size: file.size,
						type: file.type,
					}),
				);

				const updatedFiles = [...attachedFiles, ...newFiles];
				setAttachedFiles(updatedFiles);

				// Always trigger suggestions when files are added
				setSuggestionsLoading(true);
				triggerSuggestionsTool(updatedFiles);
			}
		},
		[
			attachedFiles,
			setAttachedFiles,
			setSuggestionsLoading,
			triggerSuggestionsTool,
		],
	);

	// Handle files dropped into the dropzone
	const handleFilesDrop = useCallback(
		(files: File[]) => {
			if (files.length > 0) {
				const newFiles: AttachedFile[] = files.map((file) => ({
					id: Math.random().toString(36).substring(7),
					name: file.name,
					size: file.size,
					type: file.type,
				}));

				// Start suggestion loading immediately before updating state
				setSuggestionsLoading(true);

				// Update files state
				const updatedFiles = [...attachedFiles, ...newFiles];
				setAttachedFiles(updatedFiles);

				// Trigger suggestions immediately
				triggerSuggestionsTool(updatedFiles);
			}
		},
		[
			attachedFiles,
			setAttachedFiles,
			setSuggestionsLoading,
			triggerSuggestionsTool,
		],
	);

	// Remove a file by ID
	const removeFile = useCallback(
		(id: string) => {
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

	// Return the updated stop function
	return {
		messages,
		input,
		setInput,
		handleSubmit,
		isLoading,
		error,
		append,
		reload,
		stop,
		attachedFiles,
		setAttachedFiles,
		handleFileChange,
		handleFilesDrop,
		removeFile,
		suggestionsLoading,
		suggestions,
		setSuggestions,
	};
}
