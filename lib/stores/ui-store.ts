import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MOBILE_BREAKPOINT = 768;
const SIDEBAR_COOKIE_NAME = 'sidebar:state';
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

interface UIState {
	// Mobile detection
	isMobile: boolean | undefined;
	setIsMobile: (value: boolean) => void;

	// Sidebar state
	sidebarOpen: boolean | undefined;
	setSidebarOpen: (value: boolean) => void;
	toggleSidebar: () => void;

	// Mobile sidebar state
	sidebarOpenMobile: boolean;
	setSidebarOpenMobile: (value: boolean) => void;

	// Page title
	pageTitle: string;
	setPageTitle: (title: string) => void;

	// Editing state
	isEditing: boolean;
	setIsEditing: (value: boolean) => void;

	// Editable state
	isEditable: boolean;
	setIsEditable: (value: boolean) => void;
}

export const useUIStore = create<UIState>()(
	persist(
		(set, get) => ({
			// Mobile detection
			isMobile:
				typeof window !== 'undefined'
					? window.innerWidth < MOBILE_BREAKPOINT
					: undefined,
			setIsMobile: (value) => set({ isMobile: value }),

			// Sidebar state
			sidebarOpen: undefined,
			setSidebarOpen: (value) => {
				set({ sidebarOpen: value });
				// Update cookie for persistence
				if (typeof document !== 'undefined') {
					document.cookie = `${SIDEBAR_COOKIE_NAME}=${value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
				}
			},
			toggleSidebar: () => {
				const isMobile = get().isMobile;

				if (isMobile) {
					set((state) => ({ sidebarOpenMobile: !state.sidebarOpenMobile }));
				} else {
					const newValue = !get().sidebarOpen;

					set({ sidebarOpen: newValue });

					// Update cookie for persistence
					if (typeof document !== 'undefined') {
						document.cookie = `${SIDEBAR_COOKIE_NAME}=${newValue}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
					}
				}
			},

			// Mobile sidebar state
			sidebarOpenMobile: false,
			setSidebarOpenMobile: (value) => set({ sidebarOpenMobile: value }),

			// Page title
			pageTitle: 'Loading...',
			setPageTitle: (title) => set({ pageTitle: title }),

			// Editing state
			isEditing: false,
			setIsEditing: (value) => set({ isEditing: value }),
			isEditable: false,
			setIsEditable: (value) => set({ isEditable: value }),
		}),
		{
			name: 'ui-state',
			partialize: (state) => ({
				sidebarOpen: state.sidebarOpen,
				pageTitle: state.pageTitle,
			}),
		},
	),
);

// Setup mobile detection effect
if (typeof window !== 'undefined') {
	const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
	const onChange = () => {
		useUIStore.getState().setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
	};
	mql.addEventListener('change', onChange);
}
