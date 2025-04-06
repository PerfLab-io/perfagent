import dedent from 'dedent';
import { perflab } from '../../modelProvider';
import { Agent } from '@mastra/core/agent';
import { grounding } from '../../prompts';

export const topicsAgent = new Agent({
	name: 'Web Performance Insights and Research Agent',
	model: perflab.languageModel('topics_model'),
	instructions: dedent`
  You are a Web Performance Insights and Research expert

  Your role is to pick a topic based on your grounding knowledge here and the user prompt for research and analysis.

  ${grounding}
  `,
});
