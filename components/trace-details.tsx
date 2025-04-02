'use client';

import { useState, useEffect, useMemo } from 'react';
import {
	ChevronDown,
	ChevronRight,
	FileText,
	Image,
	Code,
	File,
	FileCode,
	Layers,
	Clock,
	BarChart3,
	Activity,
	Cpu,
	MousePointer,
	Pointer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileInsightCard } from './trace-details/trace-insight-card';
import { FrameHistogram } from './trace-details/trace-histogram';
import { InsightsReport, MetricScoreClassification } from '@/lib/insights';
import { analyzeEvents, msOrSDisplay, TraceAnalysis } from '@/lib/trace';
import { analyseInsightsForCWV } from '@/lib/insights';
import { InteractionTimeline } from './trace-details/interaction-timeline';
import { microSecondsToMilliSeconds } from '@paulirish/trace_engine/core/platform/Timing';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from './ui/select';
import { SyntheticAnimationFramePair } from '@paulirish/trace_engine/models/trace/types/TraceEvents';
import { Micro } from '@paulirish/trace_engine/models/trace/types/Timing';
interface AttachedFile {
	id: string;
	name: string;
	size: number;
	type: string;
	data: string | ArrayBuffer | null;
}

enum WebVitalsMetric {
	INP = 'Interaction to Next Paint',
	CLS = 'Cumulative Layout Shift',
	LCP = 'Largest Contentful Paint',
}

const WebVitalsMetricIcons = {
	INP: <MousePointer className="h-3.5 w-3.5" />,
	CLS: <Clock className="h-3.5 w-3.5" />,
	LCP: <Activity className="h-3.5 w-3.5" />,
};

interface FileContextSectionProps {
	currentFile: AttachedFile | null;
	isVisible: boolean;
	traceAnalysis: TraceAnalysis | null;
}

export function FileContextSection({
	currentFile,
	isVisible,
	traceAnalysis,
}: FileContextSectionProps) {
	// First, add a max-height to the main container when expanded
	// Add a new state to track the initial animation
	const [isInitialRender, setIsInitialRender] = useState(true);
	const [isExpanded, setIsExpanded] = useState(true);
	const [isAnimating, setIsAnimating] = useState(false);
	const [selectedNavigation, setSelectedNavigation] = useState<string | null>(
		null,
	);

	// Add useEffect to handle the animation sequence
	useEffect(() => {
		if (isVisible && isInitialRender) {
			// Start with the panel closed
			setIsExpanded(false);

			// Set animating state to true
			setIsAnimating(true);

			// After a short delay, mark initial render as complete
			const timer = setTimeout(() => {
				setIsInitialRender(false);
				setIsAnimating(false);
			}, 600); // Animation duration

			return () => clearTimeout(timer);
		}
	}, [isVisible, isInitialRender]);

	console.log({ traceAnalysis }, 'TRACE ANALYSIS');
	if (!traceAnalysis || !true || !currentFile) {
		return null;
	}

	const __insights = Array.from(traceAnalysis.insights.entries()).filter(
		([_, insight]) => insight.url.host !== 'new-tab-page',
	);

	const metrics = analyseInsightsForCWV(
		traceAnalysis.insights,
		traceAnalysis.parsedTrace,
		selectedNavigation || __insights[0][0],
	);

	// Format file size
	const formatFileSize = (bytes: number): string => {
		if (bytes < 1024) return bytes + ' B';
		else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	};

	// Determine file icon based on type
	const getFileIcon = () => {
		const type = currentFile.type;
		if (type.startsWith('image/'))
			return <Image className="h-8 w-8 text-blue-500" />;
		if (type === 'text/plain')
			return <FileText className="h-8 w-8 text-amber-500" />;
		if (type === 'application/json')
			return <Code className="h-8 w-8 text-green-500" />;
		if (type.includes('javascript') || type.includes('typescript'))
			return <FileCode className="h-8 w-8 text-yellow-500" />;
		if (currentFile.name.endsWith('.go'))
			return <FileCode className="h-8 w-8 text-cyan-500" />;
		return <File className="h-8 w-8 text-gray-500" />;
	};

	// Mock frame duration data for histogram
	const frameDurations = [];

	const { animationFrames } = traceAnalysis.parsedTrace.AnimationFrames;
	const LONG_TASK_THRESHOLD = 50 * 1000; // 50ms in microseconds
	const loafs: SyntheticAnimationFramePair[] = [];
	let longestAnimationFrame: SyntheticAnimationFramePair | null = null;

	for (const frame of animationFrames) {
		frameDurations.push(microSecondsToMilliSeconds(frame.dur));
		if (frame.dur > LONG_TASK_THRESHOLD) {
			loafs.push(frame);
		}
		if (frame.dur > (longestAnimationFrame?.dur ?? 0)) {
			longestAnimationFrame = frame;
		}
	}
	const longestAnimationFrameDuration = microSecondsToMilliSeconds(
		longestAnimationFrame?.dur ?? (0 as Micro),
	);

	const { interactionEvents } = traceAnalysis.parsedTrace.UserInteractions;
	const interactionsClassification = interactionEvents.reduce(
		(acc, interaction) => {
			if (interaction.type === 'click') {
				acc.clicks += 1;
			} else if (interaction.type.includes('pointer')) {
				acc.pointers += 1;
			}
			return acc;
		},
		{ clicks: 0, pointers: 0 },
	);

	// Mock timeline events
	const timelineEvents = [
		{ type: 'HTML', startTime: 0, duration: 120, color: 'bg-blue-500/70' },
		{ type: 'CSS', startTime: 100, duration: 180, color: 'bg-purple-500/70' },
		{ type: 'JS', startTime: 250, duration: 350, color: 'bg-yellow-500/70' },
		{ type: 'Images', startTime: 550, duration: 250, color: 'bg-green-500/70' },
		{ type: 'Other', startTime: 750, duration: 150, color: 'bg-gray-500/70' },
	];

	const getMetricVariant = (
		metricScore: MetricScoreClassification | undefined,
	) => {
		switch (metricScore) {
			case MetricScoreClassification.BAD:
				return 'critical';
			case MetricScoreClassification.OK:
				return 'warning';
			default:
				return 'good';
		}
	};

	return (
		<div
			className={cn(
				'z-50 mb-4 overflow-hidden rounded-lg bg-peppermint-50 transition-all duration-300 dark:bg-peppermint-950/30',
				isExpanded
					? 'max-h-[600px] overflow-y-auto border border-peppermint-300 dark:border-peppermint-900'
					: 'max-h-[40px] border border-dashed border-peppermint-300 dark:border-peppermint-900',
				isAnimating &&
					'-translate-y-1 translate-x-1 shadow-[-4px_4px_0_hsl(var(--border-color))]',
				isInitialRender && 'file-context-appear',
			)}
		>
			{/* Header */}
			<div
				className="group sticky top-0 z-10 flex cursor-pointer items-center justify-between bg-peppermint-50 p-2 hover:bg-peppermint-100 dark:bg-peppermint-950/30 dark:hover:bg-peppermint-900/20"
				onClick={() => setIsExpanded(!isExpanded)}
			>
				<div className="flex items-center space-x-2">
					{isExpanded ? (
						<ChevronDown className="h-4 w-4 text-peppermint-700 dark:text-peppermint-300" />
					) : (
						<ChevronRight className="h-4 w-4 text-peppermint-700 dark:text-peppermint-300" />
					)}
					<span className="text-sm font-medium text-peppermint-800 dark:text-peppermint-200">
						Trace Metadata
					</span>
				</div>
				<div className="flex items-center space-x-2">
					<div className="flex items-center space-x-1 rounded border border-peppermint-200 bg-transparent px-2 py-0.5 text-xs group-hover:bg-peppermint-200 dark:bg-peppermint-900/40">
						<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
						<span className="text-peppermint-700 group-hover:text-peppermint-900 dark:text-peppermint-300">
							Processing
						</span>
					</div>
				</div>
			</div>

			{/* Content */}
			{isExpanded && (
				<div className="border-t border-peppermint-200 p-3 dark:border-peppermint-900/50">
					<div className="flex justify-between">
						<div className="flex items-center">
							<div className="flex-shrink-0 rounded border border-peppermint-200 bg-white p-2 dark:border-peppermint-800 dark:bg-peppermint-900/30">
								{getFileIcon()}
							</div>
							<div className="ml-3">
								<h3 className="font-medium text-peppermint-900 dark:text-peppermint-100">
									{currentFile.name}
								</h3>
								<div className="mt-1 flex flex-wrap gap-2">
									<span className="rounded bg-peppermint-200 px-2 py-0.5 text-xs text-peppermint-800 dark:bg-peppermint-900/40 dark:text-peppermint-300">
										URL: {traceAnalysis.parsedTrace.Meta.mainFrameURL}
									</span>
									<span className="rounded bg-peppermint-200 px-2 py-0.5 text-xs text-peppermint-800 dark:bg-peppermint-900/40 dark:text-peppermint-300">
										Navigations:{' '}
										{traceAnalysis.parsedTrace.Meta.mainFrameNavigations.length}
									</span>
									{traceAnalysis.metadata.cpuThrottling && (
										<span className="rounded bg-peppermint-200 px-2 py-0.5 text-xs text-peppermint-800 dark:bg-peppermint-900/40 dark:text-peppermint-300">
											CPU Throttling: {traceAnalysis.metadata.cpuThrottling}x
										</span>
									)}
									{traceAnalysis.metadata.networkThrottling && (
										<span className="rounded bg-peppermint-200 px-2 py-0.5 text-xs text-peppermint-800 dark:bg-peppermint-900/40 dark:text-peppermint-300">
											Network Throttling:{' '}
											{traceAnalysis.metadata.networkThrottling}
										</span>
									)}
									<span className="rounded bg-peppermint-200 px-2 py-0.5 text-xs text-peppermint-800 dark:bg-peppermint-900/40 dark:text-peppermint-300">
										File Size: {formatFileSize(currentFile.size)}
									</span>
								</div>
							</div>
						</div>
						<Select
							value={selectedNavigation || __insights[0][0]}
							onValueChange={setSelectedNavigation}
						>
							<SelectTrigger className="w-48 border border-dashed border-peppermint-400 text-peppermint-800 focus:ring-peppermint-300">
								<SelectValue placeholder="Choose a navigation" />
							</SelectTrigger>
							<SelectContent className="border border-dashed border-peppermint-400 text-peppermint-800 focus:ring-peppermint-300">
								{__insights.map(([navigationId, insight]) => (
									<SelectItem
										className="focus:bg-peppermint-100 focus:text-peppermint-900 dark:focus:bg-peppermint-900/40 dark:focus:text-peppermint-100"
										key={navigationId}
										value={navigationId}
									>
										{insight.url.host}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Core Web Vitals Section - Updated with better visuals */}
					<div className="mt-4">
						<h4 className="mb-2 max-w-96 truncate text-xs font-semibold text-peppermint-800 dark:text-peppermint-200">
							Core Web Vitals for:{' '}
							{
								__insights.find(([nav, _in]) => {
									return nav === selectedNavigation;
								})?.[1]?.url?.href
							}
						</h4>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
							{Object.keys(metrics).map((metric) => {
								const metricValue = metrics[metric as keyof typeof metrics];
								const metricIcon =
									WebVitalsMetricIcons[metric as keyof typeof WebVitalsMetric];

								return (
									<FileInsightCard
										key={`metric-${metric}-${selectedNavigation}`}
										title={
											WebVitalsMetric[metric as keyof typeof WebVitalsMetric]
										}
										value={msOrSDisplay(metricValue?.metricValue || 0)}
										unit="ms"
										icon={metricIcon}
										status={getMetricVariant(metricValue?.metricScore)}
									>
										<div className="mt-1 flex items-center justify-between">
											<div className="flex items-center">
												<div
													className={cn(
														'relative mr-1 h-2 w-2',
														metricValue?.metricScore ===
															MetricScoreClassification.BAD
															? 'bg-red-200'
															: metricValue?.metricScore ===
																  MetricScoreClassification.OK
																? 'bg-amber-200'
																: 'bg-green-200',
													)}
												>
													<svg
														className={cn(
															'absolute inset-0 w-full opacity-50',
															metricValue?.metricScore ===
																MetricScoreClassification.BAD
																? 'text-red-700'
																: metricValue?.metricScore ===
																	  MetricScoreClassification.OK
																	? 'text-amber-700'
																	: 'text-green-700',
														)}
														style={{ height: 'calc(100%)' }}
														xmlns="http://www.w2.org/2000/svg"
													>
														<pattern
															id={`metric-${metric}-${selectedNavigation}-lines`}
															patternUnits="userSpaceOnUse"
															width="2.5"
															height="2.5"
															patternTransform="rotate(45)"
														>
															<line
																x1="0"
																y1="0"
																x2="0"
																y2="10"
																stroke="currentColor"
																strokeWidth="2.5"
															/>
														</pattern>
														<rect
															width="100%"
															height="100%"
															fill={`url(#metric-${metric}-${selectedNavigation}-lines)`}
														/>
													</svg>
												</div>
												<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
													{metricValue?.metricScore ===
													MetricScoreClassification.BAD
														? 'Poor'
														: metricValue?.metricScore ===
															  MetricScoreClassification.OK
															? 'Needs improvement'
															: 'Good'}
												</span>
											</div>
											<div className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
												<span className="font-medium">Target: &lt;100ms</span>
											</div>
										</div>
										<div className="mt-1 text-[10px] text-peppermint-600 dark:text-peppermint-400">
											<span className="font-medium">Slowest:</span> Click on
											product-card (285.3ms)
										</div>
									</FileInsightCard>
								);
							})}
						</div>
					</div>

					{/* Request Timeline - Updated with overlaid markers */}
					<div className="mt-4">
						<h4 className="mb-2 text-xs font-semibold text-peppermint-800 dark:text-peppermint-200">
							Request Timeline
						</h4>
						<div className="rounded-lg border border-peppermint-200 bg-white p-3 transition-all duration-300 hover:-translate-y-1 hover:translate-x-1 hover:shadow-[-4px_4px_0_var(--border-color)] dark:border-peppermint-800 dark:bg-peppermint-900/30">
							{/* Timeline container with relative positioning */}
							<div className="relative">
								{/* The timeline bars */}
								<InteractionTimeline
									events={timelineEvents}
									totalDuration={1000}
								/>

								{/* Overlaid markers - positioned absolutely on top of the bars */}
								<div className="absolute left-0 top-0 h-8 w-full">
									{/* DOMContentLoaded marker */}
									<div className="absolute top-0 h-8" style={{ left: '45%' }}>
										<div className="absolute top-0 h-full w-[1px] bg-red-500"></div>
										<div className="absolute -top-1 h-2 w-2 -translate-x-1/2 rounded-full bg-red-500"></div>
										<div className="absolute -bottom-6 -translate-x-1/2 whitespace-nowrap text-[10px] text-red-500">
											DOMContentLoaded: 450ms
										</div>
									</div>

									{/* Load marker */}
									<div className="absolute top-0 h-8" style={{ left: '85%' }}>
										<div className="absolute top-0 h-full w-[1px] bg-green-700"></div>
										<div className="absolute -top-1 h-2 w-2 -translate-x-1/2 rounded-full bg-green-700"></div>
										<div className="absolute -bottom-6 -translate-x-1/2 whitespace-nowrap text-[10px] text-green-700">
											Load: 850ms
										</div>
									</div>
								</div>
							</div>

							{/* Timeline scale */}
							<div className="mt-6 flex justify-between text-[10px] text-peppermint-600 dark:text-peppermint-400">
								<span>0ms</span>
								<span>1000ms</span>
							</div>

							{/* Legend */}
							<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-blue-500"></div>
									<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
										HTML
									</span>
								</div>
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-purple-500"></div>
									<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
										CSS
									</span>
								</div>
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-yellow-500"></div>
									<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
										JavaScript
									</span>
								</div>
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-green-500"></div>
									<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
										Images
									</span>
								</div>
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-gray-500"></div>
									<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
										Other
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* Frame Histogram */}
					<div className="mt-4">
						<h4 className="mb-2 text-xs font-semibold text-peppermint-800 dark:text-peppermint-200">
							Trace activity
						</h4>
						<div className="rounded-lg border border-peppermint-200 bg-white p-3 transition-all duration-300 hover:-translate-y-1 hover:translate-x-1 hover:shadow-[-4px_4px_0_hsl(var(--border-color))] dark:border-peppermint-800 dark:bg-peppermint-900/30">
							<div className="h-24">
								<FrameHistogram data={frameDurations} />
							</div>
							<div className="mt-2 flex justify-between text-[10px] text-peppermint-600 dark:text-peppermint-400">
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-green-500"></div>
									<span>&lt;200ms (Good)</span>
								</div>
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-amber-500"></div>
									<span>200-500ms (Needs Improvement)</span>
								</div>
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-red-500"></div>
									<span>&gt;500ms (Poor)</span>
								</div>
							</div>
						</div>
					</div>

					{/* Task Breakdown */}
					<div className="mt-4">
						<h4 className="mb-2 text-xs font-semibold text-peppermint-800 dark:text-peppermint-200">
							Metrics Breakdown
						</h4>
						<div className="grid grid-cols-2 gap-3">
							{/* <FileInsightCard
								title="JavaScript Execution"
								value={68}
								unit="%"
								icon={<Cpu className="h-3.5 w-3.5" />}
								status="warning"
							>
								<div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
									<div
										className="h-full rounded-full bg-amber-500"
										style={{ width: '68%' }}
									></div>
								</div>
							</FileInsightCard>

							<FileInsightCard
								title="Rendering & Layout"
								value={24}
								unit="%"
								icon={<Layers className="h-3.5 w-3.5" />}
								status="neutral"
							>
								<div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
									<div
										className="h-full rounded-full bg-blue-500"
										style={{ width: '24%' }}
									></div>
								</div>
							</FileInsightCard> */}

							{loafs.length > 0 && (
								<FileInsightCard
									title="Long Tasks (>50ms)"
									value={12}
									icon={<BarChart3 className="h-3.5 w-3.5" />}
									status={
										longestAnimationFrameDuration > 500
											? 'critical'
											: longestAnimationFrameDuration > 200
												? 'warning'
												: 'good'
									}
								>
									<div className="mt-1 flex items-center">
										<div
											className={cn(
												'mr-1 h-2 w-2',
												longestAnimationFrameDuration > 500
													? 'bg-red-500'
													: longestAnimationFrameDuration > 200
														? 'bg-amber-500'
														: 'bg-green-500',
											)}
										></div>
										<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
											Longest: {msOrSDisplay(longestAnimationFrameDuration)}ms
										</span>
									</div>
								</FileInsightCard>
							)}

							<FileInsightCard
								title="Intearction Events"
								value={
									interactionsClassification.clicks +
									interactionsClassification.pointers
								}
								icon={<Pointer className="h-3.5 w-3.5" />}
								status="neutral"
							>
								<div className="mt-1 flex items-center">
									<div className="mr-1 h-2 w-2 bg-slate-500"></div>
									<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
										{interactionsClassification.clicks} click,{' '}
										{interactionsClassification.pointers} pointer events
									</span>
								</div>
							</FileInsightCard>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
