'use client';

import { redirect } from 'next/navigation';
import { logout } from '@/app/actions/login';
import { useEffect } from 'react';

export default function LogoutPage() {
	const handleLogout = async () => {
		try {
			const success = await logout();
			if (success) {
				redirect('/');
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
