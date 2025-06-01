import { Suspense } from 'react';
import { OnboardingForm } from '@/components/pages/onboarding-form';
import TerminalWindow from '@/components/terminal-window';
import { redirect } from 'next/navigation';
import { verifySession, verifyTempSession } from '@/lib/session.server';

export default async function OnboardingPage() {
	// Check for temporary session from email verification
	const tempSession = await verifyTempSession();
	const session = await verifySession();

	if (!tempSession) {
		if (!session) {
			// No temp session means they haven't completed OTP verification
			redirect('/signup');
		}
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
						<OnboardingForm email={tempSession?.email ?? ''} />
					</Suspense>
				</TerminalWindow>
			</div>
		</div>
	);
}
