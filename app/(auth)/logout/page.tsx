'use client';

import { useRouter } from 'next/navigation';
import { logout } from '@/app/actions/login';
import { useEffect } from 'react';

export default function LogoutPage() {
	const router = useRouter();
	const handleLogout = async () => {
		try {
			const success = await logout();
			console.log('success', success);
			if (success) {
				router.push('/login');
			} else {
				console.error('Logout failed');
				// Optionally show a toast notification here
			}
		} catch (error) {
			console.error('Error during logout:', error);
			// Optionally show an error message to the user
		}
	};

	useEffect(() => void handleLogout(), []);

	return null;
}
