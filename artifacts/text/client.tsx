import { Artifact } from '@/components/artifact';
import { CheckCircle, CopyIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TextArtifactMetadata {
	title?: string;
	message?: string;
	status?: string;
	timestamp?: Date;
	type?: string;
}

export const textArtifact = new Artifact<
	'text',
	TextArtifactMetadata,
	{
		type: string;
		data: any;
	}
>({
	kind: 'text',
	description: 'Text content from the AI',
	toolbar: [],
	initialize: async ({ setMetadata }) => {
		setMetadata({});
	},
	onStreamPart: ({ streamPart, setArtifact, setMetadata }) => {
		if (streamPart.content.type === 'text-delta') {
			setArtifact((artifact) => {
				return {
					...artifact,
					content: (artifact.content || '') + streamPart.content.data,
				};
			});
		} else if (
			streamPart.status === 'in-progress' ||
			streamPart.status === 'started' ||
			streamPart.status === 'complete'
		) {
			setMetadata((metadata) => {
				return {
					...metadata,
					status: streamPart.status,
					...streamPart.content.data,
					timestamp:
						streamPart.content.data.timestamp ??
						new Date(streamPart.content.data.timestamp),
				};
			});
		}
	},
	content: ({ metadata }) => {
		console.log('metadata', metadata);
		if (!metadata) {
			return null;
		}

		// Get status-based styling
		const getStatusColor = (status?: string) => {
			const statusColors = {
				complete:
					'bg-peppermint-100 text-peppermint-800 dark:bg-peppermint-800 dark:text-peppermint-100',
				'in-progress':
					'bg-midnight-100 text-midnight-800 dark:bg-midnight-800 dark:text-midnight-100',
				started:
					'bg-merino-100 text-merino-800 dark:bg-merino-800 dark:text-merino-100',
				default: 'bg-muted text-muted-foreground',
			};

			return (
				statusColors[status as keyof typeof statusColors] ||
				statusColors.default
			);
		};

		return (
			<div className="mb-4 w-full space-y-2">
				{metadata.message && (
					<div
						className={cn(
							'border-border text-foreground relative rounded-lg border bg-white p-3 transition-all duration-300',
						)}
					>
						<div className="flex items-center justify-between">
							{metadata.title && (
								<h3 className="font-medium">{metadata.title}</h3>
							)}
							<div className="flex items-center">
								{metadata.status && (
									<div
										className={cn(
											'flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
											getStatusColor(metadata.status),
										)}
									>
										{metadata.status === 'in-progress' ||
										metadata.status === 'started' ? (
											<div className="animate-spin">
												<Loader2 className="h-4 w-4" />
											</div>
										) : (
											<CheckCircle className="h-4 w-4" />
										)}
										{metadata.status === 'complete'
											? 'Complete'
											: metadata.status === 'in-progress'
												? 'In Progress'
												: 'Started'}
									</div>
								)}
							</div>
						</div>
						<div className="mt-2 text-sm">{metadata.message}</div>
					</div>
				)}
			</div>
		);
	},
	actions: [
		{
			icon: <CopyIcon size={18} />,
			description: 'Copy to clipboard',
			onClick: ({ content, metadata }) => {
				const textToCopy = content || metadata?.message || '';
				navigator.clipboard.writeText(textToCopy);
				toast.success('Copied to clipboard!');
			},
		},
	],
});
