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
		<div className="bg-peppermint-950 dark:bg-peppermint-100 relative min-h-screen w-full overflow-hidden py-16">
			{/* Grid background */}
			<div className="bg-grid-pattern absolute inset-0 opacity-10 dark:opacity-5"></div>

			{/* Scan lines effect */}
			<div className="bg-scanlines dark:bg-scanlines-light pointer-events-none absolute inset-0"></div>

			<div className="relative z-10 container mx-auto px-4">
				<div className="mx-auto max-w-3xl">
					{/* Terminal-style header */}
					<div className="mb-6 flex items-center">
						<div className="bg-peppermint-500 dark:bg-peppermint-700 mr-2 h-3 w-3 rounded-full"></div>
						<div className="text-peppermint-500 dark:text-peppermint-700 font-mono text-sm tracking-wider uppercase">
							$ ./unsubscribe_from_updates.sh
						</div>
					</div>

					<h2 className="text-peppermint-50 dark:text-peppermint-950 mb-4 text-3xl font-bold md:text-4xl">
						<span className="text-peppermint-500 dark:text-peppermint-700">
							{'>'}
						</span>{' '}
						We're sorry to see you go
					</h2>

					{!submitted ? (
						<>
							<p className="text-peppermint-300 dark:text-peppermint-700 mb-8 max-w-2xl">
								We understand that inboxes can get crowded. If you'd like to
								unsubscribe from our updates, please confirm your email address
								below. You can always resubscribe later if you change your mind.
							</p>

							<form onSubmit={handleSubmit}>
								<div className="flex w-full flex-col gap-3 sm:flex-row">
									<div className="relative flex-1">
										<div className="text-peppermint-500 dark:text-peppermint-700 absolute top-1/2 left-3 -translate-y-1/2">
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
											className="border-peppermint-700 bg-peppermint-50 text-peppermint-600 placeholder:text-peppermint-600 focus:ring-peppermint-500 dark:border-peppermint-400 dark:text-peppermint-500 dark:placeholder:text-peppermint-500 dark:focus:ring-peppermint-700 h-12 w-full rounded-md border px-8 py-3 focus:ring-2 focus:outline-hidden dark:bg-white"
											required
											aria-invalid={error ? 'true' : 'false'}
											aria-describedby={error ? 'email-error' : undefined}
										/>
									</div>
									<Button
										type="submit"
										disabled={isPending}
										className="bg-peppermint-500 text-peppermint-950 hover:bg-peppermint-600 dark:bg-peppermint-700 dark:text-peppermint-50 dark:hover:bg-peppermint-800 flex h-12 items-center justify-center gap-2 rounded-md px-6 font-medium transition-all"
									>
										{isPending ? (
											<span className="flex items-center gap-2">
												Processing
												<span className="border-peppermint-950 inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></span>
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
							<div className="animate-fadeIn border-peppermint-700 bg-peppermint-900/30 dark:border-peppermint-400 dark:bg-peppermint-200/30 mb-8 flex items-start gap-4 rounded-md border p-6">
								<CheckCircle className="text-peppermint-500 dark:text-peppermint-700 mt-1 h-8 w-8 shrink-0" />
								<div>
									<h4 className="text-peppermint-50 dark:text-peppermint-950 mb-2 font-bold">
										You've been unsubscribed
									</h4>
									<p className="text-peppermint-300 dark:text-peppermint-700 mb-4">
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
									className="text-peppermint-500 hover:text-peppermint-400 dark:text-peppermint-700 dark:hover:text-peppermint-600 inline-flex items-center gap-2 transition-colors"
								>
									<ArrowLeft size={16} />
									<span>Return to homepage</span>
								</Link>
							</div>
						</>
					)}

					<div className="border-peppermint-800/50 dark:border-peppermint-300/50 mt-12 border-t pt-8">
						<div className="text-peppermint-400 dark:text-peppermint-600 text-center text-sm">
							<p>
								If you have any questions or need assistance, please contact our
								support team.
							</p>
							<p className="mt-2">
								<span className="text-peppermint-500 dark:text-peppermint-700 font-mono">
									{'{'}
								</span>
								<span> support@perflab.io </span>
								<span className="text-peppermint-500 dark:text-peppermint-700 font-mono">
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
