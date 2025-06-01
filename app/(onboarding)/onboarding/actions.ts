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
} from '@/lib/session';
import { onboardingSchema } from '@/lib/validations/email';
import crypto from 'crypto';

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
		// Validate inputs with Zod
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

		// Verify that user has a valid temporary session
		const tempSession = await verifyTempSession();
		if (!tempSession) {
			return {
				success: false,
				error: 'Invalid session. Please start the onboarding process again.',
			};
		}

		const email = tempSession.email;

		// Check if user already exists with this email
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

		// Check if username is already taken
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

		// Hash the password
		const passwordHash = await bcrypt.hash(validatedData.password, 12);

		// Create the user
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

		// Create password entry
		await db.insert(passwordTable).values({
			userId: userId,
			hash: passwordHash,
		});

		// Find the specific roles
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

		// Assign roles if they exist
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

		// Create a real session for the new user
		await createSession(userId);

		// Remove the temporary session cookie
		await deleteTempSession();

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
