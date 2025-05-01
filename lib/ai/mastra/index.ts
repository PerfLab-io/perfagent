import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { cwvInsightsWorkflow } from './workflows/cwvInsights';
import { routerAgent } from './agents/router';
import { LangfuseExporter } from 'langfuse-vercel';
import { serverEnv } from '@/lib/env/server';
import { smallAssistant } from './agents/smallAssistant';
import { researchWorkflow } from './workflows/researchWorkflow';
import { topicsAgent } from './agents/perfTopics';
import { largeAssistant } from './agents/largeAssistant';
import { researchPlanner } from './agents/researchPlanner';
import { researchAnalyst } from './agents/researchAnalist';
import { reportAssistant } from './agents/reportAssistant';
import { traceAssistant } from './agents/traceAssistant';
export const mastra = new Mastra({
	workflows: { cwvInsightsWorkflow, researchWorkflow },
	agents: {
		smallAssistant,
		largeAssistant,
		topicsAgent,
		routerAgent,
		researchPlanner,
		researchAnalyst,
		reportAssistant,
		traceAssistant,
	},
	logger: createLogger({
		name: 'Mastra',
		level: 'info',
	}),
	telemetry: {
		serviceName: 'ai', // this must be set to "ai" so that the LangfuseExporter thinks it's an AI SDK trace
		enabled: true,
		export: {
			type: 'custom',
			exporter: new LangfuseExporter({
				publicKey: serverEnv.LANGFUSE_PUBLIC_KEY,
				secretKey: serverEnv.LANGFUSE_SECRET_KEY,
				baseUrl: serverEnv.LANGFUSE_BASEURL,
			}),
		},
	},
});
