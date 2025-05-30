import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// Types adapted from the FlameGraph component
export interface FrameNode {
	id: string;
	name: string;
	value: number;
	start: number;
	end: number;
	depth: number;
	color?: string;
}

export interface Annotation {
	id: string;
	label: string;
	timestamp: number;
	color?: string;
}

export interface InteractionEvent {
	id: string;
	type: string;
	timestamp: number;
	duration: number;
	color?: string;
}

export interface ViewState {
	startTime: number;
	endTime: number;
	topDepth: number;
	visibleDepthCount: number;
}

export interface ProcessedTrace {
	frames: FrameNode[];
	maxDepth: number;
	totalDuration: number;
}

interface FlameGraphState {
	// Canvas and rendering state
	processedData: ProcessedTrace | null;
	selectedNode: FrameNode | null;
	hoverNode: FrameNode | null;
	hoverPosition: { x: number; y: number } | null;

	// Dragging state
	isDragging: boolean;
	hasDragged: boolean;
	dragStart: { x: number; y: number };

	// Visibility toggles
	showAnnotations: boolean;
	showInteractions: boolean;

	// Selected elements
	selectedAnnotation: Annotation | null;
	selectedInteraction: InteractionEvent | null;

	// View state
	viewState: ViewState;

	// Actions
	setProcessedData: (data: ProcessedTrace | null) => void;
	setSelectedNode: (node: FrameNode | null) => void;
	setHoverNode: (node: FrameNode | null) => void;
	setHoverPosition: (position: { x: number; y: number } | null) => void;
	setIsDragging: (value: boolean) => void;
	setHasDragged: (value: boolean) => void;
	setDragStart: (position: { x: number; y: number }) => void;
	setShowAnnotations: (value: boolean) => void;
	setShowInteractions: (value: boolean) => void;
	setSelectedAnnotation: (annotation: Annotation | null) => void;
	setSelectedInteraction: (interaction: InteractionEvent | null) => void;
	setViewState: (viewState: ViewState) => void;
	updateViewState: (updates: Partial<ViewState>) => void;

	// Reset state
	resetInteractionState: () => void;
}

// Define initial state values
const initialViewState: ViewState = {
	startTime: 0,
	endTime: 0,
	topDepth: 0,
	visibleDepthCount: 0,
};

export const useFlameGraphStore = create<FlameGraphState>()(
	immer((set) => ({
		// Initial state
		processedData: null,
		selectedNode: null,
		hoverNode: null,
		hoverPosition: null,
		isDragging: false,
		hasDragged: false,
		dragStart: { x: 0, y: 0 },
		showAnnotations: true,
		showInteractions: true,
		selectedAnnotation: null,
		selectedInteraction: null,
		viewState: initialViewState,

		// Actions with immer middleware for easier state updates
		setProcessedData: (data) =>
			set((state) => {
				state.processedData = data;
			}),

		setSelectedNode: (node) =>
			set((state) => {
				state.selectedNode = node;
			}),

		setHoverNode: (node) =>
			set((state) => {
				state.hoverNode = node;
			}),

		setHoverPosition: (position) =>
			set((state) => {
				state.hoverPosition = position;
			}),

		setIsDragging: (value) =>
			set((state) => {
				state.isDragging = value;
			}),

		setHasDragged: (value) =>
			set((state) => {
				state.hasDragged = value;
			}),

		setDragStart: (position) =>
			set((state) => {
				state.dragStart = position;
			}),

		setShowAnnotations: (value) =>
			set((state) => {
				state.showAnnotations = value;
			}),

		setShowInteractions: (value) =>
			set((state) => {
				state.showInteractions = value;
			}),

		setSelectedAnnotation: (annotation) =>
			set((state) => {
				state.selectedAnnotation = annotation;
			}),

		setSelectedInteraction: (interaction) =>
			set((state) => {
				state.selectedInteraction = interaction;
			}),

		setViewState: (viewState) =>
			set((state) => {
				state.viewState = viewState;
			}),

		updateViewState: (updates) =>
			set((state) => {
				state.viewState = { ...state.viewState, ...updates };
			}),

		resetInteractionState: () =>
			set((state) => {
				state.selectedNode = null;
				state.hoverNode = null;
				state.hoverPosition = null;
				state.isDragging = false;
				state.hasDragged = false;
				state.selectedAnnotation = null;
				state.selectedInteraction = null;
			}),
	})),
);
