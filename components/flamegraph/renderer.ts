import { msOrSDisplay } from '@/lib/trace';
import type { ProcessedTrace, ViewState } from './types';
import { TIMESCALE_HEIGHT } from './types';

interface RenderOptions {
	width: number;
	height: number;
	viewState: ViewState;
	selectedNodeId?: string;
	yOffset?: number; // Add offset for interactions track
}

export function renderFlameGraph(
	ctx: CanvasRenderingContext2D,
	data: ProcessedTrace,
	options: RenderOptions,
): void {
	const { width, height, viewState, selectedNodeId, yOffset = 0 } = options;
	const { startTime, endTime, topDepth, visibleDepthCount } = viewState;
	const timeRange = endTime - startTime;

	// Draw timescale as the first element
	// drawTimescale(ctx, width, height, startTime, endTime);

	// Create patterns for each color we use
	const patterns = createPatterns(ctx);

	// Draw frames
	data.frames.forEach((frame) => {
		// Skip frames outside the visible time range or depth range
		if (
			frame.end < startTime ||
			frame.start > endTime ||
			frame.depth < topDepth ||
			frame.depth >= topDepth + visibleDepthCount
		) {
			return;
		}

		// Determine if this frame is selected
		const isSelected = selectedNodeId === frame.id;

		// Calculate frame position and dimensions based on view state
		const frameStartX = Math.max(
			0,
			((frame.start - startTime) / timeRange) * width,
		);
		const frameEndX = Math.min(
			width,
			((frame.end - startTime) / timeRange) * width,
		);
		const frameWidth = Math.max(1, frameEndX - frameStartX); // Ensure minimum width of 1px
		const frameY = (frame.depth - topDepth) * 24 + TIMESCALE_HEIGHT + yOffset; // Add offset for interactions track
		const frameHeight = 24; // Increased from 22 to 24 to remove gaps

		// Determine if this is an event, function call, or timer frame
		const isEvent = frame.cat === 'input' || frame.name.includes('Event');
		const isFunctionCall = frame.name.includes('Function call');
		const isTimer = frame.cat === 'timer';

		// Use a pattern fill instead of solid color
		let fillColor = frame.color;

		// Override with yellow for events, function calls, and timers
		if (isEvent || isFunctionCall || isTimer) {
			fillColor = isSelected ? '#e6b800' : '#f5d76e'; // Darker yellow when selected
		} else if (isSelected) {
			fillColor = '#6366f1'; // Default selected color for other frames
		}

		const patternKey = isSelected
			? isEvent || isFunctionCall || isTimer
				? 'selectedEvent'
				: 'selected'
			: getPatternKeyFromColor(fillColor, frame);

		// Calculate a darker shade for the border (30% darker)
		const borderColor = isSelected
			? isEvent || isFunctionCall || isTimer
				? '#cc9900'
				: '#4338ca'
			: // Darker border for selected frames
				darkenColor(fillColor, 0.3);

		// Draw frame with pattern fill
		ctx.fillStyle = patterns[patternKey] || patterns.default;
		ctx.strokeStyle = borderColor;
		ctx.lineWidth = isSelected ? 2 : 1;

		// Draw frame with no rounded corners
		ctx.beginPath();
		ctx.rect(frameStartX, frameY, frameWidth, frameHeight);
		ctx.fill();
		ctx.stroke();

		// Draw text if there's enough space
		if (frameWidth > 3) {
			// For text readability, add a semi-transparent background behind the text
			const text = frame.name;
			ctx.font = '10px monospace'; // Set font before measuring text
			const textWidth = ctx.measureText(text).width;
			const leftPadding = 3; // Small padding from the left edge

			// Add padding around text (equivalent to Tailwind px-2 py-1)
			const textPaddingX = 8; // 2 in Tailwind scale (4px per unit)
			const textPaddingY = 4; // 1 in Tailwind scale (4px per unit)

			// Calculate total width needed for text including padding
			const totalTextWidth = textWidth + textPaddingX * 2;

			// Check if there's enough space for the text with padding
			if (totalTextWidth <= frameWidth - leftPadding * 2) {
				// If text fits with padding on both sides
				// Get color variants for text and background with increased contrast
				const bgColor = getLighterVariant(fillColor, 0.3); // Less lightening for more contrast
				const textColor = getDarkerVariant(fillColor, 0.7); // More darkening for more contrast

				// Draw text background with padding
				ctx.fillStyle = bgColor;
				ctx.globalAlpha = 0.95; // Higher opacity for better contrast
				ctx.fillRect(
					frameStartX + leftPadding,
					frameY + frameHeight / 2 - textPaddingY - 5,
					totalTextWidth,
					10 + textPaddingY * 2,
				);
				ctx.globalAlpha = 1.0;

				// Draw text
				ctx.fillStyle = textColor;
				ctx.textBaseline = 'middle';
				ctx.textAlign = 'left'; // Left-align text
				ctx.fillText(
					text,
					frameStartX + leftPadding + textPaddingX,
					frameY + frameHeight / 2,
				);
			} else if (frameWidth > 20) {
				// Increased minimum width for truncated text
				// If frame is wide enough for truncated text
				let truncatedText = text;

				// Account for ellipsis and padding when truncating
				const ellipsisWidth = ctx.measureText('...').width;
				const availableWidth =
					frameWidth - leftPadding * 2 - textPaddingX * 2 - ellipsisWidth;

				while (
					truncatedText.length > 1 &&
					ctx.measureText(truncatedText).width > availableWidth
				) {
					truncatedText = truncatedText.slice(0, -1);
				}

				if (truncatedText.length > 1) {
					const truncatedWidth =
						ctx.measureText(truncatedText + '...').width + textPaddingX * 2;

					// Get color variants with increased contrast
					const bgColor = getLighterVariant(fillColor, 0.3);
					const textColor = getDarkerVariant(fillColor, 0.7);

					// Draw text background with padding
					ctx.fillStyle = bgColor;
					ctx.globalAlpha = 0.95;
					ctx.fillRect(
						frameStartX + leftPadding,
						frameY + frameHeight / 2 - textPaddingY - 5,
						truncatedWidth,
						10 + textPaddingY * 2,
					);
					ctx.globalAlpha = 1.0;

					// Draw text
					ctx.fillStyle = textColor;
					ctx.fillText(
						truncatedText + '...',
						frameStartX + leftPadding + textPaddingX,
						frameY + frameHeight / 2,
					);
				} else if (frameWidth > leftPadding * 3 + textPaddingX * 2) {
					// For very narrow frames, just show first character if possible
					const charWidth =
						ctx.measureText(text.charAt(0)).width + textPaddingX * 2;

					// Get color variants with increased contrast
					const bgColor = getLighterVariant(fillColor, 0.3);
					const textColor = getDarkerVariant(fillColor, 0.7);

					// Draw text background with padding
					ctx.fillStyle = bgColor;
					ctx.globalAlpha = 0.95;
					ctx.fillRect(
						frameStartX + leftPadding,
						frameY + frameHeight / 2 - textPaddingY - 5,
						charWidth,
						10 + textPaddingY * 2,
					);
					ctx.globalAlpha = 1.0;

					// Draw text
					ctx.fillStyle = textColor;
					ctx.fillText(
						text.charAt(0),
						frameStartX + leftPadding + textPaddingX,
						frameY + frameHeight / 2,
					);
				}
			}
		}
	});
}

// Helper function to create pattern fills for different colors
function createPatterns(
	ctx: CanvasRenderingContext2D,
): Record<string, CanvasPattern> {
	const patterns: Record<string, CanvasPattern> = {};

	// Create a pattern for each color we use - with more saturated colors for better contrast
	const colors = {
		js: '#a3d8c1', // Stronger mint green for JS
		event: '#f5d76e', // Yellow for events
		selectedEvent: '#e6b800', // Darker yellow for selected events
		anonymous: '#c084fc', // Stronger purple for anonymous functions
		dom: '#f87171', // Stronger red for DOM operations
		function: '#7dd3fc', // Stronger blue for functions
		selected: '#6366f1', // Stronger indigo for selected frame
		default: '#d1d5db', // Stronger gray
	};

	// Create patterns for each color
	Object.entries(colors).forEach(([key, color]) => {
		const patternCanvas = document.createElement('canvas');
		patternCanvas.width = 5;
		patternCanvas.height = 5;
		const patternCtx = patternCanvas.getContext('2d');

		if (patternCtx) {
			patternCtx.strokeStyle = color;
			patternCtx.lineWidth = 1.5; // Thicker lines for better visibility
			patternCtx.beginPath();

			// Draw diagonal lines
			patternCtx.moveTo(0, 5);
			patternCtx.lineTo(5, 0);

			patternCtx.stroke();

			// Create pattern from the canvas
			const pattern = ctx.createPattern(patternCanvas, 'repeat');
			if (pattern) {
				patterns[key] = pattern;
			}
		}
	});

	return patterns;
}

// Helper function to map a color to a pattern key
function getPatternKeyFromColor(color: string, frame?: any): string {
	// Check for special frame types first
	if (frame) {
		if (frame.cat === 'input' || frame.name.includes('Event')) {
			return 'event';
		}
		if (frame.name.includes('Function call')) {
			return 'event'; // Use same pattern as events
		}
		if (frame.cat === 'timer') {
			return 'event'; // Use same pattern as events
		}
	}

	// Updated color mapping for the new, more saturated colors
	switch (color.toLowerCase()) {
		case '#b8e0d2':
		case '#a3d8c1':
			return 'js';
		case '#f5d76e':
		case '#f0c050':
		case '#e6b800':
			return 'event';
		case '#d8b4fe':
		case '#c084fc':
			return 'anonymous';
		case '#fecaca':
		case '#f87171':
			return 'dom';
		case '#a7d7e8':
		case '#7dd3fc':
			return 'function';
		case '#6366f1':
		case '#4f46e5':
			return 'selected';
		case '#818cf8':
			return 'selected'; // Bright indigo also maps to selected
		default:
			return 'default';
	}
}

// Helper function to darken a color by a specified amount
function darkenColor(color: string, amount: number): string {
	// Convert hex to RGB
	let r = Number.parseInt(color.slice(1, 3), 16);
	let g = Number.parseInt(color.slice(3, 5), 16);
	let b = Number.parseInt(color.slice(5, 7), 16);

	// Darken each component
	r = Math.max(0, Math.floor(r * (1 - amount)));
	g = Math.max(0, Math.floor(g * (1 - amount)));
	b = Math.max(0, Math.floor(b * (1 - amount)));

	// Convert back to hex
	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Helper function to get a lighter variant of a color with adjustable intensity
function getLighterVariant(color: string, intensity = 0.4): string {
	// Convert hex to RGB
	let r = Number.parseInt(color.slice(1, 3), 16);
	let g = Number.parseInt(color.slice(3, 5), 16);
	let b = Number.parseInt(color.slice(5, 7), 16);

	// Lighten each component (make it closer to white)
	r = Math.min(255, Math.floor(r + (255 - r) * intensity));
	g = Math.min(255, Math.floor(g + (255 - g) * intensity));
	b = Math.min(255, Math.floor(b + (255 - b) * intensity));

	// Convert back to hex
	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Helper function to get a darker variant of a color with adjustable intensity
function getDarkerVariant(color: string, intensity = 0.6): string {
	// Convert hex to RGB
	let r = Number.parseInt(color.slice(1, 3), 16);
	let g = Number.parseInt(color.slice(3, 5), 16);
	let b = Number.parseInt(color.slice(5, 7), 16);

	// Darken each component (make it closer to black)
	r = Math.max(0, Math.floor(r * (1 - intensity)));
	g = Math.max(0, Math.floor(g * (1 - intensity)));
	b = Math.max(0, Math.floor(b * (1 - intensity)));

	// Convert back to hex
	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Update the drawTimescale function to dynamically adjust decimal precision based on zoom level
export function drawTimescale(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	startTime: number,
	endTime: number,
): void {
	const timeRange = endTime - startTime;

	// Draw timescale background
	ctx.fillStyle = '#e8dcc7'; // Beige/tan background matching PerfAgent panels
	ctx.fillRect(0, 0, width, TIMESCALE_HEIGHT);

	// Add subtle gradient for retro-futuristic effect
	const gradient = ctx.createLinearGradient(0, 0, 0, TIMESCALE_HEIGHT);
	gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
	gradient.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, TIMESCALE_HEIGHT);

	// Draw bottom border for the timescale
	ctx.strokeStyle = '#c9bea7'; // Border color matching PerfAgent panels
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(0, TIMESCALE_HEIGHT);
	ctx.lineTo(width, TIMESCALE_HEIGHT);
	ctx.stroke();

	// Determine appropriate time interval based on visible range and available width
	// This ensures readable labels at any zoom level
	const targetLabelCount = Math.max(4, Math.min(10, Math.floor(width / 100)));
	let interval = timeRange / targetLabelCount;

	// Round interval to a nice number (1, 2, 5, 10, 20, 50, etc.)
	const magnitude = Math.pow(10, Math.floor(Math.log10(interval)));
	const normalized = interval / magnitude;

	if (normalized < 1.5) interval = magnitude;
	else if (normalized < 3.5) interval = 2 * magnitude;
	else if (normalized < 7.5) interval = 5 * magnitude;
	else interval = 10 * magnitude;

	// Calculate first marker that's visible in the view
	// Ensure we start slightly before the visible area to handle edge cases
	const firstMarkerTime = Math.floor(startTime / interval) * interval;

	// Determine decimal precision based on zoom level, capped at 3 decimal points
	let decimalPrecision = 1; // Default precision

	if (timeRange <= 10) {
		decimalPrecision = 3; // Maximum precision (hundreds of microseconds)
	} else if (timeRange <= 100) {
		decimalPrecision = 2; // Medium precision
	}

	// Helper function to format time with appropriate precision
	// Fix for negative zero issue
	const formatTime = (time: number) => {
		// Handle the case where time is very close to zero but slightly negative
		// due to floating point precision issues
		if (Math.abs(time) < 0.0001) {
			time = 0;
		}
		return `${msOrSDisplay(time)}`;
	};

	// Draw time markers
	ctx.fillStyle = '#333333'; // Dark text color
	ctx.font = '10px monospace'; // Monospace for retro-futuristic look
	ctx.textBaseline = 'top';

	// Always draw the start time marker with proper padding
	const startLabel = formatTime(startTime);
	const startLabelWidth = ctx.measureText(startLabel).width;
	ctx.fillText(startLabel, 4, 6);

	// Draw tick for start time
	ctx.strokeStyle = '#94a3b8';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(0, TIMESCALE_HEIGHT);
	ctx.lineTo(0, TIMESCALE_HEIGHT - 6);
	ctx.stroke();

	// Draw regular interval markers
	for (
		let time = firstMarkerTime;
		time <= endTime + interval;
		time += interval
	) {
		// Skip if this time is too close to the start or end marker
		if (
			Math.abs(time - startTime) < interval * 0.1 ||
			Math.abs(time - endTime) < interval * 0.1
		) {
			continue;
		}

		const x = ((time - startTime) / timeRange) * width;

		// Skip if outside canvas or too close to edges
		if (x < 10 || x > width - 10) continue;

		// Draw tick
		ctx.strokeStyle = '#94a3b8';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(x, TIMESCALE_HEIGHT);
		ctx.lineTo(x, TIMESCALE_HEIGHT - 6);
		ctx.stroke();

		// Draw time label with appropriate precision
		const label = formatTime(time);
		const labelWidth = ctx.measureText(label).width;

		// Center the label on the tick, but ensure it doesn't go off-screen
		const labelX = Math.max(
			4,
			Math.min(width - labelWidth - 4, x - labelWidth / 2),
		);
		ctx.fillText(label, labelX, 6);
	}

	// Always draw the end time marker with proper padding
	const endLabel = formatTime(endTime);
	const endLabelWidth = ctx.measureText(endLabel).width;
	ctx.fillText(endLabel, width - endLabelWidth - 4, 6);

	// Draw tick for end time
	ctx.strokeStyle = '#94a3b8';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(width, TIMESCALE_HEIGHT);
	ctx.lineTo(width, TIMESCALE_HEIGHT - 6);
	ctx.stroke();

	// Draw minor ticks for better precision
	// Adjust minor tick interval based on zoom level
	const minorInterval = interval / 5;
	ctx.strokeStyle = '#c9bea7';
	ctx.lineWidth = 0.5;

	// Only draw minor ticks if they're not too dense
	if ((minorInterval * width) / timeRange > 3) {
		for (let time = startTime; time <= endTime; time += minorInterval) {
			// Skip if this is a major tick
			if (Math.abs(time % interval) < 0.001) continue;

			const x = ((time - startTime) / timeRange) * width;

			// Skip if outside canvas
			if (x < 0 || x > width) continue;

			// Draw minor tick
			ctx.beginPath();
			ctx.moveTo(x, TIMESCALE_HEIGHT);
			ctx.lineTo(x, TIMESCALE_HEIGHT - 3);
			ctx.stroke();
		}
	}

	// Draw vertical grid lines
	ctx.strokeStyle = '#ad7149';
	ctx.setLineDash([2, 2]);

	// Draw grid line for start time
	ctx.beginPath();
	ctx.moveTo(0, TIMESCALE_HEIGHT);
	ctx.lineTo(0, height);
	ctx.stroke();

	// Draw grid lines at regular intervals
	for (let time = firstMarkerTime; time <= endTime; time += interval) {
		// Skip if too close to start or end
		if (
			Math.abs(time - startTime) < interval * 0.1 ||
			Math.abs(time - endTime) < interval * 0.1
		) {
			continue;
		}

		const x = ((time - startTime) / timeRange) * width;

		// Skip if outside canvas
		if (x < 0 || x > width) continue;

		// Draw vertical grid line
		ctx.beginPath();
		ctx.moveTo(x, TIMESCALE_HEIGHT);
		ctx.lineTo(x, height);
		ctx.stroke();
	}

	// Draw grid line for end time
	ctx.beginPath();
	ctx.moveTo(width, TIMESCALE_HEIGHT);
	ctx.lineTo(width, height);
	ctx.stroke();

	// Reset line dash
	ctx.setLineDash([]);
}
