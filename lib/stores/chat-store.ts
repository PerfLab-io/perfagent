import { create } from 'zustand';
import { analyseInsightsForCWV } from '@/lib/insights';

// Define types for the files attached to the chat
export interface AttachedFile {
	id: string;
	name: string;
	size: number;
	type: string;
}

interface ChatUIState {
	// Side panel state
	showSidePanel: boolean | null;
	setShowSidePanel: (value: boolean | null) => void;

	panelContentType: 'data' | 'report';
	setPanelContentType: (value: 'data' | 'report') => void;

	// File and trace state
	traceContents: string | null;
	setTraceContents: (value: string | null) => void;

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

	contextFileINPInteractionAnimation: {
		animationFrameInteractionImageUrl: string | null;
		isLoading: boolean;
		progress: number;
		error: string | null;
	} | null;
	setContextFileINPInteractionAnimation: (
		animation: {
			animationFrameInteractionImageUrl: string | null;
			isLoading: boolean;
			progress: number;
			error: string | null;
		} | null,
	) => void;

	// Report state
	isGeneratingReport: boolean;
	setIsGeneratingReport: (value: boolean) => void;

	reportData: string | null;
	setReportData: (value: string | null) => void;

	activeReportId: string | null;
	setActiveReportId: (value: string | null) => void;

	// Serialized context
	serializedContext: string | null;
	setSerializedContext: (value: string | null) => void;
}

export const useChatStore = create<ChatUIState>()((set) => ({
	// Side panel state
	showSidePanel: null,
	setShowSidePanel: (value) => set({ showSidePanel: value }),

	panelContentType: 'data',
	setPanelContentType: (value) => set({ panelContentType: value }),

	// File and trace state
	traceContents: null,
	setTraceContents: (value) => set({ traceContents: value }),

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
	isGeneratingReport: false,
	setIsGeneratingReport: (value) => set({ isGeneratingReport: value }),

	reportData: null,
	setReportData: (value) => set({ reportData: value }),

	activeReportId: null,
	setActiveReportId: (value) => set({ activeReportId: value }),

	// Serialized context
	serializedContext: null,
	setSerializedContext: (value) => set({ serializedContext: value }),
}));
