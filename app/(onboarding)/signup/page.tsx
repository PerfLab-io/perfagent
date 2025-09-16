import { Suspense } from 'react';
import { SignupForm } from '@/components/pages/signup-form';
import TerminalWindow from '@/components/terminal-window';

export default function SignupPage() {
	return (
		<div className="bg-peppermint-950 text-peppermint-50 relative min-h-screen overflow-hidden">
			<div className="flex h-screen w-full items-center justify-center">
				<TerminalWindow title="ONBOARDING TERMINAL">
					<Suspense
						fallback={
							<div className="border-peppermint-600 bg-peppermint-900/30 rounded-md border p-6 text-center">
								<p className="text-peppermint-300 font-mono">Loading...</p>
							</div>
						}
					>
						<SignupForm />
					</Suspense>
				</TerminalWindow>
			</div>
		</div>
	);
}
