import { microSecondsToMilliSeconds } from '@paulirish/trace_engine/core/platform/Timing';
import { msOrSDisplay } from './trace';
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
					// @ts-expect-error
					microSecondsToMilliSeconds(LCPEvent.ts - (traceWindow.min || 0)),
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
							value: value,
						});
					});
					_lcp.recommendations = [
						insights?.model.LCPDiscovery.strings.description,
					];

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
				rawEvent: longestInteractionEvent,
			} as InsightsReport;
		}
	}

	return { LCP, CLS, INP };
}
