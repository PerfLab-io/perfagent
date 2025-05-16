'use client';

import { useRef, useState, useEffect, memo, useCallback } from 'react';

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
import type { TraceWindowMicro } from '@perflab/trace_engine/models/trace/types/Timing';
import { TraceAnalysis } from '@/lib/trace';
import useSWR from 'swr';

const getNetworkActivityUpToLCPEvent = (
	traceAnalysis: TraceAnalysis,
	selectedNavigation: string,
):
	| {
			networkRequests: SyntheticNetworkRequest[];
			lcpNetworkRequest?: SyntheticNetworkRequest;
			mainFrameOrigin: string;
			navigationBounds: TraceWindowMicro;
			loadTimeMetrics: PageLoadEvent[];
	  }
	| undefined => {
	const {
		PageLoadMetrics: { allMarkerEvents: loadTimeMetrics },
	} = traceAnalysis.parsedTrace;

	const insights = traceAnalysis.insights.get(selectedNavigation);
	const LCPEvent = loadTimeMetrics.find(
		(metric) => metric.name === 'largestContentfulPaint::Candidate',
	);

	if (!insights || !LCPEvent) return undefined;

	const navigationBounds = insights.bounds;
	const networkRequestsTillLCP =
		traceAnalysis.parsedTrace.NetworkRequests.byTime.filter((nE) => {
			const nETotal = nE.ts + nE.dur;
			// ensure that the events are from the starting point of the selected navigation
			return nE.ts >= (navigationBounds.min || 0) && nETotal < LCPEvent.ts;
		});

	const mainFrameOrigin = new URL(
		networkRequestsTillLCP.at(-1)?.args.data.requestingFrameUrl || '',
	);

	const lcpNetworkRequest = insights.model.LCPDiscovery.relatedEvents
		?.values()
		// @ts-ignore The type is a mess on this one
		.find((_e) => _e.name === 'SyntheticNetworkRequest') as
		| SyntheticNetworkRequest
		| undefined;

	return {
		networkRequests: networkRequestsTillLCP,
		lcpNetworkRequest,
		mainFrameOrigin: mainFrameOrigin.origin,
		navigationBounds,
		loadTimeMetrics,
	};
};

export interface NetworkActivityCompactCanvasProps {
	networkData?: SyntheticNetworkRequest[];
	firstPartyOrigin?: string;
	width?: number;
	height?: number;
	className?: string;
	initialViewState?: Partial<NetworkViewState>;
	loadTimeMetrics?: PageLoadEvent[];
}

export const NetworkActivityCompactCanvas = memo(
	function CompactCanvasComponent({
		networkData,
		width = 1200,
		height = 300,
		initialViewState,
		firstPartyOrigin,
		loadTimeMetrics,
	}: NetworkActivityCompactCanvasProps) {
		const { data: traceAnalysis } = useSWR<TraceAnalysis | null>(
			'trace-analysis',
			null,
			{
				fallbackData: null,
			},
		);
		const { data: selectedNavigation } = useSWR<string | null>(
			'navigation-id',
			null,
			{
				fallbackData: null,
			},
		);
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
			firstPartyOrigin: firstPartyOrigin || '',
			loadTimeMetrics,
		});

		// Calculate actual canvas height based on mode and whether milestones are shown
		const canvasHeight =
			COMPACT_MODE_HEIGHT +
			(viewState.showMilestones ? MILESTONE_TRACK_HEIGHT : 0);

		const _processNetworkData = useCallback(
			(
				_networkData: SyntheticNetworkRequest[],
				_viewState?: Partial<NetworkViewState>,
			) => {
				const processed = processNetworkData(_networkData);
				setProcessedData(processed);

				// Calculate visible depth count based on available height
				const availableHeight =
					height - TIMESCALE_HEIGHT - LEGEND_HEIGHT - MILESTONE_TRACK_HEIGHT;
				const visibleDepths = Math.floor(
					availableHeight / NETWORK_ENTRY_HEIGHT,
				);

				// Initialize view state to show the entire timeline
				setViewState((prev) => ({
					...prev,
					startTime:
						_viewState?.startTime !== undefined
							? _viewState.startTime
							: viewState.startTime,
					endTime:
						_viewState?.endTime !== undefined
							? _viewState.endTime
							: viewState.endTime,
					isCompact: true,
					topDepth:
						_viewState?.topDepth !== undefined ? _viewState.topDepth : 0,
					visibleDepthCount:
						_viewState?.visibleDepthCount !== undefined
							? _viewState.visibleDepthCount
							: Math.max(10, visibleDepths),
					showFirstParty:
						_viewState?.showFirstParty !== undefined
							? _viewState.showFirstParty
							: true,
					showThirdParty:
						_viewState?.showThirdParty !== undefined
							? _viewState.showThirdParty
							: true,
					showMilestones:
						_viewState?.showMilestones !== undefined
							? _viewState.showMilestones
							: true,
					showByAssetType:
						_viewState?.showByAssetType !== undefined
							? _viewState.showByAssetType
							: false,
					firstPartyOrigin:
						_viewState?.firstPartyOrigin !== undefined
							? _viewState.firstPartyOrigin
							: firstPartyOrigin || '',
					loadTimeMetrics:
						_viewState?.loadTimeMetrics !== undefined
							? _viewState.loadTimeMetrics
							: loadTimeMetrics,
				}));
			},
			[networkData, height],
		);

		// Process network data props
		useEffect(() => {
			if (!networkData) return;

			_processNetworkData(networkData, initialViewState);
		}, [networkData, initialViewState, _processNetworkData]);

		// Process network data from trace analysis, only if networkData is not provided
		useEffect(() => {
			if (networkData || !traceAnalysis || !selectedNavigation) return;

			const networkActivityUpToLCPEvent = getNetworkActivityUpToLCPEvent(
				traceAnalysis,
				selectedNavigation,
			);

			if (!networkActivityUpToLCPEvent) return;

			_processNetworkData(networkActivityUpToLCPEvent.networkRequests, {
				...initialViewState,
				startTime: networkActivityUpToLCPEvent.navigationBounds.min,
				endTime: networkActivityUpToLCPEvent.lcpNetworkRequest
					? ((networkActivityUpToLCPEvent.lcpNetworkRequest.ts +
							networkActivityUpToLCPEvent.lcpNetworkRequest.dur +
							800000) as number)
					: networkActivityUpToLCPEvent.navigationBounds.max,
				firstPartyOrigin: networkActivityUpToLCPEvent.mainFrameOrigin,
				loadTimeMetrics: networkActivityUpToLCPEvent.loadTimeMetrics,
			});
		}, [
			traceAnalysis,
			selectedNavigation,
			_processNetworkData,
			initialViewState,
		]);

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
				viewState.firstPartyOrigin,
				viewState.loadTimeMetrics,
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
