import { NextResponse } from 'next/server';
import { enqueue } from '@/lib/jobs/enqueue';

export const runtime = 'nodejs';

export async function POST() {
	// Fire-and-forget enqueue a cleanup job for MCP and PKCE
	await enqueue({ name: 'kv.cleanup.mcp' });
	await enqueue({ name: 'kv.cleanup.pkce' });
	return NextResponse.json({ ok: true });
}
