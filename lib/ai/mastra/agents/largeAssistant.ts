import { Agent } from '@mastra/core/agent';
import { perflab } from '../../modelProvider';
import { largeModelSystemPrompt } from '../../prompts';

export const largeAssistant = new Agent({
	name: 'PerfAgent assistant',
	instructions: largeModelSystemPrompt,
	model: perflab.languageModel('default_model'),
});
