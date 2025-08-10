import { serverEnv } from '@/lib/env/server';
import type { EnqueuedJob } from '@/lib/jobs/registry';

const QSTASH_BASE = 'https://qstash.upstash.io/v2';

function getAppUrl() {
	const url = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
	if (!url) throw new Error('Missing NEXT_PUBLIC_APP_URL or VERCEL_URL');
	return url.startsWith('http') ? url : `https://${url}`;
}

export interface Schedule {
	id: string;
	destination: string;
	cron: string;
	createdAt?: string;
	paused?: boolean;
	lastRun?: string | null;
	nextRun?: string | null;
	body?: any;
}

export async function listSchedules(): Promise<Schedule[]> {
	const res = await fetch(`${QSTASH_BASE}/schedules`, {
		headers: {
			Authorization: `Bearer ${serverEnv.QSTASH_TOKEN}`,
			'Content-Type': 'application/json',
		},
		cache: 'no-store',
	});
	if (!res.ok) {
		throw new Error(`Failed to list schedules: ${res.status}`);
	}
	const data = await res.json();
	// The API returns an array
	return data as Schedule[];
}

export async function createSchedule(params: {
	name: string;
	cron: string; // e.g. "*/15 * * * *"
	payload?: unknown;
	queue?: string;
	retries?: number;
}): Promise<Schedule> {
	const destination = `${getAppUrl()}/api/admin/qstash`;
	const body: EnqueuedJob = { name: params.name, payload: params.payload };

	const res = await fetch(`${QSTASH_BASE}/schedules`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${serverEnv.QSTASH_TOKEN}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			destination,
			cron: params.cron,
			body,
			retries: params.retries,
			queue: params.queue,
		}),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Failed to create schedule: ${res.status} ${text}`);
	}
	return (await res.json()) as Schedule;
}

export async function deleteSchedule(id: string): Promise<void> {
	const res = await fetch(`${QSTASH_BASE}/schedules/${id}`, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${serverEnv.QSTASH_TOKEN}`,
			'Content-Type': 'application/json',
		},
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Failed to delete schedule: ${res.status} ${text}`);
	}
}
