'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/session.server';
import { db } from '@/drizzle/db';
import { mcpServers } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';

interface ActionResult {
	success: boolean;
	error?: string;
	data?: any;
}

export async function addMcpServerAction(formData: FormData): Promise<ActionResult> {
	try {
		// Verify authentication
		const sessionData = await verifySession();
		if (!sessionData) {
			return {
				success: false,
				error: 'Authentication required',
			};
		}

		const name = formData.get('name') as string;
		const url = formData.get('url') as string;

		// Validate form data
		if (!name || !name.trim()) {
			return {
				success: false,
				error: 'Server name is required',
			};
		}

		if (!url || !url.trim()) {
			return {
				success: false,
				error: 'Server URL is required',
			};
		}

		// Basic URL validation
		try {
			new URL(url);
		} catch (error) {
			return {
				success: false,
				error: 'Please provide a valid URL',
			};
		}

		// Generate a unique ID for the server
		const serverId = crypto.randomUUID();

		// Insert into database directly
		const [newServer] = await db
			.insert(mcpServers)
			.values({
				id: serverId,
				name: name.trim(),
				url: url.trim(),
				userId: sessionData.userId,
				enabled: true,
				authStatus: 'unknown',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.returning();

		// Note: No revalidatePath needed - using optimistic updates on frontend

		return {
			success: true,
			data: newServer,
		};
	} catch (error) {
		console.error('Failed to add MCP server:', error);
		
		// Handle specific database constraint errors
		if (error && typeof error === 'object' && 'code' in error) {
			if (error.code === '23505') { // unique constraint violation
				return {
					success: false,
					error: 'A server with this name or URL already exists.',
				};
			}
			if (error.code === '23502') { // not null constraint violation
				return {
					success: false,
					error: 'Required server information is missing.',
				};
			}
		}
		
		return {
			success: false,
			error: 'Failed to add MCP server. Please try again.',
		};
	}
}

export async function toggleMcpServerAction(serverId: string, enabled: boolean): Promise<ActionResult> {
	try {
		// Verify authentication
		const sessionData = await verifySession();
		if (!sessionData) {
			return {
				success: false,
				error: 'Authentication required',
			};
		}

		// Verify ownership and update server
		const [updatedServer] = await db
			.update(mcpServers)
			.set({ 
				enabled,
				updatedAt: new Date().toISOString(),
			})
			.where(
				and(
					eq(mcpServers.id, serverId),
					eq(mcpServers.userId, sessionData.userId)
				)
			)
			.returning();

		if (!updatedServer) {
			return {
				success: false,
				error: 'Server not found or access denied',
			};
		}

		// Note: No revalidatePath needed - using optimistic updates on frontend

		return {
			success: true,
			data: updatedServer,
		};
	} catch (error) {
		console.error('Failed to toggle MCP server:', error);
		return {
			success: false,
			error: 'Failed to update server. Please try again.',
		};
	}
}

export async function deleteMcpServerAction(serverId: string): Promise<ActionResult> {
	try {
		// Verify authentication
		const sessionData = await verifySession();
		if (!sessionData) {
			return {
				success: false,
				error: 'Authentication required',
			};
		}

		// Verify ownership and delete server
		const [deletedServer] = await db
			.delete(mcpServers)
			.where(
				and(
					eq(mcpServers.id, serverId),
					eq(mcpServers.userId, sessionData.userId)
				)
			)
			.returning();

		if (!deletedServer) {
			return {
				success: false,
				error: 'Server not found or access denied',
			};
		}

		// Note: No revalidatePath needed - using optimistic updates on frontend

		return {
			success: true,
		};
	} catch (error) {
		console.error('Failed to delete MCP server:', error);
		return {
			success: false,
			error: 'Failed to delete server. Please try again.',
		};
	}
}