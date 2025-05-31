'use server';

import { db } from '@/drizzle/db';
import { user, role, roleToUser } from '@/drizzle/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { resend } from '@/lib/resend';
import { grantRole, revokeRole } from './login';

export type AudienceContact = {
	id: string;
	email: string;
	first_name?: string;
	last_name?: string;
	unsubscribed: boolean;
	created_at: string;
};

export type UserWithRole = {
	id: string;
	email: string;
	username: string | null;
	name?: string;
	hasAgentUserRole: boolean;
	existsInDb: boolean;
};

export type PendingUpdate = {
	userId: string;
	email: string;
	shouldHaveRole: boolean;
	currentHasRole: boolean;
};

/**
 * Get all contacts from a Resend audience
 * @param audienceId The ID of the audience to fetch contacts from
 * @returns Promise<AudienceContact[]> Array of contacts from the audience
 */
export async function getAudienceContacts(
	audienceId: string,
): Promise<AudienceContact[]> {
	try {
		const { data: contacts, error } = await resend.contacts.list({
			audienceId,
		});

		if (error || !contacts) {
			console.error('Error fetching audience contacts:', error);
			return [];
		}

		return contacts.data.map((contact) => ({
			id: contact.id,
			email: contact.email,
			first_name: contact.first_name || undefined,
			last_name: contact.last_name || undefined,
			unsubscribed: contact.unsubscribed,
			created_at: contact.created_at,
		}));
	} catch (error) {
		console.error('Error fetching audience contacts:', error);
		return [];
	}
}

/**
 * Get users from the database and check if they have the 'agent-user' role
 * Also include contacts from the audience that don't exist in the database
 * @param audienceContacts Array of contacts from the audience
 * @returns Promise<UserWithRole[]> Array of users with role information
 */
export async function getUsersWithRoleInfo(
	audienceContacts: AudienceContact[],
): Promise<UserWithRole[]> {
	try {
		const contactEmails = audienceContacts.map((contact) => contact.email);

		if (contactEmails.length === 0) {
			return [];
		}

		// Get all users from the database that match the audience contacts with their roles
		const dbUsersWithRoles = await db
			.select({
				user: user,
				role: role,
			})
			.from(user)
			.leftJoin(roleToUser, eq(user.id, roleToUser.b))
			.leftJoin(
				role,
				and(eq(roleToUser.a, role.id), eq(role.name, 'agent-user')),
			)
			.where(inArray(user.email, contactEmails));

		console.log('DB query results:', dbUsersWithRoles.length);

		// Create a map of email to user with role info
		const userMap = new Map<string, UserWithRole>();

		// Add users from database
		for (const userResult of dbUsersWithRoles) {
			const { user: dbUser, role: dbRole } = userResult;

			// Check if we already have this user in the map (to handle multiple role entries)
			const existingUser = userMap.get(dbUser.email);

			if (existingUser) {
				// If we already have the user but didn't have the agent-user role, update it
				if (!existingUser.hasAgentUserRole && dbRole?.name === 'agent-user') {
					existingUser.hasAgentUserRole = true;
				}
			} else {
				// Add new user to the map
				userMap.set(dbUser.email, {
					id: dbUser.id,
					email: dbUser.email,
					username: dbUser.username,
					name: dbUser.name || undefined,
					hasAgentUserRole: dbRole?.name === 'agent-user',
					existsInDb: true,
				});
			}
		}

		// Add contacts that don't exist in database
		for (const contact of audienceContacts) {
			if (!userMap.has(contact.email)) {
				userMap.set(contact.email, {
					id: '', // No ID for non-existing users
					email: contact.email,
					username: null,
					name:
						contact.first_name && contact.last_name
							? `${contact.first_name} ${contact.last_name}`
							: contact.first_name || contact.last_name || undefined,
					hasAgentUserRole: false,
					existsInDb: false,
				});
			}
		}

		const result = Array.from(userMap.values());
		console.log(
			'Final user mapping:',
			result.map((u) => ({
				email: u.email,
				hasRole: u.hasAgentUserRole,
				existsInDb: u.existsInDb,
			})),
		);

		return result;
	} catch (error) {
		console.error('Error getting users with role info:', error);
		return [];
	}
}

/**
 * Process pending role updates for users
 * @param pendingUpdates Array of pending updates to process
 * @returns Promise<{ success: boolean; processedCount: number; errors: string[] }>
 */
export async function processPendingRoleUpdates(
	pendingUpdates: PendingUpdate[],
): Promise<{ success: boolean; processedCount: number; errors: string[] }> {
	const errors: string[] = [];
	let processedCount = 0;

	try {
		for (const update of pendingUpdates) {
			// Skip if no change needed
			if (update.shouldHaveRole === update.currentHasRole) {
				continue;
			}

			// Skip if user doesn't exist in database (no userId) or missing data
			if (!update.userId || !update.email) {
				errors.push(
					`Invalid user data for: ${update.email || 'unknown email'}`,
				);
				continue;
			}

			// Create user object with just id and email (all we need for role operations)
			const userRecord = {
				id: update.userId,
				email: update.email,
			};

			if (update.shouldHaveRole) {
				// Grant the agent-user role
				const success = await grantRole('agent-user', userRecord);
				if (success) {
					processedCount++;
					console.log(`Granted agent-user role to ${update.email}`);
				} else {
					errors.push(`Failed to grant role to ${update.email}`);
				}
			} else {
				// Revoke the agent-user role
				const success = await revokeRole('agent-user', userRecord);
				if (success) {
					processedCount++;
					console.log(`Revoked agent-user role from ${update.email}`);
				} else {
					errors.push(`Failed to revoke role from ${update.email}`);
				}
			}
		}

		return {
			success: errors.length === 0,
			processedCount,
			errors,
		};
	} catch (error) {
		console.error('Error processing pending role updates:', error);
		return {
			success: false,
			processedCount,
			errors: [...errors, `Unexpected error: ${error}`],
		};
	}
}
