import { microSecondsToMilliSeconds } from '@perflab/trace_engine/core/platform/Timing';
import { msOrSDisplay } from './trace';
import { Handlers } from '@perflab/trace_engine';
import * as Trace from '@perflab/trace_engine/models/trace/trace.js';
import { InteractionEvent } from '@/components/flamegraph/types';
import { Micro } from '@perflab/trace_engine/models/trace/types/Timing';
import dedent from 'dedent';

export enum MetricType {
	TIME = 'time',
	SCORE = 'score',
}

enum LCPMetricPhases {
	'ttfb' = 'TTFB',
	'loadDelay' = 'Load Delay',
	'loadTime' = 'Load Time',
	'renderDelay' = 'Render Delay',
}

export enum MetricScoreClassification {
	GOOD = 'good',
	OK = 'needs improvement',
	BAD = 'bad',
	UNCLASSIFIED = 'unclassified',
}

export const metricsThresholds = new Map([
	[
		'LCP',
		{
			good: 2500,
			needsImprovement: 4000,
		},
	],
	[
		'CLS',
		{
			good: 0.1,
			needsImprovement: 0.25,
		},
	],
	[
		'INP',
		{
			good: 200,
			needsImprovement: 500,
		},
	],
]);

export type InsightsReport = {
	metric: string;
	metricTitle?: string;
	metricValue: number;
	metricType: MetricType;
	metricBreakdown: { label: string; value: number }[];
	metricScore?: MetricScoreClassification;
	infoContent?: string;
	recommendations?: string[];
	extras?: INPExtras | LCPExtras;
};

export type INPExtras = {
	formattedEvent: InteractionEvent;
	timeline: {
		min: number;
		max: number;
		range: number;
	};
	animationFrames?: {
		animationFrameEventMeta: any;
		eventDurationStr: string;
	}[][];
};

export type LCPExtras = {
	networkStackInfo: string;
};

type ExpectedMimeTypes =
	| 'text/css'
	| 'application/json'
	| 'application/javascript'
	| 'application/ecmascript'
	| 'application/x-javascript'
	| 'image';
type RequestMap = {
	origin: string;
	isSameOrigin: boolean;
	assetCount: Array<{
		type: ExpectedMimeTypes;
		entryCount: number;
		lowPrioCount: number;
		highPrioCount: number;
		renderBlockingCount: number;
		totalTime: Micro;
	}>;
	repeatedAssets?: { [key: string]: number };
	failedRequests?: { [key: string]: number };
	totalTime: Micro;
};

// Utility function to determine asset type from mime type for the RequestMap
const getAssetType = (mimeType: ExpectedMimeTypes): ExpectedMimeTypes => {
	if (mimeType === 'text/css') return 'text/css';
	if (mimeType === 'application/json' || mimeType.includes('+json'))
		return 'application/json';
	if (
		mimeType === 'application/javascript' ||
		mimeType === 'application/ecmascript' ||
		mimeType === 'application/x-javascript'
	)
		return 'application/javascript';
	if (mimeType.startsWith('image/')) return 'image';
	return mimeType;
};

export function analyseInsightsForCWV(
	traceInsights: Trace.Insights.Types.TraceInsightSets,
	trace: Handlers.Types.ParsedTrace,
	selectedNavigation: string,
) {
	const {
		PageLoadMetrics,
		LayoutShifts,
		UserInteractions,
		Animations: { animationFrames },
		Meta: { traceBounds: traceWindow },
	} = trace;

	const mainFrameMetrics = PageLoadMetrics.allMarkerEvents;

	const insights = traceInsights.get(selectedNavigation);

	const LCPEvent = mainFrameMetrics.find(
		(metric) => metric.name === 'largestContentfulPaint::Candidate',
	);

	const layoutShifts = LayoutShifts.clusters;

	let CLS: InsightsReport = {
		metric: 'CLS',
		metricValue: 0,
		metricType: MetricType.SCORE,
		metricScore: undefined,
		metricBreakdown: [],
		rawEvent: null,
	} as InsightsReport;
	let LCP: InsightsReport = {
		metric: 'LCP',
		metricValue: 0,
		metricType: MetricType.TIME,
		metricScore: undefined,
		metricBreakdown: [],
		rawEvent: null,
	} as InsightsReport;
	let INP: InsightsReport = {
		metric: 'INP',
		metricValue: 0,
		metricType: MetricType.TIME,
		metricScore: undefined,
		metricBreakdown: [],
		rawEvent: null,
	} as InsightsReport;

	if (LCPEvent) {
		const _lcp = {
			metric: 'LCP',
			metricValue: 0,
			metricType: MetricType.TIME,
			metricScore: undefined,
			metricBreakdown: [],
			rawEvent: LCPEvent,
		} as InsightsReport;

		const LCPEventFrame = PageLoadMetrics.metricScoresByFrameId.get(
			LCPEvent.args.frame,
		);

		if (LCPEventFrame && LCPEvent.args.data) {
			const navigationTimings = LCPEventFrame.get(
				LCPEvent.args.data.navigationId,
			);

			const navigationBounds = insights?.bounds;
			const networkRequestsTillLCP = trace.NetworkRequests.byTime.filter(
				(nE) => {
					const nETotal = nE.ts + nE.dur;
					// ensure that the events are from the starting point of the selected navigation
					return nE.ts >= (navigationBounds?.min || 0) && nETotal < LCPEvent.ts;
				},
			);

			const mainFrameOrigin = new URL(
				networkRequestsTillLCP.at(-1)?.args.data.requestingFrameUrl || '',
			);

			if (navigationTimings) {
				for (const [key, value] of navigationTimings.entries()) {
					const normalizedTiming = microSecondsToMilliSeconds(value.timing);
					if (key === 'LCP') {
						_lcp.metricValue = normalizedTiming;
						// @ts-ignore
						_lcp.metricScore = value.classification;
					}
				}

				_lcp.infoContent = `The LCP event happened at ${msOrSDisplay(
					microSecondsToMilliSeconds(_lcp.metricValue as Micro),
				)}.`;

				if (
					insights &&
					!(insights.model.LCPPhases instanceof Error) &&
					insights.model.LCPPhases
				) {
					_lcp.metricBreakdown = [];
					Array.from(
						Object.entries(insights.model.LCPPhases.phases || {}),
					).forEach(([key]) => {
						// @ts-ignore
						const value = insights.model.LCPPhases.phases[key] as number;

						if (!value) return;

						_lcp.metricBreakdown.push({
							label: LCPMetricPhases[key as keyof typeof LCPMetricPhases],
							value: Math.ceil(Math.round(value * 100) / 100),
						});
					});

					_lcp.recommendations = [
						insights?.model.LCPDiscovery.strings.description,
						!insights.model.LCPDiscovery.checklist?.priorityHinted.value
							? dedent`
							Increase priority hint for the LCP resource.
							This resource is critical for the user experience and should use fetchpriorit=high.`
							: '',
						!insights.model.LCPDiscovery.checklist?.requestDiscoverable.value
							? dedent`
							Consider preload the LCP image, or have it being discovered on the initial document load.
							This LCP image has a total load delay of ${msOrSDisplay(insights.model.LCPPhases.phases?.loadDelay || 0)}.
							Sometimes your LCP image may be correctly placed in the document but other resources from
							part of the [critical rendering path](https://web.dev/learn/performance/understanding-the-critical-path) are blocking its discovery till a later time.`
							: '',
						!insights.model.LCPDiscovery.checklist?.eagerlyLoaded.value
							? dedent`
							Remove lazy loading from the LCP image.
							The LCP image should be loaded as soon as possible to avoid a delay in rendering.`
							: '',
					].filter(Boolean);
				}

				const mappedURLs = networkRequestsTillLCP
					.reduce<Map<string, RequestMap>>((reqMap, entry) => {
						const frameURL = mainFrameOrigin;
						const entryURL = new URL(entry.args.data.url);
						const isSameOrigin = frameURL.origin === entryURL.origin;
						const _rM: RequestMap = reqMap.get(entryURL.origin) || {
							origin: entryURL.origin,
							isSameOrigin,
							assetCount: [],
							repeatedAssets: undefined,
							failedRequests: undefined,
							totalTime: 0 as Micro,
						};
						const assetType = getAssetType(
							entry.args.data.mimeType as ExpectedMimeTypes,
						);
						const assetTypeObj = _rM.assetCount.find(
							({ type }) => type === assetType,
						);
						const isLowPriority =
							entry.args.data.priority === 'Low' ||
							entry.args.data.priority === 'VeryLow';
						const isHighPriority =
							entry.args.data.priority === 'High' ||
							entry.args.data.priority === 'VeryHigh';
						const isRenderBlocking =
							entry.args.data.renderBlocking === 'blocking' ||
							entry.args.data.renderBlocking === 'in_body_parser_blocking' ||
							entry.args.data.renderBlocking === 'potentially_blocking';
						const repeatCount =
							(_rM.repeatedAssets?.[entryURL.origin] || -1) + 1;
						const failedCount =
							(_rM.failedRequests?.[entryURL.origin] || -1) + 1;

						_rM.assetCount = assetTypeObj
							? _rM.assetCount.map((_asset) => {
									if (_asset.type === assetType) {
										return {
											type: assetType,
											entryCount: _asset.entryCount + 1,
											lowPrioCount: isLowPriority
												? _asset.lowPrioCount + 1
												: _asset.lowPrioCount,
											highPrioCount: isHighPriority
												? _asset.highPrioCount + 1
												: _asset.highPrioCount,
											renderBlockingCount: isRenderBlocking
												? _asset.renderBlockingCount + 1
												: _asset.renderBlockingCount,
											totalTime: (_asset.totalTime + entry.dur) as Micro,
										};
									}

									return _asset;
								})
							: [
									..._rM.assetCount,
									{
										type: assetType,
										entryCount: 1,
										lowPrioCount: isLowPriority ? 1 : 0,
										highPrioCount: isHighPriority ? 1 : 0,
										renderBlockingCount: isRenderBlocking ? 1 : 0,
										totalTime: entry.dur,
									},
								];
						_rM.repeatedAssets = repeatCount
							? {
									...(_rM.repeatedAssets || {}),
									[entryURL.origin]: repeatCount,
								}
							: _rM.repeatedAssets;
						_rM.failedRequests = failedCount
							? {
									...(_rM.failedRequests || {}),
									[entryURL.origin]: failedCount,
								}
							: _rM.failedRequests;
						_rM.totalTime = (_rM.totalTime + entry.dur) as Micro;

						return reqMap.set(entryURL.origin, _rM);
					}, new Map<string, RequestMap>())
					.values()
					.reduce(
						(str, entry) => {
							return dedent`
						${str}

						Origin: ${entry.origin}
						SameOrigin: ${entry.isSameOrigin}
						AssetCount:
						${entry.assetCount.reduce(
							(_str, acc) => dedent`
							${_str}
							- AssetType: ${acc.type}
							* Count: ${acc.entryCount}
							* LowPriorityCount: ${acc.lowPrioCount}
							* HighPriorityCount: ${acc.highPrioCount}
							* RenderBlockingCount: ${acc.renderBlockingCount}
							* TotalTimeSpentForAssetType: ${microSecondsToMilliSeconds(acc.totalTime)}ms\n
							`,
							'',
						)}
						RepeatedAssets: ${
							entry.repeatedAssets
								? Object.keys(entry.repeatedAssets).reduce(
										(_str, acc) => dedent`${_str}\n
										* ${acc}: ${entry.repeatedAssets?.[acc]}`,
										'',
									)
								: '0'
						}
						FailedAssets: ${
							entry.failedRequests
								? Object.keys(entry.failedRequests).reduce(
										(_str, acc) => dedent`${_str}\n
										* ${acc}: ${entry.failedRequests?.[acc]}`,
										'',
									)
								: '0'
						}
						TotalTime: ${microSecondsToMilliSeconds(entry.totalTime)}ms
						\n
						`;
						},
						dedent`
					Trace URL: ${mainFrameOrigin.href}
					Trace Origin: ${mainFrameOrigin.origin}
					LCP candidate timming: ${_lcp.metricValue}ms
					LCP candidate type: ${LCPEvent.args.data.type}
					LCP candidate phase timings:
					${_lcp.metricBreakdown.reduce(
						(_acc, _phase) => dedent`
					${_acc}
					* ${_phase.label}: ${_phase.value}ms
					`,
						'',
					)}
					`,
					);

				_lcp.extras = {
					networkStackInfo: dedent`
					${mappedURLs}
					
					- Recommendations based on insights:
					${_lcp.recommendations?.reduce(
						(_acc, rec) => dedent`
						${_acc}
						* ${rec}
						`,
						'',
					)}
					`,
				};

				LCP = _lcp;
			}
		}
	}

	if (layoutShifts && layoutShifts.length > 0) {
		let _cls = {
			metric: 'CLS',
			metricValue: 0,
			metricType: MetricType.SCORE,
			metricScore: undefined,
			metricBreakdown: [],
			rawEvent: null,
			recommendations: [insights?.model.CLSCulprits.strings.description],
		} as InsightsReport;

		const shiftType = {
			[MetricScoreClassification.GOOD]: 'good',
			[MetricScoreClassification.OK]: 'needsImprovement',
			[MetricScoreClassification.BAD]: 'bad',
		} as const;

		layoutShifts.forEach((shift) => {
			if (shift.clusterCumulativeScore > _cls.metricValue) {
				_cls.metricValue = Number(shift.clusterCumulativeScore.toFixed(2));
				_cls.metricScore =
					shift.clusterCumulativeScore > 0.1
						? shift.clusterCumulativeScore > 0.25
							? MetricScoreClassification.BAD
							: MetricScoreClassification.OK
						: MetricScoreClassification.GOOD;

				const scoreType = shiftType[_cls.metricScore];
				const shiftWindow = shift.scoreWindows[scoreType];
				_cls.metricBreakdown = [
					{
						label: 'Shift start',
						// @ts-expect-error
						value: microSecondsToMilliSeconds(shiftWindow?.min ?? 0),
					},
					{
						label: 'Shift end',
						// @ts-expect-error
						value: microSecondsToMilliSeconds(shiftWindow?.max ?? 0),
					},
					{
						label: 'Shift duration',
						// @ts-expect-error
						value: microSecondsToMilliSeconds(shiftWindow?.range ?? 0),
					},
				];
				_cls.infoContent = `The CLS window happened at ${shift.events[0]?.cat}.
            The shift start and end represents the time range of the worst shift.`;
			}
		});

		CLS = _cls;
	}

	if (insights && insights.model.InteractionToNextPaint) {
		const { longestInteractionEvent } = insights.model.InteractionToNextPaint;

		if (longestInteractionEvent) {
			const interactionDur = microSecondsToMilliSeconds(
				longestInteractionEvent.dur,
			);

			const inputDelay = microSecondsToMilliSeconds(
				longestInteractionEvent.inputDelay,
			);

			const processingStart = microSecondsToMilliSeconds(
				longestInteractionEvent.processingStart,
			);

			const processingEnd = microSecondsToMilliSeconds(
				longestInteractionEvent.processingEnd,
			);

			const presentationDelay = microSecondsToMilliSeconds(
				longestInteractionEvent.presentationDelay,
			);

			const processing = processingEnd - processingStart;

			const formattedEvent = longestInteractionEvent
				? {
						ts: longestInteractionEvent.ts - trace.Meta.traceBounds.min,
						presentationDelay: longestInteractionEvent.presentationDelay / 1000,
						dur: longestInteractionEvent.dur / 1000,
						inputDelay: longestInteractionEvent.inputDelay / 1000,
						processingEnd:
							longestInteractionEvent.processingEnd -
							trace.Meta.traceBounds.min,
						processingStart:
							longestInteractionEvent.processingStart -
							trace.Meta.traceBounds.min,
					}
				: {};

			const _animationFrames = longestInteractionEvent
				? trace.Animations.animationFrames.filter(
						(frame) =>
							(frame.ts >= longestInteractionEvent.ts ||
								frame.ts + frame.dur >= longestInteractionEvent.ts) &&
							frame.ts <=
								longestInteractionEvent.ts + longestInteractionEvent.dur,
					)
				: undefined;

			const mappedAnimationFrames = _animationFrames?.map((animationFrame) => {
				return animationFrame.phases.map((phase) => {
					const rawEvent =
						// @ts-ignore the rawSourceEvent is not typed
						phase.rawSourceEvent as TraceEventAnimationFrameScriptGroupingEvent;
					const animationFrameEventMeta =
						rawEvent.args?.animation_frame_script_timing_info;
					const eventDuration = microSecondsToMilliSeconds(
						(phase.dur as Micro) || (0 as Micro),
					);
					const eventDurationStr = msOrSDisplay(eventDuration);
					return {
						animationFrameEventMeta,
						eventDurationStr,
					};
				});
			});

			INP = {
				metric: 'INP',
				metricValue: interactionDur,
				metricType: MetricType.TIME,
				recommendations: [
					insights?.model.InteractionToNextPaint.strings.description,
				],
				metricScore:
					interactionDur > 200
						? interactionDur > 500
							? MetricScoreClassification.BAD
							: MetricScoreClassification.OK
						: MetricScoreClassification.GOOD,
				metricBreakdown: [
					{
						label: 'Input delay',
						value: inputDelay,
					},
					{
						label: 'Processing',
						value: processing,
					},
					{
						label: 'Presentation delay',
						value: presentationDelay,
					},
				],
				infoContent: `The interaction responsible for the INP score was a ${
					longestInteractionEvent.type
				} happening at ${msOrSDisplay(
					microSecondsToMilliSeconds(
						// @ts-expect-error
						longestInteractionEvent.ts - (traceWindow.min || 0),
					),
				)}.`,
				rawEvent: {
					ts: longestInteractionEvent.ts,
					dur: longestInteractionEvent.dur,
					pid: longestInteractionEvent.pid,
					tid: longestInteractionEvent.tid,
				},
				extras: {
					formattedEvent,
					timeline: {
						min: traceWindow.min,
						max: traceWindow.max,
						range: traceWindow.range,
					},
					animationFrames: mappedAnimationFrames,
				},
			} as InsightsReport;
		}
	}

	return { LCP, CLS, INP };
}
