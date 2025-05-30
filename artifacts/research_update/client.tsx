import { Artifact } from '@/components/artifact';
import { ResearchCard } from '@/components/research-card';
import { ArtifactStreamData } from '@/lib/ai/mastra/workflows/researchWorkflow';
import { z } from 'zod';
export interface ResearchUpdateArtifactMetadata {
	query: string;
	annotations: any[];
	completed: boolean;
	title?: string;
}

export const researchUpdateArtifact = new Artifact<
	'research_update',
	ResearchUpdateArtifactMetadata,
	z.infer<typeof ArtifactStreamData>['content']
>({
	kind: 'research_update',
	description: 'Research updates from the AI agent',
	toolbar: [],
	initialize: async ({ documentId, setMetadata }) => {
		console.log('initialize', documentId);
	},
	onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
		if (streamPart.type === 'research_update') {
			setMetadata((draftArtifact) => {
				const content = streamPart.content;
				if (!draftArtifact) {
					return {
						isVisible: true,
						query: content.data.query || '',
						annotations: [content.data],
						completed: false,
						title: content.data.title || 'Research Report',
					};
				}

				const newAnnotations = [...(draftArtifact.annotations || [])];

				if (streamPart.content.type === 'text-delta') {
					setArtifact((draftArtifact) => {
						return {
							...draftArtifact,
							title:
								content.data.title || draftArtifact.title || 'Research Report',
							content: (draftArtifact.content || '') + streamPart.content.data,
						};
					});
				} else {
					newAnnotations.push((streamPart.content as any).data);
				}

				const completed =
					(streamPart.content as any)?.data?.type === 'research_plan' &&
					(streamPart.content as any)?.data?.status === 'complete';

				return {
					...draftArtifact,
					query: content.data.query || '',
					annotations: newAnnotations,
					completed,
					title: content.data.title || draftArtifact.title || 'Research Report',
				};
			});
		}
	},
	content: (props) => {
		const { metadata, documentId } = props;
		if (!metadata) {
			return null;
		}

		return (
			<ResearchCard
				query={metadata.query || 'Research'}
				metadata={metadata}
				documentId={documentId}
			/>
		);
	},
	actions: [],
});
