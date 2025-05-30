'use client';

// Inspired by react-hot-toast library
import * as React from 'react';
import { useToastStore, type ToastProps } from '@/lib/stores/toast-store';

import { ToastActionElement } from '@/components/ui/toast';

const TOAST_REMOVE_DELAY = 1000000;

// Keep the genId function for compatibility
let count = 0;
function genId() {
	count = (count + 1) % Number.MAX_SAFE_INTEGER;
	return count.toString();
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
	if (toastTimeouts.has(toastId)) {
		return;
	}

	const timeout = setTimeout(() => {
		toastTimeouts.delete(toastId);
		// Use the store's dismiss function directly
		useToastStore.getState().dismiss(toastId);
	}, TOAST_REMOVE_DELAY);

	toastTimeouts.set(toastId, timeout);
};

function toast(props: Omit<ToastProps, 'id'>) {
	const id = genId();
	const toastStore = useToastStore.getState();

	// Create update and dismiss functions to maintain the original API
	const update = (props: ToastProps) => {
		toastStore.toast({
			...props,
			id,
		});
	};

	const dismiss = () => {
		toastStore.dismiss(id);
	};

	// Add the toast to the store
	toastStore.toast({
		...props,
		id,
		open: true,
		onOpenChange: (open: boolean) => {
			if (!open) dismiss();
		},
	});

	return {
		id,
		dismiss,
		update,
	};
}

// Use the Zustand store for our useToast hook instead of React.useState
function useToast() {
	const { toasts, toast: addToast, dismiss } = useToastStore();

	// Maintain the same API as before
	return {
		toasts,
		toast,
		dismiss,
	};
}

export { useToast, toast };
