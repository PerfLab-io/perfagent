import { NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { serverEnv } from '@/lib/env/server';
import { getJobHandler, type EnqueuedJob } from '@/lib/jobs/registry';

export const runtime = 'nodejs';

async function handler(req: Request) {
	try {
		const body = (await req.json()) as EnqueuedJob;

		if (!body || typeof body.name !== 'string') {
			return NextResponse.json(
				{ error: 'Invalid job payload' },
				{ status: 400 },
			);
		}

		const jobHandler = getJobHandler(body.name);
		if (!jobHandler) {
			return NextResponse.json(
				{ error: `Unknown job: ${body.name}` },
				{ status: 400 },
			);
		}

		const result = await jobHandler(body.payload as unknown);
		return NextResponse.json({ ok: true, name: body.name, result });
	} catch (error) {
		console.error('[QStash Receiver] Job execution error:', error);
		return NextResponse.json(
			{ error: 'Job execution failed' },
			{ status: 500 },
		);
	}
}

export const POST = verifySignatureAppRouter(handler, {
	currentSigningKey: serverEnv.QSTASH_CURRENT_SIGNING_KEY,
	nextSigningKey: serverEnv.QSTASH_NEXT_SIGNING_KEY,
});
