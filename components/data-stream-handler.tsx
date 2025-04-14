'use client';

import { useChat } from '@ai-sdk/react';
import { memo, useEffect, useRef } from 'react';
import { useArtifact } from '@/hooks/use-artifact';
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

interface ArtifactProps {
	message: UIMessage;
	chatId: string;
}

function PureArtifactComponent(props: ArtifactProps) {
	const { data: dataStream, messages } = useChat({
		api: '/api/chat',
		experimental_throttle: 500,
		id: props.chatId,
	});
	const { artifact, setArtifact, metadata, setMetadata } = useArtifact(
		props.message.id,
	);
	const lastProcessedIndex = useRef(-1);

	useEffect(() => {
		if (!dataStream?.length) return;
		// Since the data stream is 'global' according to the chatId
		// we need to check if we are processing information about the message that the artifact is attached to
		// This will need to be updated if we need to support re-runs or edits for artifacts
		if (messages.at(-1)?.id !== props.message.id) return;

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
				(definition) => definition.kind === deltaType,
			);

			if (!artifactDefinition) {
				console.log('NO ARTIFACT DEFINITION FOUND FOR', deltaType);
				continue;
			}

			// Update the artifact
			setArtifact((draftArtifact) => {
				if ((delta.content as any).data?.status === 'started') {
					console.log('INITIALIZING ARTIFACT', delta.runId);
					return {
						...draftArtifact,
						documentId: delta.runId as string,
						kind: deltaType,
						isVisible: true,
					};
				}

				console.log(draftArtifact, 'DRAFT ARTIFACT');

				return {
					...draftArtifact,
					status: 'streaming',
				};
			});

			if ((delta.content as any).data?.status === 'started' && !metadata) {
				console.log('INITIALIZING ARTIFACT');
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
	}, [
		dataStream,
		setArtifact,
		artifact,
		metadata,
		setMetadata,
		props.chatId,
		messages.at(-1)?.id,
	]);

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
