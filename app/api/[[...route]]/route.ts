import { type NextRequest } from 'next/server';
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
import { type InsightSet } from '@paulirish/trace_engine/models/trace/insights/types';
import { createOpenAI } from '@ai-sdk/openai';
import dedent from 'dedent';
import { TraceTopic, analyzeInsights } from '@/lib/insights';
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
const researchTool = tool({
	name: 'research_tool',
	description:
		'Fetches research information about web performance from trusted sources',
	schema: researchToolSchema,
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
	insights: z.array(z.any()).default([]),
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
		const insights: [string, InsightSet][] = body.insights;
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

				if (insights.length) {
					const { object: insightTopic } = await generateObject({
						model: perfAgent.languageModel('topics_model'),
						temperature: 0,
						messages,
						schema: z.object({
							topic: z.nativeEnum(TraceTopic).describe('Topic of the trace'),
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
					console.log('insights ', insights.length);

					const insightsForTopic = await analyzeInsights(
						insights,
						userInteractions,
						insightTopic.topic,
					);

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
									'Gives a user a list of actionable insights based on the trace data',
								parameters: traceAnalysisToolSchema,
								execute: async ({ topic }) => {
									try {
										if (!insights || !insights.length) {
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
												traceInsight: {
													metric: insightsForTopic.metric,
													metricValue: insightsForTopic.metricValue,
													metricType: insightsForTopic.metricType,
													metricScore: insightsForTopic.metricScore as
														| 'good'
														| 'average'
														| 'poor',
													metricBreakdown: insightsForTopic.metricBreakdown,
													infoContent: insightsForTopic.infoContent,
												},
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
							researchTool: tool({
								description:
									'Fetches research information about web performance from trusted sources',
								parameters: researchToolSchema,
								execute: async ({ query }) => {
									return {
										type: 'research',
										query,
										results: [],
									};
								},
							}),
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
						system: baseSystemPrompt,
						// tools: {
						// 	researchTool,
						// },
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
