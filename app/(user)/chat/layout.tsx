import type React from 'react';
import './chat.css';
import AuthenticatedLayout from '@/components/layouts/authenticated-layout';
import { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'PerfAgent - Agent insights for web performance',
	description:
		"PerfAgent is an AI-powered web performance insights tool that helps you understand your website's performance and identify opportunities for improvement.",
};

export default async function AiChatLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<AuthenticatedLayout>
			{children}
		</AuthenticatedLayout>
	);
}
