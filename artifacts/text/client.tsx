import { Artifact } from '@/components/artifact';
import { CopyIcon } from 'lucide-react';
import { toast } from 'sonner';

interface TextArtifactMetadata {
	text: string;
}

export const textArtifact = new Artifact<
	'text',
	TextArtifactMetadata,
	{
		type: string;
		data: string;
	}
>({
	kind: 'text',
	description: 'Text content from the AI',
	toolbar: [],
	initialize: async ({ setMetadata }) => {
		setMetadata({
			text: '',
		});
	},
	onStreamPart: ({ streamPart, setArtifact }) => {
		if (streamPart.content.type === 'text-delta') {
			setArtifact((artifact) => {
				return {
					...artifact,
					content: (artifact.content || '') + streamPart.content.data,
				};
			});
		}
	},
	content: () => {
		return null;
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
