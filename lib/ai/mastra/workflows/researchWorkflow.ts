import { CoreMessage, coreMessageSchema, DataStreamWriter } from 'ai';

import { Step, Workflow } from '@mastra/core/workflows';
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
] as const;

const depth = 'advanced' as const;

const researchPlanSchema = z.object({
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

const researchPlanning = new Step({
	id: 'research-planning',
	description: "Builds a research plan based on user's input",
	inputSchema: z.object({
		messages: z.array(messageSchema),
	}),
	outputSchema: researchPlanSchema,
	execute: async ({ context, runId: toolCallId, mastra }) => {
		const triggerData = context?.getStepResult<{
			dataStream: DataStreamWriter;
			messages: CoreMessage[];
		}>('trigger');

		if (!triggerData) {
			throw new Error('Trigger data not found');
		}
		if (!mastra) {
			throw new Error('Mastra not found');
		}

		const { dataStream: dataStreamWriter, messages } = triggerData;

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

		const { object: researchPlan } = await mastra
			.getAgent('researchPlanner')
			.generate(messages, {
				output: researchPlanSchema,
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

const researchSteps = new Step({
	id: 'research-steps',
	description: 'Assembles the research plan into a list of steps',
	outputSchema: researchStepsSchema,
	execute: async ({ context, runId: toolCallId }) => {
		const triggerData = context?.getStepResult<{
			dataStream: DataStreamWriter;
		}>('trigger');
		const researchPlan =
			context?.getStepResult<z.infer<typeof researchPlanSchema>>(
				'research-planning',
			);

		if (!triggerData) {
			throw new Error('Trigger data not found');
		}

		const { dataStream: dataStreamWriter } = triggerData;

		console.log('==========researchPlan', researchPlan);

		const stepIds = generateStepIds(researchPlan);

		const completedSteps = 1;
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

const searchWeb = new Step({
	id: 'search-web',
	description:
		'Searches the web based on the data from the research steps plan',
	execute: async ({ context, runId: toolCallId, mastra }) => {
		const triggerData = context?.getStepResult<{
			dataStream: DataStreamWriter;
		}>('trigger');
		const researchStepsStepResult =
			context?.getStepResult<z.infer<typeof researchStepsSchema>>(
				'research-steps',
			);

		if (!triggerData) {
			throw new Error('Trigger data not found');
		}
		if (!mastra) {
			throw new Error('Mastra not found');
		}

		if (!tav) {
			throw new Error('Tavily client not found');
		}

		const { dataStream: dataStreamWriter } = triggerData;
		const { stepIds, completedSteps, totalSteps } = researchStepsStepResult;

		const searchResults: z.infer<typeof searchWebSchema>['searchResults'] = [];
		let _newCompletedSteps = completedSteps;

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
					completedSteps: _newCompletedSteps,
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
				completedSteps: _newCompletedSteps,
				totalSteps,
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

const analyzeResults = new Step({
	id: 'analyze-results',
	description: 'Analyzes the results of the research',
	outputSchema: z.object({
		analysisResults: analysisResultSchema,
		completedSteps: z.number(),
	}),
	execute: async ({ context, runId: toolCallId, mastra }) => {
		const triggerData = context?.getStepResult<{
			dataStream: DataStreamWriter;
		}>('trigger');
		const researchStepsStepResult =
			context?.getStepResult<z.infer<typeof researchStepsSchema>>(
				'research-steps',
			);
		const searchWebStepResult =
			context?.getStepResult<z.infer<typeof searchWebSchema>>('search-web');

		if (!triggerData) {
			throw new Error('Trigger data not found');
		}
		if (!mastra) {
			throw new Error('Mastra not found');
		}

		const { dataStream: dataStreamWriter } = triggerData;
		const { searchResults, completedSteps } = searchWebStepResult;
		const { stepIds, totalSteps } = researchStepsStepResult;

		// Perform analyses
		const _analysisResults: z.infer<typeof analysisResultSchema> = [];
		let _completedSteps = completedSteps;

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
					completedSteps: _completedSteps,
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
				completedSteps: _completedSteps,
				totalSteps,
			},
		});

		return {
			analysisResults: _analysisResults,
			completedSteps: _completedSteps,
		};
	},
});

const researchReport = new Step({
	id: 'research-report',
	description: 'Generates a research report based on the results and analysis',
	execute: async ({ context, runId: toolCallId, mastra }) => {
		const triggerData = context?.getStepResult<{
			dataStream: DataStreamWriter;
		}>('trigger');
		const researchPlan =
			context?.getStepResult<z.infer<typeof researchPlanSchema>>(
				'research-planning',
			);
		const researchStepsStepResult =
			context?.getStepResult<z.infer<typeof researchStepsSchema>>(
				'research-steps',
			);
		const searchWebStepResult =
			context?.getStepResult<z.infer<typeof searchWebSchema>>('search-web');
		const analyzeResultsStepResult =
			context?.getStepResult<z.infer<typeof analyzeResultsSchema>>(
				'analyze-results',
			);

		if (!triggerData) {
			throw new Error('Trigger data not found');
		}
		if (!mastra) {
			throw new Error('Mastra not found');
		}

		const { dataStream: dataStreamWriter } = triggerData;
		const { searchResults } = searchWebStepResult;
		const { totalSteps } = researchStepsStepResult;
		const { analysisResults } = analyzeResultsStepResult;

		const reportStream = await mastra.getAgent('largeAssistant').stream([
			{
				role: 'user',
				content: dedent`
          Generate a markdown report based on the research plan, search results and analysis results.

          Research plan: ${JSON.stringify(researchPlan)}
          Search results: ${JSON.stringify(searchResults)}
          Analysis results: ${JSON.stringify(analysisResults)}
          `,
			},
		]);

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

		reportStream.mergeIntoDataStream(dataStreamWriter);

		return {
			type: 'research',
			toolCallId,
			researchPlan,
			searchResults,
			analysisResults,
			progress: 100,
		};
	},
});

const researchWorkflow = new Workflow({
	name: 'research-workflow',
	triggerSchema: z.object({
		dataStream: z.object({
			writeMessageAnnotation: z.function().args(
				z.object({
					type: z.string(),
					data: z.any(),
				}),
			),
		}),
		messages: z.array(messageSchema),
	}),
})
	.step(researchPlanning)
	.then(researchSteps)
	.then(searchWeb)
	.then(analyzeResults)
	.then(researchReport);

researchWorkflow.commit();

export { researchWorkflow };
