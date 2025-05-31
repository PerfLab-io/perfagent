import 'server-only';
import { z } from 'zod';
import { generateTOTP, verifyTOTP } from '@epic-web/totp';
import { db } from '@/drizzle/db';
import { verification } from '@/drizzle/schema';
import { eq, and, gt } from 'drizzle-orm';

export const twoFAVerifyVerificationType = '2fa-verify';
const types = [
	'onboarding',
	'reset-password',
	'change-email',
	'2fa',
	'org-invite',
	'signup-and-org-invite',
] as const;
export const codeQueryParam = 'code';
export const targetQueryParam = 'target';
export const typeQueryParam = 'type';
export const redirectToQueryParam = 'redirectTo';
export const orgQueryParam = 'organizationId';
export const inviteIdQueryParam = 'inviteId';

const VerificationTypeSchema = z.enum(types);
export type VerificationTypes = z.infer<typeof VerificationTypeSchema>;

export function getRedirectToUrl({
	type,
	target,
	redirectTo,
}: {
	type: VerificationTypes;
	target: string;
	redirectTo?: string;
}) {
	const baseUrl =
		process.env.VERCEL_PROJECT_PRODUCTION_URL || 'http://localhost:3000';
	const redirectToUrl = new URL(`https://agent.perflab.io/verify`);
	redirectToUrl.searchParams.set(typeQueryParam, type);
	redirectToUrl.searchParams.set(targetQueryParam, target);
	if (redirectTo) {
		redirectToUrl.searchParams.set(redirectToQueryParam, redirectTo);
	}
	return redirectToUrl;
}

export async function prepareVerification({
	period,
	type,
	target,
	context,
}: {
	period: number;
	type: VerificationTypes;
	target: string;
	context?: { inviteId?: string };
}) {
	const verifyUrl = getRedirectToUrl({ type, target });
	const redirectTo = new URL(verifyUrl.toString());

	const { otp, ...verificationConfig } = await generateTOTP({
		algorithm: 'SHA-256',
		// Leaving off 0, O, and I on purpose to avoid confusing users.
		charSet: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789',
		period,
	});
	const verificationData = {
		type,
		target,
		...verificationConfig,
		expiresAt: new Date(Date.now() + verificationConfig.period * 1000),
	};

	await db
		.insert(verification)
		.values({
			id: crypto.randomUUID(),
			...verificationData,
			expiresAt: verificationData.expiresAt.toISOString(),
			createdAt: new Date().toISOString(),
		})
		.onConflictDoUpdate({
			target: [verification.target, verification.type],
			set: {
				...verificationData,
				expiresAt: verificationData.expiresAt.toISOString(),
			},
		});

	// add the otp to the url we'll email the user.
	verifyUrl.searchParams.set(codeQueryParam, otp);

	if (context?.inviteId) {
		verifyUrl.searchParams.set(inviteIdQueryParam, context.inviteId);
	}

	return { otp, redirectTo, verifyUrl };
}

export async function isCodeValid({
	code,
	type,
	target,
}: {
	code: string;
	type: VerificationTypes | typeof twoFAVerifyVerificationType;
	target: string;
}) {
	const verificationRecord = await db
		.select({
			algorithm: verification.algorithm,
			secret: verification.secret,
			period: verification.period,
			charSet: verification.charSet,
		})
		.from(verification)
		.where(
			and(
				eq(verification.target, target),
				eq(verification.type, type),
				gt(verification.expiresAt, new Date().toISOString()),
			),
		)
		.limit(1);

	if (!verificationRecord.length) return false;

	const verificationData = verificationRecord[0];
	const result = verifyTOTP({
		otp: code,
		...verificationData,
	});
	if (!result) return false;

	return true;
}
