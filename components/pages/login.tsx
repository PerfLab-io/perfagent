'use client';

import { checkAgentAccess, grantRole, login } from '@/app/actions/login';
import { ArrowRight, Eye, EyeOff, Lock, User } from 'lucide-react';
import { redirect } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';
import { Button } from '../ui/button';

export interface AttachedFile {
	id: string;
	name: string;
	size: number;
	type: string;
}

const isDragEvent = (
	e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>,
): e is React.DragEvent<HTMLDivElement & { files: FileList }> => {
	return 'dataTransfer' in e && 'files' in e.dataTransfer;
};

const isFileInputEvent = (
	e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>,
): e is React.ChangeEvent<HTMLInputElement & { files: FileList }> => {
	return 'target' in e && 'files' in e.target;
};

const DEFAULT_DEBOUNCE_TIME = 120;

export const LoginPageComponent = () => {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [loginStep, setLoginStep] = useState<
		'idle' | 'authenticating' | 'success' | 'error'
	>('idle');
	const [errorMessage, setErrorMessage] = useState('');

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setLoginStep('authenticating');
		setErrorMessage('');

		const { user, hasAccess } = await login(email, password);

		if (!user) {
			setLoginStep('error');
			setErrorMessage('Invalid credentials');
			setIsLoading(false);
			return;
		}

		if (!hasAccess) {
			setLoginStep('error');
			setErrorMessage(
				'You do not yet have access to the system. Please ensure to signup to the waitlist and wait for an invite',
			);
			setIsLoading(false);
			return;
		}

		setLoginStep('success');
		setIsLoading(false);

		requestAnimationFrame(() => {
			setTimeout(() => {
				redirect('/chat');
			}, 300);
		});
	};

	return (
		<>
			<div className="mb-6">
				<div className="text-peppermint-400 mb-2 font-mono text-sm">
					$ ./authenticate_user.sh
				</div>
				<div className="text-peppermint-300 font-mono text-sm">
					{loginStep === 'idle' &&
						'Enter your credentials to access the system...'}
					{loginStep === 'authenticating' && 'Verifying credentials...'}
					{loginStep === 'success' &&
						'Authentication successful! Redirecting...'}
					{loginStep === 'error' && 'Authentication failed. Please try again.'}
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
							<User className="h-4 w-4" />
						</div>
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="bg-peppermint-900/50 border-peppermint-600 text-peppermint-50 focus:ring-peppermint-500 placeholder:text-peppermint-600 w-full rounded-md border py-3 pr-4 pl-10 font-mono focus:border-transparent focus:ring-2 focus:outline-none"
							placeholder="user@perfagent.dev"
							required
							disabled={isLoading}
						/>
					</div>
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
							type={showPassword ? 'text' : 'password'}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="bg-peppermint-900/50 border-peppermint-600 text-peppermint-50 focus:ring-peppermint-500 placeholder:text-peppermint-600 w-full rounded-md border py-3 pr-12 pl-10 font-mono focus:border-transparent focus:ring-2 focus:outline-none"
							placeholder="••••••••••••"
							required
							disabled={isLoading}
						/>
						<button
							type="button"
							onClick={() => setShowPassword(!showPassword)}
							className="text-peppermint-500 hover:text-peppermint-400 absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
							disabled={isLoading}
						>
							{showPassword ? (
								<EyeOff className="h-4 w-4" />
							) : (
								<Eye className="h-4 w-4" />
							)}
						</button>
					</div>
				</div>

				{/* Error message */}
				{loginStep === 'error' && (
					<div className="rounded-md border border-rose-500 bg-rose-900/30 p-3">
						<div className="font-mono text-sm text-rose-400">
							ERROR: {errorMessage}
						</div>
					</div>
				)}

				{/* Success message */}
				{loginStep === 'success' && (
					<div className="bg-peppermint-900/30 border-peppermint-500 rounded-md border p-3">
						<div className="text-peppermint-400 font-mono text-sm">
							SUCCESS: Access granted. Initializing dashboard...
						</div>
					</div>
				)}

				{/* Submit button */}
				<Button
					type="submit"
					disabled={isLoading || loginStep === 'success'}
					className="bg-peppermint-500 hover:bg-peppermint-600 text-peppermint-950 flex w-full items-center justify-center gap-2 rounded-md py-3 font-mono font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isLoading ? (
						<span className="flex items-center gap-2">
							<span className="border-peppermint-950 inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></span>
							AUTHENTICATING...
						</span>
					) : loginStep === 'success' ? (
						<span className="flex items-center gap-2">
							REDIRECTING...
							<ArrowRight className="h-4 w-4" />
						</span>
					) : (
						<span className="flex items-center gap-2">
							LOGIN
							<ArrowRight className="h-4 w-4" />
						</span>
					)}
				</Button>

				<div className="border-peppermint-600 mt-6 rounded-md border border-dashed p-3">
					<div className="text-peppermint-400 mb-2 font-mono text-xs">
						INFO:
					</div>
					<div className="text-peppermint-300 space-y-1 font-mono text-xs">
						<p>
							We are currently in private preview stage for the chat. Please{' '}
							<a
								href="/#signup"
								className="text-peppermint-300 hover:text-peppermint-200 underline transition-colors"
							>
								signup to the waitlist here
							</a>
						</p>
					</div>
				</div>
			</form>
		</>
	);
};
