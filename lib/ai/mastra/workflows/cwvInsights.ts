import { type CoreMessage, type DataStreamWriter, coreMessageSchema } from 'ai';

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import dedent from 'dedent';
import { renderFlameGraphCanvas } from '@/components/flamegraph/canvas';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const messageSchema = coreMessageSchema;

// Common base schemas
const rawEventSchema = z.object({
	ts: z.number(),
	pid: z.number(),
	tid: z.number(),
	dur: z.number().optional(),
});

const timelineSchema = z.object({
	min: z.number(),
	max: z.number(),
	range: z.number(),
});

const metricBreakdownSchema = z.array(
	z.object({ label: z.string(), value: z.number() })
);

const metricScoreSchema = z.enum([
	'good',
	'needs improvement',
	'bad',
	'unclassified',
]);

const topicSchema = z.enum(['LCP', 'CLS', 'INP']);

// Event and animation frame schemas
const formattedEventSchema = z.object({
	ts: z.number(),
	dur: z.number(),
	inputDelay: z.number(),
	processingStart: z.number(),
	processingEnd: z.number(),
	presentationDelay: z.number(),
});

const animationPhaseSchema = z.object({
	name: z.string(),
	dur: z.number(),
	ts: z.number(),
	rawSourceEvent: z.any(),
});

const animationFrameSchema = z.object({
	phases: z.array(animationPhaseSchema),
});

// Extras union schemas
const inpExtrasSchema = z.object({
	formattedEvent: formattedEventSchema,
	timeline: timelineSchema,
	animationFrames: z.array(animationFrameSchema),
});

const lcpExtrasSchema = z.object({
	networkStackInfo: z.string(),
});

const extrasSchema = inpExtrasSchema.or(lcpExtrasSchema);

// Report details schema
const reportDetailsSchema = z.object({
	reportImage: z.string().optional(),
	reportMarkdown: z.string().optional(),
});

const insightReportSchema = z.object({
	metric: z.string(),
	metricValue: z.number(),
	metricType: z.enum(['time', 'score']),
	metricBreakdown: metricBreakdownSchema,
	metricScore: metricScoreSchema.optional(),
	rawEvent: rawEventSchema.optional(),
	extras: extrasSchema.optional(),
});

const insightsSchema = z.object({
	LCP: insightReportSchema,
	CLS: insightReportSchema,
	INP: insightReportSchema,
});

const workflowInputSchema = z.object({
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
	aiContext: z
		.string()
		.or(z.null())
		.describe('The call tree context serialized'),
});

const topicSchemaOutput = z.object({
	topic: topicSchema.describe(
		'Insight topic to analyze based on the user prompt. The list reffers to CLS, INP and LCP related queries',
	),
});

type TriggerSchema = {
	messages: CoreMessage[];
	insights: z.infer<typeof insightsSchema>;
	inpInteractionAnimation: string | null;
	aiContext: string | null;
	dataStream: DataStreamWriter;
};

const topicStep = createStep({
	id: 'analysis-topic',
	inputSchema: workflowInputSchema,
	outputSchema: topicSchemaOutput,
	execute: async ({ mastra, runId, getInitData }) => {
		const triggerData = getInitData() as TriggerSchema;
		const { dataStream, messages } = triggerData;

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
			output: topicSchemaOutput,
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

const extractInsightData = createStep({
	id: 'extract-insight-data',
	inputSchema: topicSchemaOutput,
	outputSchema: z.object({
		insightsForTopic: insightReportSchema,
		topic: topicSchema,
	}),
	execute: async ({ mastra, runId, getInitData, inputData }) => {
		const { topic } = inputData;

		const triggerData = getInitData() as TriggerSchema;
		const { insights, dataStream } = triggerData;

		if (!mastra) {
			throw new Error('Mastra not found');
		}

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
					message: `Analyzing trace insights for ${topic}...`,
				},
			},
		});

		const insightsForTopic = ((topic) => {
			if (topic === 'LCP') {
				return insights.LCP;
			}
			if (topic === 'CLS') {
				return insights.CLS;
			}
			if (topic === 'INP') {
				return insights.INP;
			}
			return insights.LCP; // fallback
		})(topic);

		return {
			insightsForTopic,
			topic,
		};
	},
});

const generateExtraReportData = createStep({
	id: 'generate-extra-report-data',
	inputSchema: z.object({
		insightsForTopic: insightReportSchema,
		topic: topicSchema,
	}),
	outputSchema: z.object({
		insightsForTopic: insightReportSchema,
		topic: topicSchema,
		reportDetails: reportDetailsSchema.optional(),
	}),
	execute: async ({ inputData }) => {
		const { insightsForTopic, topic } = inputData;

		if (topic === 'INP' && insightsForTopic.extras && 'formattedEvent' in insightsForTopic.extras) {
			let reportDetails: {
				reportImage?: string;
				reportMarkdown?: string;
			} = {};

			const inpExtras = insightsForTopic.extras as z.infer<typeof inpExtrasSchema>;
			const interaction = inpExtras.formattedEvent;
			const startTime = (interaction?.ts || 0) - 30_000;
			const endTime =
				(interaction?.ts || 0) + (interaction?.dur || 0) + 300_000;
			const timeline = inpExtras.timeline;

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
					interactions: [inpExtras.formattedEvent],
					annotations: [],
					selectedAnnotation: null,
				});

				reportDetails = {
					reportImage: dedent`
						Use the following image as the flamegraph data for the INP interaction:

						![INP Interaction on timeline](data:image/png;base64,${canvas.toDataURL('image/png')})
						The data on the block above will be read and rendered as a visualization showing the different timmings of the INP interaction.
					`,
				};
			} catch (e) {
				console.error(e);
				reportDetails = {
					reportMarkdown: dedent`
					Here's the flamegraph data for the INP interaction visualization (make sure to include the fenced code block as is below):
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
					The data on the block above will be read and rendered as a visualization showing the different timmings of the INP interaction.
					The section itself should not be named as 'flamegraph' but instead as 'INP interaction on timeline' or something similar to be friendlier to users that are not familiar with the 'flamegraph' term.

					`,
				};
			}

			if (inpExtras.animationFrames.length > 0) {
				const eventsOnAnimationFrames = inpExtras.animationFrames;

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
				insightsForTopic,
				topic,
			};
		} else {
			return {
				reportDetails: undefined,
				insightsForTopic,
				topic,
			};
		}
	},
});

const analyzeTrace = createStep({
	id: 'analyze-trace',
	inputSchema: z.object({
		insightsForTopic: insightReportSchema,
		topic: topicSchema,
		reportDetails: reportDetailsSchema.optional(),
	}),
	outputSchema: z.object({
		type: z.string(),
		topic: topicSchemaOutput.shape.topic.optional(),
		insightsForTopic: insightReportSchema.optional(),
		error: z.string().optional(),
	}),
	execute: async ({ inputData, mastra, runId, getInitData }) => {
		const { insightsForTopic, topic, reportDetails } = inputData;
		const triggerData = getInitData() as TriggerSchema;
		const { dataStream, inpInteractionAnimation, aiContext } = triggerData;

		if (!mastra) {
			throw new Error('Mastra not found');
		}

		try {
			if (!insightsForTopic) {
				return {
					type: 'trace_analysis',
					error: 'No trace data provided',
				};
			}

			const LCPExtras = topic === 'LCP' ? insightsForTopic.extras : undefined;

			if (insightsForTopic.extras) {
				// we don't want the extras being handled by the agent directly
				insightsForTopic.extras = undefined;
			}

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
						message: `Generating report based on insights for ${topic}...`,
					},
				},
			});

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
						topic === 'INP' && inpInteractionAnimation
							? `Use the following image on the same section of the report as the flamegraph data visualization for the INP interaction, as it represents the moment of the interaction captured from the trace screenshots as an animated webp image:
					![INP Interaction on timeline](${inpInteractionAnimation})
					Make sure to include the image above the flamegraph data visualization on the same section of the report.
					`
							: ''
					}
					`,
				},
			]);

			for await (const chunk of reportStream.textStream) {
				dataStream.writeData({
					type: 'text',
					runId,
					status: 'in-progress',
					content: {
						type: 'text-delta',
						data: chunk,
					},
				});
			}

			if (topic === 'LCP' && LCPExtras) {
				dataStream.writeData({
					type: 'text',
					runId,
					status: 'in-progress',
					content: {
						type: 'text-delta',
						data: `\n\n`,
					},
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
							message: `Analyzing relevant trace events ...`,
						},
					},
				});

				const networkAssistant = mastra.getAgent('networkAssistant');
				const networkAssistantStream = await networkAssistant.stream([
					{
						role: 'user',
						// @ts-ignore
						content: LCPExtras.networkStackInfo as string,
					},
					{
						role: 'user',
						content: dedent`
						Make sure to include at the opening of your network activity insights section the following fenced codeblock:

						\`\`\`network-activity
						{
							"topic": "LCP",
							"initialViewState": {
								"showFirstParty": true,
								"showThirdParty": true,
								"showByAssetType": false
							},
							"label": "First party vs Third party activity map"
						}
						\`\`\`

						And at the end of the same section include the following fenced codeblock:
						\`\`\`network-activity
						{
							"topic": "LCP",
							"initialViewState": {
								"showFirstParty": false,
								"showThirdParty": false,
								"showByAssetType": true
							},
							"label": "Network activity visualized by asset type"
						}
						\`\`\`
						`,
					},
				]);

				for await (const chunk of networkAssistantStream.textStream) {
					dataStream.writeData({
						type: 'text',
						runId,
						status: 'in-progress',
						content: {
							type: 'text-delta',
							data: chunk,
						},
					});
				}
			}

			if (aiContext && topic === 'INP') {
				dataStream.writeData({
					type: 'text',
					runId,
					status: 'in-progress',
					content: {
						type: 'text-delta',
						data: `\n\n`,
					},
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
							message: `Analyzing relevant trace events ...`,
						},
					},
				});

				const traceAssistant = mastra.getAgent('traceAssistant');
				const traceAssistantStream = await traceAssistant.stream([
					{
						role: 'user',
						content: aiContext,
					},
					{
						role: 'user',
						content: dedent`
						also add a code block with the following information first thing after the opening heading (Trace events analysis):

						\`\`\`flamegraph
						{
						"width": 600,
						"height": 400,
						"timeline": {
							"min": ${insightsForTopic.rawEvent?.ts || 1000 / 1000},
							"max": ${
								(insightsForTopic.rawEvent?.ts || 1000) / 1000 +
								(insightsForTopic.rawEvent?.dur || 1000) / 1000
							},
							"range": ${
								(insightsForTopic.rawEvent?.ts || 1000) / 1000 +
								(insightsForTopic.rawEvent?.dur || 1000) / 1000
							}
						},
						"searchEvent": {
							"pid": ${insightsForTopic.rawEvent?.pid},
							"tid": ${insightsForTopic.rawEvent?.tid},
							"min": ${insightsForTopic.rawEvent?.ts},
							"max": ${
								(insightsForTopic.rawEvent?.ts || 0) +
								(insightsForTopic.rawEvent?.dur || 0)
							},
							"range": ${
								(insightsForTopic.rawEvent?.ts || 0) +
								(insightsForTopic.rawEvent?.dur || 0)
							}
						}
					}
						\`\`\`
						`,
					},
				]);

				for await (const chunk of traceAssistantStream.textStream) {
					dataStream.writeData({
						type: 'text',
						runId,
						status: 'in-progress',
						content: {
							type: 'text-delta',
							data: chunk,
						},
					});
				}
			}

			dataStream.writeData({
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

			agentStream.mergeIntoDataStream(dataStream);

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

const cwvInsightsWorkflow = createWorkflow({
	id: 'trace-analysis-workflow',
	inputSchema: workflowInputSchema,
	outputSchema: z.object({
		type: z.string(),
		topic: z.string().optional(),
		insightsForTopic: insightReportSchema.optional(),
		error: z.string().optional(),
	}),
})
	.then(topicStep)
	.then(extractInsightData)
	.then(generateExtraReportData)
	.then(analyzeTrace)
	.commit();

export { cwvInsightsWorkflow };
