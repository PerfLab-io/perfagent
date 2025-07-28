import { Agent } from '@mastra/core/agent';
import { perflab } from '../../modelProvider';
import { routerSystemPrompt, enhancePromptWithMcpContext } from '../../prompts';
import { z } from 'zod';

export const routerAgent = new Agent({
	name: 'PerfAgent router',
	instructions: routerSystemPrompt,
	model: perflab.languageModel('topics_model'),
});

/**
 * Creates an MCP-aware version of the router agent
 * @param toolsets - Available MCP toolsets
 * @returns Agent instance with MCP-aware prompt
 */
export function createMcpAwareRouterAgent(
	toolsets?: Record<string, any>,
): Agent {
	return new Agent({
		name: 'PerfAgent router (MCP-enabled)',
		instructions: enhancePromptWithMcpContext(routerSystemPrompt, toolsets),
		model: perflab.languageModel('topics_model'),
	});
}

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
