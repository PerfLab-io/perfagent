'use client';

import type React from 'react';

import { useState, useTransition, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { unsubscribeFromWaitlist } from '@/app/actions/unsubscribe';
import { emailSchema } from '@/lib/validations/email';
import { z } from 'zod';
import Link from 'next/link';

export default function UnsubscribePage() {
	const searchParams = useSearchParams();
	const [email, setEmail] = useState('');
	const [submitted, setSubmitted] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | undefined>(undefined);

	useEffect(() => {
		const emailParam = searchParams.get('email');
		if (emailParam) {
			setEmail(emailParam);
		}
	}, [searchParams]);

	const validateEmail = (email: string) => {
		try {
			emailSchema.parse({ email });
			return true;
		} catch (error) {
			if (error instanceof z.ZodError) {
				setError(error.errors[0]?.message || 'Invalid email');
			}
			return false;
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		// Reset error state
		setError(undefined);

		// Client-side validation
		if (!validateEmail(email)) {
			return;
		}

		startTransition(async () => {
			const formData = new FormData();
			formData.append('email', email);
			const result = await unsubscribeFromWaitlist(formData);

			if (result.success) {
				setSubmitted(true);
			} else {
				setError(result.error);
			}
		});
	};

	return (
		<div className="relative min-h-screen w-full overflow-hidden bg-peppermint-950 py-16 dark:bg-peppermint-100">
			{/* Grid background */}
			<div className="bg-grid-pattern absolute inset-0 opacity-10 dark:opacity-5"></div>

			{/* Scan lines effect */}
			<div className="bg-scanlines dark:bg-scanlines-light pointer-events-none absolute inset-0"></div>

			<div className="container relative z-10 mx-auto px-4">
				<div className="mx-auto max-w-3xl">
					{/* Terminal-style header */}
					<div className="mb-6 flex items-center">
						<div className="mr-2 h-3 w-3 rounded-full bg-peppermint-500 dark:bg-peppermint-700"></div>
						<div className="font-mono text-sm uppercase tracking-wider text-peppermint-500 dark:text-peppermint-700">
							$ ./unsubscribe_from_updates.sh
						</div>
					</div>

					<h2 className="mb-4 text-3xl font-bold text-peppermint-50 dark:text-peppermint-950 md:text-4xl">
						<span className="text-peppermint-500 dark:text-peppermint-700">
							{'>'}
						</span>{' '}
						We're sorry to see you go
					</h2>

					{!submitted ? (
						<>
							<p className="mb-8 max-w-2xl text-peppermint-300 dark:text-peppermint-700">
								We understand that inboxes can get crowded. If you'd like to
								unsubscribe from our updates, please confirm your email address
								below. You can always resubscribe later if you change your mind.
							</p>

							<form onSubmit={handleSubmit}>
								<div className="flex w-full flex-col gap-3 sm:flex-row">
									<div className="relative flex-1">
										<div className="absolute left-3 top-1/2 -translate-y-1/2 text-peppermint-500 dark:text-peppermint-700">
											<span className="font-mono">{'>'}</span>
										</div>
										<input
											type="email"
											value={email}
											onChange={(e) => {
												setEmail(e.target.value);
												if (error) setError(undefined);
											}}
											placeholder="Confirm your email address"
											className="h-12 w-full rounded-md border border-peppermint-700 bg-peppermint-50 px-8 py-3 text-peppermint-600 placeholder:text-peppermint-600 focus:outline-hidden focus:ring-2 focus:ring-peppermint-500 dark:border-peppermint-400 dark:bg-white dark:text-peppermint-500 dark:placeholder:text-peppermint-500 dark:focus:ring-peppermint-700"
											required
											aria-invalid={error ? 'true' : 'false'}
											aria-describedby={error ? 'email-error' : undefined}
										/>
									</div>
									<Button
										type="submit"
										disabled={isPending}
										className="flex h-12 items-center justify-center gap-2 rounded-md bg-peppermint-500 px-6 font-medium text-peppermint-950 transition-all hover:bg-peppermint-600 dark:bg-peppermint-700 dark:text-peppermint-50 dark:hover:bg-peppermint-800"
									>
										{isPending ? (
											<span className="flex items-center gap-2">
												Processing
												<span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-peppermint-950 border-t-transparent"></span>
											</span>
										) : (
											<span className="flex items-center gap-2">
												Unsubscribe
											</span>
										)}
									</Button>
								</div>
								{error && (
									<div className="mt-2 flex items-start gap-2 text-red-500">
										<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
										<span className="text-sm">{error}</span>
									</div>
								)}
							</form>
						</>
					) : (
						<>
							<div className="animate-fadeIn mb-8 flex items-start gap-4 rounded-md border border-peppermint-700 bg-peppermint-900/30 p-6 dark:border-peppermint-400 dark:bg-peppermint-200/30">
								<CheckCircle className="mt-1 h-8 w-8 shrink-0 text-peppermint-500 dark:text-peppermint-700" />
								<div>
									<h4 className="mb-2 font-bold text-peppermint-50 dark:text-peppermint-950">
										You've been unsubscribed
									</h4>
									<p className="mb-4 text-peppermint-300 dark:text-peppermint-700">
										We've removed your email from our waitlist.
									</p>
									<p className="text-peppermint-300 dark:text-peppermint-700">
										If you unsubscribed by mistake or change your mind, you can
										always sign up again on our homepage.
									</p>
								</div>
							</div>

							<div className="flex justify-center">
								<Link
									href="/"
									className="inline-flex items-center gap-2 text-peppermint-500 transition-colors hover:text-peppermint-400 dark:text-peppermint-700 dark:hover:text-peppermint-600"
								>
									<ArrowLeft size={16} />
									<span>Return to homepage</span>
								</Link>
							</div>
						</>
					)}

					<div className="mt-12 border-t border-peppermint-800/50 pt-8 dark:border-peppermint-300/50">
						<div className="text-center text-sm text-peppermint-400 dark:text-peppermint-600">
							<p>
								If you have any questions or need assistance, please contact our
								support team.
							</p>
							<p className="mt-2">
								<span className="font-mono text-peppermint-500 dark:text-peppermint-700">
									{'{'}
								</span>
								<span> support@perflab.io </span>
								<span className="font-mono text-peppermint-500 dark:text-peppermint-700">
									{'}'}
								</span>
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
