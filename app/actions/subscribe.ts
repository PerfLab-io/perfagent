'use server';

import { resend } from '@/lib/resend';
import { emailSchema } from '@/lib/validations/email';
import { SignupEmail } from '@/components/emails/signup-confirmation';

// Check if we're in a local/development environment
const isLocalEnvironment = process.env.NODE_ENV === 'development';

// Waitlist audience ID for your users
const WAITLIST_AUDIENCE_NAME = 'PerfAgent Waitlist';
let WAITLIST_AUDIENCE_ID: string | null = null;

/**
 * Ensures the waitlist audience exists, creating it if necessary
 */
async function ensureWaitlistAudience() {
	if (isLocalEnvironment) {
		return 'local-audience-id';
	}

	try {
		// If we already have the audience ID cached, return it
		if (WAITLIST_AUDIENCE_ID) {
			return WAITLIST_AUDIENCE_ID;
		}

		// Get all audiences to find ours
		const { data: audiences, error: audiencesError } =
			await resend.audiences.list();

		if (audiencesError || !audiences) {
			console.error('Error listing audiences:', audiencesError);
			throw new Error('Failed to list audiences');
		}

		// Check if our waitlist audience already exists
		const waitlistAudience = audiences.data.find(
			(audience) => audience.name === WAITLIST_AUDIENCE_NAME,
		);

		if (waitlistAudience) {
			WAITLIST_AUDIENCE_ID = waitlistAudience.id;
			return waitlistAudience.id;
		}

		// Create a new waitlist audience if it doesn't exist
		const { data: newAudience, error: createError } =
			await resend.audiences.create({
				name: WAITLIST_AUDIENCE_NAME,
			});

		if (createError || !newAudience) {
			console.error('Error creating audience:', createError);
			throw new Error('Failed to create waitlist audience');
		}

		WAITLIST_AUDIENCE_ID = newAudience.id;
		return newAudience.id;
	} catch (error) {
		console.error('Error ensuring waitlist audience:', error);
		throw new Error('Failed to ensure waitlist audience exists');
	}
}

/**
 * Adds an email to the waitlist audience
 */
export async function addToWaitlist(email: string) {
	if (isLocalEnvironment) {
		console.log(
			`🔷 Local environment - Would add ${email} to waitlist audience`,
		);

		// Simulate "Email already in waitlist" error for test@test.com
		if (email === 'test@test.com') {
			throw new Error('Email already in waitlist');
		}

		return { success: true, contactId: '123' };
	}

	try {
		const audienceId = await ensureWaitlistAudience();

		// First, check if the contact exists in our audience
		const { data: contacts, error: listError } = await resend.contacts.list({
			audienceId,
		});

		if (listError) {
			console.error('Error listing contacts:', listError);
			throw new Error('Failed to check existing contacts');
		}

		// Find the existing contact if any
		const existingContact = contacts?.data.find(
			(contact) => contact.email === email,
		);

		if (existingContact) {
			// If contact exists and is already subscribed, throw error
			if (!existingContact.unsubscribed) {
				console.log(`Email ${email} already in waitlist`);
				throw new Error('Email already in waitlist');
			}

			// If contact exists but is unsubscribed, resubscribe them
			console.log(`Resubscribing ${email} to waitlist`);
			const { error: updateError } = await resend.contacts.update({
				audienceId,
				id: existingContact.id,
				unsubscribed: false,
			});

			if (updateError) {
				console.error('Error resubscribing to waitlist:', updateError);
				throw new Error('Failed to resubscribe to waitlist');
			}

			return { success: true, contactId: existingContact.id };
		}

		// Add new contact to the audience
		const { data, error } = await resend.contacts.create({
			email,
			audienceId,
			firstName: email.split('@')[0],
			unsubscribed: false,
		});

		if (error) {
			console.error('Error adding to waitlist:', error);
			throw new Error('Failed to add to waitlist');
		}

		return { success: true, contactId: data?.id };
	} catch (error) {
		console.error('Add to waitlist error:', error);
		throw error;
	}
}

export async function subscribeToNewsletter(formData: FormData) {
	try {
		// Extract email from form data
		const email = formData.get('email') as string;

		// Validate email with Zod schema
		const validatedFields = emailSchema.safeParse({ email });

		if (!validatedFields.success) {
			return {
				success: false,
				error:
					validatedFields.error.flatten().fieldErrors.email?.[0] ||
					'Invalid email',
			};
		}

		// Add the email to the waitlist audience first
		try {
			const result = await addToWaitlist(email);
			if (!result.success) {
				return {
					success: false,
					error: 'Failed to add to waitlist. Please try again.',
				};
			}
		} catch (error) {
			// If the error is "Email already in waitlist", return it as a user-friendly error
			if (
				error instanceof Error &&
				error.message === 'Email already in waitlist'
			) {
				return {
					success: false,
					error: "You're already subscribed to our waitlist!",
				};
			}

			console.error('Failed to add to waitlist:', error);
			return {
				success: false,
				error: 'Failed to add to waitlist. Please try again.',
			};
		}

		// In local environment, log to console instead of sending emails
		if (isLocalEnvironment) {
			const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/unsubscribe?email=${encodeURIComponent(email)}`;

			console.log('🔷 Local environment detected - Email would be sent with:');
			console.log({
				to: email,
				subject: 'Welcome to PerfAgent!',
				content: `
          <div>
            <h1>Thanks for subscribing!</h1>
            <p>You'll be the first to know when PerfAgent launches.</p>
            <p>If you wish to unsubscribe, <a href="${unsubscribeUrl}">click here</a>.</p>
          </div>
        `,
			});
		}

		// Then send the confirmation email
		const { data, error } = await resend.emails.send({
			from: 'no-reply@perflab.io', // Update with your verified domain
			to: email,
			subject: 'Welcome to PerfAgent!',
			react: SignupEmail({ email }),
		});

		if (error) {
			console.error('Error sending email:', error);
			return {
				success: false,
				error: 'Failed to send confirmation email',
			};
		}

		return {
			success: true,
		};
	} catch (error) {
		console.error('Subscribe action error:', error);
		return {
			success: false,
			error: 'Something went wrong. Please try again.',
		};
	}
}
