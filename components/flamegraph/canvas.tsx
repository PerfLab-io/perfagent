'use client';

import { useRef, useState, useEffect } from 'react';
import type {
	TraceEvent,
	ProcessedTrace,
	ViewState,
	Annotation,
	InteractionEvent,
} from '@/components/flamegraph/types';
import {
	INTERACTIONS_ANNOTATIONS_HEIGHT,
	INTERACTIONS_TRACK_HEIGHT,
	TIMESCALE_HEIGHT,
} from '@/components/flamegraph/types';
import {
	drawTimescale,
	renderFlameGraph,
} from '@/components/flamegraph/renderer';
import {
	renderInteractionsTrack,
	renderTaskThresholds,
} from '@/components/flamegraph/interactions-renderer';
import { renderAnnotations } from '@/components/flamegraph/annotations';
import { processTraceData } from './trace-processor';

export interface FlameGraphCanvasProps {
	traceData?: TraceEvent[];
	width?: number;
	height?: number;
	className?: string;
	annotations?: Annotation[];
	interactions?: InteractionEvent[];
	timeline: {
		min: number;
		max: number;
		range: number;
	};
	startTime?: number;
	endTime?: number;
}

export const renderFlameGraphCanvas = (options: {
	ctx: CanvasRenderingContext2D;
	width: number;
	height: number;
	viewState: ViewState;
	processedData: ProcessedTrace | null;
	showInteractions: boolean;
	showAnnotations: boolean;
	interactions?: InteractionEvent[];
	annotations?: Annotation[];
	selectedAnnotation?: Annotation | null;
}) => {
	const {
		ctx,
		width,
		height,
		viewState,
		processedData,
		showInteractions,
		showAnnotations,
		interactions,
		annotations,
		selectedAnnotation,
	} = options;
	// Clear canvas
	ctx.clearRect(0, 0, width, height);
	// Draw timescale as the first element

	drawTimescale(ctx, width, height, viewState.startTime, viewState.endTime);

	// Render the flamegraph with current view state
	if (processedData) {
		renderFlameGraph(ctx, processedData, {
			width,
			height,
			viewState,
		});
	}
	// Render interactions track if enabled
	if (showInteractions) {
		renderInteractionsTrack(ctx, interactions ?? [], viewState, width);
	}
	// Render task threshold indicators
	renderTaskThresholds(
		ctx,
		processedData?.frames ?? [],
		viewState,
		width,
		height,
	);

	// Render annotations if enabled
	if (showAnnotations && processedData) {
		renderAnnotations(
			ctx,
			annotations ?? [],
			viewState,
			{ width, height },
			processedData.frameMap,
			selectedAnnotation?.id,
			// Add offset for interactions track
			INTERACTIONS_TRACK_HEIGHT,
		);
	}
};

// Add constants for vertical navigation
const ROW_HEIGHT = 24; // Height of each row in pixels

export function FlameGraphCanvas({
	traceData,
	width = 1200,
	height = 400,
	annotations,
	interactions,
	timeline,
	startTime,
	endTime,
}: FlameGraphCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [processedData, setProcessedData] = useState<ProcessedTrace | null>(
		null,
	);

	const [showAnnotations, setShowAnnotations] = useState(true);
	const [showInteractions, setShowInteractions] = useState(true);
	const [selectedAnnotation, setSelectedAnnotation] =
		useState<Annotation | null>(null);
	const [base64IMG, setBase64IMG] = useState<string | undefined>(undefined);

	// View state represents the visible portion of the timeline
	const [viewState, setViewState] = useState<ViewState>({
		startTime: startTime ? startTime / 1000 : 0,
		endTime: endTime ? endTime / 1000 : timeline.range / 1000,
		topDepth: 0,
		visibleDepthCount: 0,
	});
	const canvasHeight = processedData
		? height
		: INTERACTIONS_TRACK_HEIGHT +
			INTERACTIONS_ANNOTATIONS_HEIGHT +
			TIMESCALE_HEIGHT;

	useEffect(() => {
		if (!traceData) return;
		const processed = processTraceData(traceData);
		setProcessedData(processed);

		// Initialize view state to show the entire timeline
		setViewState({
			startTime: viewState.startTime,
			endTime: viewState.endTime,
			topDepth: 0,
			// Subtract timescale and interactions track height from available height
			visibleDepthCount: Math.min(
				processed.maxDepth + 1,
				Math.floor(
					(height - TIMESCALE_HEIGHT - INTERACTIONS_TRACK_HEIGHT) / ROW_HEIGHT,
				),
			),
		});
	}, [traceData, height]);

	useEffect(() => {
		setViewState({
			startTime: startTime ? startTime / 1000 : 0,
			endTime: endTime ? endTime / 1000 : timeline.range / 1000,
			topDepth: 0,
			visibleDepthCount: 0,
		});
	}, [startTime, endTime, timeline]);

	// Render the flamegraph
	useEffect(() => {
		if (!canvasRef.current) return;

		const ctx = canvasRef.current.getContext('2d');
		if (!ctx) return;

		renderFlameGraphCanvas({
			ctx,
			width,
			height,
			viewState,
			processedData,
			showInteractions,
			showAnnotations,
			interactions,
			annotations,
			selectedAnnotation,
		});

		const base64IMG = canvasRef.current.toDataURL('image/png');
		setBase64IMG(base64IMG);
	}, [
		processedData,
		timeline,
		width,
		height,
		viewState,
		showAnnotations,
		showInteractions,
		annotations,
		interactions,
		selectedAnnotation,
	]);

	return (
		<div className="relative">
			<canvas
				ref={canvasRef}
				width={width}
				height={canvasHeight}
				className="border-perfagent-border w-full rounded-md border bg-white"
				style={{
					cursor: 'default',
					display: 'none',
				}}
			/>
			<img src={base64IMG} alt="Flamegraph" />
		</div>
	);
}
