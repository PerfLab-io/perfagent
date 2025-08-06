'use client';

import { useChat } from '@ai-sdk/react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { initialArtifactData, useArtifact } from '@/lib/hooks/use-artifact';
import { JSONValue, UIMessage } from 'ai';
import { researchUpdateArtifact } from '@/artifacts/research_update/client';
import { textArtifact } from '@/artifacts/text/client';
import { toolCallApprovalArtifact } from '@/artifacts/tool_call_approval/client';
import { toolExecutionArtifact } from '@/artifacts/tool_execution/client';
import { Artifact, UIArtifact } from '@/components/artifact';
import { ChevronDown, ChevronUp, ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './markdown-renderer';

export type DataStreamDelta<T extends JSONValue = NonNullable<JSONValue>> = {
	type: string;
	content: T;
	runId: string;
	status: 'started' | 'in-progress' | 'complete';
};

// Register artifacts in the global artifactDefinitions array
// This is done here to avoid circular dependencies

// We'll populate this from outside to avoid circular dependencies
export const artifactDefinitions: Array<Artifact<any, any, any>> = [];
artifactDefinitions.push(
	textArtifact,
	researchUpdateArtifact,
	toolCallApprovalArtifact,
	toolExecutionArtifact,
);

export function DataStreamHandler({
	chatId,
	currentMessageId,
}: {
	chatId?: string;
	currentMessageId?: string;
}) {
	const { data: dataStream } = useChat({
		api: '/api/chat',
		experimental_throttle: 500,
		id: chatId,
	});
	const [assistantMessageId, setAssistantMessageId] = useState<
		string | undefined
	>(undefined);
	const { artifact, setArtifact, metadata, setMetadata } =
		useArtifact(assistantMessageId);
	const lastProcessedIndex = useRef(-1);
	const _artifactId = useRef<UIArtifact | undefined>(undefined);
	const _metadata = useRef<JSONValue | undefined>(undefined);

	useEffect(() => {
		if (!currentMessageId || currentMessageId === assistantMessageId) return;
		if (currentMessageId.startsWith('msg-')) {
			setAssistantMessageId(currentMessageId);
			_artifactId.current = artifact;
			_metadata.current = metadata;

			setArtifact(initialArtifactData);
			setMetadata(undefined);
		} else {
			setAssistantMessageId(undefined);
		}
	}, [currentMessageId]);

	useEffect(() => {
		if (
			!_artifactId.current ||
			assistantMessageId !== currentMessageId ||
			!('kind' in _artifactId.current)
		) {
			return;
		}

		setArtifact(_artifactId.current);
		setMetadata(_metadata.current);
	}, [_artifactId.current, artifact, setArtifact]);

	useEffect(() => {
		if (!dataStream?.length) return;

		// Process the data that hasn't been processed yet
		const newDeltas: DataStreamDelta[] = dataStream
			.slice(lastProcessedIndex.current + 1)
			.filter(
				(data) =>
					!(typeof data !== 'object' || data === null || !('type' in data)),
			) as DataStreamDelta[];
		if (newDeltas.length === 0) return;

		lastProcessedIndex.current = dataStream.length - 1;

		for (const delta of newDeltas) {
			// Skip non-object deltas
			if (typeof delta !== 'object' || delta === null || !('type' in delta)) {
				continue;
			}

			const deltaType = delta.type as string;
			console.log('DataStreamHandler - Processing delta:', {
				deltaType,
				delta,
			});

			// Find the artifact definition for this type
			const artifactDefinition = artifactDefinitions.find(
				(definition) => definition.kind === deltaType,
			);

			console.log(
				'DataStreamHandler - Found artifact definition:',
				!!artifactDefinition,
				artifactDefinition?.kind,
			);

			if (!artifactDefinition) {
				console.log(
					'DataStreamHandler - No artifact definition found for type:',
					deltaType,
				);
				continue;
			}

			// Update the artifact
			setArtifact((draftArtifact) => {
				if (delta.status === 'started') {
					// Special handling for artifact replacement scenarios
					const isReplacingApprovalWithExecution =
						deltaType === 'tool-execution' &&
						draftArtifact.kind === 'tool-call-approval';

					if (isReplacingApprovalWithExecution) {
						console.log(
							'DataStreamHandler - Replacing tool approval with execution artifact',
						);
						// Completely replace the approval artifact with execution
						return {
							documentId: delta.runId as string,
							content: '',
							kind: deltaType,
							title: '',
							timestamp: Date.now(),
							status: 'streaming',
							isVisible: true,
							boundingBox: {
								top: 0,
								left: 0,
								width: 0,
								height: 0,
							},
						};
					}

					// Standard new artifact creation
					return {
						...draftArtifact,
						documentId: delta.runId as string,
						kind: deltaType,
						isVisible: true,
						status: 'streaming',
					};
				}

				// Set status to idle when complete, or streaming when in-progress
				const newStatus =
					delta.status === 'complete' || delta.status === 'completed'
						? 'idle'
						: 'streaming';
				return {
					...draftArtifact,
					status: newStatus,
				};
			});

			if (delta.status === 'started') {
				// Check if we need to initialize or reset metadata
				const isReplacingApprovalWithExecution =
					deltaType === 'tool-execution' &&
					artifact.kind === 'tool-call-approval';

				if (!metadata || isReplacingApprovalWithExecution) {
					// Clear any existing metadata when replacing artifacts
					if (isReplacingApprovalWithExecution) {
						console.log(
							'DataStreamHandler - Clearing metadata for artifact replacement',
						);
						setMetadata(undefined);
					}

					artifactDefinition.initialize?.({
						documentId: delta.runId as string,
						setMetadata,
					});
				}
			}

			if (artifactDefinition.onStreamPart) {
				console.log(
					'DataStreamHandler - Calling onStreamPart for:',
					artifactDefinition.kind,
				);
				// Call the onStreamPart method of the artifact definition
				artifactDefinition.onStreamPart({
					streamPart: delta as DataStreamDelta,
					setArtifact,
					setMetadata,
				});
			}
		}
	}, [dataStream, setArtifact, artifact, metadata, setMetadata]);

	return null;
}

interface ArtifactProps {
	message: UIMessage;
	chatId: string;
	openArtifact: (artifactId: string, artifactData: string) => void;
}

function PureArtifactComponent(props: ArtifactProps) {
	const messageId = props.message.id.startsWith('msg-')
		? props.message.id
		: undefined;
	const { artifact, metadata } = useArtifact(messageId);
	const [expanded, setExpanded] = useState(true);
	const toggleExpanded = useCallback(() => {
		setExpanded((prev) => !prev);
	}, []);

	useEffect(() => {
		if (artifact.content) {
			props.openArtifact(artifact.documentId, artifact.content);
		}
	}, [artifact.content]);

	if (!artifact || !artifact.isVisible) return null;

	// Find the artifact definition for the current artifact
	const artifactDefinition = artifactDefinitions.find(
		(def) => def.kind === artifact.kind,
	);

	if (!artifactDefinition) return null;

	// Render the artifact using its content component
	return (
		<div className="mt-1 mb-4 flex w-[500px] flex-col flex-wrap items-start group-[.panel-active]:w-full xl:w-[650px]">
			<div className="mb-1 flex w-full items-center justify-between">
				<div className="text-merino-400 dark:text-merino-800 text-xs">
					<span>
						{artifactDefinition.kind === 'text'
							? 'Text'
							: artifactDefinition.kind === 'tool-call-approval'
								? 'Tool Call Approval'
								: artifactDefinition.kind === 'tool-execution'
									? 'Tool Execution'
									: 'Research'}
					</span>
				</div>
				<button
					onClick={toggleExpanded}
					className="text-merino-400 hover:bg-merino-100 hover:text-merino-800 dark:text-merino-800 dark:hover:bg-merino-900 dark:hover:text-merino-100 flex items-center gap-1 rounded-md p-1 text-xs"
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
			<div className={expanded ? 'block w-full' : 'hidden'}>
				<artifactDefinition.content
					content={artifact.content}
					documentId={artifact.documentId}
					metadata={metadata}
					status={artifact.status}
					title={artifact.title || metadata?.title}
					mode="diff"
					isCurrentVersion={true}
					currentVersionIndex={0}
					onSaveContent={() => {}}
					isInline={false}
					getDocumentContentById={() => ''}
					isLoading={false}
					setMetadata={() => {}}
				/>
				{artifact.content && (
					<div
						className={cn(
							'border-border rounded-lg border p-3 transition-all duration-300',
							'bg-merino-50 dark:bg-merino-950',
							'hover:translate-x-1 hover:-translate-y-1 hover:shadow-[-4px_4px_0_hsl(var(--border-color))]',
							artifact.status === 'streaming' &&
								'translate-x-1 -translate-y-1 shadow-[-4px_4px_0_hsl(var(--border-color))]',
						)}
					>
						<div className="flex items-center justify-between">
							<h3 className="text-merino-800 dark:text-merino-200 mr-2 flex-1 truncate text-sm font-bold">
								{artifact.title || 'Research Report'}
							</h3>
							<Button
								variant="outline"
								size="sm"
								className={cn(
									'flex items-center gap-2',
									artifact.status === 'streaming'
										? 'border-merino-600 bg-merino-600 hover:bg-merino-700 text-white'
										: 'border-merino-300 bg-merino-100 text-merino-800 hover:bg-merino-200 dark:border-merino-700 dark:bg-merino-800 dark:text-merino-100 dark:hover:bg-merino-700',
									'min-w-[40px]',
									'report-button',
								)}
								onClick={() => {
									props.openArtifact?.(artifact.documentId, artifact.content);
								}}
								disabled={artifact.status === 'streaming'}
							>
								<FileText className="h-4 w-4 shrink-0" />
								<span className="report-button-text overflow-hidden whitespace-nowrap">
									Open Report
								</span>
								<ExternalLink className="h-3 w-3 shrink-0" />
							</Button>
						</div>
						<p className="text-foreground mt-2 line-clamp-4 text-sm italic">
							<MarkdownRenderer
								content={artifact.content.slice(0, 280).trim() + '...'}
							/>
						</p>
						<span className="text-accent-foreground text-sm italic">
							Open to read the full report.
						</span>
					</div>
				)}
			</div>
		</div>
	);
}

export const ArtifactComponent = memo(PureArtifactComponent);
