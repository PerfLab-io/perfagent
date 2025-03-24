'use client';

import type React from 'react';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Bell, CheckCircle, AlertCircle } from 'lucide-react';
import { emailSchema, type EmailFormValues } from '@/lib/validations/email';
import { subscribeToNewsletter } from '@/app/actions/subscribe';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

export function SignupNotification() {
	const [submitted, setSubmitted] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [serverError, setServerError] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		formState: { errors },
		reset,
	} = useForm<EmailFormValues>({
		resolver: zodResolver(emailSchema),
		defaultValues: {
			email: '',
		},
	});

	const onSubmit = async (data: EmailFormValues) => {
		setServerError(null);

		const formData = new FormData();
		formData.append('email', data.email);

		startTransition(async () => {
			const result = await subscribeToNewsletter(formData);

			if (result.success) {
				setSubmitted(true);
				reset();
			} else {
				setServerError(
					result.error || 'Something went wrong. Please try again.',
				);
			}
		});
	};

	return (
		<div className="relative w-full overflow-hidden bg-peppermint-950 py-16 dark:bg-peppermint-100">
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
							$ ./subscribe_to_updates.sh
						</div>
					</div>

					<h2 className="mb-4 text-3xl font-bold text-peppermint-50 dark:text-peppermint-950 md:text-4xl">
						<span className="text-peppermint-500 dark:text-peppermint-700">
							{'>'}
						</span>{' '}
						Be the first to know when we launch
					</h2>

					<p className="mb-8 max-w-2xl text-peppermint-300 dark:text-peppermint-700">
						Our performance optimization platform is almost ready. Sign up now
						to get early access, exclusive beta features, and performance
						insights before anyone else.
					</p>

					{!submitted ? (
						<form onSubmit={handleSubmit(onSubmit)} className="mb-8">
							<div className="flex flex-col gap-3 sm:flex-row">
								<div className="relative flex-1">
									<div className="absolute left-3 top-1/2 -translate-y-1/2 text-peppermint-500 dark:text-peppermint-700">
										<span className="font-mono">{'>'}</span>
									</div>
									<input
										type="email"
										{...register('email')}
										placeholder="Enter your email address"
										className="h-12 w-full rounded-md border border-peppermint-700 bg-peppermint-50 px-8 py-3 text-peppermint-600 placeholder:text-peppermint-600 focus:outline-none focus:ring-2 focus:ring-peppermint-500 dark:border-peppermint-400 dark:bg-white dark:text-peppermint-500 dark:placeholder:text-peppermint-500 dark:focus:ring-peppermint-700"
									/>
								</div>
								<Button
									type="submit"
									disabled={isPending}
									className="flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-md bg-peppermint-500 px-6 font-medium text-peppermint-950 transition-all hover:bg-peppermint-600 dark:bg-peppermint-700 dark:text-peppermint-50 dark:hover:bg-peppermint-800"
								>
									{isPending ? (
										<span className="flex items-center gap-2">
											Processing
											<span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-peppermint-950 border-t-transparent"></span>
										</span>
									) : (
										<span className="flex items-center gap-2">
											Notify Me <ArrowRight size={16} />
										</span>
									)}
								</Button>
							</div>

							{/* Error messages */}
							{(errors.email || serverError) && (
								<div className="mt-2 flex items-start gap-2 text-red-500">
									<AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
									<span className="text-sm">
										{errors.email?.message || serverError}
									</span>
								</div>
							)}
						</form>
					) : (
						<div className="animate-fadeIn mb-8 flex items-center gap-4 rounded-md border border-peppermint-700 bg-peppermint-900/30 p-6 dark:border-peppermint-400 dark:bg-peppermint-200/30">
							<CheckCircle className="h-8 w-8 flex-shrink-0 text-peppermint-500 dark:text-peppermint-700" />
							<div>
								<h4 className="mb-1 font-bold text-peppermint-50 dark:text-peppermint-950">
									You're on the list!
								</h4>
								<p className="text-peppermint-300 dark:text-peppermint-700">
									We'll notify you when PerfAgent launches. Keep an eye on your
									inbox.
								</p>
							</div>
						</div>
					)}

					<div className="flex flex-col items-start gap-4 text-sm text-peppermint-400 dark:text-peppermint-600 sm:flex-row sm:items-center">
						<div className="flex items-center gap-2">
							<Bell
								size={16}
								className="text-peppermint-500 dark:text-peppermint-700"
							/>
							<span>Early access to beta features</span>
						</div>
						<div className="hidden h-1 w-1 rounded-full bg-peppermint-700 dark:bg-peppermint-500 sm:block"></div>
						<div className="flex items-center gap-2">
							<span className="font-mono text-peppermint-500 dark:text-peppermint-700">
								{'{'}
							</span>
							<span>No spam, unsubscribe anytime</span>
							<span className="font-mono text-peppermint-500 dark:text-peppermint-700">
								{'}'}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
