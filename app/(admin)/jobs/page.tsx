'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface ScheduleItem {
	id: string;
	destination: string;
	cron: string;
	createdAt?: string;
	paused?: boolean;
	lastRun?: string | null;
	nextRun?: string | null;
	body?: any;
}

export default function JobsAdminPage() {
	const [jobs, setJobs] = useState<string[]>([]);
	const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
	const [selectedJob, setSelectedJob] = useState<string>('');
	const [delaySec, setDelaySec] = useState<string>('');
	const [queue, setQueue] = useState<string>('');
	const [retries, setRetries] = useState<string>('');
	const [cron, setCron] = useState<string>('');
	const [creating, setCreating] = useState(false);
	const [enqueuing, setEnqueuing] = useState(false);

	useEffect(() => {
		void fetch('/api/admin/jobs/registry', { cache: 'no-store' })
			.then((r) => r.json())
			.then((d) => setJobs(d.jobs ?? []));
		reloadSchedules();
	}, []);

	const canEnqueue = useMemo(() => Boolean(selectedJob), [selectedJob]);
	const canCreateSchedule = useMemo(
		() => Boolean(selectedJob && cron),
		[selectedJob, cron],
	);

	async function reloadSchedules() {
		const res = await fetch('/api/admin/jobs/schedules', { cache: 'no-store' });
		const data = await res.json();
		setSchedules(data.schedules ?? []);
	}

	async function handleEnqueue() {
		setEnqueuing(true);
		try {
			await fetch('/api/admin/jobs/enqueue', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: selectedJob,
					options: {
						delay: delaySec ? Number(delaySec) : undefined,
						retries: retries ? Number(retries) : undefined,
						queue: queue || undefined,
					},
				}),
			});
		} finally {
			setEnqueuing(false);
		}
	}

	async function handleCreateSchedule() {
		setCreating(true);
		try {
			await fetch('/api/admin/jobs/schedules', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: selectedJob,
					cron,
					queue: queue || undefined,
					retries: retries ? Number(retries) : undefined,
				}),
			});
			await reloadSchedules();
		} finally {
			setCreating(false);
		}
	}

	async function handleDeleteSchedule(id: string) {
		await fetch(`/api/admin/jobs/schedules/${id}`, { method: 'DELETE' });
		await reloadSchedules();
	}

	return (
		<div className="space-y-8 p-4">
			<Card>
				<CardHeader>
					<CardTitle>Enqueue Job</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2">
						<div>
							<label className="text-sm">Job</label>
							<Select value={selectedJob} onValueChange={setSelectedJob}>
								<SelectTrigger>
									<SelectValue placeholder="Select a job" />
								</SelectTrigger>
								<SelectContent>
									{jobs.map((j) => (
										<SelectItem key={j} value={j}>
											{j}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<label className="text-sm">Delay (seconds)</label>
							<Input
								value={delaySec}
								onChange={(e) => setDelaySec(e.target.value)}
								placeholder="e.g. 300"
							/>
						</div>
						<div>
							<label className="text-sm">Queue (optional)</label>
							<Input
								value={queue}
								onChange={(e) => setQueue(e.target.value)}
								placeholder="queue name"
							/>
						</div>
						<div>
							<label className="text-sm">Retries</label>
							<Input
								value={retries}
								onChange={(e) => setRetries(e.target.value)}
								placeholder="e.g. 3"
							/>
						</div>
					</div>
					<Button disabled={!canEnqueue || enqueuing} onClick={handleEnqueue}>
						Enqueue
					</Button>
				</CardContent>
			</Card>

			<Separator />

			<Card>
				<CardHeader>
					<CardTitle>Recurring Schedules (Cron)</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2">
						<div>
							<label className="text-sm">Job</label>
							<Select value={selectedJob} onValueChange={setSelectedJob}>
								<SelectTrigger>
									<SelectValue placeholder="Select a job" />
								</SelectTrigger>
								<SelectContent>
									{jobs.map((j) => (
										<SelectItem key={j} value={j}>
											{j}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<label className="text-sm">Cron</label>
							<Input
								value={cron}
								onChange={(e) => setCron(e.target.value)}
								placeholder="*/30 * * * *"
							/>
						</div>
						<div>
							<label className="text-sm">Queue (optional)</label>
							<Input
								value={queue}
								onChange={(e) => setQueue(e.target.value)}
								placeholder="queue name"
							/>
						</div>
						<div>
							<label className="text-sm">Retries</label>
							<Input
								value={retries}
								onChange={(e) => setRetries(e.target.value)}
								placeholder="e.g. 3"
							/>
						</div>
					</div>
					<Button
						disabled={!canCreateSchedule || creating}
						onClick={handleCreateSchedule}
					>
						Create Schedule
					</Button>

					<div className="mt-6 space-y-2">
						{schedules.map((s) => (
							<div
								key={s.id}
								className="flex items-center justify-between rounded border p-3 text-sm"
							>
								<div className="space-y-1">
									<div className="font-mono">{s.id}</div>
									<div>
										Cron: <span className="font-mono">{s.cron}</span>
									</div>
									{s.body?.name && (
										<div>
											Job:{' '}
											<span className="font-mono">{String(s.body.name)}</span>
										</div>
									)}
									<div>Next: {s.nextRun ?? '-'}</div>
								</div>
								<Button
									variant="destructive"
									onClick={() => handleDeleteSchedule(s.id)}
								>
									Delete
								</Button>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
