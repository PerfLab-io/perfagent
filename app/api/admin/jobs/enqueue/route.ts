import { NextResponse } from 'next/server';
import { enqueue } from '@/lib/jobs/enqueue';
import type { EnqueuedJob } from '@/lib/jobs/registry';

export const runtime = 'nodejs';

export async function POST(req: Request) {
	const { name, payload, options } = (await req.json()) as {
		name: string;
		payload?: unknown;
		options?: {
			delay?: number;
			retries?: number;
			queue?: string;
			deduplicationId?: string;
		};
	};

	if (!name) {
		return NextResponse.json({ error: 'Missing job name' }, { status: 400 });
	}

	const job: EnqueuedJob = { name, payload };
	const result = await enqueue(job, options);
	return NextResponse.json({ ok: true, result });
}
