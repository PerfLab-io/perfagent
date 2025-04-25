// Types based on Chrome DevTools trace format
// Simplified from https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/models/trace/types/TraceEvents.ts

export interface TraceEvent {
	name: string;
	cat: string;
	ph: string; // Phase type (B=begin, E=end, X=complete, etc.)
	ts: number; // Timestamp (microseconds)
	pid: number; // Process ID
	tid: number; // Thread ID
	dur?: number; // Duration (microseconds) - only for complete events
	args?: {
		data?: any;
		[key: string]: any;
	};
	id?: string | number;
	stack?: string[];
	parent?: TraceEvent;
	children?: TraceEvent[];
	sourceScript?: string; // Source script information
}

export interface TraceFile {
	traceEvents: TraceEvent[];
	metadata?: {
		[key: string]: any;
	};
}

// Processed data structures for rendering
export interface FrameNode {
	id: string;
	name: string;
	value: number; // Duration in ms
	start: number; // Start time in ms
	end: number; // End time in ms
	depth: number; // Depth in the call stack
	color: string; // Color for rendering
	parent?: string; // Parent node ID
	children: string[]; // Child node IDs
	source?: string; // Source file/location
	sourceScript?: string; // Source script information
	args?: any; // Additional arguments
	cat?: string; // Category (input, timer, etc.)
}

export interface ProcessedTrace {
	startTime: number; // Start time in ms
	endTime: number; // End time in ms
	totalTime: number; // Total duration in ms
	maxDepth: number; // Maximum depth of the call stack
	frames: FrameNode[];
	frameMap: Map<string, FrameNode>;
	rootIds: string[];
	sourceScriptColors: Map<string, string>; // Map of source scripts to colors
}

export interface ViewState {
	startTime: number; // Visible start time in ms
	endTime: number; // Visible end time in ms
	topDepth: number; // Top visible depth
	visibleDepthCount: number; // Number of visible depths
}

// Base annotation interface
export interface BaseAnnotation {
	id: string;
	type: 'highlight' | 'link' | 'label';
	color?: string; // Optional custom color
}

// Highlight annotation (time range)
export interface HighlightAnnotation extends BaseAnnotation {
	type: 'highlight';
	startTime: number; // Start time in ms
	endTime: number; // End time in ms
	label: string;
}

// Link annotation (connecting two frames)
export interface LinkAnnotation extends BaseAnnotation {
	type: 'link';
	fromFrameId: string; // Source frame ID
	toFrameId: string; // Target frame ID
}

// Label annotation (attached to a frame)
export interface LabelAnnotation extends BaseAnnotation {
	type: 'label';
	frameId: string; // Frame ID to attach the label to
	label: string; // Label text
	position?: 'top' | 'right' | 'bottom' | 'left'; // Optional position
}

// Union type for all annotation types
export type Annotation = HighlightAnnotation | LinkAnnotation | LabelAnnotation;

// New interface for interaction events
export interface InteractionEvent {
	id?: string; // Optional ID for the interaction
	name?: string; // Optional name for the interaction
	ts: number; // Start timestamp in nanoseconds
	presentationDelay: number; // Presentation delay in ms
	dur: number; // Duration in ms
	inputDelay: number; // Input delay in ms
	processingEnd: number; // Processing end timestamp in nanoseconds
	processingStart: number; // Processing start timestamp in nanoseconds
}

// Constants for thresholds
export const TASK_THRESHOLD_MS = 50; // Threshold for tasks in ms
export const INTERACTION_THRESHOLD_MS = 200; // Threshold for interactions in ms

// Height constants for rendering
export const TIMESCALE_HEIGHT = 30; // Height of the timescale in pixels
export const INTERACTIONS_TRACK_HEIGHT = 40; // Height of the interactions track in pixels
export const INTERACTIONS_ANNOTATIONS_HEIGHT = 60;
