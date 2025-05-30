import { Agent } from '@mastra/core/agent';
import { perflab } from '../../modelProvider';
import { routerSystemPrompt } from '../../prompts';
import { z } from 'zod';

export const routerAgent = new Agent({
	name: 'PerfAgent router',
	instructions: routerSystemPrompt,
	model: perflab.languageModel('topics_model'),
});

export const routerOutputSchema = z.object({
	workflow: z
		.enum(['cwvInsightsWorkflow', 'researchWorkflow'])
		.nullable()
		.describe(
			'The workflow to use in case the user message requires any form of deeper analysis. Null if a simple response is sufficient.',
		),
	certainty: z
		.number()
		.min(0)
		.max(1)
		.describe(
			'A number between 0 and 1 (0 - 100 percent) with the certainty of a need or not of a workflow based on the user sentiment and message, also taking in consideration the current context of previous messages.',
		),
});
