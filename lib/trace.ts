import * as Trace from '@perflab/trace_engine/models/trace/trace.js';
import { MetaData } from '@perflab/trace_engine/models/trace/types/File';
import { yieldToMain } from '@/lib/utils';

export async function analyzeEvents(
	traceEvents: Trace.Types.Events.Event[],
	metadata: MetaData,
) {
	const model = Trace.TraceModel.Model.createWithAllHandlers();

	await yieldToMain();

	await model.parse(traceEvents);

	await yieldToMain();

	const parsedTrace = model.parsedTrace();
	const insights = model.traceInsights();

	if (!parsedTrace) {
		throw new Error('No data');
	}
	if (!insights) {
		throw new Error('No insights');
	}
	return { parsedTrace, insights, model, metadata };
}

export async function analyzeTrace(contents: string) {
	const { traceEvents, metadata } = loadTraceEventsFromFileContents(contents);

	await yieldToMain();

	return analyzeEvents(traceEvents, metadata);
}

function loadTraceEventsFromFileContents(contents: string) {
	const json = JSON.parse(contents);
	if (!json.traceEvents) {
		throw new Error('No trace events');
	}
	const { traceEvents, metadata } = json;
	return { traceEvents, metadata };
}

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

export type TraceAnalysis = {
	parsedTrace: Readonly<
		Trace.Handlers.Types.EnabledHandlerDataWithMeta<
			typeof Trace.Handlers.ModelHandlers
		>
	>;
	insights: Trace.Insights.Types.TraceInsightSets;
	model: Trace.TraceModel.Model;
	metadata: MetaData;
};

export async function analyzeTraceFromFile(
	file: File,
	_topic?: TraceTopic,
): Promise<string> {
	const contents = await file.text();
	return contents;
}
