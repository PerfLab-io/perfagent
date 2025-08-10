import { NextResponse } from 'next/server';
import { deleteSchedule } from '@/lib/jobs/schedules';

export const runtime = 'nodejs';

interface Params {
	params: { id: string };
}

export async function DELETE(_: Request, { params }: Params) {
	const { id } = params;
	if (!id) {
		return NextResponse.json({ error: 'Missing schedule id' }, { status: 400 });
	}
	await deleteSchedule(id);
	return NextResponse.json({ ok: true });
}
