import { LoginPageComponent } from '@/components/pages/login';
import { isAuthenticated } from '@/lib/session';
import type React from 'react';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
	const isAuthenticatedUser = await isAuthenticated();
	if (isAuthenticatedUser) {
		redirect('/');
	}

	return (
		<div className="bg-peppermint-950 text-peppermint-50 relative min-h-screen overflow-hidden">
			<div className="flex h-screen w-full items-center justify-center">
				<div className="w-full max-w-md">
					{/* Terminal window header */}
					<div className="bg-peppermint-900 border-peppermint-500 rounded-t-lg border-2 border-dotted p-3">
						<div className="flex items-center gap-2">
							<div className="bg-peppermint-500 h-3 w-3 rounded-full"></div>
							<div className="bg-merino-500 h-3 w-3 rounded-full"></div>
							<div className="h-3 w-3 rounded-full bg-rose-500"></div>
							<span className="text-peppermint-300 ml-2 font-mono text-xs tracking-wider uppercase">
								AUTHENTICATION TERMINAL
							</span>
						</div>
					</div>

					{/* Login form container */}
					<div className="bg-peppermint-950 border-peppermint-500 relative rounded-b-lg border-2 border-t-0 border-dotted p-8">
						<LoginPageComponent />

						{/* Footer links */}
						<div className="border-peppermint-600 mt-8 border-t border-dashed pt-6">
							<div className="text-peppermint-400 flex flex-col items-center justify-between gap-4 font-mono text-xs sm:flex-row">
								<a
									href="#"
									className="hover:text-peppermint-300 transition-colors"
								>
									&gt; Forgot password?
								</a>
								<a
									href="#"
									className="hover:text-peppermint-300 transition-colors"
								>
									&gt; Create account
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
