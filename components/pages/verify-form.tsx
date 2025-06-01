'use client';

import { useState, useTransition, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from '@/components/ui/input-otp';
import { ArrowRight } from 'lucide-react';
import { verifyOtpAction } from '@/app/actions/verify';

export function VerifyForm() {
	const [code, setCode] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [isPending, startTransition] = useTransition();
	const searchParams = useSearchParams();

	const type = searchParams.get('type');
	const target = searchParams.get('target');
	const urlCode = searchParams.get('code');

	// Pre-fill code from URL parameter and auto-submit if valid
	useEffect(() => {
		if (urlCode && urlCode.length === 6 && !code) {
			setCode(urlCode);
			// Auto-submit if we have all required parameters
			if (type && target) {
				startTransition(async () => {
					const result = await verifyOtpAction({
						code: urlCode,
						type,
						target,
					});

					if (result.success) {
						setSuccess(true);
						// Redirect after a short delay
						setTimeout(() => {
							window.location.href = '/onboarding';
						}, 1500);
					} else {
						setError(result.error || 'Invalid verification code');
					}
				});
			}
		}
	}, [urlCode, type, target, code]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!type || !target) {
			setError('Missing verification parameters');
			return;
		}

		if (code.length !== 6) {
			setError('Please enter a 6-digit code');
			return;
		}

		setError(null);

		startTransition(async () => {
			const result = await verifyOtpAction({
				code,
				type,
				target,
			});

			if (result.success) {
				setSuccess(true);
				// Redirect after a short delay
				setTimeout(() => {
					window.location.href = '/onboarding';
				}, 1500);
			} else {
				setError(result.error || 'Invalid verification code');
			}
		});
	};

	if (!type || !target) {
		return (
			<>
				<div className="mb-6">
					<div className="text-peppermint-400 mb-2 font-mono text-sm">
						$ ./verify_code.sh
					</div>
					<div className="text-peppermint-300 font-mono text-sm">
						Missing verification parameters...
					</div>
				</div>
				<div className="rounded-md border border-rose-500 bg-rose-900/30 p-3">
					<div className="font-mono text-sm text-rose-400">
						ERROR: Missing verification parameters. Please check your link and
						try again.
					</div>
				</div>
			</>
		);
	}

	if (success) {
		return (
			<>
				<div className="mb-6">
					<div className="text-peppermint-400 mb-2 font-mono text-sm">
						$ ./verify_code.sh
					</div>
					<div className="text-peppermint-300 font-mono text-sm">
						Verification successful! Redirecting...
					</div>
				</div>
				<div className="bg-peppermint-900/30 border-peppermint-500 rounded-md border p-3">
					<div className="text-peppermint-400 font-mono text-sm">
						SUCCESS: Code verified. Initializing onboarding...
					</div>
				</div>
			</>
		);
	}

	return (
		<>
			<div className="mb-6">
				<div className="text-peppermint-400 mb-2 font-mono text-sm">
					$ ./verify_code.sh
				</div>
				<div className="text-peppermint-300 font-mono text-sm">
					Enter your 6-digit verification code...
				</div>
			</div>

			<form onSubmit={handleSubmit} className="space-y-6">
				{/* OTP Input */}
				<div className="space-y-2">
					<label className="text-peppermint-400 block font-mono text-sm">
						&gt; VERIFICATION_CODE:
					</label>
					<div className="flex justify-center">
						<InputOTP
							maxLength={6}
							value={code}
							onChange={(value) => {
								setCode(value);
								setError(null);
							}}
							disabled={isPending}
							className="gap-2"
						>
							<InputOTPGroup className="gap-2">
								<InputOTPSlot
									index={0}
									className="bg-peppermint-900/50 border-peppermint-600 text-peppermint-50 focus:ring-peppermint-500 h-12 w-12 rounded-md border font-mono text-lg focus:border-transparent focus:ring-2 focus:outline-none"
								/>
								<InputOTPSlot
									index={1}
									className="bg-peppermint-900/50 border-peppermint-600 text-peppermint-50 focus:ring-peppermint-500 h-12 w-12 rounded-md border font-mono text-lg focus:border-transparent focus:ring-2 focus:outline-none"
								/>
								<InputOTPSlot
									index={2}
									className="bg-peppermint-900/50 border-peppermint-600 text-peppermint-50 focus:ring-peppermint-500 h-12 w-12 rounded-md border font-mono text-lg focus:border-transparent focus:ring-2 focus:outline-none"
								/>
								<InputOTPSlot
									index={3}
									className="bg-peppermint-900/50 border-peppermint-600 text-peppermint-50 focus:ring-peppermint-500 h-12 w-12 rounded-md border font-mono text-lg focus:border-transparent focus:ring-2 focus:outline-none"
								/>
								<InputOTPSlot
									index={4}
									className="bg-peppermint-900/50 border-peppermint-600 text-peppermint-50 focus:ring-peppermint-500 h-12 w-12 rounded-md border font-mono text-lg focus:border-transparent focus:ring-2 focus:outline-none"
								/>
								<InputOTPSlot
									index={5}
									className="bg-peppermint-900/50 border-peppermint-600 text-peppermint-50 focus:ring-peppermint-500 h-12 w-12 rounded-md border font-mono text-lg focus:border-transparent focus:ring-2 focus:outline-none"
								/>
							</InputOTPGroup>
						</InputOTP>
					</div>
					{target && (
						<p className="text-peppermint-400 text-center font-mono text-xs">
							Code sent to:{' '}
							<span className="text-peppermint-300">{target}</span>
						</p>
					)}
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
					disabled={isPending || code.length !== 6}
					className="bg-peppermint-500 hover:bg-peppermint-600 text-peppermint-950 flex w-full items-center justify-center gap-2 rounded-md py-3 font-mono font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isPending ? (
						<span className="flex items-center gap-2">
							<span className="border-peppermint-950 inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></span>
							VERIFYING...
						</span>
					) : success ? (
						<span className="flex items-center gap-2">
							REDIRECTING...
							<ArrowRight className="h-4 w-4" />
						</span>
					) : (
						<span className="flex items-center gap-2">
							VERIFY CODE
							<ArrowRight className="h-4 w-4" />
						</span>
					)}
				</Button>
			</form>
		</>
	);
}
