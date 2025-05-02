import { AICallTree } from '@perflab/trace_engine/panels/timeline/utils/AICallTree';
import { StandaloneCallTreeContext } from '@perflab/trace_engine/panels/ai_assistance/standalone';
import { type Micro } from '@perflab/trace_engine/models/trace/types/Timing';
import { analyzeTrace } from '@/lib/trace';

// Web Worker to handle trace event processing and serialization
self.onmessage = async (e: MessageEvent) => {
	const { traceContents, navigationId } = e.data;

	try {
		// Analyze the trace
		const traceAnalysis = await analyzeTrace(traceContents);

		// Get the longest interaction event
		const longestInteractionEvent =
			traceAnalysis.insights.get(navigationId)?.model.InteractionToNextPaint
				.longestInteractionEvent;

		if (!longestInteractionEvent) {
			throw new Error('No longest interaction event found');
		}

		// Process the trace events for the AI call tree
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

		const callTreeContext = new StandaloneCallTreeContext(aiCallTree);
		const serializedData = callTreeContext.getItem()?.serialize();

		self.postMessage({ serializedData });
	} catch (error) {
		self.postMessage({
			error: error instanceof Error ? error.message : 'Serialization failed',
		});
	}
};

export {};
