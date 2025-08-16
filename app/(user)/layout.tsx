import type React from 'react';
import '@/app/globals.css';
import AuthenticatedLayout from '@/components/layouts/authenticated-layout';

export default function UserLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
