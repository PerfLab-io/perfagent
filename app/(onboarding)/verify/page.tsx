import { Suspense } from 'react';
import { VerifyForm } from '@/components/pages/verify-form';
import TerminalWindow from '@/components/terminal-window';
import Link from 'next/link';

export default function VerifyPage() {
	const footerElement = (
		<div className="border-peppermint-600 mt-6 rounded-md border border-dashed p-3">
			<div className="text-peppermint-400 mb-2 font-mono text-xs">INFO:</div>
			<div className="text-peppermint-300 space-y-1 font-mono text-xs">
				<p>
					Didn't receive a code?{' '}
					<Link
						href="/signup"
						className="text-peppermint-300 hover:text-peppermint-200 underline transition-colors"
					>
						Request new code
					</Link>
				</p>
			</div>
		</div>
	);
	return (
		<div className="bg-peppermint-950 text-peppermint-50 relative min-h-screen overflow-hidden">
			<div className="flex h-screen w-full items-center justify-center">
				<TerminalWindow
					title="VERIFICATION TERMINAL"
					footerElement={footerElement}
				>
					<Suspense
						fallback={
							<div className="border-peppermint-600 bg-peppermint-900/30 rounded-md border p-6 text-center">
								<p className="text-peppermint-300 font-mono">Loading...</p>
							</div>
						}
					>
						<VerifyForm />
					</Suspense>
				</TerminalWindow>
			</div>
		</div>
	);
}
