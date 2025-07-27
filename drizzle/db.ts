import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { serverEnv } from '@/lib/env/server';

// OPTIMIZATION: Configure connection pooling and performance settings
export const client = postgres(serverEnv.DB_URL, {
	// Connection pooling
	max: 20, // Maximum number of connections
	idle_timeout: 20, // Close connections after 20 seconds of inactivity
	connect_timeout: 60, // Connection timeout in seconds

	// Performance optimizations
	prepare: false, // Disable prepared statements for development (enable in production)
	transform: postgres.camel, // Transform snake_case to camelCase automatically

	// Query optimization
	fetch_types: false, // Skip type fetching for better performance
	publications: undefined, // Don't listen for changes

	// Error handling
	onnotice: process.env.NODE_ENV === 'development' ? console.log : () => {}, // Log notices only in dev

	// Connection management
	connection: {
		application_name: 'perfagent',
		search_path: 'public',
	},

	// Performance settings for production
	...(process.env.NODE_ENV === 'production' && {
		prepare: true, // Enable prepared statements in production
		max: 10, // Lower max connections in production
		idle_timeout: 60, // Longer idle timeout in production
	}),
});

// { schema } is used for relational queries
export const db = drizzle({
	client,
	schema,
	logger: process.env.NODE_ENV === 'development',
});

// OPTIMIZATION: Health check function
export async function checkDbHealth(): Promise<boolean> {
	try {
		await client`SELECT 1`;
		return true;
	} catch (error) {
		console.error('Database health check failed:', error);
		return false;
	}
}

// OPTIMIZATION: Connection cleanup for graceful shutdown
process.on('SIGINT', async () => {
	console.log('Closing database connections...');
	await client.end();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	console.log('Closing database connections...');
	await client.end();
	process.exit(0);
});
