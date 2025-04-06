import { Agent } from '@mastra/core/agent';
import { perflab } from '../../modelProvider';

import dedent from 'dedent';

export const researchAnalyst = new Agent({
	model: perflab.languageModel('default_model'),
	name: 'research-analyst',
	instructions: dedent`
    Perform an analysis based on the given analysis type, description and search results presented.
    Consider all sources and their reliability.
    IMPORTANT: ENSURE TO RETURN CONFIDENCE SCORES BETWEEN 0 AND 1. And max 3 findings.
  `,
});
