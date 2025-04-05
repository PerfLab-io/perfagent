import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { insightsWorkflow } from './workflows';
import { routerAgent } from './agents/router';
import { LangfuseExporter } from 'langfuse-vercel';
import { serverEnv } from '@/lib/env/server';
import { smallAssistant } from './agents/smallAssistant';

export const mastra = new Mastra({
	workflows: { insightsWorkflow },
	agents: { routerAgent, smallAssistant },
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
