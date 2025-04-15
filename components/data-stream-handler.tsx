'use client';

import { useChat } from '@ai-sdk/react';
import { memo, useEffect, useRef, useState } from 'react';
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';
import { JSONValue, UIMessage } from 'ai';
import { researchUpdateArtifact } from '@/artifacts/research_update/client';
import { textArtifact } from '@/artifacts/text/client';
import { Artifact, UIArtifact } from '@/components/artifact';

export type DataStreamDelta = {
	type: string;
	content: string | JSONValue;
};

// Register artifacts in the global artifactDefinitions array
// This is done here to avoid circular dependencies

// We'll populate this from outside to avoid circular dependencies
export const artifactDefinitions: Array<Artifact<any, any>> = [];
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
		const newDeltas = dataStream
			.slice(lastProcessedIndex.current + 1)
			.filter(
				(data) =>
					!(typeof data !== 'object' || data === null || !('type' in data)),
			);
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
					streamPart: delta,
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

	if (!artifact || !artifact.isVisible) return null;

	// Find the artifact definition for the current artifact
	const artifactDefinition = artifactDefinitions.find(
		(def) => def.kind === artifact.kind,
	);

	if (!artifactDefinition) return null;

	// Render the artifact using its content component
	return artifactDefinition.content({
		content: artifact.content,
		metadata: metadata,
		status: artifact.status,
	});
}

export const ArtifactComponent = memo(PureArtifactComponent);
