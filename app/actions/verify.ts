'use server';

import {
	isCodeValid,
	type VerificationTypes,
} from '@/app/actions/verify.server';
import { cookies } from 'next/headers';

export async function verifyOtpAction({
	code,
	type,
	target,
}: {
	code: string;
	type: string;
	target: string;
}) {
	try {
		// Validate the input
		if (!code || !type || !target) {
			return {
				success: false,
				error: 'Missing required parameters',
			};
		}

		if (code.length !== 6) {
			return {
				success: false,
				error: 'Invalid code format',
			};
		}

		// Verify the OTP code
		const isValid = await isCodeValid({
			code,
			type: type as VerificationTypes,
			target,
		});

		if (!isValid) {
			return {
				success: false,
				error: 'Invalid or expired verification code',
			};
		}

		// Create a temporary session cookie for the verified email
		const tempSessionId = crypto.randomUUID();
		const expirationDate = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

		// Create a temporary session payload with the verified email
		const tempSessionData = {
			id: tempSessionId,
			email: target, // The verified email
			expirationDate: expirationDate.toISOString(),
		};

		// Set secure temporary session cookie
		const cookieStore = await cookies();
		cookieStore.set('temp-session-id', JSON.stringify(tempSessionData), {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			expires: expirationDate,
			path: '/',
		});

		return {
			success: true,
		};
	} catch (error) {
		console.error('Verification error:', error);
		return {
			success: false,
			error: 'An error occurred during verification',
		};
	}
}
