import 'server-only';
import { cookies } from 'next/headers';
import { db } from '@/drizzle/db';
import { session, user, role, roleToUser } from '@/drizzle/schema';
import { eq, lt, and } from 'drizzle-orm';
import { cache } from 'react';

const SESSION_COOKIE_NAME = 'session-id';
const TEMP_SESSION_COOKIE_NAME = 'temp-session-id';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const TEMP_SESSION_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

export interface SessionData {
	id: string;
	userId: string;
	expirationDate: string;
	user?: {
		id: string;
		email: string;
		username: string;
		name: string | null;
	};
}

export interface TempSessionData {
	id: string;
	email: string;
	expirationDate: string;
}

/**
 * Create a new session in the database and set the session cookie
 * @param userId The user ID to create a session for
 * @returns Promise<string> The session ID
 */
export async function createSession(userId: string): Promise<string> {
	try {
		const sessionId = crypto.randomUUID();
		const expirationDate = new Date(Date.now() + SESSION_DURATION);

		// Create session in database
		await db.insert(session).values({
			id: sessionId,
			userId: userId,
			expirationDate: expirationDate.toISOString(),
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});

		// Set secure cookie
		const cookieStore = await cookies();
		cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			expires: expirationDate,
			path: '/',
		});

		return sessionId;
	} catch (error) {
		console.error('Error creating session:', error);
		throw new Error('Failed to create session');
	}
}

/**
 * Verify and retrieve session from database using cookie
 * Uses React cache to avoid duplicate database calls during render
 */
export const verifySession = cache(async (): Promise<SessionData | null> => {
	try {
		const cookieStore = await cookies();
		const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

		if (!sessionId) {
			return null;
		}

		// Query session with user data
		const result = await db
			.select({
				session: session,
				user: user,
			})
			.from(session)
			.innerJoin(user, eq(session.userId, user.id))
			.where(eq(session.id, sessionId))
			.limit(1);

		const sessionData = result[0];
		if (!sessionData?.session) {
			return null;
		}

		// Check if session is expired
		const now = new Date();
		const expirationDate = new Date(sessionData.session.expirationDate);

		if (now > expirationDate) {
			// Session expired, clean it up
			await deleteSession();
			return null;
		}

		return {
			id: sessionData.session.id,
			userId: sessionData.session.userId,
			expirationDate: sessionData.session.expirationDate,
			user: {
				id: sessionData.user.id,
				email: sessionData.user.email,
				username: sessionData.user.username,
				name: sessionData.user.name,
			},
		};
	} catch (error) {
		console.error('Error verifying session:', error);
		return null;
	}
});

/**
 * Delete session from database and remove cookie
 */
export async function deleteSession(): Promise<void> {
	try {
		const cookieStore = await cookies();
		const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

		if (sessionId) {
			// Remove from database
			await db.delete(session).where(eq(session.id, sessionId));
		}

		// Remove cookie
		cookieStore.delete(SESSION_COOKIE_NAME);
	} catch (error) {
		console.error('Error deleting session:', error);
		throw new Error('Failed to delete session');
	}
}

/**
 * Update session expiration time (extend session)
 * @param sessionId The session ID to update
 */
export async function extendSession(sessionId: string): Promise<void> {
	try {
		const newExpirationDate = new Date(Date.now() + SESSION_DURATION);

		await db
			.update(session)
			.set({
				expirationDate: newExpirationDate.toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.where(eq(session.id, sessionId));

		// Update cookie expiration
		const cookieStore = await cookies();
		const currentSessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

		if (currentSessionId === sessionId) {
			cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax',
				expires: newExpirationDate,
				path: '/',
			});
		}
	} catch (error) {
		console.error('Error extending session:', error);
		throw new Error('Failed to extend session');
	}
}

/**
 * Clean up expired sessions from the database
 * This should be called periodically (e.g., in a cron job)
 */
export async function cleanupExpiredSessions(): Promise<number> {
	try {
		const now = new Date().toISOString();

		const deletedSessions = await db
			.delete(session)
			.where(lt(session.expirationDate, now))
			.returning({ id: session.id });

		return deletedSessions.length;
	} catch (error) {
		console.error('Error cleaning up expired sessions:', error);
		return 0;
	}
}

/**
 * Get current user from session
 * Convenience function that extracts user data from session
 */
export const getCurrentUser = cache(async () => {
	const sessionData = await verifySession();
	return sessionData?.user || null;
});

/**
 * Check if user is authenticated
 */
export const isAuthenticated = cache(async (): Promise<boolean> => {
	const sessionData = await verifySession();
	return !!sessionData;
});

/**
 * Require user to be authenticated and have a specific role
 * @param roleName The name of the required role
 * @returns Promise<SessionData> The session data if user has the role
 * @throws Error if not authenticated or missing the role
 */
export async function requireUserWithRole(
	roleName: string,
): Promise<SessionData> {
	try {
		// First verify the session
		const sessionData = await verifySession();

		if (!sessionData) {
			throw new Error('Authentication required');
		}

		// Check if user has the specified role
		const userRole = await db
			.select({
				role: role,
			})
			.from(roleToUser)
			.innerJoin(role, eq(roleToUser.a, role.id))
			.where(and(eq(roleToUser.b, sessionData.userId), eq(role.name, roleName)))
			.limit(1);

		if (userRole.length === 0) {
			throw new Error(`Access denied: ${roleName} role required`);
		}

		return sessionData;
	} catch (error) {
		console.error('Role authorization failed:', error);
		throw error; // Re-throw to let caller handle the error
	}
}

/**
 * Verify and retrieve temporary session from cookie
 * Used during onboarding flow after email verification
 */
export const verifyTempSession = cache(
	async (): Promise<TempSessionData | null> => {
		try {
			const cookieStore = await cookies();
			const tempSessionData = cookieStore.get(TEMP_SESSION_COOKIE_NAME)?.value;

			if (!tempSessionData) {
				return null;
			}

			const parsedData: TempSessionData = JSON.parse(tempSessionData);

			// Check if temp session is expired
			const now = new Date();
			const expirationDate = new Date(parsedData.expirationDate);

			if (now > expirationDate) {
				// Temp session expired, clean it up
				await deleteTempSession();
				return null;
			}

			return parsedData;
		} catch (error) {
			console.error('Error verifying temp session:', error);
			return null;
		}
	},
);

/**
 * Delete temporary session cookie
 */
export async function deleteTempSession(): Promise<void> {
	try {
		const cookieStore = await cookies();
		cookieStore.delete(TEMP_SESSION_COOKIE_NAME);
	} catch (error) {
		console.error('Error deleting temp session:', error);
		throw new Error('Failed to delete temp session');
	}
}
