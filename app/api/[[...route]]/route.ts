import { convertToCoreMessages, streamText, createDataStream } from 'ai';
import { analyseInsightsForCWV } from '@/lib/insights';
import { z } from 'zod';
import { largeModelSystemPrompt } from '@/lib/ai/prompts';
import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { stream } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { UserInteractionsData } from '@paulirish/trace_engine/models/trace/handlers/UserInteractionsHandler';
import { mastra } from '@/lib/ai/mastra';
import { langfuse } from '@/lib/tools/langfuse';
import { routerOutputSchema } from '@/lib/ai/mastra/agents/router';
import { researchStepsSchema } from '@/lib/ai/mastra/workflows/researchWorkflow';

export const runtime = 'nodejs';

// Define the request body schema
const requestSchema = z.object({
	messages: z.array(z.any()).default([]),
	files: z.array(z.any()).default([]),
	insights: z.any().default(null),
	userInteractions: z.any().default(null),
	model: z.string().default('default_model'),
	traceFile: z.any().default(null),
	researchApproved: z.boolean().nullable().default(null),
	requestId: z.string().nullable().default(null),
	researchPlan: researchStepsSchema.nullable().default(null),
});

// Create Hono app for chat API
const chat = new Hono().basePath('/api');

// POST endpoint for chat
chat.post('/chat', zValidator('json', requestSchema), async (c) => {
	try {
		const body = c.req.valid('json');
		const messages = convertToCoreMessages(body.messages);
		const files = body.files;
		const insights: ReturnType<typeof analyseInsightsForCWV> = body.insights;
		const userInteractions: UserInteractionsData = body.userInteractions;
		const traceFile = body.traceFile;
		const researchApproved = body.researchApproved;
		const requestId = body.requestId;
		const researchPlan = body.researchPlan;
		const dataStream = createDataStream({
			execute: async (dataStreamWriter) => {
				dataStreamWriter.writeData('initialized call');
				console.log(
					'######################### traceReportStream #################################',
					insights,
					userInteractions?.interactionEvents?.length,
				);

				console.log('insights ', insights);
				console.log('researchApproved ', researchApproved);
				console.log('requestId ', requestId);
				console.log('researchPlan ', researchPlan);

				if (messages.length === 0) {
					if (!researchPlan) {
						throw new Error('Research plan is required');
					}
					const researchWorkflow = mastra.getWorkflow(
						'researchExecutionWorkflow',
					);
					const run = researchWorkflow.createRun({
						runId: requestId ?? undefined,
					});

					console.log('run ', run);

					const unsubscribe = run?.watch((event) => {
						console.log('========== event', event);
					});

					const _run = await run.start({
						triggerData: {
							researchPlan,
							dataStream: dataStreamWriter,
						},
					});

					console.log('run', _run);
					unsubscribe?.();
				} else {
					if (messages.length === 0) {
						// return c.json({ error: 'No messages provided' }, 400);
						throw new Error('No messages provided');
					}

					const routerAgent = mastra.getAgent('routerAgent');
					const { object } = await routerAgent.generate(messages, {
						output: routerOutputSchema,
					});

					console.log('object ', object);
					const smallAssistant = mastra.getAgent('smallAssistant');

					if (object.certainty < 0.5) {
						const stream = await smallAssistant.stream([
							...messages,
							{
								role: 'assistant',
								content:
									'Unclear user request, I should kindly ask for clarification and steer the conversation back on track.',
							},
						]);
						stream.mergeIntoDataStream(dataStreamWriter, {
							sendReasoning: true,
							sendSources: true,
						});
					} else {
						switch (object.workflow) {
							case 'cwvInsightsWorkflow':
								if (insights) {
									const insightsWorkflow = mastra.getWorkflow(
										'cwvInsightsWorkflow',
									);
									const run = insightsWorkflow.createRun();

									const unsubscribe = run.watch((event) => {
										console.log('========== event', event);
									});

									const _run = await run.start({
										triggerData: {
											insights,
											dataStream: dataStreamWriter,
											messages,
										},
									});

									console.log('run', _run);
									unsubscribe();
								} else {
									const stream = await smallAssistant.stream([
										...messages,
										{
											role: 'assistant',
											content:
												'User request is missing required data for analysis, I should kindly prompt the user to attach the trace json file containing the data to process the request. I should remind the user that I only process Google Chrome trace files and refer to the official blog post: https://developer.chrome.com/blog/devtools-tips-39?hl=en.',
										},
									]);
									stream.mergeIntoDataStream(dataStreamWriter);
								}
								break;
							case 'researchPlanningWorkflow':
								const researchWorkflow = mastra.getWorkflow(
									'researchPlanningWorkflow',
								);
								const run = researchWorkflow.createRun();

								const unsubscribe = run.watch((event) => {
									console.log('========== event', event);
								});

								const _run = await run.start({
									triggerData: {
										messages,
										dataStream: dataStreamWriter,
									},
								});

								console.log('run', _run);
								unsubscribe();
								break;
							default:
								const stream = await mastra
									.getAgent('largeAssistant')
									.stream(messages, {
										system: largeModelSystemPrompt,
									});
								stream.mergeIntoDataStream(dataStreamWriter, {
									sendReasoning: true,
									sendSources: true,
								});
								break;
						}
					}
				}
			},
			onError: (error) => {
				return error instanceof Error ? error.message : String(error);
			},
		});

		c.header('X-Vercel-AI-Data-Stream', 'v1');
		c.header('Content-Type', 'text/plain; charset=utf-8');

		await langfuse.flushAsync();

		return stream(c, (stream) =>
			stream.pipe(dataStream.pipeThrough(new TextEncoderStream())),
		);
	} catch (error) {
		console.error('Error in chat API:', error);

		if (error instanceof Error && error.name === 'AbortError') {
			// Return a specific status code for aborted requests
			console.log('Returning aborted response');
			// @ts-expect-error - 499 status code is not standard, but it refers for user cancellation
			return c.json({ error: 'Request aborted' }, 499);
		}
		return c.json(
			{
				error: 'Internal server error',
				message: error instanceof Error ? error.message : 'Unknown error',
			},
			500,
		);
	}
});

export const GET = handle(chat);
export const POST = handle(chat);
