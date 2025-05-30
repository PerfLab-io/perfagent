'use server';

import NewsletterEmail from '@/components/emails/newsletter';
import { resend } from '@/lib/resend';

// Helper functions for YouTube URL processing
function isYouTubeUrl(url: string): boolean {
	const youtubeRegex =
		/^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
	return youtubeRegex.test(url);
}

function extractYouTubeVideoId(url: string): string | null {
	const youtubeRegex =
		/^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
	const match = url.match(youtubeRegex);
	return match ? match[4] : null;
}

function getYouTubeThumbnailUrl(videoId: string): string {
	// Use the high-quality thumbnail
	return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

// Process image URLs to handle YouTube links
function processImageUrl(url: string | undefined): {
	imageUrl: string | undefined;
	linkUrl: string | undefined;
} {
	if (!url) return { imageUrl: undefined, linkUrl: undefined };

	if (isYouTubeUrl(url)) {
		const videoId = extractYouTubeVideoId(url);
		if (videoId) {
			return {
				imageUrl: getYouTubeThumbnailUrl(videoId),
				linkUrl: url, // Keep the original YouTube URL for linking
			};
		}
	}

	// If not a YouTube URL, return the original URL with no link
	return { imageUrl: url, linkUrl: undefined };
}

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
		// Process hero image URL for YouTube videos
		const { imageUrl: processedHeroImageUrl, linkUrl: heroLinkUrl } =
			processImageUrl(newsletterData.heroImageUrl);

		// Process update image URLs for YouTube videos
		const processedUpdates = newsletterData.updates?.map((update) => {
			const { imageUrl: processedImageUrl, linkUrl: imageLinkUrl } =
				processImageUrl(update.imageUrl);

			return {
				...update,
				imageUrl: processedImageUrl,
				// If the image is a YouTube video and no explicit link is provided, use the YouTube link
				linkUrl: update.linkUrl || imageLinkUrl || undefined,
			};
		});

		// Prepare the newsletter data with processed URLs
		const processedNewsletterData = {
			...newsletterData,
			heroImageUrl: processedHeroImageUrl,
			heroLinkUrl, // Add the hero link URL if it's a YouTube video
			updates: processedUpdates,
		};

		// If audienceId is provided, create and send a broadcast to the audience
		if (audienceId) {
			try {
				// Step 1: Create a broadcast
				const { data } = await resend.broadcasts.create({
					audienceId: audienceId,
					name: subject,
					from: 'PerfAgent <support@perflab.io>',
					subject: subject,
					react: NewsletterEmail({
						...processedNewsletterData,
						unsubscribeUrl: `https://agent.perflab.io/unsubscribe`,
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
					const unsubscribeUrl = `https://agent.perflab.io/unsubscribe?email=${encodeURIComponent(email)}`;

					const data = await resend.emails.send({
						from: 'PerfAgent <support@perflab.io>',
						to: email,
						subject: subject,
						react: NewsletterEmail({
							...processedNewsletterData,
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
