import { Artifact } from '@/components/artifact';
import { ResearchCard } from '@/components/research-card';
export interface ResearchUpdateArtifactMetadata {
	query: string;
	annotations: any[];
	report?: string;
	researchId: string;
	completed: boolean;
}

export const researchUpdateArtifact = new Artifact<
	'research_update',
	ResearchUpdateArtifactMetadata
>({
	kind: 'research_update',
	description: 'Research updates from the AI agent',
	initialize: async ({ documentId, setMetadata }) => {
		console.log('initialize', documentId);
	},
	onStreamPart: ({ streamPart, setMetadata }) => {
		if (streamPart.type === 'research_update') {
			setMetadata((draftArtifact) => {
				if (!draftArtifact) {
					return {
						isVisible: true,
						query: streamPart.content.query,
						researchId: streamPart.content.id,
						annotations: [(streamPart.content as any).data],
						completed: false,
					};
				}

				const newAnnotations = [...(draftArtifact.annotations || [])];
				let report = draftArtifact.report || '';

				if (streamPart.content.type === 'text-delta') {
					report += streamPart.content.data;
				} else {
					newAnnotations.push((streamPart.content as any).data);
				}

				const completed =
					(streamPart.content as any)?.data?.type === 'research_plan' &&
					(streamPart.content as any)?.data?.status === 'complete';

				return {
					...draftArtifact,
					query: streamPart.content.query,
					researchId: streamPart.content.id,
					annotations: newAnnotations,
					completed,
					report,
				};
			});
		}
	},
	content: (props) => {
		const { metadata } = props;
		if (!metadata) {
			return null;
		}

		return (
			<ResearchCard query={metadata.query || 'Research'} artifact={metadata} />
		);
	},
	actions: [],
});
