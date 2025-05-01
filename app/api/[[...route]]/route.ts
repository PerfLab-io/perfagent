import { convertToCoreMessages, createDataStream } from 'ai';
import { analyseInsightsForCWV } from '@/lib/insights';
import { z } from 'zod';
import { largeModelSystemPrompt } from '@/lib/ai/prompts';
import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { stream } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { UserInteractionsData } from '@perflab/trace_engine/models/trace/handlers/UserInteractionsHandler';
import { mastra } from '@/lib/ai/mastra';
import { langfuse } from '@/lib/tools/langfuse';
import { routerOutputSchema } from '@/lib/ai/mastra/agents/router';
import dedent from 'dedent';

export const runtime = 'nodejs';

// Define the request body schema
const requestSchema = z.object({
	messages: z.array(z.any()).default([]),
	files: z.array(z.any()).default([]),
	insights: z.any().default(null),
	userInteractions: z.any().default(null),
	model: z.string().default('default_model'),
	traceFile: z.any().default(null),
	inpInteractionAnimation: z.string().or(z.null()).default(null),
	aiContext: z.string().or(z.null()).default(null),
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
		const model = body.model;
		const traceFile = body.traceFile;
		const inpInteractionAnimation = body.inpInteractionAnimation;
		const aiContext = body.aiContext;

		if (messages.length === 0) {
			return c.json({ error: 'No messages provided' }, 400);
		}

		const dataStream = createDataStream({
			execute: async (dataStreamWriter) => {
				dataStreamWriter.writeData('initialized call');

				const routerAgent = mastra.getAgent('routerAgent');

				const { object } = await routerAgent.generate(messages, {
					output: routerOutputSchema,
				});

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
										// @ts-expect-error - TODO: fix this type error
										insights,
										dataStream: dataStreamWriter,
										messages,
										inpInteractionAnimation,
										aiContext,
									},
								});

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
						case 'researchWorkflow':
							const researchWorkflow = mastra.getWorkflow('researchWorkflow');
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
			},
			onError: (error) => {
				return error instanceof Error ? error.message : String(error);
			},
		});

		c.header('X-Vercel-AI-Data-Stream', 'v1');
		c.header('Content-Type', 'text/plain; charset=utf-8');

		try {
			await langfuse.flushAsync();
		} catch (e) {
			console.error(e);
		}

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

chat.post('/suggest', zValidator('json', requestSchema), async (c) => {
	const body = c.req.valid('json');
	const messages = body.messages;

	const insights: ReturnType<typeof analyseInsightsForCWV> = body.insights;

	const smallAssistant = mastra.getAgent('smallAssistant');

	const stream = await smallAssistant.generate(
		[
			...messages,
			{
				role: 'assistant',
				content: dedent`
			I should suggest of least 5 but at most 7 messages to the user based on the insights data I have here.
			Each suggestion context phrasing should refer to the insights data I have here, but as the user would ask it.
			The suggestions should be based on what is the most relevant question for the user based on the insights data.
			I should keep in mind that the user is a web developer and the suggestions should be related to web performance.
			I should also keep in mind that the user might not know the terminology, so I should include one suggestion about the most relevant metric according to the insights data.
			I should only return the suggested questions, no other text.
			I should avoid questions that are too broad, keeping it as contextualized to the relevant insights data as possible, or aimed to explain an important metric according to the insights data.
			I should keep the suggestions short and concise, maximum 100 characters each.
			I should avoid using the 'full name' of a metric on the questions, use the abbreviation instead, even on a possible suggestion to explain a metric.

			Here is the insights data:
			\`\`\`json
			${JSON.stringify(insights, null, 2)}
			\`\`\`
			`,
			},
		],
		{ output: z.array(z.string()).min(5).max(7) },
	);

	return c.json(stream.object);
});

export const GET = handle(chat);
export const POST = handle(chat);
