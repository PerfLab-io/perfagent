import { create } from 'zustand';
import type {
	ToastActionElement,
	ToastProps as UIToastProps,
} from '@/components/ui/toast';

// Helper function to generate random IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

// Toast types that match the original implementation
export type ToastProps = UIToastProps & {
	id?: string;
	title?: React.ReactNode;
	description?: React.ReactNode;
	action?: ToastActionElement;
	duration?: number;
	variant?: 'default' | 'destructive';
	onOpenChange?: (open: boolean) => void;
};

export type Toast = {
	id: string;
	title?: React.ReactNode;
	description?: React.ReactNode;
	action?: ToastActionElement;
	duration?: number;
	variant?: 'default' | 'destructive';
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
} & UIToastProps;

interface ToastState {
	toasts: Toast[];
	toast: (props: ToastProps) => void;
	dismiss: (toastId?: string) => void;
}

export const useToastStore = create<ToastState>()((set) => ({
	toasts: [],

	toast: ({ id, ...props }: ToastProps) => {
		set((state) => {
			const toastId = id || generateId();
			const newToast = {
				id: toastId,
				...props,
			};

			// Check if this toast already exists
			if (state.toasts.some((toast) => toast.id === toastId)) {
				return {
					toasts: state.toasts.map((toast) =>
						toast.id === toastId ? { ...toast, ...newToast } : toast,
					),
				};
			}

			return {
				toasts: [...state.toasts, newToast],
			};
		});
	},

	dismiss: (toastId?: string) => {
		set((state) => {
			if (toastId) {
				// First set open to false for animation
				const updatedToasts = state.toasts.map((toast) =>
					toast.id === toastId ? { ...toast, open: false } : toast,
				);

				// Return updated toasts
				return {
					toasts: updatedToasts,
				};
			}

			// If no toastId, mark all as closed
			return {
				toasts: state.toasts.map((toast) => ({ ...toast, open: false })),
			};
		});
	},
}));

// Export a hook function to maintain compatibility with the original API
export function useToast() {
	const { toasts, toast, dismiss } = useToastStore();
	return {
		toasts,
		toast,
		dismiss,
	};
}
