import * as Trace from '@paulirish/trace_engine/models/trace/trace.js';

export async function analyzeEvents(traceEvents: Trace.Types.Events.Event[]) {
	const model = Trace.TraceModel.Model.createWithAllHandlers();
	await model.parse(traceEvents);
	const parsedTrace = model.parsedTrace();
	const insights = model.traceInsights();

	if (!parsedTrace) {
		throw new Error('No data');
	}
	if (!insights) {
		throw new Error('No insights');
	}
	console.log('insights', insights);
	return { parsedTrace, insights, model };
}

export async function analyzeTrace(contents: string) {
	const traceEvents = loadTraceEventsFromFileContents(contents);
	return analyzeEvents(traceEvents);
}

function loadTraceEventsFromFileContents(contents: string) {
	const json = JSON.parse(contents);
	const traceEvents = json.traceEvents ?? json;
	console.log('traceEvents', traceEvents);
	return traceEvents;
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
};

export async function analyzeTraceFromFile(
	file: File,
	_topic?: TraceTopic,
): Promise<TraceAnalysis> {
	const contents = await file.text();
	return await analyzeTrace(contents);
}
