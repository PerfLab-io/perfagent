import { Agent } from '@mastra/core/agent';
import { perflab } from '../../modelProvider';
import { networkAssistantSystemPrompt } from '../../prompts';

export const networkAssistant = new Agent({
	name: 'Network assistant',
	instructions: networkAssistantSystemPrompt,
	model: perflab.languageModel('default_model'),
});
