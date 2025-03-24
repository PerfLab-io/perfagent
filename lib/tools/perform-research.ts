import { registerTool } from '../mock-ai-sdk';
import type { DataStream } from '../mock-ai-sdk';

// Mock research results for web performance patterns
const mockResults = [
	{
		id: '1',
		title: 'Core Web Vitals: Essential Metrics for Modern Web Performance',
		snippet:
			"Core Web Vitals are Google's initiative to provide unified guidance for quality signals. They focus on three aspects of user experience—loading performance (LCP), interactivity (FID), and visual stability (CLS). Understanding and optimizing these metrics is crucial for delivering a great user experience.",
		source: 'web',
		sourceIcon: 'Globe',
		url: 'https://web.dev/vitals/',
	},
	{
		id: '2',
		title: 'Advanced Performance Optimization: Resource Loading and Rendering',
		snippet:
			'Modern web performance optimization involves strategic resource loading, efficient JavaScript execution, and optimized rendering paths. Techniques like code splitting, tree shaking, and critical CSS extraction can significantly improve loading times and user experience.',
		source: 'academic',
		sourceIcon: 'BookOpen',
		url: 'https://developer.mozilla.org/en-US/docs/Web/Performance',
	},
	{
		id: '3',
		title: 'Performance Monitoring and Analysis Patterns',
		snippet:
			'Real User Monitoring (RUM) combined with synthetic testing provides comprehensive performance insights. Using tools like the Performance API, Lighthouse, and WebPageTest helps identify bottlenecks and optimization opportunities.',
		source: 'analysis',
		sourceIcon: 'BarChart',
	},
	{
		id: '4',
		title: 'Client-Side vs. Server-Side Optimization Strategies',
		snippet:
			'A holistic approach to web performance involves both client-side and server-side optimizations. This includes techniques like server-side rendering, edge caching, image optimization, and efficient data loading patterns.',
		source: 'academic',
		sourceIcon: 'BookOpen',
		url: 'https://web.dev/performance-optimizing-content-efficiency/',
	},
	{
		id: '5',
		title: 'Error Handling and Performance Recovery',
		snippet:
			'Implementing robust error handling and recovery mechanisms is crucial for maintaining performance under adverse conditions. This includes graceful degradation, offline capabilities, and strategic error boundaries.',
		source: 'web',
		sourceIcon: 'Globe',
	},
];

// Define the research steps
const initialSteps = (query: string) => [
	{
		id: 'plan',
		title: 'Research Plan',
		subtitle: '(4 queries, 3 analyses)',
		icon: 'Search',
		status: 'pending',
	},
	{
		id: 'web',
		title: `Searched the web for "${query}"`,
		subtitle: 'Found 0 results',
		icon: 'Globe',
		status: 'pending',
	},
	{
		id: 'academic',
		title: `Searching academic papers for "${query}"`,
		subtitle: 'Searching all sources...',
		icon: 'BookOpen',
		status: 'pending',
	},
	{
		id: 'analysis',
		title: 'Analyzing patterns and insights',
		subtitle: 'Preparing analysis...',
		icon: 'BarChart',
		status: 'pending',
	},
];

// Define the research phases
const researchPhases = [
	{
		phase: 'planning',
		activeStep: 'plan',
		steps: [
			{
				id: 'plan',
				status: 'in-progress',
				expanded: true,
				subtitle: '(4 queries, 3 analyses)',
			},
		],
		progress: 15,
		visibleSteps: ['plan'],
	},
	{
		phase: 'searching',
		activeStep: 'web',
		steps: [
			{
				id: 'plan',
				status: 'complete',
				expanded: false,
				subtitle: 'Research plan created',
			},
			{
				id: 'web',
				status: 'in-progress',
				expanded: true,
			},
		],
		progress: 35,
		visibleSteps: ['plan', 'web'],
	},
	{
		phase: 'analyzing',
		activeStep: 'academic',
		steps: [
			{
				id: 'web',
				status: 'complete',
				expanded: false,
				subtitle: 'Found 3 results',
			},
			{
				id: 'academic',
				status: 'in-progress',
				expanded: true,
			},
		],
		progress: 65,
		visibleSteps: ['plan', 'web', 'academic'],
	},
	{
		phase: 'analyzing',
		activeStep: 'analysis',
		steps: [
			{
				id: 'academic',
				status: 'complete',
				expanded: false,
				subtitle: 'Found 2 results',
			},
			{
				id: 'analysis',
				status: 'in-progress',
				expanded: true,
			},
		],
		progress: 85,
		visibleSteps: ['plan', 'web', 'academic', 'analysis'],
	},
	{
		phase: 'complete',
		activeStep: null,
		steps: [
			{
				id: 'analysis',
				status: 'complete',
				expanded: false,
				subtitle: 'Analysis complete',
			},
		],
		progress: 100,
		visibleSteps: ['plan', 'web', 'academic', 'analysis'],
		showResults: true,
	},
];

export const performResearchTool = registerTool({
	name: 'performResearch',
	description: 'Performs research on web performance optimization topics',
	execute: async (params: { query: string; toolCallId?: string }) => {
		// Determine the research query
		const researchQuery = params.query.toLowerCase().includes('performance')
			? 'web performance optimization'
			: 'web performance concepts';

		// Create the initial research state
		const initialState = {
			type: 'research',
			query: researchQuery,
			phase: 'planning',
			progress: 0,
			steps: initialSteps(researchQuery),
			visibleSteps: [],
			activeStep: null,
			results: [],
			showResults: false,
			completed: false,
			toolCallId: params.toolCallId || null,
		};

		// Return the initial state immediately
		return {
			...initialState,
			streamSteps: true, // Signal that this result will be streamed in steps
		};
	},
	// Update the stream method to handle dataStream for annotations
	stream: async function* (
		params: { query: string; toolCallId?: string },
		dataStream?: DataStream,
	) {
		const researchQuery = params.query.toLowerCase().includes('performance')
			? 'web performance optimization'
			: 'web performance concepts';

		// Initial state
		const steps = initialSteps(researchQuery);
		const toolCallId =
			params.toolCallId ||
			`research-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

		// Send initial research update annotation
		if (dataStream?.writeMessageAnnotation) {
			dataStream.writeMessageAnnotation({
				type: 'research_update',
				data: {
					id: 'trace-insights',
					type: 'trace-insight',
					status: 'running',
					title: 'Research Analysis',
					message: 'Starting research analysis...',
					timestamp: Date.now(),
				},
			});
		}

		// Yield each phase with a delay
		for (let i = 0; i < researchPhases.length; i++) {
			const phase = researchPhases[i];

			// Wait before sending the next phase (simulating research time)
			await new Promise((resolve) =>
				setTimeout(resolve, i === 0 ? 1000 : 1500),
			);

			// Update steps based on the current phase
			const updatedSteps = [...steps];
			phase.steps.forEach((stepUpdate) => {
				const index = updatedSteps.findIndex((s) => s.id === stepUpdate.id);
				if (index !== -1) {
					updatedSteps[index] = {
						...updatedSteps[index],
						status: stepUpdate.status,
						expanded: stepUpdate.expanded,
						subtitle: stepUpdate.subtitle || updatedSteps[index].subtitle,
					};
				}
			});

			// Create the research state for this phase
			const researchState = {
				type: 'research',
				query: researchQuery,
				phase: phase.phase,
				progress: phase.progress,
				steps: updatedSteps,
				visibleSteps: phase.visibleSteps,
				activeStep: phase.activeStep,
				results: phase.showResults ? mockResults : [],
				showResults: !!phase.showResults,
				completed: i === researchPhases.length - 1,
				toolCallId: toolCallId,
			};

			// Send research update annotation
			if (dataStream?.writeMessageAnnotation) {
				// Send a research update annotation for the current phase
				dataStream.writeMessageAnnotation({
					type: 'research_update',
					data: {
						id: `research-${phase.activeStep || 'progress'}`,
						type: phase.activeStep || 'progress',
						status: i === researchPhases.length - 1 ? 'completed' : 'running',
						title: phase.activeStep
							? `${phase.activeStep.charAt(0).toUpperCase() + phase.activeStep.slice(1)} Research`
							: 'Research Progress',
						message: phase.activeStep
							? `${phase.activeStep === 'plan' ? 'Creating' : phase.activeStep === 'web' ? 'Searching' : 'Analyzing'} ${phase.activeStep}...`
							: 'Research in progress...',
						timestamp: Date.now(),
						completedSteps: i,
						totalSteps: researchPhases.length,
						overwrite: true,
					},
				});

				// If this is the final phase, send a completed status
				if (i === researchPhases.length - 1) {
					dataStream.writeMessageAnnotation({
						type: 'research_update',
						data: {
							id: 'research-progress',
							type: 'progress',
							status: 'completed',
							message: 'Research complete',
							completedSteps: researchPhases.length,
							totalSteps: researchPhases.length,
							isComplete: true,
							timestamp: Date.now(),
						},
						overwrite: true,
					});
				}
			}

			// Yield the updated research state
			yield researchState;
		}
	},
});
