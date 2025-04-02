import { serverEnv } from '@/lib/env/server';
import { tavily } from '@tavily/core';
import {
	convertToCoreMessages,
	customProvider,
	streamText,
	createDataStream,
	tool,
	wrapLanguageModel,
	simulateStreamingMiddleware,
	generateObject,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import dedent from 'dedent';
import { analyseInsightsForCWV } from '@/lib/insights';
import { TraceTopic } from '@/lib/trace';
import { z } from 'zod';
import { baseSystemPrompt, toolUsagePrompt } from '@/lib/ai/model';
import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { stream } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { UserInteractionsData } from '@paulirish/trace_engine/models/trace/handlers/UserInteractionsHandler';
export const runtime = 'nodejs';

const local = createOpenAI({
	baseURL: 'http://localhost:11434/v1',
	apiKey: 'ollama', // required but unused
});

const middleware = simulateStreamingMiddleware();

const localModels = {
	default_model: wrapLanguageModel({
		model: local('qwen2.5-coder:14b', {
			structuredOutputs: true,
		}),
		middleware,
	}),
	topics_model: wrapLanguageModel({
		model: local('llama3.1:8b', {
			structuredOutputs: true,
		}),
		middleware,
	}),
};

const google = createGoogleGenerativeAI({
	apiKey: serverEnv.GEMINI_API_KEY,
});

const googleModels = {
	default_model: google('gemini-2.0-flash', {
		structuredOutputs: true,
	}),
	topics_model: google('gemini-2.0-flash-lite', {
		structuredOutputs: true,
	}),
};

const perfAgent = customProvider({
	languageModels:
		// process.env.NODE_ENV === 'development' ? localModels : googleModels,
		googleModels,
});

// Define tool schemas
const traceAnalysisToolSchema = z.object({
	topic: z.nativeEnum(TraceTopic).describe('Insight topic to analyze'),
});

const researchToolSchema = z.object({
	query: z.string().describe('Research query based on the user message'),
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
				error: error.message || 'Failed to fetch research information',
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

		if (messages.length === 0) {
			return c.json({ error: 'No messages provided' }, 400);
		}

		const dataStream = createDataStream({
			execute: async (dataStreamWriter) => {
				dataStreamWriter.writeData('initialized call');
				console.log(
					'######################### traceReportStream #################################',
					insights.length,
					userInteractions?.interactionEvents?.length,
				);

				const researchTool = tool({
					description:
						'Performs research on web performance optimization topics',
					parameters: researchToolSchema,
					execute: async ({ query }) => {
						// Create a unique toolCallId
						const toolCallId = `research-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

						try {
							// Determine the research query by adding context if needed
							const researchQuery = query.toLowerCase().includes('performance')
								? query
								: `${query} web performance optimization`;

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

							// Now generate the research plan
							const { object: researchPlan } = await generateObject({
								model: perfAgent.languageModel(model),
								temperature: 0,
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
									Create a focused research plan for the topic: "${researchQuery}".

									Today's date and day of the week: ${new Date().toLocaleDateString('en-US', {
										weekday: 'long',
										year: 'numeric',
										month: 'long',
										day: 'numeric',
									})}

									Keep the plan concise but comprehensive, with:
									- maximum 5targeted search queries (each can use web as source. Focus on web.dev as main source whenever possible)
									- 2-4 key analyses to perform
									- Prioritize the most important aspects to investigate

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

								const webResults = await tav.search(step.query.query, {
									searchDepth: depth,
									includeAnswer: true,
									includeDomains: trustedDomains,
									maxResults: Math.min(6 - step.query.priority, 10),
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
									model: perfAgent.languageModel(model),
									temperature: 0.5,
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
								model: perfAgent.languageModel(model),
								temperature: 0,
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
								error: error.message || 'Failed to perform research',
								results: [],
							};
						}
					},
				});

				if (insights) {
					const { object: insightTopic } = await generateObject({
						model: perfAgent.languageModel('topics_model'),
						temperature: 0,
						messages,
						schema: z.object({
							topic: z
								.enum(['LCP', 'CLS', 'INP'])
								.describe('Topic of the trace'),
							researchQuery: z
								.string()
								.describe(
									"Optimized research query based on the user's query and the topic of the trace",
								),
						}),
						system: dedent`
							You are a web performance analysis expert specializing in Core Web Vitals. Your task is to analyze user queries about web performance issues, classify them into relevant categories.
							Pick a topic from the schema given based on the user's message.
							Use only the list of topics provided in the schema.

							Those topics represent different aspects of a performance trace.

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

							Your Process

							Analyze the user's query about web performance
							Classify it into relevant web vitals categories

							IMPORTANT: Use only the list of topics provided in the schema.
						`,
					});

					console.log('insightTopic: ', insightTopic);
					console.log(
						'userInteractions ',
						userInteractions.longestInteractionEvent,
					);
					console.log('insights ', insights);

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
					})(insightTopic.topic);

					console.log('insightsForTopic ', insightsForTopic);

					if (!insightsForTopic) {
						throw new Error('No insights for topic', {
							cause: {
								insightTopic,
							},
						});
					}

					const traceReportStream = streamText({
						model: perfAgent.languageModel(model),
						temperature: 0,
						messages,
						system: dedent`${baseSystemPrompt}
						
						${toolUsagePrompt}`,
						toolChoice: 'required',
						tools: {
							/**
							 * Trace Analysis Tool
							 * Analyzes trace data for specific topics
							 */
							traceAnalysisTool: tool({
								description:
									'Gives a user a list of actionable insights based on the trace data. Use only for LCP, CLS and INP related questions.',
								parameters: traceAnalysisToolSchema,
								execute: async ({ topic }) => {
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

										console.log(
											'insightsForTopic complete: ',
											insightsForTopic.metric,
										);

										const generatedReport = streamText({
											model: perfAgent.languageModel(model),
											temperature: 0,
											messages,
											system: dedent`${baseSystemPrompt}

											Here's the trace analysis for the report to be generated (DO NOT INCLUDE THIS DATA IN THE RESPONSE. USE IT TO WRITE THE REPORT SECTION ON THE TRACE ANALYSIS):
											\`\`\`json
											${JSON.stringify(insightsForTopic, null, 2)}
											\`\`\``,
										});

										generatedReport.mergeIntoDataStream(dataStreamWriter, {
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
											error: error.message || 'Failed to analyze trace data',
										};
									}
								},
							}),
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
				} else {
					const traceReportStream = streamText({
						model: perfAgent.languageModel(model),
						temperature: 0,
						messages,
						system: dedent`${baseSystemPrompt}
						
						${toolUsagePrompt}`,
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

		return stream(c, (stream) =>
			stream.pipe(dataStream.pipeThrough(new TextEncoderStream())),
		);
	} catch (error) {
		console.error('Error in chat API:', error);

		if (error.name === 'AbortError') {
			// Return a specific status code for aborted requests
			console.log('Returning aborted response');
			return c.json({ error: 'Request aborted' }, 499);
		}
		return c.json(
			{
				error: 'Internal server error',
				message: error.message || 'Unknown error',
			},
			500,
		);
	}
});

export const GET = handle(chat);
export const POST = handle(chat);
