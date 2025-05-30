import { Agent } from '@mastra/core/agent';
import { perflab } from '../../modelProvider';
import { traceAssistantSystemPrompt } from '../../prompts';

export const traceAssistant = new Agent({
	name: 'Trace assistant',
	instructions: traceAssistantSystemPrompt,
	model: perflab.languageModel('default_model'),
});
