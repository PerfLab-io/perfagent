import { Agent } from '@mastra/core/agent';
import { perflab } from '../../modelProvider';
import dedent from 'dedent';
import { z } from 'zod';

export const routerAgent = new Agent({
	name: 'PerfAgent router',
	instructions: dedent`
    You are a sentiment analysis and smart router that will analyse user messages and requests about web performance and core web vitals and output a JSON object with the following fields:
    - workflow: The workflow to use in case the user message requires any form of deeper analysis. Null if a simple response is sufficient.
    - certainty: A number between 0 and 1 (0 - 100 percent) with the certainty of a need or not of a tool call based on the user sentiment and message, also taking in consideration the current context of previous messages.

    You have the following workflows available:
    - cwvInsightsWorkflow: A workflow that will analyse a trace file or user's metrics data and provide insights about the performance. This workflow is not required for general questions about performance, only for use when user's message is related 'their' metrics or trace data.
    - researchWorkflow: A workflow that will research a given topic and provide a report about the findings.

    Example possible outcome:
    { // I may need the insights workflow: User asks about his own performance metrics but there's a medium level of uncertainty if you should use the cwvInsightsWorkflow or the researchWorkflow, so you preffer to choose the cwvInsightsWorkflow
      workflow: 'cwvInsightsWorkflow',
      certainty: 0.5,
    }

    { // I need the insights workflow: User asks about his own specific performance metric or trace related question
      workflow: 'cwvInsightsWorkflow',
      certainty: 1,
    }

    { // I need the research workflow: User asks about a specific performance metric or trace related question but it is not related to the user's own metrics or trace data
      workflow: 'researchWorkflow',
      certainty: 1,
    }

    { // I don't need a workflow: User asks a general question or simply expresses some general sentiment, or a general question about performance metrics or traces, without mentioning his own metrics or trace data so we should reply with a general answer and not use any tool
      workflow: null,
      certainty: 0.8,
    }

    You can only pick one workflow when deeper analysis is required. If you KNOW the user's request DOES NOT require a workflow, same as when you KNOW the user's request DOES require a certain workflow, the certainty should be 1 or as close to 1 as possible.
    The output will be used to route the user's request to the appropriate workflow or ask for clarification if needed.
  `,
	model: perflab.languageModel('topics_model'),
});

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
