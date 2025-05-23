import 'dotenv/config'; // make sure to install dotenv package
import { defineConfig } from 'drizzle-kit';
import { serverEnv } from './lib/env/server';

export default defineConfig({
	dialect: 'postgresql',
	out: './drizzle',
	schema: './drizzle/schema.ts',
	dbCredentials: {
		url: serverEnv.DB_URL,
	},
	// Print all statements
	verbose: true,
	// Always ask for confirmation
	strict: true,
});
