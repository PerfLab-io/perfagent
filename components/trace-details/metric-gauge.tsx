import { cn } from '@/lib/utils';
import { LinePattern } from '../line-pattern';
import { msOrSDisplay } from '@/lib/trace';
import { MetricType } from '@/lib/insights';

type MetricStatus = 'good' | 'needs-improvement' | 'poor';

interface MetricGaugeProps {
	value: number;
	metricType: MetricType;
	thresholds: {
		good: number;
		needsImprovement: number;
	};
	unit?: string;
	className?: string;
}

export function MetricGauge({
	value,
	metricType,
	thresholds,
	unit = '',
	className,
}: MetricGaugeProps) {
	// Determine which section the value falls into
	let status: MetricStatus = 'good';
	if (value > thresholds.needsImprovement) {
		status = 'poor';
	} else if (value > thresholds.good) {
		status = 'needs-improvement';
	}

	// Format the threshold values based on metric type
	const formatValue = (val: number) => {
		if (metricType === MetricType.TIME) {
			return msOrSDisplay(val);
		}
		return val.toFixed(2);
	};

	return (
		<div className={cn('mt-2 gap-1 pb-10 text-xs', className)}>
			<div className="flex h-5 w-full">
				{/* Good section */}
				<div
					className={cn(
						'relative flex w-1/3 items-center justify-center overflow-hidden rounded-l-md bg-green-500 dark:bg-green-600',
						status !== 'good' && 'opacity-40',
					)}
				>
					<span className="text-xs text-green-100">Good</span>
					{status !== 'good' && (
						<LinePattern
							id={`gauge-${metricType}-${status}-${unit}-lines-good`}
						/>
					)}
				</div>
				<div className="relative flex h-full w-0.5 justify-center bg-white">
					<div className="absolute h-8 w-0.5 bg-slate-500 dark:bg-slate-300" />
					<div className="absolute h-full w-0.5 bg-white" />
					<div className="absolute top-8 text-xs text-slate-500 dark:text-slate-300">
						{formatValue(thresholds.good)}
						{unit}
					</div>
				</div>
				{/* Needs improvement section */}
				<div
					className={cn(
						'relative flex w-1/3 items-center justify-center bg-amber-200 dark:bg-amber-600',
						status !== 'needs-improvement' && 'opacity-40',
					)}
				>
					<span className="truncate px-2 text-xs text-amber-700">
						Needs Improvement
					</span>
					{status !== 'needs-improvement' && (
						<LinePattern
							id={`gauge-${metricType}-${status}-${unit}-lines-needs-improvement`}
						/>
					)}
				</div>
				<div className="relative flex h-full w-0.5 justify-center bg-white">
					<div className="absolute h-8 w-0.5 bg-slate-500 dark:bg-slate-300" />
					<div className="absolute h-full w-0.5 bg-white" />
					<div className="absolute top-8 text-xs text-slate-500 dark:text-slate-300">
						{formatValue(thresholds.needsImprovement)}
						{unit}
					</div>
				</div>
				{/* Poor section */}
				<div
					className={cn(
						'relative flex w-1/3 items-center justify-center overflow-hidden rounded-r-md bg-red-500 dark:bg-red-600',
						status !== 'poor' && 'opacity-40',
					)}
				>
					<span className="text-xs text-red-100">Poor</span>
					{status !== 'poor' && (
						<LinePattern
							id={`gauge-${metricType}-${status}-${unit}-lines-poor`}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
