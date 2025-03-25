import { type NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env/server';
import { tavily } from '@tavily/core';
import {
	convertToCoreMessages,
	customProvider,
	generateObject,
	streamText,
	createDataStreamResponse,
	tool,
} from 'ai';
import { type InsightSet } from '@paulirish/trace_engine/models/trace/insights/types';
import { createOpenAI } from '@ai-sdk/openai';
import dedent from 'dedent';
import { TraceTopic, analyzeInsights } from '@/lib/insights';
import { z } from 'zod';
import { systemPrompt } from '@/lib/ai/model';

const openai = createOpenAI({
	// custom settings, e.g.
	baseURL: 'http://localhost:11434/v1',
	apiKey: 'ollama', // required but unused
	name: 'ollama',
	compatibility: 'strict', // strict mode, enable when using the OpenAI API
});

const perfAgent = customProvider({
	languageModels: {
		default_model: openai('qwen2.5-coder:14b', {
			structuredOutputs: true,
			simulateStreaming: true,
		}),
		topics_model: openai('llama3.1:8b', {
			structuredOutputs: true,
			simulateStreaming: true,
		}),
	},
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

// Update the POST function in the chat API route
export async function POST(req: NextRequest) {
	try {
		// Parse the request body
		let body;
		try {
			body = await req.json();
		} catch (error) {
			console.error('Error parsing request body:', error);
			return NextResponse.json(
				{ error: 'Invalid request body' },
				{ status: 400 },
			);
		}

		// Ensure body is an object
		body = body || {};

		// Extract messages, files, and other data with defaults
		const messages = convertToCoreMessages(body.messages);
		const files = body.files || [];
		const insights: [string, InsightSet][] = body.insights || [];
		const userInteractions = body.userInteractions || {};
		const model = body.model || 'default_model';

		if (messages.length === 0) {
			return NextResponse.json(
				{ error: 'No messages provided' },
				{ status: 400 },
			);
		}

		return createDataStreamResponse({
			execute: async (dataStream) => {
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

				return traceReportStream.mergeIntoDataStream(dataStream, {
					experimental_sendStart: true,
				});
			},
		});
	} catch (error) {
		console.error('Error in chat API:', error);
		if (error.name === 'AbortError') {
			// Return a specific status code for aborted requests
			console.log('Returning aborted response');
			return new Response(JSON.stringify({ error: 'Request aborted' }), {
				status: 499,
				headers: {
					'Content-Type': 'application/json',
				},
			});
		}
		return NextResponse.json(
			{
				error: 'Internal server error',
				message: error.message || 'Unknown error',
			},
			{ status: 500 },
		);
	}
}
