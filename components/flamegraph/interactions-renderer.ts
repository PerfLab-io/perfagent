import type { InteractionEvent, ViewState } from './types';
import {
	INTERACTION_THRESHOLD_MS,
	TASK_THRESHOLD_MS,
	TIMESCALE_HEIGHT,
	INTERACTIONS_TRACK_HEIGHT,
} from './types';

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

	// Create pattern for threshold indicators
	const patternCanvas = document.createElement('canvas');
	patternCanvas.width = 6;
	patternCanvas.height = 6;
	const patternCtx = patternCanvas.getContext('2d');

	if (patternCtx) {
		patternCtx.strokeStyle = '#f43f5e'; // Red color for threshold pattern
		patternCtx.lineWidth = 1.5;
		patternCtx.beginPath();
		patternCtx.moveTo(0, 6);
		patternCtx.lineTo(6, 0);
		patternCtx.stroke();
	}

	const thresholdPattern = ctx.createPattern(patternCanvas, 'repeat');

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
		ctx.fillStyle = '#f59e0b'; // Amber color for interaction bar
		ctx.fillRect(
			processingStartX,
			trackCenterY - barHeight / 2,
			processingEndX - processingStartX,
			barHeight,
		);

		// Draw input delay whisker (left side)
		ctx.strokeStyle = '#6b7280'; // Dark gray color for whiskers (changed from amber)
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
	});
}

// Render task threshold indicators on the flamegraph
export function renderTaskThresholds(
	ctx: CanvasRenderingContext2D,
	frames: FrameNode[],
	viewState: ViewState,
	width: number,
	height: number,
): void {
	const { startTime, endTime, topDepth } = viewState;
	const timeRange = endTime - startTime;

	// Create pattern for threshold indicators
	const patternCanvas = document.createElement('canvas');
	patternCanvas.width = 6;
	patternCanvas.height = 6;
	const patternCtx = patternCanvas.getContext('2d');

	if (patternCtx) {
		patternCtx.strokeStyle = '#f43f5e'; // Red color for threshold pattern
		patternCtx.lineWidth = 1.5;
		patternCtx.beginPath();
		patternCtx.moveTo(0, 6);
		patternCtx.lineTo(6, 0);
		patternCtx.stroke();
	}

	const thresholdPattern = ctx.createPattern(patternCanvas, 'repeat');
	if (!thresholdPattern) return;

	// Find top-level tasks (frames with depth 0)
	const topLevelTasks = frames.filter((frame) => frame.depth === 0);

	// Render threshold indicators for each task that exceeds the threshold
	topLevelTasks.forEach((task) => {
		// Skip tasks outside the visible range
		if (task.end < startTime || task.start > endTime) return;

		// Skip tasks that don't exceed the threshold
		if (task.value <= TASK_THRESHOLD_MS) return;

		// Calculate the threshold point
		const thresholdTime = task.start + TASK_THRESHOLD_MS;

		// Skip if the threshold point is outside the visible range
		if (thresholdTime > endTime) return;

		// Calculate positions on the canvas
		const thresholdX = ((thresholdTime - startTime) / timeRange) * width;
		const endX = Math.min(width, ((task.end - startTime) / timeRange) * width);

		// Skip if there's no visible area after the threshold
		if (thresholdX >= endX) return;

		// Calculate vertical position based on the task's depth
		const taskY =
			(task.depth - topDepth) * 24 +
			TIMESCALE_HEIGHT +
			INTERACTIONS_TRACK_HEIGHT;
		const taskHeight = 24; // Height of each frame

		// Only draw the pattern if the task is actually visible in the current view
		// This ensures the pattern is hidden when the task is scrolled out of view
		if (
			task.depth >= topDepth &&
			task.depth < topDepth + viewState.visibleDepthCount
		) {
			// Draw the threshold pattern
			ctx.fillStyle = thresholdPattern;
			ctx.fillRect(thresholdX, taskY, endX - thresholdX, taskHeight);
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
