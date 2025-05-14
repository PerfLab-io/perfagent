'use client';

import { useRef, useState, useEffect, memo } from 'react';

import {
	type NetworkViewState,
	type ProcessedNetworkData,
	COMPACT_MODE_HEIGHT,
	NETWORK_ENTRY_HEIGHT,
	TIMESCALE_HEIGHT,
	LEGEND_HEIGHT,
	MILESTONE_TRACK_HEIGHT,
} from './types';
import { processNetworkData } from './mock-data';
import { renderCompactMode } from './compact-renderer';
import {
	PageLoadEvent,
	SyntheticNetworkRequest,
} from '@perflab/trace_engine/models/trace/types/TraceEvents';

export interface NetworkActivityCanvasProps {
	networkData: SyntheticNetworkRequest[];
	firstPartyOrigin: string;
	width?: number;
	height?: number;
	className?: string;
	initialViewState?: Partial<NetworkViewState>;
	loadTimeMetrics?: PageLoadEvent[];
}

// Increase the expanded mode minimum height
// const EXPANDED_MODE_MIN_HEIGHT = 400; // Changed from 150 to 400

export const NetworkActivityCompactCanvas = memo(
	function CompactCanvasComponent({
		networkData,
		width = 1200,
		height = 300,
		initialViewState,
		firstPartyOrigin,
		loadTimeMetrics,
	}: NetworkActivityCanvasProps) {
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const [processedData, setProcessedData] =
			useState<ProcessedNetworkData | null>(null);
		const [base64IMG, setBase64IMG] = useState<string | undefined>(undefined);
		// View state represents the visible portion of the timeline
		const [viewState, setViewState] = useState<NetworkViewState>({
			startTime: 0,
			endTime: 0,
			isCompact: true,
			topDepth: 0,
			visibleDepthCount: 0,
			showFirstParty: true,
			showThirdParty: true,
			showMilestones: true, // Show milestones by default
			showByAssetType: false,
		});

		// Calculate actual canvas height based on mode and whether milestones are shown
		const canvasHeight =
			COMPACT_MODE_HEIGHT +
			(viewState.showMilestones ? MILESTONE_TRACK_HEIGHT : 0);

		// Process network data
		useEffect(() => {
			const processed = processNetworkData(networkData);
			setProcessedData(processed);

			// Calculate visible depth count based on available height
			const availableHeight =
				height -
				TIMESCALE_HEIGHT -
				LEGEND_HEIGHT -
				(viewState.showMilestones ? MILESTONE_TRACK_HEIGHT : 0);
			const visibleDepths = Math.floor(availableHeight / NETWORK_ENTRY_HEIGHT);

			// Initialize view state to show the entire timeline
			setViewState((prev) => ({
				...prev,
				startTime:
					initialViewState?.startTime !== undefined
						? initialViewState.startTime
						: viewState.startTime,
				endTime:
					initialViewState?.endTime !== undefined
						? initialViewState.endTime
						: viewState.endTime,
				isCompact: true,
				topDepth:
					initialViewState?.topDepth !== undefined
						? initialViewState.topDepth
						: 0,
				visibleDepthCount:
					initialViewState?.visibleDepthCount !== undefined
						? initialViewState.visibleDepthCount
						: Math.max(10, visibleDepths),
				showFirstParty:
					initialViewState?.showFirstParty !== undefined
						? initialViewState.showFirstParty
						: true,
				showThirdParty:
					initialViewState?.showThirdParty !== undefined
						? initialViewState.showThirdParty
						: true,
				showMilestones:
					initialViewState?.showMilestones !== undefined
						? initialViewState.showMilestones
						: true,
				showByAssetType:
					initialViewState?.showByAssetType !== undefined
						? initialViewState.showByAssetType
						: false,
			}));
		}, [networkData, initialViewState, height, viewState.showMilestones]);

		// Render the network activity canvas
		useEffect(() => {
			if (!canvasRef.current || !processedData) return;

			const ctx = canvasRef.current.getContext('2d');
			if (!ctx) return;

			// Clear canvas
			ctx.clearRect(0, 0, width, canvasHeight);

			renderCompactMode(
				ctx,
				processedData,
				viewState,
				width,
				canvasHeight,
				firstPartyOrigin,
				loadTimeMetrics,
			);

			const base64IMG = canvasRef.current.toDataURL('image/png');
			setBase64IMG(base64IMG);
		}, [processedData, width, canvasHeight, viewState]);

		return (
			<div className="relative">
				<canvas
					ref={canvasRef}
					width={width}
					height={canvasHeight}
					className="border-perfagent-border w-full rounded-md border bg-white"
					style={{
						height: `${canvasHeight}px`,
						display: 'none',
					}}
				/>
				<img src={base64IMG} alt="Network Activity" />
			</div>
		);
	},
);
