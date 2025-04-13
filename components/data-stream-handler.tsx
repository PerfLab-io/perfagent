'use client';

import { useChat } from '@ai-sdk/react';
import { memo, useEffect, useRef } from 'react';
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';
import { JSONValue, UIMessage } from 'ai';
import { researchUpdateArtifact } from '@/artifacts/research_update/client';
import { textArtifact } from '@/artifacts/text/client';
import { Artifact } from '@/components/artifact';

export type DataStreamDelta = {
	type: string;
	content: string | JSONValue;
};

// Register artifacts in the global artifactDefinitions array
// This is done here to avoid circular dependencies

// We'll populate this from outside to avoid circular dependencies
export const artifactDefinitions: Array<Artifact<any, any>> = [];
artifactDefinitions.push(textArtifact, researchUpdateArtifact);

export function DataStreamHandler({ chatId }: { chatId?: string }) {
	const { data: dataStream } = useChat({
		api: '/api/chat',
		experimental_throttle: 500,
		id: chatId,
	});
	const { artifact, setArtifact, setMetadata } = useArtifact();
	const lastProcessedIndex = useRef(-1);

	useEffect(() => {
		if (!dataStream?.length) return;

		// Process the data that hasn't been processed yet
		const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
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
				(definition) => definition.kind === artifact.kind,
			);

			if (artifactDefinition?.onStreamPart) {
				// Call the onStreamPart method of the artifact definition
				artifactDefinition.onStreamPart({
					streamPart: delta,
					setArtifact,
					setMetadata,
				});
			}

			// Update the artifact
			setArtifact((draftArtifact) => {
				if (!draftArtifact) return { ...initialArtifactData };

				if (draftArtifact.documentId === 'init') {
					return {
						...initialArtifactData,
						documentId: chatId || 'current-chat',
						kind: deltaType as any,
						status: 'streaming',
						isVisible: true,
					};
				}

				return {
					...draftArtifact,
					status: 'streaming',
				};
			});
		}
	}, [dataStream, setArtifact, setMetadata, chatId]);

	return null;
}

interface ArtifactProps {
	message: UIMessage;
}

function PureArtifactComponent({ message }: ArtifactProps) {
	const { artifact, metadata } = useArtifact();

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
