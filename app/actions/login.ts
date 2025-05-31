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
import { deleteSession } from '@/lib/session';
import crypto from 'crypto';

export async function login(email: string, password: string) {
	try {
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
			return {
				user: null,
				hasAccess: false,
			};
		}

		const isValid = await bcrypt.compare(
			password,
			userWithPassword.password?.hash ?? '',
		);

		if (!isValid) {
			return {
				user: null,
				hasAccess: false,
			};
		}

		const hasAccess = await checkAgentAccess(userWithPassword.user.id);

		if (!hasAccess) {
			return {
				user: userWithPassword.user,
				hasAccess: false,
			};
		}

		// Create session for authenticated user
		await createSession(userWithPassword.user.id);

		return {
			user: userWithPassword.user,
			hasAccess: true,
		};
	} catch (error) {
		console.log('error', error);
		return {
			user: null,
			hasAccess: false,
		};
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
	userRecord: Pick<typeof user.$inferSelect, 'id' | 'email'>,
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
 * Revoke a role from a user by removing the role assignment
 * @param roleName The name of the role to revoke (e.g., 'agent-user')
 * @param userRecord The user record from the login function
 * @returns Promise<boolean> True if role was revoked successfully
 */
export async function revokeRole(
	roleName: string,
	userRecord: Pick<typeof user.$inferSelect, 'id' | 'email'>,
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

		// Remove the role assignment from the user
		const result = await db
			.delete(roleToUser)
			.where(
				and(eq(roleToUser.a, targetRole.id), eq(roleToUser.b, userRecord.id)),
			);

		console.log(`Role revoked: ${roleName} from user ${userRecord.email}`);
		return true;
	} catch (error) {
		console.error('Error revoking role:', error);
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

/**
 * Log out the current user by deleting their session
 * @returns Promise<boolean> True if logout was successful
 */
export async function logout(): Promise<boolean> {
	try {
		await deleteSession();
		console.log('User logged out successfully');
		return true;
	} catch (error) {
		console.error('Error during logout:', error);
		return false;
	}
}

/**
 * Create a new role with specified permissions
 * @param roleName The name of the role to create (e.g., 'content-manager')
 * @param permissionStrings Array of permission strings to assign to the role (e.g., ['read:agent:own', 'write:agent:own'])
 * @returns Promise<boolean> True if role and permissions were created successfully
 */
export async function createRoleWithPermissions(
	roleName: string,
	permissionStrings: PermissionString[],
): Promise<boolean> {
	try {
		// Check if role already exists
		const existingRole = await db
			.select({
				id: role.id,
				name: role.name,
			})
			.from(role)
			.where(eq(role.name, roleName))
			.limit(1);

		let roleId: string;

		if (existingRole.length === 0) {
			// Create new role with required fields
			const newRole = await db
				.insert(role)
				.values({
					id: crypto.randomUUID(),
					name: roleName,
					description: `Auto-generated role: ${roleName}`,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				})
				.returning({ id: role.id });

			roleId = newRole[0].id;
			console.log(`Role created: ${roleName} with id ${roleId}`);
		} else {
			roleId = existingRole[0].id;
			console.log(`Role already exists: ${roleName} with id ${roleId}`);
		}

		// Process each permission string
		for (const permissionString of permissionStrings) {
			const { action, entity, access } =
				parsePermissionString(permissionString);

			// Handle access conditions for permission creation
			if (access && access.length > 0) {
				// Create separate permissions for each access level
				for (const accessLevel of access) {
					const accessConditions = [
						eq(permission.action, action),
						eq(permission.entity, entity),
						eq(permission.access, accessLevel),
					];

					const existingPermission = await db
						.select({
							id: permission.id,
						})
						.from(permission)
						.where(and(...accessConditions))
						.limit(1);

					let permissionId: string;

					if (existingPermission.length === 0) {
						// Create new permission with all required fields
						const newPermission = await db
							.insert(permission)
							.values({
								id: crypto.randomUUID(),
								action,
								entity,
								access: accessLevel,
								description: `Auto-generated permission: ${action}:${entity}:${accessLevel}`,
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
							})
							.returning({ id: permission.id });

						permissionId = newPermission[0].id;
						console.log(
							`Permission created: ${action}:${entity}:${accessLevel} with id ${permissionId}`,
						);
					} else {
						permissionId = existingPermission[0].id;
					}

					// Link permission to role if not already linked
					const existingLink = await db
						.select()
						.from(permissionToRole)
						.where(
							and(
								eq(permissionToRole.a, permissionId),
								eq(permissionToRole.b, roleId),
							),
						)
						.limit(1);

					if (existingLink.length === 0) {
						await db.insert(permissionToRole).values({
							a: permissionId,
							b: roleId,
						});
						console.log(
							`Permission ${action}:${entity}:${accessLevel} linked to role ${roleName}`,
						);
					}
				}
			} else {
				// Handle permission without access (default to empty string for access)
				const whereConditions = [
					eq(permission.action, action),
					eq(permission.entity, entity),
					eq(permission.access, ''), // Default to empty string for access
				];

				const existingPermission = await db
					.select({
						id: permission.id,
					})
					.from(permission)
					.where(and(...whereConditions))
					.limit(1);

				let permissionId: string;

				if (existingPermission.length === 0) {
					// Create new permission with all required fields
					const newPermission = await db
						.insert(permission)
						.values({
							id: crypto.randomUUID(),
							action,
							entity,
							access: '', // Default to empty string for access
							description: `Auto-generated permission: ${action}:${entity}`,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
						})
						.returning({ id: permission.id });

					permissionId = newPermission[0].id;
					console.log(
						`Permission created: ${action}:${entity} with id ${permissionId}`,
					);
				} else {
					permissionId = existingPermission[0].id;
				}

				// Link permission to role if not already linked
				const existingLink = await db
					.select()
					.from(permissionToRole)
					.where(
						and(
							eq(permissionToRole.a, permissionId),
							eq(permissionToRole.b, roleId),
						),
					)
					.limit(1);

				if (existingLink.length === 0) {
					await db.insert(permissionToRole).values({
						a: permissionId,
						b: roleId,
					});
					console.log(
						`Permission ${action}:${entity} linked to role ${roleName}`,
					);
				}
			}
		}

		console.log(
			`Role ${roleName} created/updated with ${permissionStrings.length} permissions`,
		);
		return true;
	} catch (error) {
		console.error('Error creating role with permissions:', error);
		return false;
	}
}
