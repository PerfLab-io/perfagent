import { Client } from '@upstash/qstash';
import { serverEnv } from '@/lib/env/server';
import type { EnqueuedJob } from '@/lib/jobs/registry';

const client = new Client({ token: serverEnv.QSTASH_TOKEN });

function getAppUrl() {
	const url = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
	if (!url) throw new Error('Missing NEXT_PUBLIC_APP_URL or VERCEL_URL');
	return url.startsWith('http') ? url : `https://${url}`;
}

export async function enqueue<T = unknown>(
	job: EnqueuedJob<T>,
	options?: {
		delay?: number; // seconds
		notBefore?: string; // RFC3339
		deduplicationId?: string;
		retries?: number;
		queue?: string; // QStash queue name
	},
) {
	const url = `${getAppUrl()}/api/qstash`;
	const publishOptions: any = {
		url,
		body: job,
	};

	if (options?.delay) publishOptions.delay = options.delay;
	if (options?.notBefore) publishOptions.notBefore = options.notBefore;
	if (options?.deduplicationId)
		publishOptions.deduplicationId = options.deduplicationId;
	if (options?.retries !== undefined) publishOptions.retries = options.retries;
	if (options?.queue) publishOptions.queue = options.queue;

	return client.publishJSON(publishOptions);
}

export async function enqueueRecurringCleanup() {
	// Example: schedule MCP cleanup to run in 5 minutes once
	return enqueue({ name: 'kv.cleanup.mcp' }, { delay: 300 });
}
