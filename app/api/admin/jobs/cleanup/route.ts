import { NextResponse } from 'next/server';
import { enqueue } from '@/lib/jobs/enqueue';

export const runtime = 'nodejs';

export async function POST() {
	await enqueue({ name: 'kv.cleanup.mcp' });
	await enqueue({ name: 'kv.cleanup.pkce' });
	await enqueue({ name: 'db.cleanup.sessions' });
	return NextResponse.json({ ok: true });
}
