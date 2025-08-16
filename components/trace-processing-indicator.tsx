import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TraceProcessingIndicatorProps {
	isProcessing: boolean;
	progress: {
		phase: string;
		percentage: number;
	} | null;
	className?: string;
}

export const TraceProcessingIndicator = ({
	isProcessing,
	progress,
	className,
}: TraceProcessingIndicatorProps) => {
	if (!isProcessing) return null;

	return (
		<div
			className={cn(
				'bg-background/50 border-border/50 flex items-center gap-3 rounded-lg border p-3',
				'backdrop-blur-sm',
				className,
			)}
		>
			<Loader2 className="text-peppermint-700 h-4 w-4 animate-spin" />
			<div className="flex-1">
				<p className="text-foreground text-sm font-medium">
					{progress?.phase || 'Processing trace...'}
				</p>
				{progress?.percentage !== undefined && (
					<div className="bg-secondary mt-1 h-1.5 w-full overflow-hidden rounded-full">
						<div
							className="bg-peppermint-700 h-full transition-all duration-300"
							style={{ width: `${progress.percentage}%` }}
						/>
					</div>
				)}
			</div>
		</div>
	);
};
