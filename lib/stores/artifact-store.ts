import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// Types from the original implementation
export interface UIArtifact {
	documentId: string;
	content: string;
	kind: string;
	title: string;
	timestamp: number;
	status: 'idle' | 'loading' | 'success' | 'error';
	isVisible: boolean;
	boundingBox: {
		top: number;
		left: number;
		width: number;
		height: number;
	};
}

export const initialArtifactData: UIArtifact = {
	documentId: 'init',
	content: '',
	kind: 'text',
	title: '',
	timestamp: 0,
	status: 'idle',
	isVisible: false,
	boundingBox: {
		top: 0,
		left: 0,
		width: 0,
		height: 0,
	},
};

interface ArtifactStoreState {
	artifacts: Record<string, UIArtifact>;
	metadata: Record<string, any>;

	// Actions
	getArtifact: (artifactId?: string) => UIArtifact;
	setArtifact: (
		artifactId: string,
		updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact),
	) => void;
	getMetadata: (artifactId: string) => any | null;
	setMetadata: (artifactId: string, metadata: any) => void;
}

export const useArtifactStore = create<ArtifactStoreState>()(
	immer((set, get) => ({
		artifacts: {
			default: initialArtifactData,
		},
		metadata: {},

		getArtifact: (artifactId = 'default') => {
			const artifacts = get().artifacts;
			return artifacts[artifactId] || initialArtifactData;
		},

		setArtifact: (artifactId = 'default', updaterFn) =>
			set((state) => {
				const currentArtifact =
					state.artifacts[artifactId] || initialArtifactData;

				if (typeof updaterFn === 'function') {
					state.artifacts[artifactId] = updaterFn(currentArtifact);
				} else {
					state.artifacts[artifactId] = updaterFn;
				}
			}),

		getMetadata: (artifactId) => {
			return get().metadata[artifactId] || null;
		},

		setMetadata: (artifactId, metadata) =>
			set((state) => {
				state.metadata[artifactId] = metadata;
			}),
	})),
);

// Create a hook that provides the same API as the original useArtifact
export function useArtifact(artifactId = 'default') {
	const store = useArtifactStore();

	const artifact = store.getArtifact(artifactId);
	const setArtifact = (
		updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact),
	) => {
		store.setArtifact(artifactId, updaterFn);
	};

	const metadata = store.getMetadata(artifactId);
	const setMetadata = (newMetadata: any) => {
		store.setMetadata(artifactId, newMetadata);
	};

	return {
		artifact,
		setArtifact,
		metadata,
		setMetadata,
	};
}
