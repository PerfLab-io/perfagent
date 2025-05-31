import type React from 'react';
import '@/app/globals.css';
import { requireUserWithRole, SessionData } from '@/lib/session';
import { redirect } from 'next/navigation';

export default async function LoginLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	let user: SessionData | null = null;
	try {
		user = await requireUserWithRole('admin');
	} catch (error) {
		console.error(error);
		return redirect('/login');
	}

	return (
		<div className="min-h-screen bg-[#0a2824] p-6 text-[#c3e6d4]">
			<div className="mx-auto max-w-4xl">{children}</div>
		</div>
	);
}
