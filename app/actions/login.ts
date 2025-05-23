'use server';

import { db } from '@/drizzle/db';
import { user, password as passwordTable } from '@/drizzle/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

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

		console.log(result);

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

		return userWithPassword.user;
	} catch (error) {
		console.log('error', error);
		return null;
	}
}
