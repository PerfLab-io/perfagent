'use server';

import { db } from '@/drizzle/db';
import {
	user,
	password as passwordTable,
	role,
	roleToUser,
	permissionToRole,
	permission,
} from '@/drizzle/schema';
import bcrypt from 'bcryptjs';
import { eq, and, or, SQL } from 'drizzle-orm';
import { parsePermissionString, type PermissionString } from '@/lib/user';
import { createSession } from '@/lib/session';

export async function login(email: string, password: string) {
	try {
		console.log('login', email, password);

		const result = await db
			.select({
				user: user,
				password: passwordTable,
			})
			.from(user)
			.leftJoin(passwordTable, eq(user.id, passwordTable.userId))
			.where(eq(user.email, email))
			.limit(1);

		const userWithPassword = result[0];
		if (!userWithPassword?.user) {
			return null;
		}

		const isValid = await bcrypt.compare(
			password,
			userWithPassword.password?.hash ?? '',
		);

		if (!isValid) {
			return null;
		}

		// Create session for authenticated user
		await createSession(userWithPassword.user.id);

		return userWithPassword.user;
	} catch (error) {
		console.log('error', error);
		return null;
	}
}

export async function checkUserPermission(
	userId: string,
	permissionString: PermissionString,
): Promise<boolean> {
	try {
		const { action, entity, access } = parsePermissionString(permissionString);

		// Build the base conditions
		const baseConditions: SQL<unknown>[] = [
			eq(roleToUser.b, userId),
			eq(permission.action, action),
			eq(permission.entity, entity),
		];

		// Add access conditions if specified
		if (access && access.length > 0) {
			if (access.length === 1) {
				baseConditions.push(eq(permission.access, access[0]));
			} else {
				// Handle multiple access values with OR logic
				const accessConditions = access.map((a) => eq(permission.access, a));
				baseConditions.push(or(...accessConditions)!);
			}
		}

		const result = await db
			.select({
				permission: permission,
			})
			.from(roleToUser)
			.innerJoin(role, eq(roleToUser.a, role.id))
			.innerJoin(permissionToRole, eq(role.id, permissionToRole.b))
			.innerJoin(permission, eq(permissionToRole.a, permission.id))
			.where(and(...baseConditions))
			.limit(1);

		return result.length > 0;
	} catch (error) {
		console.error('Error checking user permission:', error);
		return false;
	}
}

/**
 * Convenience function to check if a user has read access to agents they own
 * @param userId The user ID to check
 * @returns Promise<boolean> True if user has read:agent:own permission
 */
export async function canReadOwnAgents(userId: string): Promise<boolean> {
	return checkUserPermission(userId, 'read:agent:own');
}

/**
 * Grant a role to a user by assigning them to an existing role
 * @param roleName The name of the role to grant (e.g., 'agent-user')
 * @param userRecord The user record from the login function
 * @returns Promise<boolean> True if role was granted successfully
 */
export async function grantRole(
	roleName: string,
	userRecord: typeof user.$inferSelect,
): Promise<boolean> {
	try {
		// Find the role by name
		const roleResult = await db
			.select({
				id: role.id,
				name: role.name,
			})
			.from(role)
			.where(eq(role.name, roleName))
			.limit(1);

		if (roleResult.length === 0) {
			console.error(`Role not found: ${roleName}`);
			return false;
		}

		const targetRole = roleResult[0];

		// Check if user already has this role
		const existingRoleToUser = await db
			.select()
			.from(roleToUser)
			.where(
				and(eq(roleToUser.a, targetRole.id), eq(roleToUser.b, userRecord.id)),
			)
			.limit(1);

		if (existingRoleToUser.length === 0) {
			// Assign the role to the user
			await db.insert(roleToUser).values({
				a: targetRole.id,
				b: userRecord.id,
			});

			console.log(`Role granted: ${roleName} to user ${userRecord.email}`);
			return true;
		} else {
			console.log(`User ${userRecord.email} already has role ${roleName}`);
			return true;
		}
	} catch (error) {
		console.error('Error granting role:', error);
		return false;
	}
}

/**
 * Check if a user has permission to read their own agents
 * Example usage after login to verify agent access
 */
export async function checkAgentAccess(userId: string) {
	return canReadOwnAgents(userId);
}
