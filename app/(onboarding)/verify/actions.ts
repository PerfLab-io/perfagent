'use server';

import { isCodeValid, type VerificationTypes } from '@/app/actions/verify';

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
