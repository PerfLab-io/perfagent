import { LoginPageComponent } from '@/components/pages/login';
import { isAuthenticated } from '@/lib/session.server';
import type React from 'react';
import { redirect } from 'next/navigation';
import TerminalWindow from '@/components/terminal-window';

export default async function LoginPage() {
	const isAuthenticatedUser = await isAuthenticated();
	if (isAuthenticatedUser) {
		redirect('/');
	}

	return (
		<div className="bg-peppermint-950 text-peppermint-50 relative min-h-screen overflow-hidden">
			<div className="flex h-screen w-full items-center justify-center">
				<TerminalWindow
					title="AUTHENTICATION TERMINAL"
					footerLinks={[
						// { link: '/login', label: 'Forgot password?' },
						{ link: '/signup', label: 'Create account' },
					]}
				>
					<LoginPageComponent />
				</TerminalWindow>
			</div>
		</div>
	);
}
