'use server';

import NewsletterEmail from '@/components/emails/newsletter';
import { resend } from '@/lib/resend';

export async function sendNewsletter(
	recipients: string[],
	subject: string,
	newsletterData: {
		previewText?: string;
		headline?: string;
		heroImageUrl?: string;
		heroImageAlt?: string;
		updates?: {
			title: string;
			content: string;
			imageUrl?: string;
			linkUrl?: string;
			linkText?: string;
		}[];
		ctaText?: string;
		ctaUrl?: string;
		currentDate?: string;
	},
	audienceId?: string,
) {
	try {
		// If audienceId is provided, create and send a broadcast to the audience
		if (audienceId) {
			try {
				// Step 1: Create a broadcast
				const { data } = await resend.broadcasts.create({
					audienceId: audienceId,
					from: 'PerfAgent <support@perflab.io>',
					subject: subject,
					react: NewsletterEmail({
						...newsletterData,
						unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe`,
					}),
				});

				if (!data) {
					throw new Error('Failed to create broadcast');
				}

				const { id: broadcastId } = data;

				// Step 2: Send the broadcast
				const sendResponse = await resend.broadcasts.send(broadcastId);

				if (!sendResponse.data) {
					throw new Error('Failed to send broadcast');
				}

				return {
					success: true,
					broadcastId,
					audienceId,
					id: sendResponse.data.id,
				};
			} catch (error) {
				console.error('Failed to create or send broadcast:', error);
				return {
					success: false,
					error: 'Failed to create or send broadcast to audience',
					details: error instanceof Error ? error.message : String(error),
				};
			}
		}

		// Validate inputs for individual recipients
		if (!recipients || recipients.length === 0) {
			return { success: false, error: 'No recipients provided' };
		}

		// Send to each recipient individually to personalize the email
		const results = await Promise.all(
			recipients.map(async (email) => {
				try {
					const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe?email=${encodeURIComponent(email)}`;

					const data = await resend.emails.send({
						from: 'PerfAgent <support@perflab.io>',
						to: email,
						subject: subject,
						react: NewsletterEmail({
							...newsletterData,
							unsubscribeUrl,
							recipientEmail: email,
						}),
					});

					return { email, success: true, data };
				} catch (error) {
					console.error(`Failed to send to ${email}:`, error);
					return { email, success: false, error };
				}
			}),
		);

		const failures = results.filter((result) => !result.success);

		if (failures.length > 0) {
			console.error('Some emails failed to send:', failures);
			return {
				success: results.some((r) => r.success),
				partialFailure: true,
				sent: results.filter((r) => r.success).length,
				failed: failures.length,
				totalAttempted: recipients.length,
			};
		}

		return {
			success: true,
			sent: recipients.length,
		};
	} catch (error) {
		console.error('Failed to send newsletter:', error);
		return { success: false, error: 'Failed to send newsletter' };
	}
}
