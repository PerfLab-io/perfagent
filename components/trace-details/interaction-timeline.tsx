import { cn } from '@/lib/utils';

interface TimelineEvent {
	type: string;
	startTime: number;
	duration: number;
	color: string;
}

interface InteractionTimelineProps {
	events: TimelineEvent[];
	totalDuration: number;
	className?: string;
}

export function InteractionTimeline({
	events,
	totalDuration,
	className,
}: InteractionTimelineProps) {
	return (
		<div
			className={cn(
				'relative h-8 w-full overflow-hidden rounded bg-peppermint-100 dark:bg-peppermint-900/40',
				className,
			)}
		>
			{events.map((event, index) => {
				const left = `${(event.startTime / totalDuration) * 100}%`;
				const width = `${(event.duration / totalDuration) * 100}%`;

				return (
					<div
						key={index}
						className={cn('absolute h-full', event.color)}
						style={{
							left,
							width,
						}}
						title={`${event.type}: ${event.duration.toFixed(1)}ms`}
					/>
				);
			})}
		</div>
	);
}
