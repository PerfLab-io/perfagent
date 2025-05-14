import {
	type NetworkViewState,
	type ProcessedNetworkData,
	ResourceType,
	TIMESCALE_HEIGHT,
	LEGEND_HEIGHT,
	NETWORK_ENTRY_HEIGHT,
	MILESTONE_TRACK_HEIGHT,
} from './types';
import {
	microToMs,
	calculateRequestSegments,
	getResourceTypeColor,
	createDiagonalPattern,
	drawTimescale,
	drawLegends,
} from './renderer';
import { renderMilestoneTrack } from './milestone-renderer';
import { mockMilestones } from './mock-milestones';

// Render network activity in expanded mode
export function renderExpandedMode(
	ctx: CanvasRenderingContext2D,
	data: ProcessedNetworkData,
	viewState: NetworkViewState,
	width: number,
	height: number,
): void {
	const { startTime, endTime, topDepth, visibleDepthCount, showMilestones } =
		viewState;
	const timeRange = endTime - startTime;

	// Clear canvas
	ctx.clearRect(0, 0, width, height);

	// Draw timescale
	drawTimescale(ctx, width, startTime, endTime);

	// Calculate the available height for network entries
	const entriesAreaHeight =
		height -
		TIMESCALE_HEIGHT -
		LEGEND_HEIGHT -
		(showMilestones ? MILESTONE_TRACK_HEIGHT : 0);

	// Create patterns for each resource type
	const patterns = new Map<string, CanvasPattern | null>();

	// First party patterns
	patterns.set(
		`${ResourceType.Document}-true`,
		createDiagonalPattern(
			ctx,
			getResourceTypeColor(ResourceType.Document, true),
		),
	);
	patterns.set(
		`${ResourceType.Stylesheet}-true`,
		createDiagonalPattern(
			ctx,
			getResourceTypeColor(ResourceType.Stylesheet, true),
		),
	);
	patterns.set(
		`${ResourceType.Script}-true`,
		createDiagonalPattern(ctx, getResourceTypeColor(ResourceType.Script, true)),
	);
	patterns.set(
		`${ResourceType.Image}-true`,
		createDiagonalPattern(ctx, getResourceTypeColor(ResourceType.Image, true)),
	);
	patterns.set(
		`${ResourceType.Font}-true`,
		createDiagonalPattern(ctx, getResourceTypeColor(ResourceType.Font, true)),
	);
	patterns.set(
		`${ResourceType.Other}-true`,
		createDiagonalPattern(ctx, getResourceTypeColor(ResourceType.Other, true)),
	);

	// Third party patterns
	patterns.set(
		`${ResourceType.Document}-false`,
		createDiagonalPattern(
			ctx,
			getResourceTypeColor(ResourceType.Document, false),
		),
	);
	patterns.set(
		`${ResourceType.Stylesheet}-false`,
		createDiagonalPattern(
			ctx,
			getResourceTypeColor(ResourceType.Stylesheet, false),
		),
	);
	patterns.set(
		`${ResourceType.Script}-false`,
		createDiagonalPattern(
			ctx,
			getResourceTypeColor(ResourceType.Script, false),
		),
	);
	patterns.set(
		`${ResourceType.Image}-false`,
		createDiagonalPattern(ctx, getResourceTypeColor(ResourceType.Image, false)),
	);
	patterns.set(
		`${ResourceType.Font}-false`,
		createDiagonalPattern(ctx, getResourceTypeColor(ResourceType.Font, false)),
	);
	patterns.set(
		`${ResourceType.Other}-false`,
		createDiagonalPattern(ctx, getResourceTypeColor(ResourceType.Other, false)),
	);

	// Draw grid lines for better readability
	ctx.strokeStyle = '#f1f5f9';
	ctx.lineWidth = 1;

	// Draw horizontal grid lines
	for (let i = 0; i <= visibleDepthCount; i++) {
		const y = TIMESCALE_HEIGHT + i * NETWORK_ENTRY_HEIGHT;
		if (
			y >= TIMESCALE_HEIGHT &&
			y <=
				height - LEGEND_HEIGHT - (showMilestones ? MILESTONE_TRACK_HEIGHT : 0)
		) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(width, y);
			ctx.stroke();
		}
	}

	// Calculate stacking depths for all requests
	const depthMap = new Map<string, number>();
	let maxDepth = 0;

	// Sort requests by start time for proper stacking
	const sortedRequests = [...data.requests].sort(
		(a, b) => microToMs(a.ts) - microToMs(b.ts),
	);

	// Assign depths to all requests
	sortedRequests.forEach((request) => {
		const requestStartMs = microToMs(request.ts);
		const requestEndMs = requestStartMs + microToMs(request.dur);

		// Find the smallest available depth
		let depth = 0;
		let foundDepth = false;

		while (!foundDepth) {
			foundDepth = true;

			// Check if this depth is already occupied by another request that overlaps in time
			for (const [id, d] of depthMap.entries()) {
				if (d !== depth) continue;

				const otherRequest = data.requests.find((r) => r.args.data.url === id);
				if (!otherRequest) continue;

				const otherStartMs = microToMs(otherRequest.ts);
				const otherEndMs = otherStartMs + microToMs(otherRequest.dur);

				// Check if there's an overlap
				if (requestStartMs < otherEndMs && requestEndMs > otherStartMs) {
					foundDepth = false;
					break;
				}
			}

			if (!foundDepth) {
				depth++;
			}
		}

		depthMap.set(request.args.data.url, depth);
		maxDepth = Math.max(maxDepth, depth);
	});

	// Filter requests that are in the visible time and depth range
	const visibleRequests = sortedRequests.filter((request) => {
		const requestStartMs = microToMs(request.ts);
		const requestEndMs = requestStartMs + microToMs(request.dur);
		const depth = depthMap.get(request.args.data.url) || 0;

		return (
			requestEndMs >= startTime &&
			requestStartMs <= endTime &&
			depth >= topDepth &&
			depth < topDepth + visibleDepthCount
		);
	});

	// Enable clipping to prevent drawing outside the network entries area
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, TIMESCALE_HEIGHT, width, entriesAreaHeight);
	ctx.clip();

	// Render each visible request
	visibleRequests.forEach((request) => {
		const segments = calculateRequestSegments(request);
		const requestStartMs = microToMs(request.ts);
		const depth = depthMap.get(request.args.data.url) || 0;

		// Skip if outside visible depth range
		if (depth < topDepth || depth >= topDepth + visibleDepthCount) return;

		// Calculate adjusted depth for rendering (accounting for scrolled position)
		const adjustedDepth = Math.floor(depth - topDepth);

		// Calculate positions - properly handle requests that start before the visible area
		const startX = ((requestStartMs - startTime) / timeRange) * width;

		// Calculate segment positions, ensuring they respect the left edge of the canvas
		const queueingDurationMs = microToMs(segments.queueing);
		const requestWaitingDurationMs = microToMs(segments.requestPlusWaiting);
		const downloadDurationMs = microToMs(segments.download);
		const waitingOnMainThreadDurationMs = microToMs(
			segments.waitingOnMainThread,
		);

		// Calculate the actual visible start position
		const visibleStartX = Math.max(0, startX);

		// Calculate segment end positions
		const queueingEndX = startX + (queueingDurationMs / timeRange) * width;
		const waitingEndX =
			queueingEndX + (requestWaitingDurationMs / timeRange) * width;
		const downloadEndX = waitingEndX + (downloadDurationMs / timeRange) * width;
		const endX =
			downloadEndX + (waitingOnMainThreadDurationMs / timeRange) * width;

		// Calculate vertical position
		const y = TIMESCALE_HEIGHT + adjustedDepth * NETWORK_ENTRY_HEIGHT;
		const barHeight = NETWORK_ENTRY_HEIGHT * 0.7; // 70% of row height
		const barY = y + (NETWORK_ENTRY_HEIGHT - barHeight) / 2;

		// Get resource type and first party status
		const resourceType = request.resourceType || ResourceType.Other;
		const isFirstParty = request.isFirstParty || false;

		// Only draw queueing whisker if it's visible
		if (startX < width && queueingEndX > 0) {
			// Adjust whisker to be visible
			const visibleWhiskerStartX = Math.max(0, startX);
			const visibleWhiskerEndX = Math.min(width, queueingEndX);

			if (visibleWhiskerEndX > visibleWhiskerStartX) {
				// Draw queueing whisker (left side)
				ctx.strokeStyle = '#6b7280'; // Gray for queueing
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(visibleWhiskerStartX, y + NETWORK_ENTRY_HEIGHT / 2);
				ctx.lineTo(visibleWhiskerEndX, y + NETWORK_ENTRY_HEIGHT / 2);
				ctx.stroke();

				// Draw small vertical line at the start if visible
				if (startX >= 0 && startX < width) {
					const whiskerEndHeight = barHeight * 0.5;
					ctx.beginPath();
					ctx.moveTo(
						startX,
						y + NETWORK_ENTRY_HEIGHT / 2 - whiskerEndHeight / 2,
					);
					ctx.lineTo(
						startX,
						y + NETWORK_ENTRY_HEIGHT / 2 + whiskerEndHeight / 2,
					);
					ctx.stroke();
				}
			}
		}

		// Draw request+waiting rectangle with pattern if visible
		if (queueingEndX < width && waitingEndX > 0) {
			const visibleWaitingStartX = Math.max(0, queueingEndX);
			const visibleWaitingEndX = Math.min(width, waitingEndX);

			if (visibleWaitingEndX > visibleWaitingStartX) {
				const patternKey = `${resourceType}-${isFirstParty}`;
				const pattern = patterns.get(patternKey);

				if (pattern) {
					ctx.fillStyle = pattern;
				} else {
					ctx.fillStyle = getResourceTypeColor(resourceType, isFirstParty);
				}

				// Draw waiting rectangle
				ctx.fillRect(
					visibleWaitingStartX,
					barY,
					visibleWaitingEndX - visibleWaitingStartX,
					barHeight,
				);
				ctx.strokeStyle = getResourceTypeColor(resourceType, isFirstParty);
				ctx.lineWidth = 1;
				ctx.strokeRect(
					visibleWaitingStartX,
					barY,
					visibleWaitingEndX - visibleWaitingStartX,
					barHeight,
				);
			}
		}

		// Draw download rectangle with solid color if visible
		if (waitingEndX < width && downloadEndX > 0) {
			const visibleDownloadStartX = Math.max(0, waitingEndX);
			const visibleDownloadEndX = Math.min(width, downloadEndX);

			if (visibleDownloadEndX > visibleDownloadStartX) {
				ctx.fillStyle = getResourceTypeColor(resourceType, isFirstParty, true);
				ctx.fillRect(
					visibleDownloadStartX,
					barY,
					visibleDownloadEndX - visibleDownloadStartX,
					barHeight,
				);
				ctx.strokeRect(
					visibleDownloadStartX,
					barY,
					visibleDownloadEndX - visibleDownloadStartX,
					barHeight,
				);
			}
		}

		// Draw waiting on main thread whisker (right side) if visible
		if (segments.waitingOnMainThread > 0 && downloadEndX < width && endX > 0) {
			const visibleRightWhiskerStartX = Math.max(0, downloadEndX);
			const visibleRightWhiskerEndX = Math.min(width, endX);

			if (visibleRightWhiskerEndX > visibleRightWhiskerStartX) {
				ctx.strokeStyle = '#6b7280'; // Gray for waiting on main thread
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(visibleRightWhiskerStartX, y + NETWORK_ENTRY_HEIGHT / 2);
				ctx.lineTo(visibleRightWhiskerEndX, y + NETWORK_ENTRY_HEIGHT / 2);
				ctx.stroke();

				// Draw small vertical line at the end if visible
				if (endX >= 0 && endX < width) {
					const whiskerEndHeight = barHeight * 0.5;
					ctx.beginPath();
					ctx.moveTo(endX, y + NETWORK_ENTRY_HEIGHT / 2 - whiskerEndHeight / 2);
					ctx.lineTo(endX, y + NETWORK_ENTRY_HEIGHT / 2 + whiskerEndHeight / 2);
					ctx.stroke();
				}
			}
		}

		// Draw resource name if there's enough space - INSIDE the rectangle section
		// Only draw text if at least part of the rectangle is visible
		const visibleRectangleStartX = Math.max(0, queueingEndX);
		const visibleRectangleEndX = Math.min(width, downloadEndX);
		const rectangleWidth = visibleRectangleEndX - visibleRectangleStartX;

		if (rectangleWidth > 50) {
			const fileName = request.args.data.url.split('/').pop() || '';
			ctx.fillStyle = '#333333';
			ctx.font = '10px sans-serif';
			ctx.textBaseline = 'middle';
			ctx.textAlign = 'left';

			// Measure text to check if it fits
			const textWidth = ctx.measureText(fileName).width;
			if (textWidth < rectangleWidth - 10) {
				// Draw with 5px padding from the left edge of the visible rectangle
				ctx.fillText(
					fileName,
					visibleRectangleStartX + 5,
					y + NETWORK_ENTRY_HEIGHT / 2,
				);
			} else if (rectangleWidth > 30) {
				// If not enough space for full name, truncate with ellipsis
				let truncatedName = fileName;
				while (
					ctx.measureText(truncatedName + '...').width > rectangleWidth - 10 &&
					truncatedName.length > 1
				) {
					truncatedName = truncatedName.slice(0, -1);
				}
				if (truncatedName.length > 1) {
					ctx.fillText(
						truncatedName + '...',
						visibleRectangleStartX + 5,
						y + NETWORK_ENTRY_HEIGHT / 2,
					);
				}
			}
		}
	});

	// Restore clipping
	ctx.restore();

	// Draw milestone track if enabled
	if (showMilestones) {
		const milestoneTrackY = height - LEGEND_HEIGHT - MILESTONE_TRACK_HEIGHT;
		renderMilestoneTrack(
			ctx,
			mockMilestones,
			startTime,
			endTime,
			width,
			milestoneTrackY,
		);
	}

	// Draw legends
	drawLegends(ctx, width, height, false);
}
