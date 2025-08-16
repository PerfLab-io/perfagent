'use server';

import { db } from '@/drizzle/db';
import {
	user,
	password as passwordTable,
	role,
	roleToUser,
} from '@/drizzle/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import {
	verifyTempSession,
	deleteTempSession,
	createSession,
} from '@/lib/session.server';
import { onboardingSchema } from '@/lib/validations/email';
import crypto from 'crypto';
import { resend } from '@/lib/resend';
import { OnboardingEmail } from '@/components/emails/onboarding';

export async function createAccountAction({
	username,
	name,
	password,
	confirmPassword,
	agreeToTerms,
}: {
	username: string;
	name: string;
	password: string;
	confirmPassword: string;
	agreeToTerms: boolean;
}) {
	try {
		const validationResult = onboardingSchema.safeParse({
			username,
			name,
			password,
			confirmPassword,
			agreeToTerms,
		});

		if (!validationResult.success) {
			const firstError = validationResult.error.errors[0];
			return {
				success: false,
				error: firstError?.message || 'Invalid form data',
			};
		}

		const validatedData = validationResult.data;

		const tempSession = await verifyTempSession();
		if (!tempSession) {
			return {
				success: false,
				error: 'Invalid session. Please start the onboarding process again.',
			};
		}

		const email = tempSession.email;

		const existingUser = await db
			.select()
			.from(user)
			.where(eq(user.email, email))
			.limit(1);

		if (existingUser.length > 0) {
			return {
				success: false,
				error: 'An account with this email already exists',
			};
		}

		const existingUsername = await db
			.select()
			.from(user)
			.where(eq(user.username, validatedData.username))
			.limit(1);

		if (existingUsername.length > 0) {
			return {
				success: false,
				error: 'Username is already taken',
			};
		}

		const passwordHash = await bcrypt.hash(validatedData.password, 12);

		const userId = crypto.randomUUID();
		const newUser = await db
			.insert(user)
			.values({
				id: userId,
				email,
				username: validatedData.username,
				name: validatedData.name,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.returning();

		if (!newUser || newUser.length === 0) {
			return {
				success: false,
				error: 'Failed to create user account',
			};
		}

		await db.insert(passwordTable).values({
			userId: userId,
			hash: passwordHash,
		});

		const userRole = await db
			.select()
			.from(role)
			.where(eq(role.name, 'user'))
			.limit(1);

		const agentUserRole = await db
			.select()
			.from(role)
			.where(eq(role.name, 'agent-user'))
			.limit(1);

		if (userRole.length > 0) {
			await db.insert(roleToUser).values({
				a: userRole[0].id,
				b: userId,
			});
		}

		if (agentUserRole.length > 0) {
			await db.insert(roleToUser).values({
				a: agentUserRole[0].id,
				b: userId,
			});
		}

		await createSession(userId);

		await deleteTempSession();

		await resend.emails.send({
			from: 'PerfAgent <support@perflab.io>',
			to: email,
			subject: 'Welcome to PerfAgent - Your Access is Now Active! 🚀',
			react: OnboardingEmail({
				previewText:
					"Welcome to PerfAgent - Let's optimize your web performance together!",
				userName: validatedData.username,
				heroImageUrl:
					'https://yn20j37lsyu3f9lc.public.blob.vercel-storage.com/newsletter/hero_images/hero16-VKXKwJJzJwMhFV0ovjFpGVljf8nxLL.jpg',
				heroImageAlt:
					'Welcome to PerfAgent! - AI-Powered Web Performance Analysis',
				chatUrl: 'https://agent.perflab.io/chat',
				unsubscribeUrl: `https://agent.perflab.io/unsubscribe?email=${encodeURIComponent(email)}`,
				recipientEmail: email,
			}),
		});

		return {
			success: true,
			userId: userId,
		};
	} catch (error) {
		console.error('Account creation error:', error);
		return {
			success: false,
			error: 'An error occurred during account creation',
		};
	}
}
