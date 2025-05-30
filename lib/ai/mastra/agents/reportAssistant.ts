import { Agent } from '@mastra/core/agent';
import { perflab } from '../../modelProvider';
import { reportFormat } from '../../prompts';

export const reportAssistant = new Agent({
	name: 'PerfAgent report assistant',
	instructions: reportFormat,
	model: perflab.languageModel('default_model'),
});
