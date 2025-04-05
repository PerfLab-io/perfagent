import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { insightsWorkflow } from './workflows';
import { weatherAgent } from './agents';
import { LangfuseExporter } from 'langfuse-vercel';
import { serverEnv } from '../../env/server';

export const mastra = new Mastra({
	workflows: { insightsWorkflow },
	agents: { weatherAgent },
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
