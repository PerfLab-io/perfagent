import type React from 'react';
import { cn } from '@/lib/utils';

interface InsightCardProps {
	title: string;
	value: string | number;
	icon: React.ReactNode;
	status?: 'good' | 'warning' | 'critical' | 'neutral';
	className?: string;
	children?: React.ReactNode;
}

export function FileInsightCard({
	title,
	value,
	icon,
	status = 'neutral',
	className,
	children,
}: InsightCardProps) {
	// Enhanced status colors with better contrast
	const statusColors = {
		good: 'text-green-600 dark:text-green-400',
		warning: 'text-amber-600 dark:text-amber-400',
		critical: 'text-red-600 dark:text-red-400',
		neutral: 'text-blue-600 dark:text-blue-400',
	};

	// Enhanced background colors for the icon
	const iconBgColors = {
		good: 'bg-green-100 dark:bg-green-900/40',
		warning: 'bg-amber-100 dark:bg-amber-900/40',
		critical: 'bg-red-100 dark:bg-red-900/40',
		neutral: 'bg-blue-100 dark:bg-blue-900/40',
	};

	return (
		<div
			className={cn(
				'border-peppermint-200 dark:border-peppermint-800 dark:bg-peppermint-950/30 rounded-lg border bg-white',
				'transition-all duration-300 hover:translate-x-1 hover:-translate-y-1 hover:shadow-[-4px_4px_0_hsl(var(--border-color))]',
				'metric-context-appear p-3',
				'flex flex-col gap-2',
				className,
			)}
		>
			<div className="mb-2 flex items-center justify-between">
				<span className="text-peppermint-700 dark:text-peppermint-300 text-xs font-medium">
					{title}
				</span>
				<div
					className={cn(
						'rounded-full p-1.5',
						iconBgColors[status],
						statusColors[status],
					)}
				>
					{icon}
				</div>
			</div>
			<div className="flex items-baseline">
				<span className={cn('text-lg font-bold', statusColors[status])}>
					{value}
				</span>
			</div>
			{children}
		</div>
	);
}
