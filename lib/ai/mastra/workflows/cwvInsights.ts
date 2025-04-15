import { reportFormat } from '@/lib/ai/prompts';
import { coreMessageSchema, DataStreamWriter } from 'ai';

import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';

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
			content: {
				type: 'trace-insight',
				data: {
					id: 'trace-insight',
					type: 'trace-insight',
					status: 'started',
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
			content: {
				type: 'trace-insight',
				data: {
					id: 'trace-insight',
					type: 'trace-insight',
					status: 'in-progress',
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
			content: {
				type: 'trace-insight',
				data: {
					id: 'trace-insight',
					type: 'trace-insight',
					status: 'in-progress',
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
				content: {
					type: 'trace-insight',
					data: {
						id: 'trace-insight',
						type: 'trace-insight',
						status: 'in-progress',
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
					content: `Data for the report: ${JSON.stringify(insightsForTopic)}`,
				},
			]);

			for await (const chunk of reportStream.textStream) {
				dataStreamWriter.writeData({
					type: 'text',
					runId,
					content: {
						type: 'text-delta',
						data: chunk,
					},
				});
			}

			// Add a stream with final remarks
			const agentStream = await mastra.getAgent('largeAssistant').stream([
				{
					role: 'assistant',
					content: `I now shall provide a concluding remark about this web performance metric:
					${JSON.stringify(insightsForTopic)}

					Being concise and verify with the user if the there's interest in further research into a specific topic or point from the report.`,
				},
			]);

			agentStream.mergeIntoDataStream(dataStreamWriter, {
				sendReasoning: true,
			});

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
