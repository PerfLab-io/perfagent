import { registerTool } from '../mock-ai-sdk';
import type { DataStream } from '../mock-ai-sdk';

export const generateBreakdownTool = registerTool({
	name: 'generateBreakdown',
	description:
		'Generates a breakdown of web performance metrics and optimization techniques',
	execute: async (params: { query: string }) => {
		// Mock data for web performance metrics breakdown
		const performanceData = {
			coreWebVitals: 5,
			userExperience: 4,
			resourceOptimization: 3,
		};

		return {
			type: 'breakdown',
			data: performanceData,
		};
	},
	// Add streaming support similar to the research tool
	stream: async function* (
		params: { query: string; toolCallId?: string },
		dataStream?: DataStream,
	) {
		const toolCallId =
			params.toolCallId ||
			`breakdown-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

		// Send initial annotation
		if (dataStream?.writeMessageAnnotation) {
			dataStream.writeMessageAnnotation({
				type: 'breakdown_update',
				data: {
					id: 'breakdown-start',
					type: 'progress',
					status: 'running',
					title: 'Performance Metrics Breakdown',
					message: 'Analyzing performance data...',
					timestamp: Date.now(),
					progress: 0,
				},
			});
		}

		// Increase initial processing time to 3 seconds for better testing
		await new Promise((resolve) => setTimeout(resolve, 3000));

		// Send progress update
		if (dataStream?.writeMessageAnnotation) {
			dataStream.writeMessageAnnotation({
				type: 'breakdown_update',
				data: {
					id: 'breakdown-progress',
					type: 'progress',
					status: 'running',
					message: 'Processing Core Web Vitals...',
					timestamp: Date.now(),
					progress: 25,
				},
			});
		}

		// Add another delay and progress update at 50%
		await new Promise((resolve) => setTimeout(resolve, 2500));

		if (dataStream?.writeMessageAnnotation) {
			dataStream.writeMessageAnnotation({
				type: 'breakdown_update',
				data: {
					id: 'breakdown-progress',
					type: 'progress',
					status: 'running',
					message: 'Analyzing performance metrics distribution...',
					timestamp: Date.now(),
					progress: 50,
				},
			});
		}

		// Add another delay and progress update at 75%
		await new Promise((resolve) => setTimeout(resolve, 2500));

		if (dataStream?.writeMessageAnnotation) {
			dataStream.writeMessageAnnotation({
				type: 'breakdown_update',
				data: {
					id: 'breakdown-progress',
					type: 'progress',
					status: 'running',
					message: 'Finalizing performance breakdown...',
					timestamp: Date.now(),
					progress: 75,
				},
			});
		}

		// Final delay before completion
		await new Promise((resolve) => setTimeout(resolve, 2500));

		// Mock data for web performance metrics breakdown
		const performanceData = {
			coreWebVitals: 5,
			userExperience: 4,
			resourceOptimization: 3,
		};

		// Send completion annotation
		if (dataStream?.writeMessageAnnotation) {
			dataStream.writeMessageAnnotation({
				type: 'breakdown_update',
				data: {
					id: 'breakdown-complete',
					type: 'progress',
					status: 'completed',
					message: 'Performance metrics breakdown complete',
					timestamp: Date.now(),
					progress: 100,
					isComplete: true,
				},
			});
		}

		// Return the final result
		yield {
			type: 'breakdown',
			data: performanceData,
			toolCallId,
		};
	},
});
