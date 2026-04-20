import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { cwvInsightsWorkflow } from './workflows/cwvInsights';
import { mcpWorkflow } from './workflows/mcpWorkflow';
import { routerAgent } from './agents/router';
import { smallAssistant } from './agents/smallAssistant';
import { researchWorkflow } from './workflows/researchWorkflow';
import { topicsAgent } from './agents/perfTopics';
import { largeAssistant } from './agents/largeAssistant';
import { researchPlanner } from './agents/researchPlanner';
import { researchAnalyst } from './agents/researchAnalist';
import { reportAssistant } from './agents/reportAssistant';
import { traceAssistant } from './agents/traceAssistant';
import { suggestionsAssistant } from './agents/suggestionsAssistant';
import { networkAssistant } from './agents/networkAssistant';
import { mcpAgent } from './agents/mcpAgent';

export const mastra = new Mastra({
	workflows: { cwvInsightsWorkflow, researchWorkflow, mcpWorkflow },
	agents: {
		smallAssistant,
		largeAssistant,
		topicsAgent,
		routerAgent,
		researchPlanner,
		researchAnalyst,
		reportAssistant,
		traceAssistant,
		networkAssistant,
		suggestionsAssistant,
		mcpAgent,
	},
	logger: createLogger({
		name: 'Mastra',
		level: 'info',
	}),
});
