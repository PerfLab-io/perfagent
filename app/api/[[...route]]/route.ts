import { serverEnv } from '@/lib/env/server';
import { tavily } from '@tavily/core';
import {
	convertToCoreMessages,
	streamText,
	createDataStream,
	tool,
	generateObject,
} from 'ai';
import dedent from 'dedent';
import { analyseInsightsForCWV } from '@/lib/insights';
import { z } from 'zod';
import {
	baseSystemPrompt,
	largeModelSystemPrompt,
	toolUsagePrompt,
} from '@/lib/ai/prompts';
import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { stream } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { UserInteractionsData } from '@paulirish/trace_engine/models/trace/handlers/UserInteractionsHandler';
import { randomUUID } from 'crypto';
import { mastra } from '@/lib/ai/mastra';
import { perflab } from '@/lib/ai/modelProvider';
import { langfuse } from '@/lib/tools/langfuse';
import { Agent } from '@mastra/core/agent';

export const runtime = 'nodejs';

// Define tool schemas
const traceAnalysisToolSchema = z.object({
	topic: z
		.enum(['LCP', 'CLS', 'INP'])
		.describe(
			'Insight topic to analyze. Only use for the given topic list. The list reffers to CLS, INP and LCP related queries',
		),
	traceFile: z.string().describe('The trace file to analyze'),
});

const researchToolSchema = z.object({
	query: z
		.string()
		.describe(
			'Research query based on the given user prompt and the context from your previous responses to perform the most relevant research',
		),
});

/**
 * Research Tool
 * Fetches web performance information from trusted sources
 */
const tavlyResearchTool = tool({
	description:
		'Fetches research information about web performance from trusted sources',
	parameters: researchToolSchema,
	execute: async ({ query }) => {
		try {
			let tav;
			// Configure Tavily API
			if (serverEnv.TAVILY_API_KEY) {
				tav = tavily({ apiKey: serverEnv.TAVILY_API_KEY });
			} else {
				console.warn('TAVILY_API_KEY is not set');
				return {
					type: 'research',
					query,
					results: [
						{
							title: 'No Tavily API key configured',
							content:
								'Please configure a Tavily API key to enable research functionality.',
							url: 'https://tavily.com',
						},
					],
				};
			}

			// Define trusted domains for web performance research
			const trustedDomains = [
				'web.dev',
				'chromium.org',
				'developer.chrome.com',
				'developer.mozilla.org',
				'dev.to',
			];

			// Enhanced query with domain-specific scoping
			const enhancedQuery = `${query} (site:${trustedDomains.join(' OR site:')})`;

			// Execute search with Tavily
			const response = await tav.search(enhancedQuery, {
				searchDepth: 'advanced',
				maxResults: 3,
				includeDomains: trustedDomains,
				includeAnswer: false,
				includeRawContent: false,
			});

			return {
				type: 'research',
				query,
				results: response.results || [],
			};
		} catch (error) {
			console.error('Error in research tool:', error);
			return {
				type: 'research',
				query,
				error:
					error instanceof Error
						? error.message
						: 'Failed to fetch research information',
				results: [],
			};
		}
	},
});

// Define the request body schema
const requestSchema = z.object({
	messages: z.array(z.any()).default([]),
	files: z.array(z.any()).default([]),
	insights: z.any().default(null),
	userInteractions: z.any().default(null),
	model: z.string().default('default_model'),
	traceFile: z.any().default(null),
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
		const parentTraceId = randomUUID();

		langfuse.trace({
			id: parentTraceId,
			name: 'chat-api-call',
			metadata: {
				model,
				environment: process.env.NODE_ENV,
			},
		});

		if (messages.length === 0) {
			return c.json({ error: 'No messages provided' }, 400);
		}

		const dataStream = createDataStream({
			execute: async (dataStreamWriter) => {
				dataStreamWriter.writeData('initialized call');
				console.log(
					'######################### traceReportStream #################################',
					insights,
					userInteractions?.interactionEvents?.length,
				);

				const researchTool = tool({
					description:
						'Performs research on web performance optimization topics based on the user query and the provided context',
					parameters: researchToolSchema,
					execute: async ({ query }) => {
						// Create a unique toolCallId
						const toolCallId = randomUUID();

						try {
							// Determine the research query by adding context if needed
							const researchQuery = query;

							let tav;
							// Configure Tavily API
							if (serverEnv.TAVILY_API_KEY) {
								tav = tavily({ apiKey: serverEnv.TAVILY_API_KEY });
							} else {
								console.warn('TAVILY_API_KEY is not set');
								// TODO: Make sure the return type is the same as the success case
								return {
									type: 'research',
									query,
									results: [
										{
											title: 'Error initializing research tool',
										},
									],
								};
							}

							// Define trusted domains for web performance research
							const trustedDomains = [
								'web.dev',
								'chromium.org',
								'developer.chrome.com',
								'developer.mozilla.org',
								'dev.to',
							];

							dataStreamWriter.writeMessageAnnotation({
								type: 'research_update',
								toolCallId,
								data: {
									id: 'research-and-analysis',
									type: 'research-and-analysis',
									status: 'started',
									title: 'Research and Analysis',
									message: 'Starting research and analysis...',
									timestamp: Date.now(),
								},
							});

							const depth = 'advanced';

							dataStreamWriter.writeMessageAnnotation({
								type: 'research_update',
								toolCallId,
								data: {
									id: `research-plan`,
									type: 'research_plan',
									status: 'in-progress',
									title: 'Research Plan',
									message: 'Creating research plan...',
									timestamp: Date.now(),
									completedSteps: 0,
								},
							});

							console.log('researchQuery ', researchQuery);

							// Now generate the research plan
							const { object: researchPlan } = await generateObject({
								model: perflab.languageModel(model),
								temperature: 0,
								experimental_telemetry: {
									isEnabled: true,
									functionId: `research-plan-llm-call`,
									metadata: {
										langfuseTraceId: parentTraceId,
										langfuseUpdateParent: false, // Do not update the parent trace with execution results
									},
								},
								schema: z.object({
									search_queries: z
										.array(
											z.object({
												query: z.string(),
												rationale: z.string(),
												priority: z.number().min(1).max(5),
											}),
										)
										.max(10),
									required_analyses: z
										.array(
											z.object({
												type: z.string(),
												description: z.string(),
												importance: z.number().min(1).max(5),
											}),
										)
										.max(4),
								}),
								prompt: dedent`
									Create a research plan for the topic: "${researchQuery}".

									Today's date and day of the week: ${new Date().toLocaleDateString('en-US', {
										weekday: 'long',
										year: 'numeric',
										month: 'long',
										day: 'numeric',
									})}

									Keep the plan concise but comprehensive, with:
									- maximum 5 targeted search queries
									- Each query should be focused on a specific aspect of the topic to provide the best value
									- 2-4 key analyses to perform
									- Prioritize the most important aspects to investigate based on the user query and the context

									Available sources:
									- "web": General web search

									Do not use floating numbers, use whole numbers only in the priority field!!
									Do not keep the numbers too low or high, make them reasonable in between.
									Do not use 0 or 1 in the priority field, use numbers between 2 and 4.

									Consider related topics, but maintain focus on the core aspects.
									Here's the list of topics represent different aspects of a performance trace.

									Core Web Vitals Context
									Core Web Vitals are Google's metrics for measuring web page experience:

									Loading (LCP): Largest Contentful Paint - measures loading performance (2.5s or less is good)
									Interactivity (INP): Interaction to Next Paint - measures responsiveness (100ms or less is good)
									Visual Stability (CLS): Cumulative Layout Shift - measures visual stability (0.1 or less is good)

									Additional important metrics include:

									TTFB (Time to First Byte)
									FCP (First Contentful Paint)
									TTI (Time to Interactive)
									TBT (Total Blocking Time)
									Resource optimization (JS, CSS, images, fonts)
									Network performance (caching, compression)

									Ensure the total number of steps (searches + analyses) does not exceed 10.
							`,
							});

							console.log('researchPlan', researchPlan);

							// Generate IDs for all steps based on the plan
							const generateStepIds = (plan: typeof researchPlan) => {
								// Generate an array of search steps.
								const searchSteps = plan.search_queries.map((query, index) => ({
									id: `search-web-${index}`,
									type: 'web',
									query,
								}));

								// Generate an array of analysis steps.
								const analysisSteps = plan.required_analyses.map(
									(analysis, index) => ({
										id: `analysis-${index}`,
										type: 'analysis',
										analysis,
									}),
								);

								return {
									planId: 'research-plan',
									searchSteps,
									analysisSteps,
								};
							};

							const stepIds = generateStepIds(researchPlan);
							let completedSteps = 1;
							const totalSteps =
								stepIds.searchSteps.length + stepIds.analysisSteps.length + 1;

							dataStreamWriter.writeMessageAnnotation({
								type: 'research_update',
								toolCallId,
								data: {
									id: `research-plan`,
									type: 'research_plan',
									status: 'complete',
									title: 'Research Plan',
									message: 'Research plan created',
									timestamp: Date.now(),
									completedSteps,
									totalSteps,
								},
							});

							const searchResults = [];

							for (const step of stepIds.searchSteps) {
								// Send running annotation for this search step
								dataStreamWriter.writeMessageAnnotation({
									type: 'research_update',
									toolCallId,
									data: {
										id: step.id,
										type: 'web',
										status: 'in-progress',
										title: `Searching the web for "${step.query.query}"`,
										query: step.query.query,
										message: `Searching trusted sources...`,
										timestamp: Date.now(),
									},
								});

								const startTime = new Date();

								const webResults = await tav.search(step.query.query, {
									searchDepth: depth,
									includeAnswer: true,
									includeDomains: trustedDomains,
									maxResults: Math.min(6 - step.query.priority, 10),
								});

								langfuse.span({
									name: `search-web`,
									metadata: {
										query: step.query.query,
									},
									traceId: parentTraceId,
									startTime,
									endTime: new Date(),
								});

								searchResults.push({
									type: 'web',
									query: step.query,
									results: webResults.results.map((r) => ({
										source: 'web',
										title: r.title,
										url: r.url,
										content: r.content,
									})),
								});

								completedSteps++;

								// Send progress annotation for the search step
								dataStreamWriter.writeMessageAnnotation({
									type: 'research_update',
									toolCallId,
									data: {
										id: step.id,
										type: 'web',
										status: 'in-progress',
										title: `Searched the web for "${step.query.query}"`,
										query: step.query.query,
										results: searchResults[searchResults.length - 1].results,
										message: `Found ${
											searchResults[searchResults.length - 1].results.length
										} results for "${step.query.query}"`,
										timestamp: Date.now(),
										completedSteps,
										totalSteps,
									},
								});
							}

							// Send completed annotation for the search step
							dataStreamWriter.writeMessageAnnotation({
								type: 'research_update',
								toolCallId,
								data: {
									id: `search-web-final`,
									type: 'web',
									status: 'complete',
									title: 'Search step complete',
									timestamp: Date.now(),
									completedSteps,
									totalSteps,
								},
							});

							// Perform analyses
							let _analysisResults = [];
							for (const step of stepIds.analysisSteps) {
								dataStreamWriter.writeMessageAnnotation({
									type: 'research_update',
									toolCallId,
									data: {
										id: step.id,
										type: 'analysis',
										status: 'in-progress',
										title: `Analyzing ${step.analysis.type}`,
										analysisType: step.analysis.type,
										message: `Analyzing ${step.analysis.type}...`,
										timestamp: Date.now(),
										completedSteps,
										totalSteps,
									},
								});

								const { object: analysisResult } = await generateObject({
									model: perflab.languageModel(model),
									temperature: 0.5,
									experimental_telemetry: {
										isEnabled: true,
										functionId: `analysis-${step.analysis.type}-llm-call`,
										metadata: {
											langfuseTraceId: parentTraceId,
											langfuseUpdateParent: false, // Do not update the parent trace with execution results
										},
									},
									schema: z.object({
										findings: z
											.array(
												z.object({
													insight: z.string(),
													evidence: z.array(z.string()),
													confidence: z.number().min(0).max(1),
												}),
											)
											.max(3),
									}),
									prompt: dedent`
										Perform a ${step.analysis.type} analysis on the search results. ${step.analysis.description}
										Consider all sources and their reliability.
										Search results: ${JSON.stringify(searchResults)}
										IMPORTANT: ENSURE TO RETURN CONFIDENCE SCORES BETWEEN 0 AND 1. And max 3 findings.
									`,
								});

								_analysisResults.push(analysisResult.findings);
								completedSteps++;

								dataStreamWriter.writeMessageAnnotation({
									type: 'research_update',
									toolCallId,
									data: {
										id: step.id,
										type: 'analysis',
										status: 'in-progress',
										title: `Analysis of ${step.analysis.type} complete`,
										analysisType: step.analysis.type,
										findings: analysisResult.findings,
										message: `Completed analysis of ${step.analysis.type}`,
										timestamp: Date.now(),
										completedSteps,
										totalSteps,
									},
								});
							}

							dataStreamWriter.writeMessageAnnotation({
								type: 'research_update',
								toolCallId,
								data: {
									id: `analysis-final`,
									type: 'analysis',
									status: 'complete',
									title: `Analysis complete`,
									timestamp: Date.now(),
									completedSteps,
									totalSteps,
								},
							});

							const researchReport = streamText({
								model: perflab.languageModel(model),
								temperature: 0,
								experimental_telemetry: {
									isEnabled: true,
									functionId: `research-report-llm-call`,
									metadata: {
										langfuseTraceId: parentTraceId,
										langfuseUpdateParent: false, // Do not update the parent trace with execution results
									},
								},
								system: dedent`${baseSystemPrompt}

								Generate a markdown report based on the research plan, search results and analysis results.`,
								messages: [
									...messages,
									{
										role: 'user',
										content: `
											Research plan: ${JSON.stringify(researchPlan)}
											Search results: ${JSON.stringify(searchResults)}
											Analysis results: ${JSON.stringify(_analysisResults)}
										`,
									},
								],
							});

							dataStreamWriter.writeMessageAnnotation({
								type: 'research_update',
								toolCallId,
								data: {
									id: 'research-and-analysis',
									type: 'research-and-analysis',
									status: 'complete',
									message: `Research and analysis complete`,
									completedSteps: totalSteps,
									totalSteps,
									timestamp: Date.now(),
								},
							});

							researchReport.mergeIntoDataStream(dataStreamWriter);

							return {
								type: 'research',
								toolCallId,
								query: researchQuery,
								progress: 100,
							};
						} catch (error) {
							console.error('Error in research tool:', error);
							return {
								type: 'research',
								toolCallId,
								query,
								error:
									error instanceof Error
										? error.message
										: 'Failed to perform research',
								results: [],
							};
						}
					},
				});

				if (insights) {
					console.log('insights ', insights);

					const routerAgent = new Agent({
						name: 'PerfAgent router',
						instructions: dedent`
							You are a sentiment analysis and smart router that will analyse user messages and output a JSON object with the following fields:
							- workflow: The workflow to use in case the user message requires any form of deeper analysis. Null if a simple response is sufficient.
							- toolRequired: A number between 0 and 1 (0 - 100 percent) with the certainty of a need or not of a tool call based on the user sentiment and message, also taking in consideration the current context of previous messages.

							You have the following workflows available:
							- insightsWorkflow: A workflow that will analyse a trace file or user's metrics data and provide insights about the performance. This workflow is not required for general questions about performance, only for use when user's message is related 'their' metrics or trace data.
							- researchWorkflow: A workflow that will research a given topic and provide a report about the findings.

							Example possible outcome:
							{ // User asks about his own performance metrics but there's a medium level of uncertainty if you should use the insightsWorkflow or the researchWorkflow, so you preffer to choose the insightsWorkflow
								workflow: 'insightsWorkflow',
								toolRequired: 0.5,
							}

							{ // User asks about his own specific performance metric or trace related question
								workflow: 'insightsWorkflow',
								toolRequired: 1,
							}

							{ // User asks about a specific performance metric or trace related question but it is not related to the user's own metrics or trace data
								workflow: 'researchWorkflow',
								toolRequired: 1,
							}

							{ // User asks a general question, or a general question about performance metrics or traces, without mentioning his own metrics or trace data so we should reply with a general answer and not use any tool
								workflow: null,
								toolRequired: 0.8,
							}

							You can only pick one workflow when deeper analysis is required. The output will be used to route the user's request or ask for clarification if needed.
						`,
						model: perflab.languageModel('topics_model'),
					});

					const { object } = await routerAgent.generate(messages, {
						output: z.object({
							workflow: z
								.enum(['insightsWorkflow', 'researchWorkflow'])
								.nullable()
								.describe(
									'The workflow to use in case the user message requires any form of deeper analysis. Null if a simple response is sufficient.',
								),
							toolRequired: z
								.number()
								.min(0)
								.max(1)
								.describe(
									'A number between 0 and 1 (0 - 100 percent) with the certainty of a need of a tool call based on the user sentiment and message, also taking in consideration the current context of previous messages.',
								),
						}),
					});

					console.log('object ', object);

					if (object.workflow === 'insightsWorkflow') {
						const insightsWorkflow = mastra.getWorkflow('insightsWorkflow');
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
					} else if (object.workflow === 'researchWorkflow') {
						// const researchWorkflow = mastra.getWorkflow('researchWorkflow');
						// const run = researchWorkflow.createRun();
						// const unsubscribe = run.watch((event) => {
						// 	console.log('========== event', event);
						// });
					} else {
						const traceInsightStream = streamText({
							model: perflab.languageModel(model),
							temperature: 0,
							experimental_telemetry: {
								isEnabled: true,
								functionId: `trace-analysis-llm-call`,
								metadata: {
									langfuseTraceId: parentTraceId,
									langfuseUpdateParent: false, // Do not update the parent trace with execution results
								},
							},
							messages,
							system: largeModelSystemPrompt,
							onFinish(event) {
								console.log(
									'######################### traceReportStream onFinish #################################',
								);
								console.log('Fin reason: ', event.finishReason);
								console.log('Reasoning: ', event.reasoning);
								console.log('reasoning details: ', event.reasoningDetails);
								console.log('Messages: ', event.response.messages);
							},
							onError(event) {
								console.log('Error: ', event.error);
							},
						});

						traceInsightStream.mergeIntoDataStream(dataStreamWriter, {
							sendReasoning: true,
							sendSources: true,
						});
					}
				} else {
					const traceReportStream = streamText({
						model: perflab.languageModel(model),
						temperature: 0,
						experimental_telemetry: {
							isEnabled: true,
							functionId: `trace-report-llm-call`,
							metadata: {
								langfuseTraceId: parentTraceId,
								langfuseUpdateParent: false, // Do not update the parent trace with execution results
							},
						},
						messages,
						system: dedent`${baseSystemPrompt}
						
						${toolUsagePrompt}
						
						No trace file provided.
						`,
						tools: {
							researchTool,
						},
						onFinish(event) {
							console.log(
								'######################### traceReportStream onFinish #################################',
							);
							console.log('Fin reason: ', event.finishReason);
							console.log('Reasoning: ', event.reasoning);
							console.log('reasoning details: ', event.reasoningDetails);
							console.log('Messages: ', event.response.messages);
						},
						onError(event) {
							console.log('Error: ', event.error);
						},
					});

					traceReportStream.mergeIntoDataStream(dataStreamWriter, {
						sendReasoning: true,
						sendSources: true,
					});
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
