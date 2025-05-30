import {
	type NetworkViewState,
	type ProcessedNetworkData,
	TIMESCALE_HEIGHT,
	LEGEND_HEIGHT,
	COMPACT_MODE_HEIGHT,
} from './types';
import { drawTimescale, drawLegends } from './renderer';
import { renderMilestoneTrack } from './milestone-renderer';
import { PageLoadEvent } from '@perflab/trace_engine/models/trace/types/TraceEvents';

export enum NetworkCategory {
	JS = 'JS',
	MEDIA = 'Media',
	IMG = 'Img',
	FONT = 'Font',
	WASM = 'Wasm',
	DOC = 'Doc',
	CSS = 'CSS',
	OTHER = 'Other',
}

export const getColor = (category: NetworkCategory) => {
	switch (category) {
		case NetworkCategory.DOC:
			return 'rgb(76 141 246 / 100%)';
		case NetworkCategory.CSS:
			return 'rgb(191 103 255 / 100%)';
		case NetworkCategory.JS:
			return 'rgb(250 204 21 / 100%)';
		case NetworkCategory.FONT:
			return 'rgb(0 157 193 / 100%)';
		case NetworkCategory.IMG:
			return 'rgb(109 213 140 / 100%)';
		case NetworkCategory.MEDIA:
			return 'rgb(30 164 70 / 100%)';
		case NetworkCategory.WASM:
			return 'rgb(141 127 255 / 100%)';
		case NetworkCategory.OTHER:
			return 'rgb(117 117 117 / 100%)';
	}
};

// Render network activity in compact mode
export function renderCompactMode(
	ctx: CanvasRenderingContext2D,
	data: ProcessedNetworkData,
	viewState: NetworkViewState,
	width: number,
	height: number,
	firstPartyOrigin: string,
	milestones?: PageLoadEvent[],
): void {
	const {
		startTime,
		endTime,
		showFirstParty,
		showThirdParty,
		showByAssetType,
		showMilestones,
	} = viewState;
	const timeRange = endTime - startTime;

	// Clear canvas
	ctx.clearRect(0, 0, width, height);

	// Draw timescale
	drawTimescale(ctx, width, startTime, endTime);

	// Calculate the height of the activity bar - FIXED calculation
	// We need to ensure the activity bar has a fixed height regardless of milestones
	const activityBarHeight =
		COMPACT_MODE_HEIGHT - TIMESCALE_HEIGHT - LEGEND_HEIGHT;
	const activityBarY = TIMESCALE_HEIGHT;

	// Draw activity bar background
	ctx.fillStyle = '#f8fafc';
	ctx.fillRect(0, activityBarY, width, activityBarHeight);

	// Add border around activity bar
	ctx.strokeStyle = '#e2e8f0';
	ctx.lineWidth = 1;
	ctx.strokeRect(0, activityBarY, width, activityBarHeight);

	// Create activity maps for first and third party
	const docActivity = new Map<number, number>();
	const cssActivity = new Map<number, number>();
	const jsActivity = new Map<number, number>();
	const fontActivity = new Map<number, number>();
	const imgActivity = new Map<number, number>();
	const mediaActivity = new Map<number, number>();
	const wasmActivity = new Map<number, number>();
	const otherActivity = new Map<number, number>();
	const firstPartyActivity = new Map<number, number>();
	const thirdPartyActivity = new Map<number, number>();

	// Calculate activity at each pixel position
	for (let x = 0; x < width; x++) {
		const timeAtPixel = startTime + (x / width) * timeRange;
		let docCount = 0;
		let cssCount = 0;
		let jsCount = 0;
		let fontCount = 0;
		let imgCount = 0;
		let mediaCount = 0;
		let wasmCount = 0;
		let otherCount = 0;
		let firstPartyCount = 0;
		let thirdPartyCount = 0;

		data.requests.forEach((request) => {
			const requestStartMs = request.ts;
			const requestEndMs = requestStartMs + request.dur;

			if (timeAtPixel >= requestStartMs && timeAtPixel <= requestEndMs) {
				if (request.args.data.url.includes(firstPartyOrigin)) {
					firstPartyCount++;
				} else {
					thirdPartyCount++;
				}

				if (request.args.data.mimeType.includes('html')) {
					docCount++;
				} else if (request.args.data.mimeType.includes('css')) {
					cssCount++;
				} else if (request.args.data.mimeType.includes('javascript')) {
					jsCount++;
				} else if (request.args.data.mimeType.includes('font')) {
					fontCount++;
				} else if (request.args.data.mimeType.includes('image')) {
					imgCount++;
				} else if (request.args.data.mimeType.includes('audio')) {
					mediaCount++;
				} else if (request.args.data.mimeType.includes('wasm')) {
					wasmCount++;
				} else {
					otherCount++;
				}
			}
		});

		docActivity.set(x, docCount);
		cssActivity.set(x, cssCount);
		jsActivity.set(x, jsCount);
		fontActivity.set(x, fontCount);
		imgActivity.set(x, imgCount);
		mediaActivity.set(x, mediaCount);
		wasmActivity.set(x, wasmCount);
		otherActivity.set(x, otherCount);
		firstPartyActivity.set(x, firstPartyCount);
		thirdPartyActivity.set(x, thirdPartyCount);
	}

	// Find maximum activity count for scaling
	const maxDoc = Math.max(...Array.from(docActivity.values()), 1);
	const maxCSS = Math.max(...Array.from(cssActivity.values()), 1);
	const maxJS = Math.max(...Array.from(jsActivity.values()), 1);
	const maxFont = Math.max(...Array.from(fontActivity.values()), 1);
	const maxImg = Math.max(...Array.from(imgActivity.values()), 1);
	const maxMedia = Math.max(...Array.from(mediaActivity.values()), 1);
	const maxWasm = Math.max(...Array.from(wasmActivity.values()), 1);
	const maxOther = Math.max(...Array.from(otherActivity.values()), 1);

	if (showByAssetType) {
		const maxActivity = Math.max(
			maxDoc,
			maxCSS,
			maxJS,
			maxFont,
			maxImg,
			maxMedia,
			maxWasm,
			maxOther,
		);

		for (const [category] of Object.entries(NetworkCategory)) {
			const color = getColor(
				NetworkCategory[category as keyof typeof NetworkCategory],
			);
			ctx.fillStyle = color;

			const activityMap = {
				[NetworkCategory.DOC]: docActivity,
				[NetworkCategory.CSS]: cssActivity,
				[NetworkCategory.JS]: jsActivity,
				[NetworkCategory.FONT]: fontActivity,
				[NetworkCategory.IMG]: imgActivity,
				[NetworkCategory.MEDIA]: mediaActivity,
				[NetworkCategory.WASM]: wasmActivity,
				[NetworkCategory.OTHER]: otherActivity,
			}[NetworkCategory[category as keyof typeof NetworkCategory]];

			ctx.globalAlpha = 0.55;
			for (let x = 0; x < width; x++) {
				const activity = activityMap.get(x) || 0;
				if (activity > 0) {
					const barHeight = (activity / maxActivity) * activityBarHeight * 0.9; // 90% of max height for better visibility
					ctx.fillRect(
						x,
						activityBarY + activityBarHeight - barHeight,
						1,
						barHeight,
					);
				}
			}
			ctx.globalAlpha = 1.0;
		}
	} else {
		const maxActivity = Math.max(
			Math.max(...Array.from(firstPartyActivity.values()), 1),
			Math.max(...Array.from(thirdPartyActivity.values()), 1),
		);
		if (showFirstParty) {
			ctx.fillStyle = '#a3d8c1';
			for (let x = 0; x < width; x++) {
				const activity = firstPartyActivity.get(x) || 0;
				if (activity > 0) {
					const barHeight = (activity / maxActivity) * activityBarHeight * 0.9; // 90% of max height for better visibility
					ctx.fillRect(
						x,
						activityBarY + activityBarHeight - barHeight,
						1,
						barHeight,
					);
				}
			}
		}

		// Draw third party activity (merino) if enabled
		if (showThirdParty) {
			ctx.fillStyle = '#d9c7ae';
			for (let x = 0; x < width; x++) {
				const activity = thirdPartyActivity.get(x) || 0;
				if (activity > 0) {
					const barHeight = (activity / maxActivity) * activityBarHeight * 0.9; // 90% of max height for better visibility
					// If first party is also shown, draw third party on top with some transparency
					if (showFirstParty) {
						ctx.globalAlpha = 0.7;
					}
					ctx.fillRect(
						x,
						activityBarY + activityBarHeight - barHeight,
						1,
						barHeight,
					);
					ctx.globalAlpha = 1.0;
				}
			}
		}
	}

	// Draw milestone track if enabled
	if (showMilestones && milestones) {
		// Position milestone track below the activity bar
		const milestoneTrackY = activityBarY + activityBarHeight;
		renderMilestoneTrack(
			ctx,
			milestones,
			startTime,
			endTime,
			width,
			milestoneTrackY,
		);
	}

	drawLegends(
		ctx,
		width,
		height,
		true,
		showFirstParty,
		showThirdParty,
		showByAssetType,
	);
}
