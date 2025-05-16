'use client';

import { useRef, useState, useEffect, useCallback, memo } from 'react';
import type {
	ProcessedTrace,
	ViewState,
	Annotation,
	InteractionEvent,
} from '@/components/flamegraph/types';
import {
	INTERACTIONS_ANNOTATIONS_HEIGHT,
	INTERACTIONS_TRACK_HEIGHT,
	TIMESCALE_HEIGHT,
	FrameNode,
} from '@/components/flamegraph/types';
import {
	drawTimescale,
	renderFlameGraph,
} from '@/components/flamegraph/renderer';
import { generateRandomColor } from '@/components/flamegraph/trace-processor';
import { renderInteractionsTrack } from '@/components/flamegraph/interactions-renderer';
import { renderAnnotations } from '@/components/flamegraph/annotations';
import { debounce } from '@/lib/utils';
import {
	Event,
	ProcessID,
	ThreadID,
} from '@perflab/trace_engine/models/trace/types/TraceEvents';
import { type Micro } from '@perflab/trace_engine/models/trace/types/Timing';
import { AICallTree } from '@perflab/trace_engine/panels/timeline/utils/AICallTree';
import { StandaloneCallTreeContext } from '@perflab/trace_engine/panels/ai_assistance/standalone';
import { walkTreeFromEntry } from '@perflab/trace_engine/models/trace/helpers/TreeHelpers';
import { microToMilli } from '@perflab/trace_engine/models/trace/helpers/Timing';
import useSWR from 'swr';
import { TraceAnalysis } from '@/lib/trace';

export interface FlameGraphCanvasProps {
	searchEvent?: {
		pid: number;
		tid: number;
		min: number;
		max: number;
		range: number;
	};
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
	processedTrace?: ProcessedTrace;
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
	// renderTaskThresholds(
	// 	ctx,
	// 	processedData?.frames ?? [],
	// 	viewState,
	// 	width,
	// 	height,
	// );

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
			interactions ? INTERACTIONS_TRACK_HEIGHT : 0,
		);
	}
};

// Add constants for vertical navigation
const ROW_HEIGHT = 24; // Height of each row in pixels

export const FlameGraphCanvas = memo(function FlameGraphCanvas({
	searchEvent,
	width = 1200,
	height = 400,
	annotations,
	interactions,
	timeline,
	startTime,
	endTime,
	processedTrace,
}: FlameGraphCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const { data: traceAnalysis } = useSWR<TraceAnalysis | null>(
		'trace-analysis',
		null,
		{
			fallbackData: null,
		},
	);

	const [processedData, setProcessedData] = useState<ProcessedTrace | null>(
		null,
	);

	const [showAnnotations, setShowAnnotations] = useState(true);
	const [showInteractions, setShowInteractions] = useState(true);
	const [selectedAnnotation, setSelectedAnnotation] =
		useState<Annotation | null>(null);
	const [base64IMG, setBase64IMG] = useState<string | undefined>(undefined);
	const [processedAnnotations, setProcessedAnnotations] = useState<
		Annotation[]
	>(annotations || []);

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

	const _update = useCallback(
		debounce((processedTrace: ProcessedTrace) => {
			setProcessedData(processedTrace);
		}, 300),
		[setProcessedData],
	);

	useEffect(() => {
		if (!searchEvent || !traceAnalysis) return;

		// Process the trace events for the AI call tree
		requestAnimationFrame(() => {
			const timerangeCallTree = AICallTree.fromTimeOnThread({
				thread: {
					pid: searchEvent.pid as ProcessID,
					tid: searchEvent.tid as ThreadID,
				},
				bounds: {
					min: searchEvent.min as Micro,
					max: searchEvent.max as Micro,
					range: searchEvent.range as Micro,
				},
				parsedTrace: traceAnalysis.parsedTrace,
			});

			if (!timerangeCallTree?.rootNode.event) {
				throw new Error('Failed to create timerange call tree');
			}

			const aiCallTree = AICallTree.fromEvent(
				timerangeCallTree.rootNode.event,
				traceAnalysis.parsedTrace,
			);

			// Grab the longest function call subtree to render an annotation
			const longestCall = timerangeCallTree.rootNode.events
				.toSorted((entry, entry2) => (entry2.dur || 0) - (entry.dur || 0))
				.filter((entry) => entry.name === 'FunctionCall')
				.at(0);

			const annotationStart = (longestCall?.ts || 0) as Micro;
			const annotationEnd = (longestCall?.dur || 0) + annotationStart;

			const annotation = {
				id: 'processed-1',
				type: 'highlight',
				startTime: microToMilli(annotationStart) / 1000,
				endTime: microToMilli(annotationEnd as Micro) / 1000,
				label: 'Longest subtree',
				color: '#e8c4d4',
			} as Annotation;

			setProcessedAnnotations([...(annotations || []), annotation]);

			if (!aiCallTree) {
				throw new Error('Failed to create AI call tree');
			}

			const processedTrace: ProcessedTrace = {
				startTime: microToMilli(
					(timerangeCallTree.rootNode.event.ts || 0) as Micro,
				),
				endTime: microToMilli(
					((timerangeCallTree.rootNode.event.ts || 0) +
						(timerangeCallTree.rootNode.event.dur || 0)) as Micro,
				),
				rootIds: [timerangeCallTree.rootNode.event.ts.toString() || ''],
				frames: [],
				maxDepth: 0,
				totalTime: 0,
				frameMap: new Map(),
				sourceScriptColors: new Map(),
			};

			setViewState({
				...viewState,
				startTime: processedTrace.startTime / 1000,
				endTime: processedTrace.endTime / 1000,
				visibleDepthCount: 40,
			});

			let depth = -1;
			let nodeId = 0;
			const sourceScriptColors = new Map<string, string>();
			let parentIds: string[] = [];

			const onFrameStart = (entry: Event) => {
				if (
					!entry.name.includes('ProfileCall') &&
					!entry.name.includes('FunctionCall') &&
					!entry.name.includes('RunMicrotasks') &&
					!entry.name.includes('RequestAnimationFrame')
				) {
					return;
				}
				depth += 1;
				const _parent = processedTrace.frames.at(-1);
				let parent = undefined;

				if (depth !== 0 && _parent) {
					parentIds.push(_parent.id);
					parent = processedTrace.frames.find(({ id }) => id === _parent.id);
				}

				let color = '#f5d76e';
				nodeId += 1;
				let id = nodeId.toString();
				let name = entry.name;
				let sourceScript = undefined;
				let cat = entry.cat;

				if (entry.name === 'ProfileCall') {
					// @ts-ignore
					sourceScript = entry.callFrame?.url;
					// @ts-ignore
					cat = entry.callFrame?.codeType?.toLowerCase();
					// @ts-ignore
					const _name: string | undefined = entry.callFrame?.functionName;
					name = _name ? _name : '(anonymous)';

					if (sourceScript) {
						// Check if we already have a color for this source script
						if (!sourceScriptColors.has(sourceScript)) {
							// Generate a new random color for this source script
							sourceScriptColors.set(sourceScript, generateRandomColor());
						}
						// Use the assigned color for this source script
						color = sourceScriptColors.get(sourceScript) || color;
					}
				}

				const frame: FrameNode = {
					color,
					id,
					value: microToMilli((entry.ts + (entry.dur || 0)) as Micro) / 1000,
					start: microToMilli(entry.ts) / 1000,
					end: microToMilli((entry.ts + (entry.dur || 0)) as Micro) / 1000,
					depth,
					name,
					parent: parentIds.at(-1),
					children: [],
					sourceScript,
					cat,
					args: entry.args,
					included:
						entry.name.includes('ProfileCall') ||
						entry.name.includes('FunctionCall') ||
						entry.name.includes('RunMicrotasks') ||
						entry.name.includes('RequestAnimationFrame'),
				};

				parent?.children.push(frame.id.toString());

				processedTrace.frames.push(frame);
				processedTrace.maxDepth =
					depth > processedTrace.maxDepth ? depth : processedTrace.maxDepth;
				processedTrace.sourceScriptColors = sourceScriptColors;
			};

			const onFrameEnd = (entry: Event) => {
				if (
					!entry.name.includes('ProfileCall') &&
					!entry.name.includes('FunctionCall') &&
					!entry.name.includes('RunMicrotasks') &&
					!entry.name.includes('RequestAnimationFrame')
				) {
					return;
				}
				depth -= 1;
				parentIds.pop();

				_update(processedTrace);
			};

			walkTreeFromEntry(
				traceAnalysis.parsedTrace.Renderer.entryToNode,
				timerangeCallTree.rootNode.event,
				onFrameStart,
				onFrameEnd,
			);
		});
	}, [searchEvent]);

	useEffect(() => {
		if (!processedTrace) return;

		setProcessedData(processedTrace);
		// Initialize view state to show the entire timeline
		setViewState({
			startTime: viewState.startTime,
			endTime: viewState.endTime,
			topDepth: 0,
			// Subtract timescale and interactions track height from available height
			visibleDepthCount: Math.min(
				processedTrace.maxDepth + 1,
				Math.floor(
					(height -
						TIMESCALE_HEIGHT -
						(interactions ? INTERACTIONS_TRACK_HEIGHT : 0)) /
						ROW_HEIGHT,
				),
			),
		});
	}, [processedTrace]);

	useEffect(() => {
		setViewState({
			startTime: startTime ? startTime / 1000 : 0,
			endTime: endTime ? endTime / 1000 : timeline.range / 1000,
			topDepth: 0,
			visibleDepthCount: Math.min(
				(processedTrace?.maxDepth || 0) + 1,
				Math.floor(
					(height -
						TIMESCALE_HEIGHT -
						(interactions ? INTERACTIONS_TRACK_HEIGHT : 0)) /
						ROW_HEIGHT,
				),
			),
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
			processedData: processedTrace || processedData,
			showInteractions,
			showAnnotations,
			interactions,
			annotations: processedAnnotations,
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
		processedAnnotations,
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
});
