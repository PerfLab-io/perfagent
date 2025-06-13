'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import {
	ChevronDown,
	ChevronRight,
	FileText,
	Image,
	Code,
	File,
	FileCode,
	Clock,
	BarChart3,
	Activity,
	MousePointer,
	Pointer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileInsightCard } from './trace-details/trace-insight-card';
import { FrameHistogram } from './trace-details/trace-histogram';
import {
	MetricScoreClassification,
	metricsThresholds,
	MetricType,
} from '@/lib/insights';
import { msOrSDisplay, TraceAnalysis } from '@/lib/trace';
import { analyseInsightsForCWV } from '@/lib/insights';
import { microSecondsToMilliSeconds } from '@perflab/trace_engine/core/platform/Timing';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from './ui/select';
import type {
	SyntheticExtendedAnimationFramePair,
	TraceEventAnimationFrameScriptGroupingEvent,
	SyntheticAnimationFramePair,
} from '@perflab/trace_engine/models/trace/types/TraceEvents';
import type { Micro } from '@perflab/trace_engine/models/trace/types/Timing';
import { MetricGauge } from './trace-details/metric-gauge';
import { LinePattern } from './line-pattern';
import { useFFmpeg } from '@/lib/hooks/use-ffmpeg';
import { AttachedFile } from '@/lib/stores/chat-store';
import { AICallTree } from '@perflab/trace_engine/panels/timeline/utils/AICallTree';
import { StandaloneCallTreeContext } from '@perflab/trace_engine/panels/ai_assistance/standalone';
import useSWR from 'swr';

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

export interface FileContextSectionProps {
	currentFile: AttachedFile | null;
	isVisible: boolean;
	traceAnalysis: TraceAnalysis | null;
	onTraceNavigationChange: (navigationId: string) => void;
	metrics: ReturnType<typeof analyseInsightsForCWV> | null;
	onINPInteractionAnimationChange?: (options: {
		animationFrameInteractionImageUrl: string | null;
		isLoading: boolean;
		progress: number;
		error: string | null;
	}) => void;
	onAIContextChange?: (callTreeContext: StandaloneCallTreeContext) => void;
}

export const FileContextSection = memo(function FileContextSection({
	currentFile,
	isVisible,
	traceAnalysis,
	onTraceNavigationChange,
	metrics,
	onINPInteractionAnimationChange,
	onAIContextChange,
}: FileContextSectionProps) {
	// First, add a max-height to the main container when expanded
	// Add a new state to track the initial animation
	const [isInitialRender, setIsInitialRender] = useState(true);
	const [isExpanded, setIsExpanded] = useState(true);
	const [isAnimating, setIsAnimating] = useState(false);
	const { data: selectedNavigation, mutate: setSelectedNavigation } = useSWR<
		string | null
	>('navigation-id', null, {
		fallbackData: null,
	});

	const { convertToFormat, isLoading, progress, error } = useFFmpeg();
	const [inpAnimationFrames, setInpAnimationFrames] = useState<
		SyntheticExtendedAnimationFramePair[] | undefined
	>();
	const [inpInteractionAnimation, setInpInteractionAnimation] = useState<
		string | null
	>(null);

	useEffect(() => {
		onINPInteractionAnimationChange?.({
			animationFrameInteractionImageUrl: inpInteractionAnimation,
			isLoading,
			progress,
			error,
		});
	}, [isLoading, progress, error, inpInteractionAnimation]);

	const handleConvert = async (files: Array<File | Blob | string>) => {
		const output = await convertToFormat('webp', files, { outputType: 'url' });
		if (output && typeof output === 'string') {
			setInpInteractionAnimation(output);
		}
	};

	const { __insights } = useMemo(() => {
		if (!traceAnalysis) return { __insights: null };

		const __insights = Array.from(traceAnalysis.insights.entries()).filter(
			([_, insight]) => insight.url.host !== 'new-tab-page',
		);

		return { __insights };
	}, [traceAnalysis, selectedNavigation]);

	useEffect(() => {
		if (!traceAnalysis || !__insights) return;

		const longestInteractionEvent = traceAnalysis.insights.get(
			selectedNavigation || __insights[0][0],
		)?.model.InteractionToNextPaint.longestInteractionEvent;

		if (longestInteractionEvent) {
			try {
				// const evalScriptEvent =
				// 	traceAnalysis.parsedTrace.Renderer.allTraceEntries
				// 		.filter(
				// 			(event) =>
				// 				event.name === 'EventDispatch' &&
				// 				(event.ts >= longestInteractionEvent.ts ||
				// 					event.ts + (event.dur ?? 0) >= longestInteractionEvent.ts) &&
				// 				event.ts <=
				// 					longestInteractionEvent.ts + longestInteractionEvent.dur,
				// 		)
				// 		.sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0))[0];

				// Process the trace events for the AI call tree
				requestAnimationFrame(() => {
					const timerangeCallTree = AICallTree.fromTimeOnThread({
						thread: {
							pid: longestInteractionEvent.pid,
							tid: longestInteractionEvent.tid,
						},
						bounds: {
							min: longestInteractionEvent.ts,
							max: (longestInteractionEvent.ts +
								longestInteractionEvent.dur) as Micro,
							range: (longestInteractionEvent.ts +
								longestInteractionEvent.dur) as Micro,
						},
						parsedTrace: traceAnalysis.parsedTrace,
					});

					if (!timerangeCallTree?.rootNode.event) {
						throw new Error('Failed to create timerange call tree');
					}

					const aiCallTree = AICallTree.fromEvent(
						timerangeCallTree.rootNode.event,
						traceAnalysis.parsedTrace,
					);

					if (!aiCallTree) {
						throw new Error('Failed to create AI call tree');
					}

					requestAnimationFrame(() => {
						const callTreeContext = new StandaloneCallTreeContext(aiCallTree);
						onAIContextChange?.(callTreeContext);
					});
				});
			} catch (e) {
				console.error(e);
			}
		}

		if (
			!longestInteractionEvent ||
			!traceAnalysis.parsedTrace.Screenshots.legacySyntheticScreenshots
		) {
			setInpAnimationFrames(undefined);
			return;
		}

		const screenShotStrings =
			traceAnalysis.parsedTrace.Screenshots.legacySyntheticScreenshots
				.filter(
					(screenshot) =>
						(screenshot.ts >= longestInteractionEvent.ts ||
							screenshot.ts + (screenshot.dur || 0) >=
								longestInteractionEvent.ts ||
							screenshot.ts >= longestInteractionEvent.ts - 500_000) &&
						(screenshot.ts <=
							longestInteractionEvent.ts + longestInteractionEvent.dur ||
							screenshot.ts <=
								longestInteractionEvent.ts +
									longestInteractionEvent.dur +
									500_000),
				)
				.map((screenshot) => screenshot.args.dataUri);

		const _animationFrames = longestInteractionEvent
			? traceAnalysis.parsedTrace.Animations.animationFrames.filter(
					(frame) =>
						(frame.ts >= longestInteractionEvent.ts ||
							frame.ts + frame.dur >= longestInteractionEvent.ts) &&
						frame.ts <=
							longestInteractionEvent.ts + longestInteractionEvent.dur,
				)
			: undefined;

		setInpAnimationFrames(_animationFrames);

		handleConvert(screenShotStrings);
	}, [traceAnalysis, selectedNavigation, __insights]);

	const {
		loafs,
		longestAnimationFrameDuration,
		frameDurations,
		interactionsClassification,
	} = useMemo(() => {
		const frameDurations: number[] = [];

		if (!traceAnalysis)
			return {
				loafs: [],
				longestAnimationFrameDuration: 0,
				frameDurations,
				interactionsClassification: null,
			};

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

		return {
			loafs,
			longestAnimationFrameDuration,
			frameDurations,
			interactionsClassification,
		};
	}, [traceAnalysis]);

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

	useEffect(() => {
		if (traceAnalysis && __insights) {
			onTraceNavigationChange(selectedNavigation || __insights[0][0]);
		}
	}, [traceAnalysis, onTraceNavigationChange, __insights]);

	const handleTraceNavigationChange = (navigationId: string) => {
		setSelectedNavigation(navigationId);
		onTraceNavigationChange(navigationId);
	};

	if (!traceAnalysis || !true || !currentFile) {
		return null;
	}

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

	// Mock timeline events
	// const timelineEvents = [
	// 	{ type: 'HTML', startTime: 0, duration: 120, color: 'bg-blue-500/70' },
	// 	{ type: 'CSS', startTime: 100, duration: 180, color: 'bg-purple-500/70' },
	// 	{ type: 'JS', startTime: 250, duration: 350, color: 'bg-yellow-500/70' },
	// 	{ type: 'Images', startTime: 550, duration: 250, color: 'bg-green-500/70' },
	// 	{ type: 'Other', startTime: 750, duration: 150, color: 'bg-gray-500/70' },
	// ];

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
				'bg-peppermint-50 dark:bg-peppermint-950/30 z-50 mb-4 overflow-hidden rounded-lg transition-all duration-300',
				isExpanded
					? 'border-peppermint-300 dark:border-peppermint-900 max-h-[600px] overflow-y-auto border'
					: 'border-peppermint-300 dark:border-peppermint-900 max-h-[40px] border border-dashed',
				isAnimating &&
					'translate-x-1 -translate-y-1 shadow-[-4px_4px_0_hsl(var(--border-color))]',
				isInitialRender && 'file-context-appear',
			)}
		>
			{/* Header */}
			<div
				className="group bg-peppermint-50 hover:bg-peppermint-100 dark:bg-peppermint-950/30 dark:hover:bg-peppermint-900/20 sticky top-0 z-10 flex cursor-pointer items-center justify-between p-2"
				onClick={() => setIsExpanded(!isExpanded)}
			>
				<div className="flex items-center space-x-2">
					{isExpanded ? (
						<ChevronDown className="text-peppermint-700 dark:text-peppermint-300 h-4 w-4" />
					) : (
						<ChevronRight className="text-peppermint-700 dark:text-peppermint-300 h-4 w-4" />
					)}
					<span className="text-peppermint-800 dark:text-peppermint-200 text-sm font-medium">
						Trace Metadata
					</span>
				</div>
				<div className="flex items-center space-x-2">
					<div className="border-peppermint-200 group-hover:bg-peppermint-200 dark:bg-peppermint-900/40 flex items-center space-x-1 rounded border bg-transparent px-2 py-0.5 text-xs">
						<span
							className={cn(
								'inline-block h-2 w-2 animate-pulse rounded-full',
								isLoading ? 'bg-amber-500' : 'bg-green-500',
							)}
						></span>
						<span className="text-peppermint-700 group-hover:text-peppermint-900 dark:text-peppermint-300">
							{isLoading ? 'Processing trace details' : 'Ready'}
						</span>
					</div>
				</div>
			</div>

			{/* Content */}
			{isExpanded && (
				<div className="border-peppermint-200 dark:border-peppermint-900/50 border-t p-3">
					<div className="flex justify-between">
						<div className="flex items-center">
							<div className="border-peppermint-200 dark:border-peppermint-800 dark:bg-peppermint-900/30 shrink-0 rounded border bg-white p-2">
								{getFileIcon()}
							</div>
							<div className="ml-3">
								<h3 className="text-peppermint-900 dark:text-peppermint-100 font-medium">
									{currentFile.name}
								</h3>
								<div className="mt-1 flex flex-wrap gap-2">
									<span className="bg-peppermint-200 text-peppermint-800 dark:bg-peppermint-900/40 dark:text-peppermint-300 rounded px-2 py-0.5 text-xs">
										URL: {traceAnalysis.parsedTrace.Meta.mainFrameURL}
									</span>
									<span className="bg-peppermint-200 text-peppermint-800 dark:bg-peppermint-900/40 dark:text-peppermint-300 rounded px-2 py-0.5 text-xs">
										Navigations:{' '}
										{traceAnalysis.parsedTrace.Meta.mainFrameNavigations.length}
									</span>
									{traceAnalysis.metadata.cpuThrottling && (
										<span className="bg-peppermint-200 text-peppermint-800 dark:bg-peppermint-900/40 dark:text-peppermint-300 rounded px-2 py-0.5 text-xs">
											CPU Throttling: {traceAnalysis.metadata.cpuThrottling}x
										</span>
									)}
									{traceAnalysis.metadata.networkThrottling && (
										<span className="bg-peppermint-200 text-peppermint-800 dark:bg-peppermint-900/40 dark:text-peppermint-300 rounded px-2 py-0.5 text-xs">
											Network Throttling:{' '}
											{traceAnalysis.metadata.networkThrottling}
										</span>
									)}
									<span className="bg-peppermint-200 text-peppermint-800 dark:bg-peppermint-900/40 dark:text-peppermint-300 rounded px-2 py-0.5 text-xs">
										File Size: {formatFileSize(currentFile.size)}
									</span>
								</div>
							</div>
						</div>
						<Select
							value={selectedNavigation || __insights?.[0]?.[0]}
							onValueChange={handleTraceNavigationChange}
						>
							<SelectTrigger className="border-peppermint-400 text-peppermint-800 focus:ring-peppermint-300 w-48 border border-dashed">
								<SelectValue placeholder="Choose a navigation" />
							</SelectTrigger>
							<SelectContent className="border-peppermint-400 text-peppermint-800 focus:ring-peppermint-300 border border-dashed">
								{__insights?.map(([navigationId, insight]) => (
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
						<h4 className="text-peppermint-800 dark:text-peppermint-200 mb-2 max-w-96 truncate text-xs font-semibold">
							Core Web Vitals for:{' '}
							{
								__insights?.find(([nav, _in]) => {
									return nav === selectedNavigation;
								})?.[1]?.url?.href
							}
						</h4>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:gap-6">
							{metrics &&
								Object.keys(metrics).map((metric) => {
									const metricValue = metrics[metric as keyof typeof metrics];
									const metricIcon =
										WebVitalsMetricIcons[
											metric as keyof typeof WebVitalsMetric
										];

									return (
										<FileInsightCard
											key={`metric-${metric}-${selectedNavigation}`}
											title={
												WebVitalsMetric[metric as keyof typeof WebVitalsMetric]
											}
											value={
												metricValue?.metricType === MetricType.TIME
													? msOrSDisplay(metricValue?.metricValue || 0)
													: metricValue?.metricValue || 0
											}
											icon={metricIcon}
											status={getMetricVariant(metricValue?.metricScore)}
										>
											{/* <div className="mt-1 flex items-center justify-between">
											<div className="flex items-center">
												<div
													className={cn(
														'relative mr-1 h-2 w-2',
														metricValue?.metricScore ===
															MetricScoreClassification.BAD
															? 'bg-red-200 text-red-700'
															: metricValue?.metricScore ===
																  MetricScoreClassification.OK
																? 'bg-amber-200 text-amber-700'
															: 'bg-green-200 text-green-700',
													)}
												>
													<LinePattern
														id={`metric-${metric}-${selectedNavigation}-lines`}
													/>
												</div>
												<span className="text-peppermint-600 dark:text-peppermint-400 text-[10px]">
													{metricValue?.metricScore ===
													MetricScoreClassification.BAD
														? 'Poor'
														: metricValue?.metricScore ===
															  MetricScoreClassification.OK
															? 'Needs improvement'
															: 'Good'}
												</span>
											</div>
											<div className="text-peppermint-600 dark:text-peppermint-400 text-[10px]">
												<span className="font-medium">Target: &lt;100ms</span>
											</div>
										</div> */}
											<MetricGauge
												value={metricValue?.metricValue || 0}
												metricType={metricValue?.metricType}
												thresholds={
													metricsThresholds.get(metric) as {
														good: number;
														needsImprovement: number;
													}
												}
											/>
											{/* Add some extra insights here
										
										<div className="mt-1 text-[10px] text-peppermint-600 dark:text-peppermint-400">
											<span className="font-medium">Slowest:</span> Click on
											product-card (285.3ms)
										</div> */}
										</FileInsightCard>
									);
								})}
						</div>
					</div>

					{/* Request Timeline - Updated with overlaid markers 
					<div className="mt-4">
						<h4 className="text-peppermint-800 dark:text-peppermint-200 mb-2 text-xs font-semibold">
							Request Timeline
						</h4>
						<div className="border-peppermint-200 dark:border-peppermint-800 dark:bg-peppermint-900/30 rounded-lg border bg-white p-3 transition-all duration-300 hover:translate-x-1 hover:-translate-y-1 hover:shadow-[-4px_4px_0_var(--border-color)]">
							<div className="relative">
								<InteractionTimeline
									events={timelineEvents}
									totalDuration={1000}
								/>

								<div className="absolute top-0 left-0 h-8 w-full">
									<div className="absolute top-0 h-8" style={{ left: '45%' }}>
										<div className="absolute top-0 h-full w-[1px] bg-red-500"></div>
										<div className="absolute -top-1 h-2 w-2 -translate-x-1/2 rounded-full bg-red-500"></div>
										<div className="absolute -bottom-6 -translate-x-1/2 text-[10px] whitespace-nowrap text-red-500">
											DOMContentLoaded: 450ms
										</div>
									</div>

									<div className="absolute top-0 h-8" style={{ left: '85%' }}>
										<div className="absolute top-0 h-full w-[1px] bg-green-700"></div>
										<div className="absolute -top-1 h-2 w-2 -translate-x-1/2 rounded-full bg-green-700"></div>
										<div className="absolute -bottom-6 -translate-x-1/2 text-[10px] whitespace-nowrap text-green-700">
											Load: 850ms
										</div>
									</div>
								</div>
							</div>

							<div className="text-peppermint-600 dark:text-peppermint-400 mt-6 flex justify-between text-[10px]">
								<span>0ms</span>
								<span>1000ms</span>
							</div>

							<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-blue-500"></div>
									<span className="text-peppermint-600 dark:text-peppermint-400 text-[10px]">
										HTML
									</span>
								</div>
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-purple-500"></div>
									<span className="text-peppermint-600 dark:text-peppermint-400 text-[10px]">
										CSS
									</span>
								</div>
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-yellow-500"></div>
									<span className="text-peppermint-600 dark:text-peppermint-400 text-[10px]">
										JavaScript
									</span>
								</div>
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-green-500"></div>
									<span className="text-peppermint-600 dark:text-peppermint-400 text-[10px]">
										Images
									</span>
								</div>
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-gray-500"></div>
									<span className="text-peppermint-600 dark:text-peppermint-400 text-[10px]">
										Other
									</span>
								</div>
							</div>
						</div>
					</div>*/}

					{inpAnimationFrames && (
						<div className="mt-4">
							<h4 className="text-peppermint-800 dark:text-peppermint-200 mb-2 text-xs font-semibold">
								Registered events within INP timespan
							</h4>
							<div className="dark:bg-peppermint-900/30 border-peppermint-200 dark:border-peppermint-800 rounded-lg border bg-white p-3 transition-all duration-300 hover:translate-x-1 hover:-translate-y-1 hover:shadow-[-4px_4px_0_hsl(var(--border-color))]">
								<div className="space-y-2">
									{inpAnimationFrames.map((animFrame) =>
										animFrame.phases
											.filter(
												(phase) =>
													phase.name === 'AnimationFrame::Script::Execute',
											)
											.map((phase, index) => {
												const rawEvent =
													// @ts-ignore the rawSourceEvent is not typed
													phase.rawSourceEvent as TraceEventAnimationFrameScriptGroupingEvent;
												const animationFrameEventMeta =
													rawEvent.args?.animation_frame_script_timing_info;
												const eventDuration = microSecondsToMilliSeconds(
													phase.dur || (0 as Micro),
												);
												const eventDurationStr = msOrSDisplay(eventDuration);

												return (
													<div
														key={phase.id2?.local || '' + index}
														className="flex items-center"
													>
														<div className="w-20 flex-shrink-0">
															<span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-800 dark:text-amber-100">
																{animationFrameEventMeta?.property_like_name}
															</span>
														</div>
														<div className="ml-2 flex-grow">
															<div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
																<div
																	className={cn(
																		'h-full rounded-full',
																		eventDuration < 50
																			? 'bg-green-500'
																			: eventDuration < 100
																				? 'bg-amber-500'
																				: 'bg-red-500',
																	)}
																	style={{
																		width: `${Math.min(eventDuration / 2, 100)}%`,
																	}}
																></div>
															</div>
														</div>
														<div className="ml-2 w-16 text-right">
															<span className="text-peppermint-700 dark:text-peppermint-300 text-xs font-medium">
																{eventDurationStr}
															</span>
														</div>
														<div className="ml-2 max-w-[120px] flex-grow-0 truncate">
															<span className="text-peppermint-600 dark:text-peppermint-400 text-xs">
																{animationFrameEventMeta?.class_like_name}
															</span>
														</div>
													</div>
												);
											}),
									)}
								</div>
							</div>
						</div>
					)}

					{/* Frame Histogram */}
					<div className="mt-4">
						<h4 className="text-peppermint-800 dark:text-peppermint-200 mb-2 text-xs font-semibold">
							Animation Frame Histogram
						</h4>
						<div className="border-peppermint-200 dark:border-peppermint-800 dark:bg-peppermint-900/30 rounded-lg border bg-white p-3">
							<div className="h-24">
								<FrameHistogram data={frameDurations} />
							</div>
							<div className="text-peppermint-600 dark:text-peppermint-400 mt-2 flex justify-between text-[10px]">
								<div className="flex items-center">
									<div className="relative mr-1 h-2 w-2 bg-green-200 text-green-700">
										<LinePattern
											id={`histogram-${selectedNavigation}-lines-Good`}
										/>
									</div>
									<span>&lt;200ms (Good)</span>
								</div>
								<div className="flex items-center">
									<div className="relative mr-1 h-2 w-2 bg-amber-200 text-amber-700">
										<LinePattern
											id={`histogram-${selectedNavigation}-lines-Improvement`}
										/>
									</div>
									<span>200-500ms (Needs Improvement)</span>
								</div>
								<div className="flex items-center">
									<div className="relative mr-1 h-2 w-2 bg-red-200 text-red-700">
										<LinePattern
											id={`histogram-${selectedNavigation}-lines-Poor`}
										/>
									</div>
									<span>&gt;500ms (Poor)</span>
								</div>
							</div>
						</div>
					</div>

					{/* Task Breakdown */}
					<div className="mt-4">
						<h4 className="text-peppermint-800 dark:text-peppermint-200 mb-2 text-xs font-semibold">
							Metrics Breakdown
						</h4>
						<div className="grid grid-cols-2 gap-3">
							{loafs.length > 0 && (
								<FileInsightCard
									title="Long Animation Frames (>50ms)"
									value={loafs.length}
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
												'relative mr-1 h-2 w-2',
												longestAnimationFrameDuration > 500
													? 'bg-red-200 text-red-700'
													: longestAnimationFrameDuration > 200
														? 'bg-amber-200 text-amber-700'
														: 'bg-green-200 text-green-700',
											)}
										>
											<LinePattern
												id={`long-tasks-${selectedNavigation}-values`}
											/>
										</div>
										<span className="text-peppermint-600 dark:text-peppermint-400 text-[10px]">
											Longest: {msOrSDisplay(longestAnimationFrameDuration)}ms
										</span>
									</div>
								</FileInsightCard>
							)}

							{interactionsClassification && (
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
										<div className="relative mr-1 h-2 w-2 bg-slate-200 text-slate-700">
											<LinePattern
												id={`interaction-events-${selectedNavigation}-values`}
											/>
										</div>
										<span className="text-peppermint-600 dark:text-peppermint-400 text-[10px]">
											{interactionsClassification.clicks} click,{' '}
											{interactionsClassification.pointers} pointer events
										</span>
									</div>
								</FileInsightCard>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
});
