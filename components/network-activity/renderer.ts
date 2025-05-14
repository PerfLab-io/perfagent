import { SyntheticNetworkRequest } from '@perflab/trace_engine/models/trace/types/TraceEvents';
import {
	type NetworkRequestSegments,
	ResourceType,
	TIMESCALE_HEIGHT,
	LEGEND_HEIGHT,
} from './types';
import { microToMilli } from '@perflab/trace_engine/models/trace/helpers/Timing';
import { Micro } from '@perflab/trace_engine/models/trace/types/Timing';
import { milliSecondsToSeconds } from '@perflab/trace_engine/core/platform/Timing';
import { getColor } from './compact-renderer';
import { NetworkCategory } from './compact-renderer';

// Calculate timing segments for a network request
export function calculateRequestSegments(
	request: SyntheticNetworkRequest,
): NetworkRequestSegments {
	const syntheticData = request.args.data.syntheticData;
	const queueing = syntheticData.sendStartTime - request.ts;
	const requestPlusWaiting =
		syntheticData.downloadStart - syntheticData.sendStartTime;
	const download = syntheticData.finishTime - syntheticData.downloadStart;
	const waitingOnMainThread =
		request.ts + request.dur - syntheticData.finishTime;

	return {
		queueing,
		requestPlusWaiting,
		download,
		waitingOnMainThread,
		total: request.dur,
	};
}

// Convert microseconds to milliseconds
export function microToMs(micro: number): number {
	return micro / 1000;
}

// Create a diagonal line pattern for network bars
export function createDiagonalPattern(
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

// Get color for resource type
export function getResourceTypeColor(
	type: ResourceType,
	isFirstParty: boolean,
	isDownloading = false,
): string {
	// First party resources use peppermint colors, third party use merino colors
	if (isFirstParty) {
		// Peppermint colors (mint green range)
		switch (type) {
			case ResourceType.Document:
				return isDownloading ? '#63b3ed' : '#90cdf4'; // Blue
			case ResourceType.Stylesheet:
				return isDownloading ? '#68d391' : '#9ae6b4'; // Green
			case ResourceType.Script:
				return isDownloading ? '#4fd1c5' : '#81e6d9'; // Teal
			case ResourceType.Image:
				return isDownloading ? '#667eea' : '#7f9cf5'; // Indigo
			case ResourceType.Font:
				return isDownloading ? '#9f7aea' : '#b794f4'; // Purple
			default:
				return isDownloading ? '#a0aec0' : '#cbd5e0'; // Gray
		}
	} else {
		// Merino colors (beige/tan range)
		switch (type) {
			case ResourceType.Document:
				return isDownloading ? '#d69e2e' : '#ecc94b'; // Yellow
			case ResourceType.Stylesheet:
				return isDownloading ? '#dd6b20' : '#ed8936'; // Orange
			case ResourceType.Script:
				return isDownloading ? '#c05621' : '#dd6b20'; // Dark orange
			case ResourceType.Image:
				return isDownloading ? '#b7791f' : '#d69e2e'; // Gold
			case ResourceType.Font:
				return isDownloading ? '#975a16' : '#b7791f'; // Brown
			default:
				return isDownloading ? '#718096' : '#a0aec0'; // Gray
		}
	}
}

// Draw timescale
export function drawTimescale(
	ctx: CanvasRenderingContext2D,
	width: number,
	startTime: number,
	endTime: number,
): void {
	const timeRange = endTime - startTime;

	// Draw timescale background
	ctx.fillStyle = '#f8fafc'; // Light background
	ctx.fillRect(0, 0, width, TIMESCALE_HEIGHT);

	// Add subtle gradient
	const gradient = ctx.createLinearGradient(0, 0, 0, TIMESCALE_HEIGHT);
	gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
	gradient.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, TIMESCALE_HEIGHT);

	// Draw bottom border for the timescale
	ctx.strokeStyle = '#cbd5e0';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(0, TIMESCALE_HEIGHT);
	ctx.lineTo(width, TIMESCALE_HEIGHT);
	ctx.stroke();

	// Determine appropriate time interval based on visible range
	const targetLabelCount = Math.max(4, Math.min(10, Math.floor(width / 100)));
	let interval = timeRange / targetLabelCount;

	// Round interval to a nice number
	const magnitude = Math.pow(10, Math.floor(Math.log10(interval)));
	const normalized = interval / magnitude;

	if (normalized < 1.5) interval = magnitude;
	else if (normalized < 3.5) interval = 2 * magnitude;
	else if (normalized < 7.5) interval = 5 * magnitude;
	else interval = 10 * magnitude;

	// Calculate first marker that's visible in the view
	const firstMarkerTime = Math.floor(startTime / interval) * interval;

	// Determine decimal precision based on zoom level
	let decimalPrecision = 1;
	if (timeRange <= 10) {
		decimalPrecision = 3;
	} else if (timeRange <= 100) {
		decimalPrecision = 2;
	}

	// Format time with appropriate precision
	const formatTime = (time: number) => {
		if (Math.abs(time) < 0.0001) {
			time = 0;
		}
		return `${time.toFixed(decimalPrecision)}s`;
	};

	// Draw time markers
	ctx.fillStyle = '#333333';
	ctx.font = '10px monospace';
	ctx.textBaseline = 'top';

	// Always draw the start time marker
	const startLabel = formatTime(0);
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
		// Skip if too close to start or end
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

		// Draw time label
		const timeFromStart = (time - startTime) as Micro;
		const label = formatTime(
			milliSecondsToSeconds(microToMilli(timeFromStart)),
		);
		const labelWidth = ctx.measureText(label).width;
		const labelX = Math.max(
			4,
			Math.min(width - labelWidth - 4, x - labelWidth / 2),
		);
		ctx.fillText(label, labelX, 6);
	}

	// Always draw the end time marker
	const timeFromStart = (endTime - startTime) as Micro;
	const endLabel = formatTime(
		milliSecondsToSeconds(microToMilli(timeFromStart)),
	);
	const endLabelWidth = ctx.measureText(endLabel).width;
	ctx.fillText(endLabel, width - endLabelWidth - 4, 6);

	// Draw tick for end time
	ctx.strokeStyle = '#94a3b8';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(width, TIMESCALE_HEIGHT);
	ctx.lineTo(width, TIMESCALE_HEIGHT - 6);
	ctx.stroke();
}

// Draw legends
export function drawLegends(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	isCompact: boolean,
	showFirstParty = true,
	showThirdParty = true,
	showByAssetType = false,
): void {
	const legendY = height - LEGEND_HEIGHT;

	// Draw legend background
	ctx.fillStyle = '#f8fafc';
	ctx.fillRect(0, legendY, width, LEGEND_HEIGHT);

	// Draw top border
	ctx.strokeStyle = '#cbd5e0';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(0, legendY);
	ctx.lineTo(width, legendY);
	ctx.stroke();

	ctx.font = '10px sans-serif';
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'left';

	if (isCompact) {
		// Compact mode legends
		const legendItems = [
			{
				color: '#a3d8c1',
				label: 'First Party',
				visible: showFirstParty,
				alpha: 1.0,
			},
			{
				color: '#d9c7ae',
				label: 'Third Party',
				visible: showThirdParty,
				alpha: 1.0,
			},
			{
				color: getColor(NetworkCategory.DOC),
				label: 'Document',
				visible: showByAssetType,
				alpha: 0.55,
			},
			{
				color: getColor(NetworkCategory.CSS),
				label: 'CSS',
				visible: showByAssetType,
				alpha: 0.55,
			},
			{
				color: getColor(NetworkCategory.JS),
				label: 'Script',
				visible: showByAssetType,
				alpha: 0.55,
			},
			{
				color: getColor(NetworkCategory.IMG),
				label: 'Image',
				visible: showByAssetType,
				alpha: 0.55,
			},
			{
				color: getColor(NetworkCategory.FONT),
				label: 'Font',
				visible: showByAssetType,
				alpha: 0.55,
			},
			{
				color: getColor(NetworkCategory.WASM),
				label: 'Wasm',
				visible: showByAssetType,
				alpha: 0.55,
			},
			{
				color: getColor(NetworkCategory.OTHER),
				label: 'Other',
				visible: showByAssetType,
				alpha: 0.55,
			},
		];

		let xOffset = 10;
		legendItems
			.filter((item) => item.visible)
			.forEach((item) => {
				// Draw color box with opacity based on visibility
				ctx.fillStyle = item.color;
				ctx.globalAlpha = item.alpha;
				ctx.fillRect(xOffset, legendY + 14, 12, 12);
				ctx.globalAlpha = 1.0;

				// Draw border
				ctx.strokeStyle = '#64748b';
				ctx.lineWidth = 1;
				ctx.strokeRect(xOffset, legendY + 14, 12, 12);

				// Draw label
				ctx.fillStyle = item.visible ? '#333333' : '#94a3b8';
				ctx.fillText(item.label, xOffset + 16, legendY + 20);

				xOffset += ctx.measureText(item.label).width + 40;
			});
	} else {
		// Expanded mode legends
		const legendItems = [
			{ color: '#7f9cf5', label: 'Images', type: ResourceType.Image },
			{ color: '#9ae6b4', label: 'CSS', type: ResourceType.Stylesheet },
			{ color: '#81e6d9', label: 'Scripts', type: ResourceType.Script },
			{ color: '#cbd5e0', label: 'Other', type: ResourceType.Other },
		];

		let xOffset = 10;
		legendItems.forEach((item) => {
			// Create pattern for the legend
			const pattern = createDiagonalPattern(ctx, item.color);

			// Draw color box with pattern
			if (pattern) {
				ctx.fillStyle = pattern;
			} else {
				ctx.fillStyle = item.color;
			}
			ctx.fillRect(xOffset, legendY + 10, 12, 12);

			// Add border
			ctx.strokeStyle = item.color;
			ctx.lineWidth = 1;
			ctx.strokeRect(xOffset, legendY + 10, 12, 12);

			// Draw label
			ctx.fillStyle = '#333333';
			ctx.fillText(item.label, xOffset + 16, legendY + 16);

			xOffset += ctx.measureText(item.label).width + 40;
		});

		// Add timing legends
		xOffset += 20;

		// Draw queueing legend
		ctx.strokeStyle = '#6b7280';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(xOffset, legendY + 16);
		ctx.lineTo(xOffset + 20, legendY + 16);
		ctx.stroke();
		ctx.fillStyle = '#333333';
		ctx.fillText('Queueing', xOffset + 24, legendY + 16);

		xOffset += ctx.measureText('Queueing').width + 40;

		// Draw waiting legend
		ctx.fillStyle = '#e2e8f0';
		ctx.fillRect(xOffset, legendY + 10, 20, 12);
		ctx.strokeStyle = '#a0aec0';
		ctx.strokeRect(xOffset, legendY + 10, 20, 12);
		ctx.fillStyle = '#333333';
		ctx.fillText('Waiting', xOffset + 24, legendY + 16);

		xOffset += ctx.measureText('Waiting').width + 40;

		// Draw downloading legend
		ctx.fillStyle = '#a0aec0';
		ctx.fillRect(xOffset, legendY + 10, 20, 12);
		ctx.strokeStyle = '#718096';
		ctx.strokeRect(xOffset, legendY + 10, 20, 12);
		ctx.fillStyle = '#333333';
		ctx.fillText('Downloading', xOffset + 24, legendY + 16);
	}
}
