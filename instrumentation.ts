import { registerOTel } from '@vercel/otel';
import { LangfuseExporter } from 'langfuse-vercel';
import { serverEnv } from '@/lib/env/server';

export function register() {
	registerOTel({
		serviceName: 'perf-agent',
		traceExporter: new LangfuseExporter({
			secretKey: serverEnv.LANGFUSE_SECRET_KEY,
			publicKey: serverEnv.LANGFUSE_PUBLIC_KEY,
			baseUrl: serverEnv.LANGFUSE_BASEURL,
			environment: process.env.NODE_ENV,
		}),
	});
}
