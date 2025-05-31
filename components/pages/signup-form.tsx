'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Mail, ArrowRight } from 'lucide-react';
import { signupAction } from '@/app/(onboarding)/signup/actions';

export function SignupForm() {
	const [email, setEmail] = useState('');
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!email) {
			setError('Email is required');
			return;
		}

		if (!email.includes('@')) {
			setError('Please enter a valid email address');
			return;
		}

		setError(null);

		startTransition(async () => {
			const result = await signupAction({ email });

			if (result.success) {
				setSuccess(true);
			} else {
				setError(result.error || 'Failed to send verification email');
			}
		});
	};

	if (success) {
		return (
			<>
				<div className="mb-6">
					<div className="text-peppermint-400 mb-2 font-mono text-sm">
						$ ./send_verification.sh
					</div>
					<div className="text-peppermint-300 font-mono text-sm">
						Verification email sent successfully!
					</div>
				</div>
				<div className="bg-peppermint-900/30 border-peppermint-500 rounded-md border p-3">
					<div className="text-peppermint-400 font-mono text-sm">
						SUCCESS: Verification email sent to {email}
					</div>
				</div>
				<div className="border-peppermint-600 mt-6 rounded-md border border-dashed p-3">
					<div className="text-peppermint-400 mb-2 font-mono text-xs">
						NEXT STEPS:
					</div>
					<div className="text-peppermint-300 space-y-1 font-mono text-xs">
						<p>1. Check your email for the verification code</p>
						<p>2. Enter the code on the verification page</p>
						<p>3. Complete your onboarding process</p>
					</div>
				</div>
			</>
		);
	}

	return (
		<>
			<div className="mb-6">
				<div className="text-peppermint-400 mb-2 font-mono text-sm">
					$ ./initialize_onboarding.sh
				</div>
				<div className="text-peppermint-300 font-mono text-sm">
					Enter your email to begin onboarding...
				</div>
			</div>

			<form onSubmit={handleSubmit} className="space-y-6">
				{/* Email field */}
				<div className="space-y-2">
					<label className="text-peppermint-400 block font-mono text-sm">
						&gt; EMAIL_ADDRESS:
					</label>
					<div className="relative">
						<div className="text-peppermint-500 absolute top-1/2 left-3 -translate-y-1/2">
							<Mail className="h-4 w-4" />
						</div>
						<input
							type="email"
							value={email}
							onChange={(e) => {
								setEmail(e.target.value);
								setError(null);
							}}
							className="bg-peppermint-900/50 border-peppermint-600 text-peppermint-50 focus:ring-peppermint-500 placeholder:text-peppermint-600 w-full rounded-md border py-3 pr-4 pl-10 font-mono focus:border-transparent focus:ring-2 focus:outline-none"
							placeholder="user@perfagent.dev"
							required
							disabled={isPending}
						/>
					</div>
				</div>

				{/* Error message */}
				{error && (
					<div className="rounded-md border border-rose-500 bg-rose-900/30 p-3">
						<div className="font-mono text-sm text-rose-400">
							ERROR: {error}
						</div>
					</div>
				)}

				{/* Submit button */}
				<Button
					type="submit"
					disabled={isPending || !email}
					className="bg-peppermint-500 hover:bg-peppermint-600 text-peppermint-950 flex w-full items-center justify-center gap-2 rounded-md py-3 font-mono font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isPending ? (
						<span className="flex items-center gap-2">
							<span className="border-peppermint-950 inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></span>
							SENDING...
						</span>
					) : (
						<span className="flex items-center gap-2">
							START ONBOARDING
							<ArrowRight className="h-4 w-4" />
						</span>
					)}
				</Button>

				{/* Info section */}
				<div className="border-peppermint-600 mt-6 rounded-md border border-dashed p-3">
					<div className="text-peppermint-400 mb-2 font-mono text-xs">
						INFO:
					</div>
					<div className="text-peppermint-300 space-y-1 font-mono text-xs">
						<p>
							We'll send you a 6-digit verification code to complete your
							onboarding process.
						</p>
						<p>The code will expire in 10 minutes for security purposes.</p>
					</div>
				</div>
			</form>
		</>
	);
}
