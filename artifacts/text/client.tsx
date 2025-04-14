import { Artifact } from '@/components/artifact';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
		if (streamPart.content.type === 'text-delta') {
			setMetadata((metadata) => {
				return {
					text: (metadata?.text || '') + (streamPart.content as any).data,
				};
			});
		}
	},
	content: ({ content, metadata }) => {
		return (
			<Card className="mb-4 w-full overflow-auto p-4">
				<CardContent>
					<MarkdownRenderer content={content || metadata?.text || ''} />
				</CardContent>
			</Card>
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
