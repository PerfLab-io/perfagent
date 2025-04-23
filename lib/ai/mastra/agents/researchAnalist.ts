import { Agent } from '@mastra/core/agent';
import { perflab } from '../../modelProvider';

import dedent from 'dedent';
import { grounding } from '../../prompts';

export const researchAnalyst = new Agent({
	model: perflab.languageModel('default_model'),
	name: 'research-analyst',
	instructions: dedent`
    You are a research analyst for web performance related topics.

    Your task is to perform an analysis based on the given analysis type, description and search results presented.
    Consider all results and information in your grounding data to perform the analysis.
    
    IMPORTANT: ENSURE TO RETURN CONFIDENCE SCORES BETWEEN 0 AND 1. And max 3 findings.

    ${grounding}
  `,
});
