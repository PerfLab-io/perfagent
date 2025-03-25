import { microSecondsToMilliSeconds } from '@paulirish/trace_engine/core/platform/Timing';
import {
	InsightSet,
	type InsightModels,
} from '@paulirish/trace_engine/models/trace/insights/types';
import { type Micro } from '@paulirish/trace_engine/models/trace/types/Timing';
import { UserInteractionsData } from '@paulirish/trace_engine/models/trace/handlers/UserInteractionsHandler';

export const msOrSDisplay: (value: number) => string = (value) => {
	if (value < 1000) {
		return `${value.toFixed(1)}ms`;
	}

	return `${(value / 1000).toFixed(1)}s`;
};

export enum TraceTopic {
	CLSCulprits = 'CLSCulprits',
	DocumentLatency = 'DocumentLatency',
	DOMSize = 'DOMSize',
	FontDisplay = 'FontDisplay',
	ForcedReflow = 'ForcedReflow',
	ImageDelivery = 'ImageDelivery',
	InteractionToNextPaint = 'InteractionToNextPaint',
	LCPDiscovery = 'LCPDiscovery',
	LCPPhases = 'LCPPhases',
	LongCriticalNetworkTree = 'LongCriticalNetworkTree',
	RenderBlocking = 'RenderBlocking',
	SlowCSSSelector = 'SlowCSSSelector',
	ThirdParties = 'ThirdParties',
	Viewport = 'Viewport',
}

export async function analyzeInsights(
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
