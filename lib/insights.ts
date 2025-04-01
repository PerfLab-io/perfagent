import { microSecondsToMilliSeconds } from '@paulirish/trace_engine/core/platform/Timing';
import {
	InsightSet,
	type InsightModels,
} from '@paulirish/trace_engine/models/trace/insights/types';
import { type Micro } from '@paulirish/trace_engine/models/trace/types/Timing';
import { UserInteractionsData } from '@paulirish/trace_engine/models/trace/handlers/UserInteractionsHandler';
import { TraceTopic, msOrSDisplay } from './trace';
import { Handlers } from '@paulirish/trace_engine';
import * as Trace from '@paulirish/trace_engine/models/trace/trace.js';

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
	OK = 'ok',
	BAD = 'bad',
	UNCLASSIFIED = 'unclassified',
}

export type InsightsReport = {
	metric: string;
	metricTitle?: string;
	metricValue: number;
	metricType: MetricType;
	metricBreakdown: { label: string; value: number }[];
	metricScore?: MetricScoreClassification;
	infoContent?: string;
	recommendations?: string[];
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

	// INFO: TODO: The main frame may have multiple navigations, depending on the trace
	// we must account for that in the future.
	const insights = traceInsights.get(selectedNavigation);

	const LCPEvent = mainFrameMetrics.find(
		(metric) => metric.name === 'largestContentfulPaint::Candidate',
	);

	const layoutShifts = LayoutShifts.clusters;

	let CLS: InsightsReport | undefined = undefined;
	let LCP: InsightsReport | undefined = undefined;
	let INP: InsightsReport | undefined = undefined;

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

			if (navigationTimings) {
				for (const [key, value] of navigationTimings.entries()) {
					const normalizedTiming = microSecondsToMilliSeconds(value.timing);
					if (key === 'LCP') {
						_lcp.metricValue = normalizedTiming;
						// @ts-ignore
						_lcp.metricScore = value.classification;
					} else {
						_lcp.metricBreakdown.push({
							label: key,
							value: normalizedTiming,
						});
					}
				}

				_lcp.infoContent = `The LCP event happened at ${msOrSDisplay(
					// @ts-expect-error
					microSecondsToMilliSeconds(LCPEvent.ts - (traceWindow.min || 0)),
				)}.`;

				if (
					insights &&
					!(insights.model.LCPPhases instanceof Error) &&
					insights.model.LCPPhases
				) {
					const renderDelay = ((insights.model.LCPPhases.phases?.renderDelay ||
						0) * 1000) as Micro;
					const ttfb = ((insights.model.LCPPhases.phases?.ttfb || 0) *
						1000) as Micro;
					const lcpEvent = LCPEvent.ts;
					const loadTime =
						(insights.model.LCPPhases.phases?.loadTime || 0) * 1000;
					const loadDelay =
						(insights.model.LCPPhases.phases?.loadDelay || 0) * 1000;
					const hasDelays = loadDelay !== 0 && loadTime !== 0;

					const renderStart = lcpEvent - renderDelay;
					const loadBegin = renderStart - loadTime;
					const loadDelayStart = loadBegin - loadDelay;
					const reqStart = hasDelays
						? loadDelayStart - ttfb
						: renderStart - ttfb;

					const phases = !hasDelays
						? [
								{
									name: 'TTFB',
									start: reqStart as Micro,
									end: renderStart as Micro,
								},
								{
									name: 'Render Delay',
									start: renderStart as Micro,
									end: lcpEvent as Micro,
								},
							]
						: [
								{
									name: 'TTFB',
									start: reqStart as Micro,
									end: loadDelayStart as Micro,
								},
								{
									name: 'Resource Load Delay',
									start: loadDelayStart as Micro,
									end: loadBegin as Micro,
								},
								{
									name: 'Download Time',
									start: loadBegin as Micro,
									end: renderStart as Micro,
								},
								{
									name: 'Render Delay',
									start: renderStart as Micro,
									end: lcpEvent as Micro,
								},
							];

					const lcpRequest = insights.model.LCPPhases.lcpRequest;
					const documentRequest =
						insights.model.DocumentLatency.data?.documentRequest?.ts || 0;

					_lcp.metricBreakdown = [];
					Array.from(
						Object.entries(insights.model.LCPPhases.phases || {}),
					).forEach(([key]) => {
						// @ts-ignore
						const value = insights.model.LCPPhases.phases[key] as number;

						if (!value) return;

						_lcp.metricBreakdown.push({
							label: LCPMetricPhases[key as keyof typeof LCPMetricPhases],
							value: value,
						});
					});
					_lcp.recommendations = [];

					if (
						insights.model.LCPDiscovery.checklist &&
						!insights.model.LCPDiscovery.checklist.priorityHinted
					) {
						_lcp.recommendations.push(
							`Increase priority hint for the LCP resource.
                    This resource is critical for the user experience and should use fetchpriorit=high.`,
						);
					}
					if (
						insights.model.LCPDiscovery.checklist &&
						!insights.model.LCPDiscovery.checklist.requestDiscoverable
					) {
						_lcp.recommendations.push(
							`Consider preload the LCP image, or have it being discovered on the initial document load.
                    This LCP image has a total load delay of ${msOrSDisplay(
											insights.model.LCPPhases.phases?.loadDelay || 0,
										)}.
                    Sometimes your LCP image may be correctly placed in the document but other resources from
                    part of the [critical rendering path](https://web.dev/learn/performance/understanding-the-critical-path) are blocking its discovery till a later time.`,
						);
					}
					if (
						insights.model.LCPDiscovery.checklist &&
						!insights.model.LCPDiscovery.checklist.eagerlyLoaded
					) {
						_lcp.recommendations.push(
							`Remove lazy loading from the LCP image.
                    The LCP image should be loaded as soon as possible to avoid a delay in rendering.`,
						);
					}
				}

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

			const inpPhases = [
				{
					name: 'Input delay',
					start: longestInteractionEvent.ts,
					end: (longestInteractionEvent.ts +
						longestInteractionEvent.inputDelay) as Micro,
				},
				{
					name: 'Processing',
					start: longestInteractionEvent.processingStart,
					end: longestInteractionEvent.processingEnd,
				},
				{
					name: 'Presentation delay',
					start: longestInteractionEvent.processingEnd,
					end: (longestInteractionEvent.processingEnd +
						longestInteractionEvent.presentationDelay) as Micro,
				},
			];

			INP = {
				metric: 'INP',
				metricValue: interactionDur,
				metricType: MetricType.TIME,
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
				rawEvent: longestInteractionEvent,
			} as InsightsReport;

			const _inpRecommendations: Array<string> = [];

			if (_inpRecommendations.length > 0) {
				INP.recommendations = _inpRecommendations;
			}
		}
	}

	return { LCP, CLS, INP };
}

export async function analyzeInsightsForTopic(
	insights: [string, InsightSet][],
	userInteractions: UserInteractionsData,
	topic: TraceTopic,
) {
	const microToMs = (micro: number) => micro / 1000;
	const insightsArray = insights;
	let resultingString = '';

	// Redact info to minimize context window and embedding size
	for (let i = 0; i < insightsArray.length; i++) {
		const [navId, insights] = insightsArray[i];

		const insightKeys = Object.keys(insights.model) as (keyof InsightModels)[];
		for (const key of insightKeys) {
			let insight = insights.model[key];

			if (key === 'InteractionToNextPaint') {
				const {
					relatedEvents = [],
					longestInteractionEvent,
					highPercentileInteractionEvent,
				} = insight as InsightModels['InteractionToNextPaint'];
				const redactedEvents = [];
				for (const event of relatedEvents) {
					let evtData;
					if (Array.isArray(event)) {
						const [_evtData] = event;
						evtData = _evtData;
					} else {
						evtData = event;
					}
					delete evtData.args;
					evtData.processingStart = `${microToMs(insights.bounds.min - evtData.processingStart)}ms`;
					evtData.processingEnd = `${microToMs(insights.bounds.min - evtData.processingEnd)}ms`;
					evtData.inputDelay = `${microToMs(insights.bounds.min - evtData.inputDelay)}ms`;
					evtData.mainThreadHandling = `${microToMs(insights.bounds.min - evtData.mainThreadHandling)}ms`;
					evtData.presentationDelay = `${microToMs(insights.bounds.min - evtData.presentationDelay)}ms`;

					redactedEvents.push(evtData);
				}
				let longestInteractionEventData;
				if (longestInteractionEvent) {
					const { rawSourceEvent, args, ...rest } = longestInteractionEvent;
					longestInteractionEventData = rest;
					longestInteractionEventData.processingStart = `${microToMs(
						insights.bounds.min - longestInteractionEventData.processingStart,
					)}ms`;
					longestInteractionEventData.processingEnd = `${microToMs(
						insights.bounds.min - longestInteractionEventData.processingEnd,
					)}ms`;
					longestInteractionEventData.inputDelay = `${microToMs(
						insights.bounds.min - longestInteractionEventData.inputDelay,
					)}ms`;
					longestInteractionEventData.mainThreadHandling = `${microToMs(
						insights.bounds.min -
							longestInteractionEventData.mainThreadHandling,
					)}ms`;
					longestInteractionEventData.presentationDelay = `${microToMs(
						insights.bounds.min - longestInteractionEventData.presentationDelay,
					)}ms`;
				}

				let highPercentileInteractionEventData;
				if (highPercentileInteractionEvent) {
					const { rawSourceEvent, args, ...rest } =
						highPercentileInteractionEvent;
					highPercentileInteractionEventData = rest;
					highPercentileInteractionEventData.processingStart = `${microToMs(
						insights.bounds.min -
							highPercentileInteractionEventData.processingStart,
					)}ms`;
					highPercentileInteractionEventData.processingEnd = `${microToMs(
						insights.bounds.min -
							highPercentileInteractionEventData.processingEnd,
					)}ms`;
					highPercentileInteractionEventData.inputDelay = `${microToMs(
						insights.bounds.min - highPercentileInteractionEventData.inputDelay,
					)}ms`;
					highPercentileInteractionEventData.mainThreadHandling = `${microToMs(
						insights.bounds.min -
							highPercentileInteractionEventData.mainThreadHandling,
					)}ms`;
					highPercentileInteractionEventData.presentationDelay = `${microToMs(
						insights.bounds.min -
							highPercentileInteractionEventData.presentationDelay,
					)}ms`;
				}

				insight.relatedEvents = redactedEvents;
				insight.longestInteractionEvent = longestInteractionEventData;
				insight.highPercentileInteractionEvent =
					highPercentileInteractionEventData;

				const { longestInteractionEvent: _longestInteractionEvent } =
					userInteractions;

				console.log(
					{ longestInteractionEvent },
					'########Longest Interaction Event##########',
				);

				if (_longestInteractionEvent) {
					const interactionDur = microSecondsToMilliSeconds(
						_longestInteractionEvent.dur,
					);

					console.log(
						{ _longestInteractionEvent },
						'Longest Interaction Event',
					);

					const inputDelay = microSecondsToMilliSeconds(
						_longestInteractionEvent.inputDelay,
					);

					const processingStart = microSecondsToMilliSeconds(
						// @ts-ignore
						_longestInteractionEvent.rawSourceEvent.args.data.processingStart,
					);

					const processingEnd = microSecondsToMilliSeconds(
						// @ts-ignore
						_longestInteractionEvent.rawSourceEvent.args.data.processingEnd,
					);

					const presentationDelay = microSecondsToMilliSeconds(
						_longestInteractionEvent.presentationDelay,
					);

					const processing = processingEnd - processingStart;

					const inpPhases = [
						{
							name: 'Input delay',
							start: _longestInteractionEvent.ts,
							end: (_longestInteractionEvent.ts + inputDelay) as Micro,
						},
						{
							name: 'Processing',
							start: processingStart,
							end: processingEnd,
						},
						{
							name: 'Presentation delay',
							start: processingEnd,
							end: processingEnd + presentationDelay,
						},
					];

					const INP = {
						metric: 'INP',
						metricValue: msOrSDisplay(interactionDur),
						metricType: 'time',
						metricScore:
							interactionDur > 200
								? interactionDur > 500
									? 'poor'
									: 'average'
								: 'good',
						metricBreakdown: [
							{
								label: 'Input delay',
								value: msOrSDisplay(inputDelay),
							},
							{
								label: 'Processing',
								value: msOrSDisplay(processing),
							},
							{
								label: 'Presentation delay',
								value: msOrSDisplay(presentationDelay),
							},
						],
						metricPhases: inpPhases,
						infoContent: `The interaction responsible for the INP score was a ${
							_longestInteractionEvent.type
						} happening at ${msOrSDisplay(
							microSecondsToMilliSeconds(
								(_longestInteractionEvent.ts -
									(insights.bounds.min || 0)) as Micro,
							),
						)}.`,
					};

					insight.summary = INP;
				}
			}

			if (key === 'ThirdParties') {
				let thirdPartyInsightData;
				const { relatedEvents, eventsByEntity, ...rest } =
					insight as InsightModels['ThirdParties'];
				thirdPartyInsightData = rest;
				insight = thirdPartyInsightData;
			}

			insights.model[key] = insight;
		}

		insightsArray[i] = [navId, insights];
		console.log({ topic }, 'Topic');

		if (topic) {
			return insights.model[topic].summary;
		} else {
			return insights;
		}
	}
}
