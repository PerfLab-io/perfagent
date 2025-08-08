import * as Trace from '@perflab/trace_engine/models/trace/trace.js';
import { MetaData } from '@perflab/trace_engine/models/trace/types/File';

// Worker-specific yieldToMain implementation
function yieldToMain() {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

async function analyzeEvents(
	traceEvents: Trace.Types.Events.Event[],
	metadata: MetaData,
) {
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
	return { parsedTrace, insights, model, metadata };
}

async function analyzeTrace(contents: string) {
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

async function analyzeTraceFromFile(file: File): Promise<string> {
	return await file.text();
}

export interface TraceWorkerMessage {
	type: 'analyzeTraceFromFile' | 'analyzeTrace';
	contents: string;
}

export interface TraceWorkerResponse {
	type: 'success' | 'error' | 'progress';
	data?: {
		result: any;
	};
	error?: string;
	progress?: {
		phase: string;
		percentage: number;
	};
}

self.onmessage = async (e: MessageEvent<TraceWorkerMessage>) => {
	const { type, contents } = e.data;

	try {
		let result;
		if (type === 'analyzeTraceFromFile') {
			// For analyzeTraceFromFile, we just return the contents (file.text() equivalent)
			result = contents;
		} else if (type === 'analyzeTrace') {
			// Just run analyzeTrace in the worker - this is the heavy operation
			result = await analyzeTrace(contents);
		} else {
			throw new Error('Invalid message type');
		}
		
		self.postMessage({
			type: 'success',
			data: { result },
		} as TraceWorkerResponse);
	} catch (error) {
		self.postMessage({
			type: 'error',
			error: error instanceof Error ? error.message : 'Operation failed',
		} as TraceWorkerResponse);
	}
};

export {};