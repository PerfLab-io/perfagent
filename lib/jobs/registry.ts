import { kv } from '@/lib/kv';
import { cleanupExpiredSessions } from '@/lib/session.server';

export type JobName =
	| 'kv.cleanup.mcp'
	| 'kv.cleanup.pkce'
	| 'db.cleanup.sessions';

export interface EnqueuedJob<T = unknown> {
	name: JobName | (string & {});
	payload?: T;
}

export type JobHandler<T = unknown, R = unknown> = (payload: T) => Promise<R>;

const registry = new Map<string, JobHandler<any, any>>();

export function registerJob<T, R>(name: string, handler: JobHandler<T, R>) {
	registry.set(name, handler as JobHandler<any, any>);
}

export function getJobHandler(name: string): JobHandler<any, any> | undefined {
	return registry.get(name);
}

export function listRegisteredJobs(): string[] {
	return Array.from(registry.keys());
}

// Built-in jobs

// Cleanup any leftover MCP cache keys; Redis TTL will expire most, but we also
// allow manual sweeping and prefix invalidation for safety.
registerJob('kv.cleanup.mcp', async () => {
	const toolKeys = await kv.keys('perfagent:mcp:tools:*');
	const oauthKeys = await kv.keys('perfagent:mcp:oauth:*');

	let deleted = 0;
	for (const key of [...toolKeys, ...oauthKeys]) {
		await kv.delete(key);
		deleted += 1;
	}
	return { deleted, toolKeys: toolKeys.length, oauthKeys: oauthKeys.length };
});

// Cleanup stale PKCE verifier remnants just in case TTL failed or in tests
registerJob('kv.cleanup.pkce', async () => {
	const keys = await kv.keys('perfagent:pkce:*');
	let deleted = 0;
	for (const key of keys) {
		await kv.delete(key);
		deleted += 1;
	}
	return { deleted };
});

// Cleanup expired sessions in the database as an example of non-KV job
registerJob('db.cleanup.sessions', async () => {
	const deletedCount = await cleanupExpiredSessions();
	return { deletedCount };
});
