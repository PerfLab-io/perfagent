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
} from 'ai';
import { type InsightSet } from '@paulirish/trace_engine/models/trace/insights/types';
import { createOpenAI } from '@ai-sdk/openai';
import dedent from 'dedent';
import { TraceTopic, analyzeInsights } from '@/lib/insights';
import { z } from 'zod';
import { systemPrompt } from '@/lib/ai/model';
import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { stream } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

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
			simulateStreaming: true,
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
	topic: z.nativeEnum(TraceTopic).describe('Topic of the trace'),
});

const researchToolSchema = z.object({
	query: z.string().describe('Research query based on the user message'),
});

/**
 * Trace Analysis Tool
 * Analyzes trace data for specific topics
 */
const traceAnalysisTool = tool({
	name: 'trace_analysis',
	description:
		'Analyzes performance trace data for specific web performance metrics',
	schema: traceAnalysisToolSchema,
	execute: async ({ topic }, { insights, userInteractions }) => {
		try {
			if (!insights || !insights.length) {
				return {
					type: 'trace_analysis',
					error: 'No trace data provided',
				};
			}

			const result = await analyzeInsights(insights, userInteractions, topic);

			return {
				type: 'trace_analysis',
				topic,
				result,
			};
		} catch (error) {
			console.error('Error in trace analysis tool:', error);
			return {
				type: 'trace_analysis',
				error: error.message || 'Failed to analyze trace data',
			};
		}
	},
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
	userInteractions: z.record(z.any()).default({}),
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
		const userInteractions = body.userInteractions;
		const model = body.model;

		if (messages.length === 0) {
			return c.json({ error: 'No messages provided' }, 400);
		}

		const dataStream = createDataStream({
			execute: async (dataStreamWriter) => {
				dataStreamWriter.writeData('initialized call');

				const traceReportStream = streamText({
					model: perfAgent.languageModel(model),
					temperature: 0,
					messages,
					system: systemPrompt,
					// tools: { traceAnalysisTool, researchTool },
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
					experimental_sendStart: true,
				});
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
