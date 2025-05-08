import { Resend } from 'resend';
import { serverEnv } from '@/lib/env/server';

export const resend = new Resend(serverEnv.RESEND_API_KEY);
