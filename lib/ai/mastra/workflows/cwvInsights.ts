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
	execute: async ({ context, mastra }) => {
		const triggerData = context.getStepResult<{
			messages: z.infer<typeof messageSchema>[];
		}>('trigger');

		if (!mastra) {
			throw new Error('Mastra not found');
		}

		const response = await mastra
			.getAgent('topicsAgent')
			.generate(triggerData?.messages, {
				output: z.object({
					topic: z
						.enum(['LCP', 'CLS', 'INP'])
						.describe(
							'Insight topic to analyze based on the user prompt. The list reffers to CLS, INP and LCP related queries',
						),
				}),
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
	execute: async ({ context, mastra }) => {
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

		dataStreamWriter.writeMessageAnnotation({
			type: 'text',
			data: {
				topic,
				insights,
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

			dataStreamWriter.writeMessageAnnotation({
				type: 'trace_analysis_update',
				data: {
					id: 'trace-insights',
					type: 'trace-insight',
					status: 'started',
					topic,
					timestamp: Date.now(),
				},
			});

			dataStreamWriter.writeMessageAnnotation({
				type: 'trace_analysis_update',
				data: {
					id: 'trace-insights',
					type: 'trace-insight',
					status: 'completed',
					topic,
					traceInsight: insightsForTopic,
					timestamp: Date.now(),
				},
			});

			console.log('insightsForTopic complete: ', insightsForTopic.metric);

			const agentStream = await mastra.getAgent('largeAssistant').stream([
				{
					role: 'user',
					content: reportFormat,
				},
				{
					role: 'user',
					content: `Data for the report: ${JSON.stringify(insightsForTopic)}`,
				},
			]);

			agentStream.mergeIntoDataStream(dataStreamWriter, {
				sendReasoning: true,
				sendSources: true,
				experimental_sendStart: true,
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
			writeMessageAnnotation: z.function().args(
				z.object({
					type: z.string(),
					data: z.any(),
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
