import { NextResponse } from 'next/server';
import { createSchedule, listSchedules } from '@/lib/jobs/schedules';

export const runtime = 'nodejs';

export async function GET() {
	const schedules = await listSchedules();
	return NextResponse.json({ schedules });
}

export async function POST(req: Request) {
	const { name, cron, payload, queue, retries } = (await req.json()) as {
		name: string;
		cron: string;
		payload?: unknown;
		queue?: string;
		retries?: number;
	};

	if (!name || !cron) {
		return NextResponse.json(
			{ error: 'Missing name or cron' },
			{ status: 400 },
		);
	}

	const created = await createSchedule({ name, cron, payload, queue, retries });
	return NextResponse.json({ ok: true, schedule: created });
}
