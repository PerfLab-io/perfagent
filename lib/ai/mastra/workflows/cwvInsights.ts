import { reportFormat } from '@/lib/ai/prompts';
import { coreMessageSchema, DataStreamWriter } from 'ai';

import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import dedent from 'dedent';
import { renderFlameGraphCanvas } from '@/components/flamegraph/canvas';

import { createRequire } from 'module';
import { microSecondsToMilliSeconds } from '@perflab/trace_engine/core/platform/Timing';
import { msOrSDisplay } from '@/lib/trace';
import { Micro } from '@perflab/trace_engine/models/trace/types/Timing';
const require = createRequire(import.meta.url);

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
	extras: z
		.object({
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
			animationFrames: z.array(
				z.object({
					phases: z.array(
						z.object({
							name: z.string(),
							dur: z.number(),
							ts: z.number(),
							rawSourceEvent: z.any(),
						}),
					),
				}),
			),
		})
		.optional(),
});

const insightsSchema = z.object({
	LCP: insightReportSchema,
	CLS: insightReportSchema,
	INP: insightReportSchema,
});

const extractInsightData = new Step({
	id: 'extract-insight-data',
	description: 'Extracts the insight data from the insights',
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

		const { dataStream: dataStreamWriter } = triggerData;
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

		return {
			insightsForTopic,
			topic,
		};
	},
});

const generateExtraReportData = new Step({
	id: 'generate-extra-report-data',
	description: 'Generates the extra report data',
	execute: async ({ context }) => {
		const { insightsForTopic, topic } = context?.getStepResult<{
			insightsForTopic: z.infer<
				(typeof insightsSchema.shape)['CLS' | 'INP' | 'LCP']
			>;
			topic: string;
		}>('extract-insight-data');

		if (topic === 'INP' && insightsForTopic.extras) {
			let reportDetails: {
				reportImage?: string;
				reportMarkdown?: string;
			} = {};

			const interaction = insightsForTopic.extras.formattedEvent;
			const startTime = (interaction?.ts || 0) - 30_000;
			const endTime =
				(interaction?.ts || 0) + (interaction?.dur || 0) + 300_000;
			const timeline = insightsForTopic.extras.timeline;

			try {
				// Try to load the node canvas module and render the interactions track
				const { createCanvas } = require('canvas');
				const canvas = createCanvas(600, 400);
				// @ts-ignore the types are meant to be equivalent
				const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

				if (!ctx) {
					throw new Error('Failed to create canvas context');
				}

				renderFlameGraphCanvas({
					ctx,
					width: 600,
					height: 400,
					viewState: {
						startTime,
						endTime,
						topDepth: 0,
						visibleDepthCount: 0,
					},
					processedData: null,
					showInteractions: true,
					showAnnotations: false,
					interactions: [insightsForTopic.extras.formattedEvent],
					annotations: [],
					selectedAnnotation: null,
				});

				reportDetails = {
					reportImage: dedent`
						Use the following image as the flamegraph data for the INP interaction:

						![INP Interaction on timeline](data:image/png;base64,${canvas.toDataURL('image/png')})
						Use the image above on the report on a section to explain the interaction data.
					`,
				};
			} catch (e) {
				console.error(e);
				reportDetails = {
					reportMarkdown: dedent`
					Here's the flamegraph data for the INP interaction (make sure to include the fenced code block as is below):
					\`\`\`flamegraph
					{
						"width": 600,
						"height": 400,
						"timeline": ${JSON.stringify(timeline, null, 2)},
						"interactions": [
							${JSON.stringify(interaction, null, 2)}
						]
					}
					\`\`\`

					Use the block above on the report on a section to explain the interaction data.

					`,
				};
			}

			if (insightsForTopic.extras.animationFrames.length > 0) {
				const eventsOnAnimationFrames =
					insightsForTopic.extras.animationFrames.map((animationFrame) => {
						return animationFrame.phases.map((phase) => {
							const rawEvent =
								// @ts-ignore the rawSourceEvent is not typed
								phase.rawSourceEvent as TraceEventAnimationFrameScriptGroupingEvent;
							const animationFrameEventMeta =
								rawEvent.args?.animation_frame_script_timing_info;
							const eventDuration = microSecondsToMilliSeconds(
								(phase.dur as Micro) || (0 as Micro),
							);
							const eventDurationStr = msOrSDisplay(eventDuration);
							return {
								animationFrameEventMeta,
								eventDurationStr,
							};
						});
					});

				reportDetails.reportMarkdown =
					reportDetails.reportMarkdown +
					dedent`
				Here's the animation frames events data within INP interaction (do not include the fenced code block, use the JSON data in it to provide insights in the report):
				\`\`\`json
				${JSON.stringify(eventsOnAnimationFrames, null, 2)}
				\`\`\`

				Use the JSON data above to generate some insights about the different events that happens on the INP interaction.
				Providing some recommendations based on the data.
				`;
			}
			return {
				reportDetails,
			};
		} else {
			return {
				reportDetails: undefined,
			};
		}
	},
});

const analyzeTrace = new Step({
	id: 'analyze-trace',
	description: 'Analyzes a trace insights',
	execute: async ({ context, mastra, runId }) => {
		const triggerData = context?.getStepResult<{
			dataStream: DataStreamWriter;
			inpInteractionAnimation: string | null;
		}>('trigger');

		const { insightsForTopic, topic } = context?.getStepResult<{
			insightsForTopic: z.infer<
				(typeof insightsSchema.shape)['CLS' | 'INP' | 'LCP']
			>;
			topic: string;
		}>('extract-insight-data');

		const { reportDetails } = context?.getStepResult<{
			reportDetails: {
				reportImage?: string;
				reportMarkdown?: string;
			};
		}>('generate-extra-report-data');

		console.log('reportDetails: ', reportDetails);

		if (!triggerData) {
			throw new Error('Trigger data not found');
		}
		if (!mastra) {
			throw new Error('Mastra not found');
		}

		const { dataStream: dataStreamWriter } = triggerData;

		try {
			if (!insightsForTopic) {
				return {
					type: 'trace_analysis',
					error: 'No trace data provided',
				};
			}

			if (insightsForTopic.extras) {
				// we don't want the extras being handled by the agent directly
				insightsForTopic.extras = undefined;
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
			console.log(
				'insightsForTopic: ',
				JSON.stringify(insightsForTopic, null, 2),
			);
			console.log(
				'inpInteractionAnimation: ',
				triggerData.inpInteractionAnimation,
			);

			// Generate the analysis content
			const reportStream = await mastra.getAgent('reportAssistant').stream([
				{
					role: 'user',
					content: dedent`
					Data for the report on the ${topic} metric:
					\`\`\`json
					${JSON.stringify(insightsForTopic, null, 2)}
					\`\`\`

					${
						reportDetails
							? dedent`And some additional data that must be used to generate the report (do not include the fenced code block, use the data instead):
					\`\`\`json
					${JSON.stringify(reportDetails, null, 2)}
					\`\`\`
					`
							: ''
					}
					
					${
						topic === 'INP' && triggerData.inpInteractionAnimation
							? `Use the following image on the same section of the report as the flamegraph data for the INP interaction, as it represents the moment of the interaction captured from the trace screenshots as an animated webp image:
					![INP Interaction on timeline](${triggerData.inpInteractionAnimation})`
							: ''
					}
					`,
				},
			]);

			for await (const chunk of reportStream.textStream) {
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
		inpInteractionAnimation: z
			.string()
			.or(z.null())
			.describe('The INP interaction animation'),
	}),
})
	.step(topicStep)
	.then(extractInsightData)
	.then(generateExtraReportData)
	.then(analyzeTrace);

cwvInsightsWorkflow.commit();

export { cwvInsightsWorkflow };
