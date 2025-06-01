'use server';

import { prepareVerification } from '@/app/actions/verify';
import { resend } from '@/lib/resend';
import OnboardingOtpEmail from '@/components/emails/onboarding-otp';
import { redirect } from 'next/navigation';

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

export async function signupAction({ email }: { email: string }) {
	try {
		// Validate email
		if (!email || !email.includes('@')) {
			return {
				success: false,
				error: 'Invalid email address',
			};
		}

		// Prepare verification with 10-minute expiry
		const { otp } = await prepareVerification({
			period: 600, // 10 minutes
			type: 'onboarding',
			target: email,
		});

		// Send email with React component
		const emailResult = await sendEmail(
			email,
			'Complete Your PerfAgent Onboarding',
			{
				email,
				otpCode: otp,
			},
		);

		if (!emailResult.success) {
			return {
				success: false,
				error: 'Failed to send verification email',
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
