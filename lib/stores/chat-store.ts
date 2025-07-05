import { create } from 'zustand';
import { analyseInsightsForCWV } from '@/lib/insights';

// Define types for the files attached to the chat
export interface AttachedFile {
	id: string;
	name: string;
	size: number;
	type: string;
}

// Define the Report interface
export interface Report {
	data: string | null;
	id: string | null;
}

export interface INPInteractionAnimation {
	animationFrameInteractionImageUrl: string | null;
	isLoading: boolean;
	progress: number;
	error: string | null;
}

interface ChatUIState {
	// Side panel state
	showSidePanel: boolean | null;
	setShowSidePanel: (value: boolean | null) => void;

	// File and trace state
	attachedFiles: AttachedFile[];
	setAttachedFiles: (files: AttachedFile[]) => void;
	addAttachedFile: (file: AttachedFile) => void;
	removeAttachedFile: (fileId: string) => void;

	suggestions: string[];
	setSuggestions: (suggestions: string[]) => void;

	// Context file state
	currentContextFile: AttachedFile | null;
	setCurrentContextFile: (file: AttachedFile | null) => void;

	contextFileInsights: ReturnType<typeof analyseInsightsForCWV> | null;
	setContextFileInsights: (
		insights: ReturnType<typeof analyseInsightsForCWV> | null,
	) => void;

	contextFileINPInteractionAnimation: INPInteractionAnimation | null;
	setContextFileINPInteractionAnimation: (
		animation: INPInteractionAnimation | null,
	) => void;

	// Report state
	report: Report;
	setReport: (report: Report) => void;

	// Serialized context
	serializedContext: string | null;
	setSerializedContext: (value: string | null) => void;
}

export const useChatStore = create<ChatUIState>()((set) => ({
	// Side panel state
	showSidePanel: null,
	setShowSidePanel: (value) => set({ showSidePanel: value }),

	// File and trace state
	attachedFiles: [],
	setAttachedFiles: (files) => set({ attachedFiles: files }),
	addAttachedFile: (file) =>
		set((state) => ({
			attachedFiles: [...state.attachedFiles, file],
		})),
	removeAttachedFile: (fileId) =>
		set((state) => ({
			attachedFiles: state.attachedFiles.filter((file) => file.id !== fileId),
		})),

	suggestions: [],
	setSuggestions: (suggestions) => set({ suggestions }),

	// Context file state
	currentContextFile: null,
	setCurrentContextFile: (file) => set({ currentContextFile: file }),

	contextFileInsights: null,
	setContextFileInsights: (insights) => set({ contextFileInsights: insights }),

	contextFileINPInteractionAnimation: null,
	setContextFileINPInteractionAnimation: (animation) =>
		set({
			contextFileINPInteractionAnimation: animation,
		}),

	// Report state
	report: { data: null, id: null },
	setReport: (report) => set({ report }),

	// Serialized context
	serializedContext: null,
	setSerializedContext: (value) => set({ serializedContext: value }),
}));
