import { Agent } from '@mastra/core/agent';
import { perflab } from '../../modelProvider';
import { suggestionsSystemPrompt } from '../../prompts';

export const suggestionsAssistant = new Agent({
	name: 'PerfAgent suggestions assistant',
	instructions: suggestionsSystemPrompt,
	model: perflab.languageModel('topics_model'),
});
