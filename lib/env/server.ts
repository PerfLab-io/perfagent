// https://env.t3.gg/docs/nextjs#create-your-schema
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const serverEnv = createEnv({
	server: {
		RESEND_API_KEY: z.string().min(1),
		TAVILY_API_KEY: z.string().min(1),
		GEMINI_API_KEY: z.string().min(1),
		LANGFUSE_SECRET_KEY: z.string().min(1),
		LANGFUSE_PUBLIC_KEY: z.string().min(1),
		LANGFUSE_BASEURL: z.string().min(1),
		DB_URL: z.string().min(1),
	},
	experimental__runtimeEnv: process.env,
});
