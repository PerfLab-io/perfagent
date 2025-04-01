import { cn } from '@/lib/utils';

interface FrameHistogramProps {
	data: number[];
	maxValue?: number;
	className?: string;
	thresholds?: {
		good: number;
		warning: number;
	};
}

export function FrameHistogram({
	data,
	maxValue = Math.max(...data),
	className,
	thresholds = { good: 200, warning: 500 },
}: FrameHistogramProps) {
	return (
		<div className={cn('flex h-full w-full items-end gap-[1px]', className)}>
			{data.map((value, index) => {
				const height = `${Math.max(Math.min((value / maxValue) * 100, 100), 4)}%`;

				// Determine color based on frame duration
				let color = 'bg-green-500';
				if (value > thresholds.warning) {
					color = 'bg-red-500';
				} else if (value > thresholds.good) {
					color = 'bg-amber-500';
				}

				return (
					<div
						key={index}
						className={cn('flex-1', color)}
						style={{ height }}
						title={`${value.toFixed(1)}ms`}
					/>
				);
			})}
		</div>
	);
}
