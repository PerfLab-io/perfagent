'use server';

import { resend } from '@/lib/resend';
import { NewsLetterPage } from '@/components/pages/newsletter-page';

export default async function NewsletterAdmin() {
	const { data } = await resend.audiences.list();
	const audiences = data ? data.data : [];

	return <NewsLetterPage audiences={audiences} />;
}
