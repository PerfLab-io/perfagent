'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
	User,
	UserCircle,
	Lock,
	Shield,
	ArrowRight,
	AlertCircle,
} from 'lucide-react';
import { createAccountAction } from '@/app/(onboarding)/onboarding/actions';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
	onboardingSchema,
	type OnboardingFormValues,
} from '@/lib/validations/email';

export function OnboardingForm({ email }: { email: string }) {
	const [success, setSuccess] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [serverError, setServerError] = useState<string | null>(null);
	const router = useRouter();

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<OnboardingFormValues>({
		resolver: zodResolver(onboardingSchema),
		defaultValues: {
			username: '',
			name: '',
			password: '',
			confirmPassword: '',
			agreeToTerms: false,
		},
	});

	const onSubmit = async (data: OnboardingFormValues) => {
		setServerError(null);

		startTransition(async () => {
			const result = await createAccountAction({
				username: data.username,
				name: data.name,
				password: data.password,
				confirmPassword: data.confirmPassword,
				agreeToTerms: data.agreeToTerms,
			});

			if (result.success) {
				setSuccess(true);
				// Redirect to chat after a short delay
				setTimeout(() => {
					router.push('/chat');
				}, 1500);
			} else {
				setServerError(result.error || 'Failed to create account');
			}
		});
	};

	if (success) {
		return (
			<>
				<div className="mb-6">
					<div className="text-peppermint-400 mb-2 font-mono text-sm">
						$ ./create_account.sh
					</div>
					<div className="text-peppermint-300 font-mono text-sm">
						Account created successfully! Redirecting...
					</div>
				</div>
				<div className="bg-peppermint-900/30 border-peppermint-500 rounded-md border p-3">
					<div className="text-peppermint-400 font-mono text-sm">
						SUCCESS: Welcome to PerfAgent! Initializing chat interface...
					</div>
				</div>
			</>
		);
	}

	return (
		<>
			<div className="mb-6">
				<div className="text-peppermint-400 mb-2 font-mono text-sm">
					$ ./create_account.sh
				</div>
				<div className="text-peppermint-300 font-mono text-sm">
					Complete your account setup for{' '}
					<span className="text-peppermint-400">{email}</span>...
				</div>
			</div>

			<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
				{/* Username field */}
				<div className="space-y-2">
					<label className="text-peppermint-400 block font-mono text-sm">
						&gt; USERNAME:
					</label>
					<div className="relative">
						<div className="text-peppermint-500 absolute top-1/2 left-3 -translate-y-1/2">
							<User className="h-4 w-4" />
						</div>
						<input
							type="text"
							{...register('username')}
							className="bg-peppermint-900/50 border-peppermint-600 text-peppermint-50 focus:ring-peppermint-500 placeholder:text-peppermint-600 w-full rounded-md border py-3 pr-4 pl-10 font-mono focus:border-transparent focus:ring-2 focus:outline-none"
							placeholder="username"
							disabled={isPending}
						/>
					</div>
					{errors.username && (
						<div className="flex items-start gap-1 text-rose-400">
							<AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
							<span className="font-mono text-xs">
								{errors.username.message}
							</span>
						</div>
					)}
				</div>

				{/* Name field */}
				<div className="space-y-2">
					<label className="text-peppermint-400 block font-mono text-sm">
						&gt; FULL_NAME:
					</label>
					<div className="relative">
						<div className="text-peppermint-500 absolute top-1/2 left-3 -translate-y-1/2">
							<UserCircle className="h-4 w-4" />
						</div>
						<input
							type="text"
							{...register('name')}
							className="bg-peppermint-900/50 border-peppermint-600 text-peppermint-50 focus:ring-peppermint-500 placeholder:text-peppermint-600 w-full rounded-md border py-3 pr-4 pl-10 font-mono focus:border-transparent focus:ring-2 focus:outline-none"
							placeholder="John Doe"
							disabled={isPending}
						/>
					</div>
					{errors.name && (
						<div className="flex items-start gap-1 text-rose-400">
							<AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
							<span className="font-mono text-xs">{errors.name.message}</span>
						</div>
					)}
				</div>

				{/* Password field */}
				<div className="space-y-2">
					<label className="text-peppermint-400 block font-mono text-sm">
						&gt; PASSWORD:
					</label>
					<div className="relative">
						<div className="text-peppermint-500 absolute top-1/2 left-3 -translate-y-1/2">
							<Lock className="h-4 w-4" />
						</div>
						<input
							type="password"
							{...register('password')}
							className="bg-peppermint-900/50 border-peppermint-600 text-peppermint-50 focus:ring-peppermint-500 placeholder:text-peppermint-600 w-full rounded-md border py-3 pr-4 pl-10 font-mono focus:border-transparent focus:ring-2 focus:outline-none"
							placeholder="••••••••"
							disabled={isPending}
						/>
					</div>
					{errors.password && (
						<div className="flex items-start gap-1 text-rose-400">
							<AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
							<span className="font-mono text-xs">
								{errors.password.message}
							</span>
						</div>
					)}
				</div>

				{/* Confirm Password field */}
				<div className="space-y-2">
					<label className="text-peppermint-400 block font-mono text-sm">
						&gt; CONFIRM_PASSWORD:
					</label>
					<div className="relative">
						<div className="text-peppermint-500 absolute top-1/2 left-3 -translate-y-1/2">
							<Shield className="h-4 w-4" />
						</div>
						<input
							type="password"
							{...register('confirmPassword')}
							className="bg-peppermint-900/50 border-peppermint-600 text-peppermint-50 focus:ring-peppermint-500 placeholder:text-peppermint-600 w-full rounded-md border py-3 pr-4 pl-10 font-mono focus:border-transparent focus:ring-2 focus:outline-none"
							placeholder="••••••••"
							disabled={isPending}
						/>
					</div>
					{errors.confirmPassword && (
						<div className="flex items-start gap-1 text-rose-400">
							<AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
							<span className="font-mono text-xs">
								{errors.confirmPassword.message}
							</span>
						</div>
					)}
				</div>

				{/* Terms of Service checkbox */}
				<div className="space-y-2">
					<label className="flex cursor-pointer items-start gap-3">
						<input
							type="checkbox"
							{...register('agreeToTerms')}
							className="bg-peppermint-900/50 border-peppermint-600 text-peppermint-500 focus:ring-peppermint-500 mt-1 h-4 w-4 rounded border focus:ring-2 focus:ring-offset-0"
							disabled={isPending}
						/>
						<span className="text-peppermint-300 font-mono text-sm">
							I agree to the{' '}
							<a
								href="/terms"
								target="_blank"
								className="text-peppermint-400 hover:text-peppermint-300 underline transition-colors"
							>
								Terms of Service
							</a>{' '}
							and{' '}
							<a
								href="/privacy"
								target="_blank"
								className="text-peppermint-400 hover:text-peppermint-300 underline transition-colors"
							>
								Privacy Policy
							</a>
						</span>
					</label>
					{errors.agreeToTerms && (
						<div className="flex items-start gap-1 text-rose-400">
							<AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
							<span className="font-mono text-xs">
								{errors.agreeToTerms.message}
							</span>
						</div>
					)}
				</div>

				{/* Server Error message */}
				{serverError && (
					<div className="rounded-md border border-rose-500 bg-rose-900/30 p-3">
						<div className="flex items-start gap-2 text-rose-400">
							<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
							<div className="font-mono text-sm">ERROR: {serverError}</div>
						</div>
					</div>
				)}

				{/* Submit button */}
				<Button
					type="submit"
					disabled={isPending}
					className="bg-peppermint-500 hover:bg-peppermint-600 text-peppermint-950 flex w-full items-center justify-center gap-2 rounded-md py-3 font-mono font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isPending ? (
						<span className="flex items-center gap-2">
							<span className="border-peppermint-950 inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></span>
							CREATING ACCOUNT...
						</span>
					) : success ? (
						<span className="flex items-center gap-2">
							REDIRECTING...
							<ArrowRight className="h-4 w-4" />
						</span>
					) : (
						<span className="flex items-center gap-2">
							CREATE ACCOUNT
							<ArrowRight className="h-4 w-4" />
						</span>
					)}
				</Button>

				{/* Info section */}
				<div className="border-peppermint-600 mt-6 rounded-md border border-dashed p-3">
					<div className="text-peppermint-400 mb-2 font-mono text-xs">
						SECURITY INFO:
					</div>
					<div className="text-peppermint-300 space-y-1 font-mono text-xs">
						<p>• Password must contain uppercase, lowercase, and number</p>
						<p>• Username must be unique across all users</p>
						<p>• Your data is encrypted and secure</p>
					</div>
				</div>
			</form>
		</>
	);
}
