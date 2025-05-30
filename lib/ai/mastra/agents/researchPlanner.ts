import { Agent } from '@mastra/core/agent';
import { perflab } from '../../modelProvider';
import { researchPlannerSystemPrompt } from '../../prompts';

export const researchPlanner = new Agent({
	model: perflab.languageModel('default_model'),
	instructions: researchPlannerSystemPrompt,
	name: 'research-planner',
});
