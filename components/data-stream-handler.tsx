'use client';

import { useChat } from '@ai-sdk/react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';
import { JSONValue, UIMessage } from 'ai';
import { researchUpdateArtifact } from '@/artifacts/research_update/client';
import { textArtifact } from '@/artifacts/text/client';
import { Artifact, UIArtifact } from '@/components/artifact';
import { ChevronDown, ChevronUp } from 'lucide-react';

export type DataStreamDelta<T extends JSONValue = NonNullable<JSONValue>> = {
	type: string;
	content: T;
	runId: string;
};

// Register artifacts in the global artifactDefinitions array
// This is done here to avoid circular dependencies

// We'll populate this from outside to avoid circular dependencies
export const artifactDefinitions: Array<Artifact<any, any, any>> = [];
artifactDefinitions.push(textArtifact, researchUpdateArtifact);

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

			// Find the artifact definition for this type
			const artifactDefinition = artifactDefinitions.find(
				(definition) => definition.kind === deltaType,
			);

			if (!artifactDefinition) {
				continue;
			}

			// Update the artifact
			setArtifact((draftArtifact) => {
				if ((delta.content as any).data?.status === 'started') {
					return {
						...draftArtifact,
						documentId: delta.runId as string,
						kind: deltaType,
						isVisible: true,
					};
				}

				return {
					...draftArtifact,
					status: 'streaming',
				};
			});

			if ((delta.content as any).data?.status === 'started' && !metadata) {
				artifactDefinition.initialize?.({
					documentId: delta.runId as string,
					setMetadata,
				});
			}

			if (artifactDefinition.onStreamPart) {
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

	if (!artifact || !artifact.isVisible) return null;

	// Find the artifact definition for the current artifact
	const artifactDefinition = artifactDefinitions.find(
		(def) => def.kind === artifact.kind,
	);

	if (!artifactDefinition) return null;

	// Render the artifact using its content component
	return (
		<div className="mb-4 mt-1 flex w-[500px] flex-col flex-wrap items-start xl:w-[650px]">
			<div className="mb-1 flex w-full items-center justify-between">
				<div className="text-xs text-merino-400 dark:text-merino-800">
					<span>
						{artifactDefinition.kind === 'text' ? 'Text' : 'Research'}
					</span>
				</div>
				<button
					onClick={toggleExpanded}
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
			<div className={expanded ? 'block w-full' : 'hidden'}>
				<artifactDefinition.content
					content={artifact.content}
					documentId={artifact.documentId}
					metadata={metadata}
					status={artifact.status}
					title={artifact.title}
					mode="diff"
					isCurrentVersion={true}
					currentVersionIndex={0}
					onSaveContent={() => {}}
					isInline={false}
					getDocumentContentById={() => ''}
					isLoading={false}
					setMetadata={() => {}}
				/>
			</div>
		</div>
	);
}

export const ArtifactComponent = memo(PureArtifactComponent);
