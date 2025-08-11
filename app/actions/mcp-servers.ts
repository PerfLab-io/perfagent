'use server';

import { verifySession } from '@/lib/session.server';
import { db } from '@/drizzle/db';
import { mcpServers } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { telemetryService } from '@/lib/ai/mastra/monitoring/TelemetryService';
import crypto from 'crypto';
import { performance } from 'node:perf_hooks';

interface ActionResult {
	success: boolean;
	error?: string;
	data?: any;
}

export async function addMcpServerAction(
	formData: FormData,
): Promise<ActionResult> {
	performance.mark('mcpServerAddStart');

	try {
		const sessionData = await verifySession();
		if (!sessionData) {
			const duration = performance.measure(
				'mcpServerAdd',
				'mcpServerAddStart',
			).duration;
			telemetryService.trackClientAddServer('failed', duration);
			performance.clearMarks('mcpServerAddStart');
			performance.clearMeasures('mcpServerAdd');
			return {
				success: false,
				error: 'Authentication required',
			};
		}

		const name = formData.get('name') as string;
		const url = formData.get('url') as string;

		if (!name || !name.trim()) {
			const duration = performance.measure(
				'mcpServerAdd',
				'mcpServerAddStart',
			).duration;
			telemetryService.trackClientAddServer('failed', duration);
			performance.clearMarks('mcpServerAddStart');
			performance.clearMeasures('mcpServerAdd');
			return {
				success: false,
				error: 'Server name is required',
			};
		}

		if (!url || !url.trim()) {
			const duration = performance.measure(
				'mcpServerAdd',
				'mcpServerAddStart',
			).duration;
			telemetryService.trackClientAddServer('failed', duration);
			performance.clearMarks('mcpServerAddStart');
			performance.clearMeasures('mcpServerAdd');
			return {
				success: false,
				error: 'Server URL is required',
			};
		}

		try {
			new URL(url);
		} catch (error) {
			const duration = performance.measure(
				'mcpServerAdd',
				'mcpServerAddStart',
			).duration;
			telemetryService.trackClientAddServer('failed', duration);
			performance.clearMarks('mcpServerAddStart');
			performance.clearMeasures('mcpServerAdd');
			return {
				success: false,
				error: 'Please provide a valid URL',
			};
		}

		const serverId = crypto.randomUUID();

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

		// Track successful server addition with high-resolution timing
		const duration = performance.measure(
			'mcpServerAdd',
			'mcpServerAddStart',
		).duration;
		telemetryService.trackClientAddServer('success', duration);

		// Also track the original server added event
		const requiresAuth =
			newServer.authStatus !== 'none' && newServer.authStatus !== 'unknown';
		telemetryService.trackServerAdded(newServer.url, requiresAuth);

		// Clear performance marks and measures
		performance.clearMarks('mcpServerAddStart');
		performance.clearMeasures('mcpServerAdd');

		// Note: No revalidatePath needed - using optimistic updates on frontend

		return {
			success: true,
			data: newServer,
		};
	} catch (error) {
		console.error('Failed to add MCP server:', error);

		// Track failure with timing
		const duration = performance.measure(
			'mcpServerAdd',
			'mcpServerAddStart',
		).duration;
		telemetryService.trackClientAddServer('failed', duration);

		// Track failure with error category
		const errorCategory = telemetryService.classifyError(error);
		telemetryService.trackCriticalError(errorCategory, 'server_add');

		// Clear performance marks and measures
		performance.clearMarks('mcpServerAddStart');
		performance.clearMeasures('mcpServerAdd');

		if (error && typeof error === 'object' && 'code' in error) {
			if (error.code === '23505') {
				return {
					success: false,
					error: 'A server with this name or URL already exists.',
				};
			}
			if (error.code === '23502') {
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

export async function toggleMcpServerAction(
	serverId: string,
	enabled: boolean,
): Promise<ActionResult> {
	try {
		const sessionData = await verifySession();
		if (!sessionData) {
			return {
				success: false,
				error: 'Authentication required',
			};
		}

		const [updatedServer] = await db
			.update(mcpServers)
			.set({
				enabled,
				updatedAt: new Date().toISOString(),
			})
			.where(
				and(
					eq(mcpServers.id, serverId),
					eq(mcpServers.userId, sessionData.userId),
				),
			)
			.returning();

		if (!updatedServer) {
			return {
				success: false,
				error: 'Server not found or access denied',
			};
		}

		// Track server toggle
		const action = enabled ? 'activated' : 'deactivated';
		telemetryService.trackServerToggle(action, 'manual');

		// Note: No revalidatePath needed - using optimistic updates on frontend

		return {
			success: true,
			data: updatedServer,
		};
	} catch (error) {
		console.error('Failed to toggle MCP server:', error);

		// Track error
		const errorCategory = telemetryService.classifyError(error);
		telemetryService.trackCriticalError(errorCategory, 'server_toggle');

		return {
			success: false,
			error: 'Failed to update server. Please try again.',
		};
	}
}

export async function deleteMcpServerAction(
	serverId: string,
): Promise<ActionResult> {
	try {
		const sessionData = await verifySession();
		if (!sessionData) {
			return {
				success: false,
				error: 'Authentication required',
			};
		}

		const [deletedServer] = await db
			.delete(mcpServers)
			.where(
				and(
					eq(mcpServers.id, serverId),
					eq(mcpServers.userId, sessionData.userId),
				),
			)
			.returning();

		if (!deletedServer) {
			return {
				success: false,
				error: 'Server not found or access denied',
			};
		}

		// Track server removal
		telemetryService.trackServerRemoved(deletedServer.url, 'user');

		// Note: No revalidatePath needed - using optimistic updates on frontend

		return {
			success: true,
		};
	} catch (error) {
		console.error('Failed to delete MCP server:', error);

		// Track error
		const errorCategory = telemetryService.classifyError(error);
		telemetryService.trackCriticalError(errorCategory, 'server_delete');

		return {
			success: false,
			error: 'Failed to delete server. Please try again.',
		};
	}
}
