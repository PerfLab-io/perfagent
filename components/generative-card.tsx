'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeedbackButtons } from '@/components/feedback-buttons';

/**
 * Types and Interfaces
 */

/**
 * Data structure for course distribution
 * @property {number} beginner - Number of beginner courses
 * @property {number} intermediate - Number of intermediate courses
 * @property {number} advanced - Number of advanced courses
 */
interface CourseDistribution {
	beginner: number;
	intermediate: number;
	advanced: number;
}

/**
 * Annotation data structure
 * @property {string} [status] - Current status of the annotation
 * @property {boolean} [isComplete] - Whether the annotation is complete
 * @property {number} [progress] - Progress percentage of the annotation
 */
interface AnnotationData {
	status?: string;
	isComplete?: boolean;
	progress?: number;
}

/**
 * Annotation structure
 * @property {string} type - Type of annotation
 * @property {AnnotationData} [data] - Additional data for the annotation
 */
interface Annotation {
	type: string;
	data?: AnnotationData;
}

/**
 * Props for GenerativeCard component
 */
interface GenerativeCardProps {
	/** Title of the card */
	title: string;
	/** Course distribution data */
	data: CourseDistribution;
	/** Whether to trigger animation */
	triggerAnimation: boolean;
	/** Whether data is still streaming */
	isStreaming?: boolean;
	/** Callback to abort the operation */
	onAbort?: () => void;
	/** ID for the tool call */
	toolCallId?: string | null;
	/** Annotations for the breakdown */
	annotations?: Annotation[];
	/** Whether the operation was cancelled */
	isCancelled?: boolean;
}

/**
 * Constants for colors and other configuration
 */
const COLORS = {
	beginner: 'bg-peppermint-400',
	intermediate: 'bg-indigo-500',
	advanced: 'bg-merino-500',
};

const STROKE_COLORS = {
	beginner: 'text-peppermint-400',
	intermediate: 'text-indigo-500',
	advanced: 'text-merino-500',
};

/**
 * Calculates total courses and percentage distribution
 * @param data Course distribution data
 * @returns Object containing total courses and percentages
 */
const useDistributionStats = (data: CourseDistribution) => {
	return useMemo(() => {
		const total = data.beginner + data.intermediate + data.advanced;

		return {
			total,
			percentages: {
				beginner: Math.round((data.beginner / total) * 100),
				intermediate: Math.round((data.intermediate / total) * 100),
				advanced: Math.round((data.advanced / total) * 100),
			},
		};
	}, [data.beginner, data.intermediate, data.advanced]);
};

/**
 * Calculates donut chart segments based on percentages
 * @param percentages Percentage data for each category
 * @returns Segment data for the donut chart
 */
const useChartSegments = (percentages: {
	beginner: number;
	intermediate: number;
	advanced: number;
}) => {
	return useMemo(() => {
		const circumference = 2.51; // Adjusted circumference factor for the circle
		return {
			beginner: {
				dasharray: `${percentages.beginner * circumference} ${100 * circumference}`,
				dashoffset: '0',
			},
			intermediate: {
				dasharray: `${percentages.intermediate * circumference} ${100 * circumference}`,
				dashoffset: `${-percentages.beginner * circumference}`,
			},
			advanced: {
				dasharray: `${percentages.advanced * circumference} ${100 * circumference}`,
				dashoffset: `${-(percentages.beginner + percentages.intermediate) * circumference}`,
			},
		};
	}, [percentages]);
};

/**
 * Legend Item Component for displaying category information
 */
const LegendItem = ({
	color,
	label,
	count,
	percentage,
}: {
	color: string;
	label: string;
	count: number;
	percentage: number;
}) => (
	<div className="flex items-center justify-between">
		<div className="flex items-center">
			<div className={cn('mr-2 h-3 w-3 rounded-full', color)}></div>
			<span className="text-sm">{label}</span>
		</div>
		<span className="text-sm font-medium">
			{count} courses ({percentage}%)
		</span>
	</div>
);

/**
 * Loading Skeleton Component
 */
const LoadingSkeleton = () => (
	<div className="space-y-3">
		<Skeleton className="mx-auto h-32 w-32 rounded-full" />
		<Skeleton className="h-4 w-full" />
		<Skeleton className="h-4 w-5/6" />
		<Skeleton className="h-4 w-2/3" />
	</div>
);

/**
 * Donut Chart Component for visualizing course distribution
 */
export const DonutChart = ({
	data,
	visible,
}: {
	data: CourseDistribution;
	visible: boolean;
}) => {
	const { total, percentages } = useDistributionStats(data);
	const segments = useChartSegments(percentages);

	return (
		<div className="relative mx-auto h-32 w-32">
			<svg
				className="h-full w-full"
				viewBox="0 0 100 100"
				aria-label={`Donut chart showing ${total} courses: ${data.beginner} beginner, ${data.intermediate} intermediate, and ${data.advanced} advanced`}
				role="img"
			>
				{/* Background circle */}
				<circle
					className="stroke-current text-muted"
					strokeWidth="12"
					cx="50"
					cy="50"
					r="40"
					fill="transparent"
				/>

				{/* Beginner segment - Peppermint */}
				<circle
					className={cn(
						'stroke-current',
						STROKE_COLORS.beginner,
						'transition-all duration-1000',
						visible ? 'opacity-100' : 'opacity-0',
					)}
					strokeWidth="12"
					strokeDasharray={segments.beginner.dasharray}
					strokeDashoffset={segments.beginner.dashoffset}
					strokeLinecap="round"
					cx="50"
					cy="50"
					r="40"
					fill="transparent"
					style={{
						transformOrigin: 'center',
						transform: 'rotate(-90deg)',
						transition: 'stroke-dasharray 1.5s ease',
					}}
					aria-label={`Beginner: ${data.beginner} courses (${percentages.beginner}%)`}
				/>

				{/* Intermediate segment - Indigo */}
				<circle
					className={cn(
						'stroke-current',
						STROKE_COLORS.intermediate,
						'transition-all duration-1000',
						visible ? 'opacity-100' : 'opacity-0',
					)}
					strokeWidth="12"
					strokeDasharray={segments.intermediate.dasharray}
					strokeDashoffset={segments.intermediate.dashoffset}
					strokeLinecap="round"
					cx="50"
					cy="50"
					r="40"
					fill="transparent"
					style={{
						transformOrigin: 'center',
						transform: 'rotate(-90deg)',
						transition:
							'stroke-dasharray 1.5s ease, stroke-dashoffset 1.5s ease',
					}}
					aria-label={`Intermediate: ${data.intermediate} courses (${percentages.intermediate}%)`}
				/>

				{/* Advanced segment - Merino */}
				<circle
					className={cn(
						'stroke-current',
						STROKE_COLORS.advanced,
						'transition-all duration-1000',
						visible ? 'opacity-100' : 'opacity-0',
					)}
					strokeWidth="12"
					strokeDasharray={segments.advanced.dasharray}
					strokeDashoffset={segments.advanced.dashoffset}
					strokeLinecap="round"
					cx="50"
					cy="50"
					r="40"
					fill="transparent"
					style={{
						transformOrigin: 'center',
						transform: 'rotate(-90deg)',
						transition:
							'stroke-dasharray 1.5s ease, stroke-dashoffset 1.5s ease',
					}}
					aria-label={`Advanced: ${data.advanced} courses (${percentages.advanced}%)`}
				/>

				{/* Center text */}
				<text
					x="50"
					y="50"
					dominantBaseline="middle"
					textAnchor="middle"
					className={cn(
						'fill-foreground text-sm font-medium transition-all duration-500',
						visible ? 'opacity-100' : 'opacity-0',
					)}
				>
					{total}
				</text>
				<text
					x="50"
					y="60"
					dominantBaseline="middle"
					textAnchor="middle"
					className={cn(
						'fill-foreground text-xs opacity-70 transition-all duration-500',
						visible ? 'opacity-70' : 'opacity-0',
					)}
				>
					courses
				</text>
			</svg>
		</div>
	);
};

/**
 * GenerativeCard Component for displaying course distribution with animated donut chart
 */
export function GenerativeCard({
	title,
	data,
	triggerAnimation,
	isStreaming = false,
	onAbort,
	annotations = [],
	isCancelled = false,
}: GenerativeCardProps) {
	const [showChart, setShowChart] = useState(false);
	const { total, percentages } = useDistributionStats(data);

	// Determine chart state from annotations
	const isComplete = useMemo(
		() =>
			annotations.some(
				(a) => a.data?.status === 'completed' && a.data?.isComplete,
			),
		[annotations],
	);

	const isLoading = useMemo(
		() => isStreaming && !isComplete && !isCancelled,
		[isStreaming, isComplete, isCancelled],
	);

	// Generate feedback ID
	const feedbackId = useMemo(
		() => `breakdown-${title.replace(/\s+/g, '-').toLowerCase()}`,
		[title],
	);

	// Show chart when data is available and not loading, or when complete, and not cancelled
	useEffect(() => {
		if (isCancelled) {
			setShowChart(false);
		} else if (isComplete) {
			setShowChart(true);
		} else if (triggerAnimation && !isLoading) {
			setShowChart(true);
		}
	}, [triggerAnimation, isLoading, isComplete, isCancelled]);

	// Card container classes
	const cardClasses = cn(
		'group relative mt-4 w-full max-w-sm rounded-xl border-border bg-background transition-all duration-300 hover:-translate-y-1 hover:translate-x-1 hover:shadow-[-8px_8px_0_hsl(var(--border-color))]',
		isLoading
			? '-translate-y-1 translate-x-1 shadow-[-8px_8px_0_hsl(var(--border-color))]'
			: '',
	);

	// Legend container classes
	const legendClasses = cn(
		'mt-4 space-y-2 transition-all duration-500',
		showChart ? 'opacity-100' : 'opacity-0',
	);

	return (
		<Card className={cardClasses}>
			<CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
				<CardTitle className="text-lg font-bold text-foreground">
					{isLoading && !isCancelled ? (
						<Skeleton className="h-6 w-3/4" />
					) : (
						title
					)}
				</CardTitle>

				<div className="flex items-center gap-2">
					{/* Cancel button - only show when streaming and not cancelled */}
					{isStreaming && onAbort && !isCancelled && (
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 rounded-full border-destructive hover:bg-destructive/10 hover:text-destructive"
							onClick={onAbort}
							title="Cancel breakdown"
							aria-label="Cancel breakdown"
						>
							<X className="h-4 w-4" />
							<span className="sr-only">Cancel breakdown</span>
						</Button>
					)}

					{/* Feedback buttons - only show when complete */}
					{!isLoading && !isCancelled && showChart && (
						<FeedbackButtons messageId={feedbackId} source="breakdown" />
					)}
				</div>
			</CardHeader>

			<CardContent className="p-4 pt-2">
				{isLoading && !isCancelled ? (
					<LoadingSkeleton />
				) : (
					<div className="space-y-4">
						{/* Donut Chart */}
						<DonutChart data={data} visible={showChart} />

						{/* Legend */}
						<div className={legendClasses}>
							<LegendItem
								color={COLORS.beginner}
								label="Beginner"
								count={data.beginner}
								percentage={percentages.beginner}
							/>

							<LegendItem
								color={COLORS.intermediate}
								label="Intermediate"
								count={data.intermediate}
								percentage={percentages.intermediate}
							/>

							<LegendItem
								color={COLORS.advanced}
								label="Advanced"
								count={data.advanced}
								percentage={percentages.advanced}
							/>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
