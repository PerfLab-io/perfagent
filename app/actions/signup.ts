'use server';

import { prepareVerification } from '@/app/actions/verify.server';
import { resend } from '@/lib/resend';
import OnboardingOtpEmail from '@/components/emails/onboarding-otp';
import { redirect } from 'next/navigation';
import { signupSchema } from '@/lib/validations/email';
import { db } from '@/drizzle/db';
import { user } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

// Updated to use Resend with React component
async function sendEmail(
	to: string,
	subject: string,
	emailProps: {
		email: string;
		otpCode: string;
	},
) {
	try {
		const result = await resend.emails.send({
			from: 'PerfAgent <support@perflab.io>',
			to,
			subject,
			react: OnboardingOtpEmail(emailProps),
		});

		return { success: Boolean(result?.data) };
	} catch (error) {
		console.error('Error sending email:', error);
		return { success: false };
	}
}

export async function signupAction({
	email,
	skipRedirect = false,
}: {
	email: string;
	skipRedirect?: boolean;
}) {
	try {
		const validationResult = signupSchema.safeParse({ email });

		if (!validationResult.success) {
			const firstError = validationResult.error.errors[0];
			return {
				success: false,
				error: firstError?.message || 'Invalid email address',
			};
		}

		const validatedEmail = validationResult.data.email;

		const existingUser = await db
			.select()
			.from(user)
			.where(eq(user.email, validatedEmail))
			.limit(1);

		if (existingUser.length > 0) {
			return {
				success: false,
				error:
					'An account with this email already exists. Please sign in instead.',
			};
		}

		// Prepare verification with 10-minute expiry
		const { otp } = await prepareVerification({
			period: 604800, // 7 days (60 * 60 * 24 * 7)
			type: 'onboarding',
			target: validatedEmail,
		});

		const emailResult = await sendEmail(
			validatedEmail,
			'Complete Your PerfAgent Onboarding',
			{
				email: validatedEmail,
				otpCode: otp,
			},
		);

		if (!emailResult.success) {
			return {
				success: false,
				error: 'Failed to send verification email',
			};
		}

		if (skipRedirect) {
			return {
				success: true,
			};
		}
	} catch (error) {
		console.error('Signup error:', error);
		return {
			success: false,
			error: 'An error occurred during signup',
		};
	}

	redirect(`/verify?type=onboarding&target=${encodeURIComponent(email)}`);
}
