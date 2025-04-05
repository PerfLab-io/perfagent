import Langfuse from 'langfuse';
import { serverEnv } from '@/lib/env/server';

export const langfuse = new Langfuse({
	secretKey: serverEnv.LANGFUSE_SECRET_KEY,
	publicKey: serverEnv.LANGFUSE_PUBLIC_KEY,
	baseUrl: serverEnv.LANGFUSE_BASEURL,
});
