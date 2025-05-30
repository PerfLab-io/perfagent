import {
	PageLoadEvent,
	SyntheticNetworkRequest,
} from '@perflab/trace_engine/models/trace/types/TraceEvents';

// Resource types for color coding
export const enum ResourceType {
	Document = 'Document',
	Stylesheet = 'Stylesheet',
	Image = 'Image',
	Media = 'Media',
	Font = 'Font',
	Script = 'Script',
	TextTrack = 'TextTrack',
	XHR = 'XHR',
	Fetch = 'Fetch',
	Prefetch = 'Prefetch',
	EventSource = 'EventSource',
	WebSocket = 'WebSocket',
	Manifest = 'Manifest',
	SignedExchange = 'SignedExchange',
	Ping = 'Ping',
	CSPViolationReport = 'CSPViolationReport',
	Preflight = 'Preflight',
	Other = 'Other',
}

// Network activity view state
export interface NetworkViewState {
	startTime: number; // Visible start time in ms
	endTime: number; // Visible end time in ms
	isCompact: boolean; // Whether to show compact or expanded view
	topDepth: number; // Top visible depth for expanded view (for Y-axis panning)
	visibleDepthCount: number; // Number of visible depths
	showFirstParty: boolean; // Whether to show first-party requests in compact mode
	showThirdParty: boolean; // Whether to show third-party requests in compact mode
	showMilestones: boolean; // Whether to show page load milestones
	showByAssetType: boolean; // Whether to show by asset type in compact mode
	firstPartyOrigin: string; // First party origin
	loadTimeMetrics?: PageLoadEvent[];
}

// Processed network data
export interface ProcessedNetworkData {
	requests: SyntheticNetworkRequest[];
	maxDepth: number; // Maximum stacking depth in expanded view
}

// Network request timing segments
export interface NetworkRequestSegments {
	queueing: number;
	requestPlusWaiting: number;
	download: number;
	waitingOnMainThread: number;
	total: number;
}

// Page load milestone types
export enum MilestoneType {
	NavigationStart = 'Nav',
	FirstContentfulPaint = 'FCP',
	MarkDOMContent = 'DCL',
	MarkLoad = 'L',
	LargestContentfulPaintCandidate = 'LCP',
}

// Page load milestone
export interface PageLoadMilestone {
	type: MilestoneType;
	time: number; // Time in ms
	color: string; // Color for the milestone marker
}

// Constants for rendering
export const TIMESCALE_HEIGHT = 30; // Height of the timescale in pixels
export const COMPACT_MODE_HEIGHT = 120; // Height of the compact mode in pixels (increased for better visibility)
export const EXPANDED_MODE_MIN_HEIGHT = 400; // Changed from 150 to 400
export const NETWORK_ENTRY_HEIGHT = 24; // Height of each network entry in expanded mode
export const LEGEND_HEIGHT = 40; // Height of the legend section
export const MILESTONE_TRACK_HEIGHT = 30; // Height of the milestone track in pixels
