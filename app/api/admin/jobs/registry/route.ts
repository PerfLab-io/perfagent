import { NextResponse } from 'next/server';
import { listRegisteredJobs } from '@/lib/jobs/registry';

export const runtime = 'nodejs';

export async function GET() {
	const jobs = listRegisteredJobs();
	return NextResponse.json({ jobs });
}
