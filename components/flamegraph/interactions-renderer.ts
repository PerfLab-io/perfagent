import type { InteractionEvent, ViewState } from './types';
import {
	INTERACTION_THRESHOLD_MS,
	TASK_THRESHOLD_MS,
	TIMESCALE_HEIGHT,
	INTERACTIONS_TRACK_HEIGHT,
	INTERACTIONS_ANNOTATIONS_HEIGHT,
} from './types';

// Create a diagonal line pattern for interaction bars
function createDiagonalPattern(
	ctx: CanvasRenderingContext2D,
	color: string,
): CanvasPattern | null {
	const patternCanvas = document.createElement('canvas');
	patternCanvas.width = 6;
	patternCanvas.height = 6;
	const patternCtx = patternCanvas.getContext('2d');

	if (patternCtx) {
		patternCtx.strokeStyle = color;
		patternCtx.lineWidth = 1.5;
		patternCtx.beginPath();
		patternCtx.moveTo(0, 6);
		patternCtx.lineTo(6, 0);
		patternCtx.stroke();
	}

	return ctx.createPattern(patternCanvas, 'repeat');
}

// Convert nanoseconds to milliseconds
const nanoToMs = (ns: number) => ns / 1000;

interface FrameNode {
	start: number;
	end: number;
	value: number;
	depth: number;
}

// Render the interactions track
export function renderInteractionsTrack(
	ctx: CanvasRenderingContext2D,
	interactions: InteractionEvent[],
	viewState: ViewState,
	width: number,
	showBreakdown: boolean = true,
): void {
	const { startTime, endTime } = viewState;
	const timeRange = endTime - startTime;

	// Skip if no interactions or time range is invalid
	if (interactions.length === 0 || timeRange <= 0) return;

	// Draw interactions track background
	ctx.fillStyle = '#ffffff'; // White background
	ctx.fillRect(0, TIMESCALE_HEIGHT, width, INTERACTIONS_TRACK_HEIGHT);

	// Draw bottom border for the interactions track
	ctx.strokeStyle = '#c9bea7'; // Border color matching timescale
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(0, TIMESCALE_HEIGHT + INTERACTIONS_TRACK_HEIGHT);
	ctx.lineTo(width, TIMESCALE_HEIGHT + INTERACTIONS_TRACK_HEIGHT);
	ctx.stroke();

	// Create pattern for threshold indicators (red diagonal lines)
	const thresholdPattern = createDiagonalPattern(ctx, '#f43f5e'); // Red color for threshold pattern

	// Create pattern for interaction bars (amber diagonal lines)
	const interactionPattern = createDiagonalPattern(ctx, '#f59e0b'); // Amber color for interaction pattern

	// Calculate the height for the breakdown section if enabled
	const breakdownHeight = showBreakdown ? INTERACTIONS_ANNOTATIONS_HEIGHT : 0;
	const totalTrackHeight = INTERACTIONS_TRACK_HEIGHT + breakdownHeight;

	// If breakdown is enabled, extend the track height
	if (showBreakdown) {
		// Extend the background for the breakdown section
		ctx.fillStyle = '#f8f8f8'; // Light gray background for breakdown section
		ctx.fillRect(
			0,
			TIMESCALE_HEIGHT + INTERACTIONS_TRACK_HEIGHT,
			width,
			breakdownHeight,
		);

		// Draw bottom border for the extended track
		ctx.strokeStyle = '#c9bea7';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, TIMESCALE_HEIGHT + totalTrackHeight);
		ctx.lineTo(width, TIMESCALE_HEIGHT + totalTrackHeight);
		ctx.stroke();
	}

	// Render each interaction
	interactions.forEach((interaction) => {
		// Convert timestamps from nanoseconds to milliseconds for rendering
		const interactionStartMs = nanoToMs(interaction.ts);
		const processingStartMs = nanoToMs(interaction.processingStart);
		const processingEndMs = nanoToMs(interaction.processingEnd);
		const interactionEndMs = interactionStartMs + interaction.dur;

		// Skip interactions outside the visible range
		if (interactionEndMs < startTime || interactionStartMs > endTime) return;

		// Calculate positions on the canvas
		const startX = Math.max(
			0,
			((interactionStartMs - startTime) / timeRange) * width,
		);
		const processingStartX = Math.max(
			0,
			((processingStartMs - startTime) / timeRange) * width,
		);
		const processingEndX = Math.min(
			width,
			((processingEndMs - startTime) / timeRange) * width,
		);
		const endX = Math.min(
			width,
			((interactionEndMs - startTime) / timeRange) * width,
		);

		// Calculate vertical position (center of the track)
		const trackCenterY = TIMESCALE_HEIGHT + INTERACTIONS_TRACK_HEIGHT / 2;
		const barHeight = 16; // Height of the main interaction bar

		// Draw the main interaction bar
		// Draw the main interaction bar with diagonal pattern
		if (interactionPattern) {
			ctx.fillStyle = interactionPattern;
			ctx.fillRect(
				processingStartX,
				trackCenterY - barHeight / 2,
				processingEndX - processingStartX,
				barHeight,
			);
		} else {
			// Fallback to solid color if pattern creation fails
			ctx.fillStyle = '#f59e0b';
			ctx.fillRect(
				processingStartX,
				trackCenterY - barHeight / 2,
				processingEndX - processingStartX,
				barHeight,
			);
		}

		// Add a border around the interaction bar for better visibility
		ctx.strokeStyle = '#d97706'; // Darker amber for border
		ctx.lineWidth = 1;
		ctx.strokeRect(
			processingStartX,
			trackCenterY - barHeight / 2,
			processingEndX - processingStartX,
			barHeight,
		);

		// Note: Whiskers are now drawn in the renderInteractionBreakdown function
		// to ensure color coordination with the legends
		// Only draw whiskers if breakdown is not enabled
		if (!showBreakdown) {
			ctx.strokeStyle = '#6b7280'; // Dark gray color for whiskers
			ctx.lineWidth = 2;

			ctx.beginPath();
			ctx.moveTo(startX, trackCenterY);
			ctx.lineTo(processingStartX, trackCenterY);
			ctx.stroke();

			// Draw presentation delay whisker (right side)
			ctx.beginPath();
			ctx.moveTo(processingEndX, trackCenterY);
			ctx.lineTo(endX, trackCenterY);
			ctx.stroke();

			// Draw small vertical lines at the whisker ends
			const whiskerEndHeight = 8;
			// Start whisker end
			ctx.beginPath();
			ctx.moveTo(startX, trackCenterY - whiskerEndHeight / 2);
			ctx.lineTo(startX, trackCenterY + whiskerEndHeight / 2);
			ctx.stroke();
			// End whisker end
			ctx.beginPath();
			ctx.moveTo(endX, trackCenterY - whiskerEndHeight / 2);
			ctx.lineTo(endX, trackCenterY + whiskerEndHeight / 2);
			ctx.stroke();
		}

		// Add threshold pattern if interaction exceeds threshold
		if (interaction.dur > INTERACTION_THRESHOLD_MS && thresholdPattern) {
			// Calculate where the threshold is exceeded
			const thresholdX = Math.max(
				processingStartX,
				((interactionStartMs + INTERACTION_THRESHOLD_MS - startTime) /
					timeRange) *
					width,
			);

			// Only draw pattern if the threshold point is visible and within the processing area
			if (thresholdX < processingEndX) {
				ctx.fillStyle = thresholdPattern;
				// Only apply pattern to the main rectangle, not the whiskers
				ctx.fillRect(
					thresholdX,
					trackCenterY - barHeight / 2,
					processingEndX - thresholdX,
					barHeight,
				);
			}
		}

		// Draw interaction name if there's enough space
		const interactionWidth = processingEndX - processingStartX;
		if (interactionWidth > 50 && interaction.name) {
			ctx.fillStyle = '#000000';
			ctx.font = '10px sans-serif';
			ctx.textBaseline = 'middle';
			ctx.textAlign = 'left';

			// Measure text to check if it fits
			const textWidth = ctx.measureText(interaction.name).width;
			if (textWidth < interactionWidth - 10) {
				// Draw with 5px padding from the left edge of the processing bar
				ctx.fillText(interaction.name, processingStartX + 5, trackCenterY);
			}
		}

		// Render interaction breakdown if enabled
		if (showBreakdown && Boolean(interaction.dur)) {
			renderInteractionBreakdown(
				ctx,
				interaction,
				startX,
				processingStartX,
				processingEndX,
				endX,
				TIMESCALE_HEIGHT + INTERACTIONS_TRACK_HEIGHT,
				breakdownHeight,
				timeRange,
				startTime,
				width,
			);
		}
	});
}

// New function to render the interaction breakdown
function renderInteractionBreakdown(
	ctx: CanvasRenderingContext2D,
	interaction: InteractionEvent,
	startX: number,
	processingStartX: number,
	processingEndX: number,
	endX: number,
	startY: number,
	height: number,
	timeRange: number,
	viewStartTime: number,
	canvasWidth: number,
): void {
	// Define the segments of the interaction
	const segments = [
		{
			name: 'Input delay',
			startX: startX,
			endX: processingStartX,
			color: '#9ca3af', // Gray for input delay
			duration:
				nanoToMs(interaction.processingStart) - nanoToMs(interaction.ts),
		},
		{
			name: 'Processing',
			startX: processingStartX,
			endX: processingEndX,
			color: '#f59e0b', // Amber for processing
			duration:
				nanoToMs(interaction.processingEnd) -
				nanoToMs(interaction.processingStart),
		},
		{
			name: 'Presentation delay',
			startX: processingEndX,
			endX: endX,
			color: '#8b5cf6', // Purple for presentation delay
			duration: interaction.presentationDelay,
		},
	];

	// Calculate which segment is being hovered (if any)
	let hoveredSegmentIndex = -1;

	// Create diagonal patterns for each segment
	const patterns = segments.map((segment) =>
		createDiagonalPattern(ctx, segment.color),
	);

	// Calculate legend height and spacing
	const legendHeight = 14;
	const legendSpacing = 4;
	const legendStartY = startY + 5; // Start a bit below the interaction track

	// Draw color-coded whiskers to match legends
	// Input delay whisker (left side)
	ctx.strokeStyle = segments[0].color;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(startX, TIMESCALE_HEIGHT + INTERACTIONS_TRACK_HEIGHT / 2);
	ctx.lineTo(
		processingStartX,
		TIMESCALE_HEIGHT + INTERACTIONS_TRACK_HEIGHT / 2,
	);
	ctx.stroke();

	// Presentation delay whisker (right side)
	ctx.strokeStyle = segments[2].color;
	ctx.beginPath();
	ctx.moveTo(processingEndX, TIMESCALE_HEIGHT + INTERACTIONS_TRACK_HEIGHT / 2);
	ctx.lineTo(endX, TIMESCALE_HEIGHT + INTERACTIONS_TRACK_HEIGHT / 2);
	ctx.stroke();

	// Draw small vertical lines at the whisker ends with matching colors
	const whiskerEndHeight = 8;
	// Start whisker end
	ctx.beginPath();
	ctx.moveTo(
		startX,
		TIMESCALE_HEIGHT + INTERACTIONS_TRACK_HEIGHT / 2 - whiskerEndHeight / 2,
	);
	ctx.lineTo(
		startX,
		TIMESCALE_HEIGHT + INTERACTIONS_TRACK_HEIGHT / 2 + whiskerEndHeight / 2,
	);
	ctx.stroke();

	// End whisker end
	ctx.strokeStyle = segments[2].color;
	ctx.beginPath();
	ctx.moveTo(
		endX,
		TIMESCALE_HEIGHT + INTERACTIONS_TRACK_HEIGHT / 2 - whiskerEndHeight / 2,
	);
	ctx.lineTo(
		endX,
		TIMESCALE_HEIGHT + INTERACTIONS_TRACK_HEIGHT / 2 + whiskerEndHeight / 2,
	);
	ctx.stroke();

	// Draw legends left-aligned to the interaction start
	// Draw each segment bracket
	segments.forEach((segment, index) => {
		// Determine opacity based on hover state
		const isHovered = index === hoveredSegmentIndex;
		const opacity = hoveredSegmentIndex === -1 || isHovered ? 1.0 : 0.4;

		ctx.globalAlpha = opacity;

		// Calculate legend position
		const legendY = legendStartY + index * (legendHeight + legendSpacing);

		// Draw legend box with diagonal pattern
		const legendWidth = 14;
		const pattern = patterns[index];

		if (pattern) {
			ctx.fillStyle = pattern;
		} else {
			ctx.fillStyle = segment.color;
		}

		ctx.fillRect(startX, legendY, legendWidth, legendHeight);

		// Add border to legend box
		ctx.strokeStyle = segment.color;
		ctx.lineWidth = 1;
		ctx.strokeRect(startX, legendY, legendWidth, legendHeight);

		// Draw text with full label regardless of zoom level
		ctx.fillStyle = '#333333';
		ctx.font = '10px sans-serif';
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'left';

		const segmentText = `${segment.name} (${segment.duration.toFixed(1)}ms)`;
		ctx.fillText(
			segmentText,
			startX + legendWidth + 4,
			legendY + legendHeight / 2,
		);
	});

	// Reset global alpha
	ctx.globalAlpha = 1.0;
}

// Helper function to determine if a point is within a segment
function isPointInSegment(
	x: number,
	y: number,
	segment: any,
	startY: number,
	height: number,
): boolean {
	return (
		x >= segment.startX &&
		x <= segment.endX &&
		y >= startY &&
		y <= startY + height
	);
}

// Render task thresholds
export function renderTaskThresholds(
	ctx: CanvasRenderingContext2D,
	frames: FrameNode[],
	viewState: ViewState,
	width: number,
	height: number,
): void {
	const { startTime, endTime } = viewState;
	const timeRange = endTime - startTime;

	// Set styles for the threshold indicators
	ctx.fillStyle = 'rgba(244, 63, 94, 0.2)'; // Semi-transparent red

	// Iterate through frames and render indicators for long tasks
	frames.forEach((frame) => {
		if (frame.value > TASK_THRESHOLD_MS) {
			// Calculate position and dimensions
			const taskStartX = Math.max(
				0,
				((frame.start - startTime) / timeRange) * width,
			);
			const taskEndX = Math.min(
				width,
				((frame.end - startTime) / timeRange) * width,
			);
			const taskWidth = Math.max(1, taskEndX - taskStartX);

			// Draw the threshold indicator at the top of the canvas
			ctx.fillRect(taskStartX, 30, taskWidth, 5);
		}
	});
}

// Find interaction at a specific time
export function findInteractionAt(
	time: number,
	interactions: InteractionEvent[],
): InteractionEvent | null {
	return (
		interactions.find((interaction) => {
			const startMs = nanoToMs(interaction.ts);
			const endMs = startMs + interaction.dur;
			return time >= startMs && time <= endMs;
		}) || null
	);
}
