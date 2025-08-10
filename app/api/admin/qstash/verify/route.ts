import { NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { serverEnv } from '@/lib/env/server';

export const runtime = 'nodejs';

async function handler() {
	return NextResponse.json({ ok: true });
}

export const POST = verifySignatureAppRouter(handler, {
	currentSigningKey: serverEnv.QSTASH_CURRENT_SIGNING_KEY,
	nextSigningKey: serverEnv.QSTASH_NEXT_SIGNING_KEY,
});
