import { Artifact } from '@/components/artifact';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { CopyIcon } from 'lucide-react';
import { toast } from 'sonner';

interface TextArtifactMetadata {
	text: string;
}

export const textArtifact = new Artifact<'text', TextArtifactMetadata>({
	kind: 'text',
	description: 'Text content from the AI',
	initialize: async ({ documentId, setMetadata }) => {
		setMetadata({
			text: '',
		});
	},
	onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
		if (streamPart.type === 'text-delta') {
			setMetadata((metadata) => {
				return {
					text: (metadata.text || '') + (streamPart.content as string),
				};
			});

			setArtifact((draftArtifact) => {
				return {
					...draftArtifact,
					content:
						(draftArtifact.content || '') + (streamPart.content as string),
					isVisible: true,
					status: 'streaming',
				};
			});
		}
	},
	content: ({ content, metadata }) => {
		return (
			<div className="w-full overflow-auto p-4">
				<MarkdownRenderer content={content || metadata?.text || ''} />
			</div>
		);
	},
	actions: [
		{
			icon: <CopyIcon size={18} />,
			description: 'Copy to clipboard',
			onClick: ({ content, metadata }) => {
				const textToCopy = content || metadata?.text || '';
				navigator.clipboard.writeText(textToCopy);
				toast.success('Copied to clipboard!');
			},
		},
	],
});
