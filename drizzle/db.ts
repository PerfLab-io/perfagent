import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { serverEnv } from '@/lib/env/server';

export const client = postgres(serverEnv.DB_URL, { prepare: false });

// { schema } is used for relational queries
export const db = drizzle({ client, schema });
