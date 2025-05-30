'use server';

import { resend } from '@/lib/resend';
import { NewsLetterPage } from '@/components/newsletter-page';
import { requireUserWithRole, SessionData } from '@/lib/session';
import { redirect } from 'next/navigation';

export default async function NewsletterAdmin() {
	let user: SessionData | null = null;
	try {
		user = await requireUserWithRole('admin');
	} catch (error) {
		console.error(error);
		return redirect('/login');
	}

	const { data } = await resend.audiences.list();
	const audiences = data ? data.data : [];

	return <NewsLetterPage audiences={audiences} />;
}
