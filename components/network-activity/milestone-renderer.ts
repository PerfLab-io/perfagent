import { Micro } from '@perflab/trace_engine/models/trace/types/Timing';
import { MILESTONE_TRACK_HEIGHT, TIMESCALE_HEIGHT } from './types';
import { PageLoadEvent } from '@perflab/trace_engine/models/trace/types/TraceEvents';
import { milliSecondsToSeconds } from '@perflab/trace_engine/core/platform/Timing';
import { microToMilli } from '@perflab/trace_engine/models/trace/helpers/Timing';

export const enum MetricName {
	// First Contentful Paint
	'firstContentfulPaint' = 'FCP',
	// First Paint
	'firstPaint' = 'FP',
	// MarkLoad
	'MarkLoad' = 'L',
	'largestContentfulPaint::Candidate' = 'LCP',
	// Mark DOM Content
	'MarkDOMContent' = 'DCL',
	// Time To Interactive
	'TimeToInteractive' = 'TTI',
	// Total Blocking Time
	'TotalBlockingTime' = 'TBT',
	// Cumulative Layout Shift
	'CumulativeLayoutShift' = 'CLS',
	// Navigation
	'navigationStart' = 'NAV',
}

// Render milestone track
export function renderMilestoneTrack(
	ctx: CanvasRenderingContext2D,
	milestones: PageLoadEvent[],
	startTime: number,
	endTime: number,
	width: number,
	trackY: number,
): void {
	const timeRange = endTime - startTime;

	// Draw milestone track background
	ctx.fillStyle = '#f8fafc'; // Light background
	ctx.fillRect(0, trackY, width, MILESTONE_TRACK_HEIGHT);

	// Add subtle gradient
	const gradient = ctx.createLinearGradient(
		0,
		trackY,
		0,
		trackY + MILESTONE_TRACK_HEIGHT,
	);
	gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
	gradient.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, trackY, width, MILESTONE_TRACK_HEIGHT);

	// Draw top border for the milestone track
	ctx.strokeStyle = '#cbd5e0';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(0, trackY);
	ctx.lineTo(width, trackY);
	ctx.stroke();

	// Render each milestone
	milestones.forEach((milestone) => {
		// Skip if outside visible range
		if (milestone.ts < startTime || milestone.ts > endTime) return;

		// Calculate x position
		const x = ((milestone.ts - startTime) / timeRange) * width;

		// Draw vertical line that connects to the bottom of the timescale
		const markerColor = '#94a3b8';
		ctx.strokeStyle = markerColor;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(x, TIMESCALE_HEIGHT); // Start from the bottom of the timescale
		ctx.lineTo(x, trackY + MILESTONE_TRACK_HEIGHT - 20); // Stop above the label
		ctx.stroke();

		// Format the time text
		const timeFromStart = (milestone.ts - startTime) as Micro;
		const timeText = `${milliSecondsToSeconds(
			microToMilli(timeFromStart),
		).toFixed(1)}s`;

		// Create the full label with type and time
		// @ts-ignore
		const fullLabel = `${MetricName[milestone.name]} - ${timeText}`;

		// Measure the text to determine label width
		ctx.font = '10px sans-serif';
		const textWidth = ctx.measureText(fullLabel).width;
		const labelWidth = textWidth + 16; // Add padding
		const labelHeight = 20; // Fixed height for label
		const labelY = trackY + MILESTONE_TRACK_HEIGHT - labelHeight;

		// Draw label background
		ctx.fillStyle = markerColor;
		ctx.fillRect(x, labelY, labelWidth, labelHeight);

		// Draw full label text in white
		ctx.fillStyle = '#ffffff'; // White text for the entire label
		ctx.font = '10px sans-serif';
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'left';
		ctx.fillText(fullLabel, x + 8, labelY + 10); // 8px padding from left
	});
}
