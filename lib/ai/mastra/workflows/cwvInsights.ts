import { reportFormat } from '@/lib/ai/prompts';
import { coreMessageSchema, DataStreamWriter } from 'ai';

import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import dedent from 'dedent';

const messageSchema = coreMessageSchema;

const topicStep = new Step({
	id: 'analysis-topic',
	description: 'Picks a topic based on the user prompt',
	inputSchema: z.object({
		messages: z.array(messageSchema),
	}),
	outputSchema: z.object({
		topic: z
			.enum(['LCP', 'CLS', 'INP'])
			.describe(
				'Insight topic to analyze based on the user prompt. The list reffers to CLS, INP and LCP related queries',
			),
	}),
	execute: async ({ context, mastra, runId }) => {
		const { messages, dataStream } = context.getStepResult<{
			messages: z.infer<typeof messageSchema>[];
			dataStream: DataStreamWriter;
		}>('trigger');

		if (!mastra) {
			throw new Error('Mastra not found');
		}

		dataStream.writeData({
			type: 'text',
			runId,
			status: 'started',
			content: {
				type: 'trace-insight',
				data: {
					id: 'trace-insight',
					type: 'trace-insight',
					timestamp: Date.now(),
					title: 'Trace Analysis',
					message: 'Selecting topic...',
				},
			},
		});

		const response = await mastra.getAgent('topicsAgent').generate(messages, {
			output: z.object({
				topic: z
					.enum(['LCP', 'CLS', 'INP'])
					.describe(
						'Insight topic to analyze based on the user prompt. The list reffers to CLS, INP and LCP related queries',
					),
			}),
		});

		dataStream.writeData({
			type: 'text',
			runId,
			status: 'in-progress',
			content: {
				type: 'trace-insight',
				data: {
					id: 'trace-insight',
					type: 'trace-insight',
					timestamp: Date.now(),
					title: 'Trace Analysis',
					message: `Selected topic: ${response.object.topic}`,
				},
			},
		});

		return {
			topic: response.object.topic,
		};
	},
});

const insightReportSchema = z.object({
	metric: z.string(),
	metricValue: z.number(),
	metricType: z.enum(['time', 'score']),
	metricBreakdown: z.array(z.object({ label: z.string(), value: z.number() })),
	metricScore: z
		.enum(['good', 'needs improvement', 'bad', 'unclassified'])
		.optional(),
	extras: z.object({
		formattedEvent: z.object({
			ts: z.number(),
			dur: z.number(),
			inputDelay: z.number(),
			processingStart: z.number(),
			processingEnd: z.number(),
			presentationDelay: z.number(),
		}),
		timeline: z.object({
			min: z.number(),
			max: z.number(),
			range: z.number(),
		}),
	}),
});

const insightsSchema = z.object({
	LCP: insightReportSchema,
	CLS: insightReportSchema,
	INP: insightReportSchema,
});

const analyzeTrace = new Step({
	id: 'analyze-trace',
	description: 'Analyzes a trace insights',
	execute: async ({ context, mastra, runId }) => {
		const triggerData = context?.getStepResult<{
			insights: z.infer<typeof insightsSchema>;
			dataStream: DataStreamWriter;
		}>('trigger');
		const topicStepResult = context?.getStepResult<{
			topic: string;
		}>('analysis-topic');

		if (!triggerData) {
			throw new Error('Trigger data not found');
		}
		if (!mastra) {
			throw new Error('Mastra not found');
		}

		const { dataStream: dataStreamWriter, insights } = triggerData;
		const { topic } = topicStepResult;

		dataStreamWriter.writeData({
			type: 'text',
			runId,
			status: 'in-progress',
			content: {
				type: 'trace-insight',
				data: {
					id: 'trace-insight',
					type: 'trace-insight',
					timestamp: Date.now(),
					title: 'Trace Analysis',
					message: `Analyzing trace insights for ${topic}...`,
				},
			},
		});

		const insightsForTopic = ((topic) => {
			if (topic === 'LCP') {
				return triggerData.insights.LCP;
			}
			if (topic === 'CLS') {
				return triggerData.insights.CLS;
			}
			if (topic === 'INP') {
				return triggerData.insights.INP;
			}
		})(topicStepResult.topic);

		try {
			if (!insightsForTopic) {
				return {
					type: 'trace_analysis',
					error: 'No trace data provided',
				};
			}

			dataStreamWriter.writeData({
				type: 'text',
				runId,
				status: 'in-progress',
				content: {
					type: 'trace-insight',
					data: {
						id: 'trace-insight',
						type: 'trace-insight',
						timestamp: Date.now(),
						title: 'Trace Analysis',
						message: `Generating report based on insights for ${topic}...`,
					},
				},
			});

			console.log('insightsForTopic complete: ', insightsForTopic.metric);

			// Generate the analysis content
			const reportStream = await mastra.getAgent('largeAssistant').stream([
				{
					role: 'user',
					content: reportFormat,
				},
				{
					role: 'user',
					content: dedent`
					Data for the report on the ${topic} metric:
					\`\`\`json
					${JSON.stringify(insightsForTopic, null, 2)}
					\`\`\`
					`,
				},
			]);

			let report = '';
			for await (const chunk of reportStream.textStream) {
				report += chunk;

				console.log('report: ', report);
				dataStreamWriter.writeData({
					type: 'text',
					runId,
					status: 'in-progress',
					content: {
						type: 'text-delta',
						data: chunk,
					},
				});
			}

			dataStreamWriter.writeData({
				type: 'text',
				runId,
				status: 'complete',
				content: {
					type: 'trace-insight',
					data: {
						id: 'trace-insight',
						type: 'trace-insight',
						timestamp: Date.now(),
						title: 'Trace Analysis',
						message: 'Report generated',
					},
				},
			});

			// Add a stream with final remarks
			const agentStream = await mastra.getAgent('largeAssistant').stream([
				{
					role: 'user',
					content: `Provide a concluding remark about this web performance metric:
					${JSON.stringify(insightsForTopic)}

					Be concise and verify with me if the there's interest in further research into a specific topic or point from the report (suggesting possible research topics based on the report).`,
				},
			]);

			agentStream.mergeIntoDataStream(dataStreamWriter);

			return {
				type: 'trace_analysis',
				topic,
				insightsForTopic,
			};
		} catch (error) {
			console.error('Error in trace analysis tool:', error);
			return {
				type: 'trace_analysis',
				error:
					error instanceof Error
						? error.message
						: 'Failed to analyze trace data',
			};
		}
	},
});

const cwvInsightsWorkflow = new Workflow({
	name: 'trace-analysis-workflow',
	triggerSchema: z.object({
		dataStream: z.object({
			writeData: z.function().args(
				z.object({
					type: z.string(),
					content: z.any(),
				}),
			),
		}),
		messages: z.array(messageSchema),
		insights: insightsSchema.describe('The insights to analyze'),
	}),
})
	.step(topicStep)
	.then(analyzeTrace);

cwvInsightsWorkflow.commit();

export { cwvInsightsWorkflow };
