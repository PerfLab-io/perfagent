import {
	CoreMessage,
	coreMessageSchema,
	DataStreamWriter,
	smoothStream,
} from 'ai';

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import dedent from 'dedent';
import { serverEnv } from '@/lib/env/server';
import { tavily, type TavilyClient } from '@tavily/core';

const messageSchema = coreMessageSchema;

let tav: TavilyClient | undefined;
// Configure Tavily API
if (serverEnv.TAVILY_API_KEY) {
	tav = tavily({ apiKey: serverEnv.TAVILY_API_KEY });
} else {
	console.warn('TAVILY_API_KEY is not set');
}

// Define trusted domains for web performance research
const trustedDomains = [
	'web.dev',
	'chromium.org',
	'developer.chrome.com',
	'developer.mozilla.org',
	'dev.to',
	'speedcurve.com',
	'rumvision.com',
	'debugbear.com',
] as const;

const depth = 'advanced' as const;

export const researchPlanSchema = z.object({
	topic: z.string(),
	searchQueries: z
		.array(
			z.object({
				query: z.string(),
				rationale: z.string(),
				priority: z.number().min(1).max(5),
			}),
		)
		.max(10),
	requiredAnalyses: z
		.array(
			z.object({
				type: z.string(),
				description: z.string(),
				importance: z.number().min(1).max(5),
			}),
		)
		.max(4),
});

export const ArtifactStreamData = z.object({
	type: z.string(),
	runId: z.string(),
	content: z.object({
		type: z.string(),
		data: z.object({
			id: z.string(),
			type: z.string(),
			status: z.string(),
			title: z.string(),
			message: z.string(),
			timestamp: z.number(),
			query: z.string().optional(),
			completedSteps: z.number().optional(),
			totalSteps: z.number().optional(),
			researchPlan: researchPlanSchema.optional(),
			searchResults: z.array(z.any()).optional(),
			analysisResults: z.array(z.any()).optional(),
		}),
	}),
});

// Generate IDs for all steps based on the plan
const generateStepIds = (plan: z.infer<typeof researchPlanSchema>) => {
	// Generate an array of search steps.
	const searchSteps = plan.searchQueries.map((query, index) => ({
		id: `search-web-${index}`,
		type: 'web',
		query,
	}));

	// Generate an array of analysis steps.
	const analysisSteps = plan.requiredAnalyses.map((analysis, index) => ({
		id: `analysis-${index}`,
		type: 'analysis',
		analysis,
	}));

	return {
		planId: 'research-plan',
		searchSteps,
		analysisSteps,
	};
};

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
});

type TriggerSchema = {
	messages: CoreMessage[];
	dataStream: DataStreamWriter;
};

const researchPlanning = createStep({
	id: 'research-planning',
	inputSchema: workflowInputSchema,
	outputSchema: researchPlanSchema,
	execute: async ({ runId, mastra, getInitData }) => {
		const triggerData = getInitData() as TriggerSchema;
		const { dataStream, messages } = triggerData;

		if (!mastra) {
			throw new Error('Mastra not found');
		}

		dataStream.writeData({
			type: 'research_update',
			runId,
			status: 'started',
			content: {
				type: 'research_update',
				data: {
					id: 'research-and-analysis',
					type: 'research-and-analysis',
					status: 'started',
					title: 'Research and Analysis',
					message: 'Starting research and analysis...',
					timestamp: Date.now(),
				},
			},
		});

		dataStream.writeData({
			type: 'research_update',
			runId,
			status: 'in-progress',
			content: {
				type: 'research_update',
				data: {
					id: `research-plan`,
					type: 'research_plan',
					status: 'in-progress',
					title: 'Research Plan',
					message: 'Creating research plan...',
					timestamp: Date.now(),
					completedSteps: 0,
				},
			},
		});

		const { object: researchPlan } = await mastra
			.getAgent('researchPlanner')
			.generate(messages, {
				output: researchPlanSchema,
			});

		dataStream.writeData({
			type: 'research_update',
			runId,
			status: 'in-progress',
			content: {
				type: 'research_update',
				data: {
					id: `research-plan`,
					type: 'research_plan',
					status: 'in-progress',
					title: 'Research Plan created',
					message: 'Creating research steps...',
					timestamp: Date.now(),
					researchPlan,
					completedSteps: 0,
				},
			},
		});
		return researchPlan;
	},
});

const querySchema = z.object({
	query: z.string(),
	rationale: z.string(),
	priority: z.number(),
});

const analysisSchema = z.object({
	type: z.string(),
	description: z.string(),
	importance: z.number(),
});

const researchStepsSchema = z.object({
	stepIds: z.object({
		searchSteps: z.array(
			z.object({
				id: z.string(),
				type: z.string(),
				query: querySchema,
			}),
		),
		analysisSteps: z.array(
			z.object({
				id: z.string(),
				type: z.string(),
				analysis: analysisSchema,
			}),
		),
	}),
	completedSteps: z.number(),
	totalSteps: z.number(),
});

const researchSteps = createStep({
	id: 'research-steps',
	inputSchema: researchPlanSchema,
	outputSchema: researchStepsSchema,
	execute: async ({ inputData: researchPlan, runId, getInitData }) => {
		const triggerData = getInitData() as TriggerSchema;
		const { dataStream } = triggerData;

		console.log('==========researchPlan', researchPlan);

		const stepIds = generateStepIds(researchPlan);

		const completedSteps = 1;
		const totalSteps =
			stepIds.searchSteps.length + stepIds.analysisSteps.length + 1;

		dataStream.writeData({
			type: 'research_update',
			runId,
			status: 'in-progress',
			content: {
				type: 'research_update',
				data: {
					id: `research-plan`,
					type: 'research_plan',
					status: 'complete',
					title: 'Research Plan',
					message: 'Research plan created',
					timestamp: Date.now(),
					researchPlan,
					completedSteps,
					totalSteps,
				},
			},
		});

		return {
			stepIds,
			completedSteps,
			totalSteps,
		};
	},
});

const searchWebSchema = z.object({
	searchResults: z.array(
		z.object({
			type: z.string(),
			query: querySchema,
			results: z.array(z.any()),
		}),
	),
	completedSteps: z.number(),
});

const searchWeb = createStep({
	id: 'search-web',
	inputSchema: researchStepsSchema,
	outputSchema: searchWebSchema,
	execute: async ({ inputData, runId, mastra, getInitData }) => {
		const triggerData = getInitData() as TriggerSchema;
		const { dataStream } = triggerData;
		const { stepIds, completedSteps, totalSteps } = inputData;

		if (!mastra) {
			throw new Error('Mastra not found');
		}

		if (!tav) {
			throw new Error('Tavily client not found');
		}

		const searchResults: z.infer<typeof searchWebSchema>['searchResults'] = [];
		let _newCompletedSteps = completedSteps;

		for (const step of stepIds.searchSteps) {
			// Send running annotation for this search step
			dataStream.writeData({
				type: 'research_update',
				runId,
				status: 'in-progress',
				content: {
					type: 'research_update',
					data: {
						id: step.id,
						type: 'web',
						status: 'in-progress',
						title: `Searching the web for "${step.query.query}"`,
						query: step.query.query,
						message: `Searching trusted sources...`,
						timestamp: Date.now(),
					},
				},
			});

			const span = mastra.getTelemetry()?.tracer.startSpan('search-web');

			if (span) {
				span.setAttribute('query', step.query.query);
			}

			const webResults = await tav.search(step.query.query, {
				searchDepth: depth,
				includeAnswer: true,
				includeDomains: [...trustedDomains],
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

			_newCompletedSteps++;

			if (span) {
				span.end();
			}

			// Send progress annotation for the search step
			dataStream.writeData({
				type: 'research_update',
				runId,
				status: 'in-progress',
				content: {
					type: 'research_update',
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
						completedSteps: _newCompletedSteps,
						totalSteps,
					},
				},
			});
		}

		// Send completed annotation for the search step
		dataStream.writeData({
			type: 'research_update',
			runId,
			status: 'in-progress',
			content: {
				type: 'research_update',
				data: {
					id: `search-web-final`,
					type: 'web',
					status: 'complete',
					title: 'Search step complete',
					timestamp: Date.now(),
					completedSteps: _newCompletedSteps,
					totalSteps,
				},
			},
		});

		return {
			searchResults,
			completedSteps: _newCompletedSteps,
		};
	},
});

const analyzeResultsSchema = z.object({
	analysisResults: z.array(z.any()),
	completedSteps: z.number(),
	totalSteps: z.number(),
});

const analysisResultSchema = z
	.array(
		z.object({
			insight: z.string(),
			evidence: z.array(z.string()),
			confidence: z.number().min(0).max(1),
		}),
	)
	.max(3);

const analyzeResults = createStep({
	id: 'analyze-results',
	inputSchema: searchWebSchema,
	outputSchema: analyzeResultsSchema,
	execute: async ({ inputData, runId, mastra, getInitData, getStepResult }) => {
		const triggerData = getInitData() as TriggerSchema;
		const { dataStream } = triggerData;
		const { searchResults, completedSteps } = inputData;
		const researchStepsResult = getStepResult(researchSteps);
		const { stepIds, totalSteps } = researchStepsResult;

		if (!mastra) {
			throw new Error('Mastra not found');
		}

		// Perform analyses
		const _analysisResults: z.infer<typeof analysisResultSchema> = [];
		let _completedSteps = completedSteps;

		for (const step of stepIds.analysisSteps) {
			dataStream.writeData({
				type: 'research_update',
				runId,
				status: 'in-progress',
				content: {
					type: 'research_update',
					data: {
						id: step.id,
						type: 'analysis',
						status: 'in-progress',
						title: `Analyzing ${step.analysis.type}`,
						analysisType: step.analysis.type,
						message: `Analyzing ${step.analysis.type}...`,
						timestamp: Date.now(),
						completedSteps: _completedSteps,
						totalSteps,
					},
				},
			});

			const { object: analysisResult } = await mastra
				.getAgent('researchAnalyst')
				.generate(
					[
						{
							role: 'user',
							content: dedent`
              Analysis type: ${step.analysis.type}
              Analysis description: ${step.analysis.description}
              Search results: ${JSON.stringify(searchResults)}
            `,
						},
					],
					{
						output: z.object({
							findings: analysisResultSchema,
						}),
					},
				);

			_analysisResults.push(...analysisResult.findings);
			_completedSteps++;

			dataStream.writeData({
				type: 'research_update',
				runId,
				status: 'in-progress',
				content: {
					type: 'research_update',
					data: {
						id: step.id,
						type: 'analysis',
						status: 'in-progress',
						title: `Analysis of ${step.analysis.type} complete`,
						analysisType: step.analysis.type,
						findings: analysisResult.findings,
						message: `Completed analysis of ${step.analysis.type}`,
						timestamp: Date.now(),
						completedSteps: _completedSteps,
						totalSteps,
					},
				},
			});
		}

		dataStream.writeData({
			type: 'research_update',
			runId,
			status: 'in-progress',
			content: {
				type: 'research_update',
				data: {
					id: `analysis-final`,
					type: 'analysis',
					status: 'complete',
					title: `Analysis complete`,
					timestamp: Date.now(),
					completedSteps: _completedSteps,
					totalSteps,
				},
			},
		});

		return {
			analysisResults: _analysisResults,
			completedSteps: _completedSteps,
			totalSteps,
		};
	},
});

const researchReport = createStep({
	id: 'research-report',
	inputSchema: analyzeResultsSchema,
	outputSchema: z.object({
		type: z.string(),
		runId: z.string(),
		researchPlan: researchPlanSchema,
		searchResults: z.array(z.any()),
		analysisResults: z.array(z.any()),
		progress: z.number(),
	}),
	execute: async ({ inputData, runId, mastra, getInitData, getStepResult }) => {
		const triggerData = getInitData() as TriggerSchema;
		const { dataStream, messages } = triggerData;
		const { analysisResults, totalSteps } = inputData;

		const researchPlan = getStepResult(researchPlanning);
		const searchWebResult = getStepResult(searchWeb);
		const { searchResults } = searchWebResult;

		if (!mastra) {
			throw new Error('Mastra not found');
		}

		const reportStream = await mastra.getAgent('largeAssistant').stream(
			[
				...messages,
				{
					role: 'user',
					content: dedent`
          Generate a markdown report for my request based on the research plan, search results and analysis results.
					The report should keep the original request in mind, utilizing the search results and analysis results to formulate
					a well structured report that is easy to understand based on the findings on the search results and taking the analysis results
					as insights and possible observations.

					Do not output anything other than the report in markdown (follow your markdown formatting and citations guidelines).
					Never open with 'This report summarizes ...' or anything similar. Be objective and attend to generating a useful, professional report.

					Open the report with a summary and create sections to present the findings on the search results and the analysis results.
					Do not create sections to expand on basic concepts unless my original request asks for it.

					Give a relevant main title to the report, based on my original request and key insights

          Research plan: ${JSON.stringify(researchPlan)}
          Search results: ${JSON.stringify(searchResults)}
          Analysis results: ${JSON.stringify(analysisResults)}
          `,
				},
			],
			{
				experimental_transform: smoothStream({ chunking: 'word' }),
			},
		);

		for await (const chunk of reportStream.textStream) {
			dataStream.writeData({
				type: 'research_update',
				runId,
				status: 'in-progress',
				content: { type: 'text-delta', data: chunk },
			});
		}

		const agentSummary = await mastra.getAgent('largeAssistant').stream(
			[
				...messages,
				{
					role: 'user',
					content: dedent`
          Provide a short summary in markdown about the research outcome:

          Research plan: ${JSON.stringify(researchPlan)}
          Search results: ${JSON.stringify(searchResults)}
          Analysis results: ${JSON.stringify(analysisResults)}
					
					- Be concise, a paragraph or two
					- Highlight key findings and insights
					- Verify with me if the result needs further research into a specific topic or point from the research or analyses results, offering possible leads.
					- Return the summary in markdown format with a subheader saying something like 'Key findings and insights from the research' or similar, diversifying and keeping it short and engaging.
					- Don't open with 'Here's a summary...' or something similar. Open with the subheader as instructed.
          `,
				},
			],
			{
				experimental_transform: smoothStream({ chunking: 'word' }),
			},
		);

		dataStream.writeData({
			type: 'research_update',
			runId,
			status: 'complete',
			content: {
				type: 'research_update',
				data: {
					id: 'research-and-analysis',
					type: 'research-and-analysis',
					status: 'complete',
					message: `Research and analysis complete`,
					completedSteps: totalSteps,
					totalSteps,
					timestamp: Date.now(),
				},
			},
		});

		agentSummary.mergeIntoDataStream(dataStream);

		return {
			type: 'research',
			runId,
			researchPlan,
			searchResults,
			analysisResults,
			progress: 100,
		};
	},
});

const researchWorkflow = createWorkflow({
	id: 'research-workflow',
	inputSchema: workflowInputSchema,
	outputSchema: z.object({
		type: z.string(),
		runId: z.string(),
		researchPlan: researchPlanSchema,
		searchResults: z.array(z.any()),
		analysisResults: z.array(z.any()),
		progress: z.number(),
	}),
})
	.then(researchPlanning)
	.then(researchSteps)
	.then(searchWeb)
	.then(analyzeResults)
	.then(researchReport)
	.commit();

export { researchWorkflow };
