import { Suspense } from 'react';
import { OnboardingForm } from '@/components/pages/onboarding-form';
import TerminalWindow from '@/components/terminal-window';
import { verifySession } from '@/lib/session';
import { redirect } from 'next/navigation';

export default async function OnboardingPage() {
	// Check if user has a valid session (from OTP verification)
	const session = await verifySession();

	if (!session) {
		// No session means they haven't completed OTP verification
		redirect('/signup');
	}

	// Check if the session userId is an email (temporary session)
	// If it's not an email, they may have already completed onboarding
	if (!session.userId.includes('@')) {
		// They may have already completed onboarding, redirect to chat
		redirect('/');
	}

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
						<OnboardingForm email={session.userId} />
					</Suspense>
				</TerminalWindow>
			</div>
		</div>
	);
}
