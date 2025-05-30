'use client';

import type React from 'react';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
	ZoomIn,
	ZoomOut,
	RotateCcw,
	Move,
	BookMarked,
	ArrowUp,
	ArrowDown,
} from 'lucide-react';
import type {
	TraceEvent,
	FrameNode,
	ProcessedTrace,
	ViewState,
	Annotation,
	InteractionEvent,
} from '@/components/flamegraph/types';
import {
	TIMESCALE_HEIGHT,
	INTERACTIONS_TRACK_HEIGHT,
} from '@/components/flamegraph/types';
import { processTraceData } from '@/components/flamegraph/trace-processor';
import { mockTraceData } from '@/components/flamegraph/mock-data';
import { renderFlameGraph } from '@/components/flamegraph/renderer';
import {
	renderInteractionsTrack,
	renderTaskThresholds,
	findInteractionAt,
} from '@/components/flamegraph/interactions-renderer';
import { NodeInfoPanel } from '@/components/flamegraph/node-info-panel';
import { HoverCard } from '@/components/flamegraph/hover-card';
import {
	renderAnnotations,
	findAnnotationAt,
	findAnnotationByFrameId,
} from '@/components/flamegraph/annotations';
import { AnnotationPanel } from '@/components/flamegraph/annotation-panel';
import { renderFlameGraphCanvas } from './canvas';

export interface FlameGraphProps {
	traceData?: TraceEvent[];
	width?: number;
	height?: number;
	className?: string;
	annotations?: Annotation[];
	interactions?: InteractionEvent[];
	processedTrace?: ProcessedTrace;
	timeline: {
		min: number;
		max: number;
		range: number;
	};
}

// Add a constant for minimum time range (maximum zoom level)
// This represents the smallest time range we allow (0.001ms = 1 microsecond)
const MIN_TIME_RANGE = 0.001;

// Add constants for vertical navigation
const DEPTH_STEP = 1; // Number of rows to move when using arrow buttons
const ROW_HEIGHT = 24; // Height of each row in pixels

export function FlameGraph({
	traceData = mockTraceData,
	width = 1200,
	height = 400,
	className = '',
	annotations,
	interactions,
	processedTrace,
	timeline,
}: FlameGraphProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [processedData, setProcessedData] = useState<ProcessedTrace | null>(
		null,
	);
	const [selectedNode, setSelectedNode] = useState<FrameNode | null>(null);
	const [hoverNode, setHoverNode] = useState<FrameNode | null>(null);
	const [hoverPosition, setHoverPosition] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [hasDragged, setHasDragged] = useState(false); // Track if any dragging occurred
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
	const [showAnnotations, setShowAnnotations] = useState(true);
	const [showInteractions, setShowInteractions] = useState(true);
	const [selectedAnnotation, setSelectedAnnotation] =
		useState<Annotation | null>(null);
	const [selectedInteraction, setSelectedInteraction] =
		useState<InteractionEvent | null>(null);

	// View state represents the visible portion of the timeline
	const [viewState, setViewState] = useState<ViewState>({
		startTime: 0,
		endTime: 0,
		topDepth: 0,
		visibleDepthCount: 0,
	});

	// Function to zoom to a specific time range
	const zoomToTimeRange = useCallback(
		(startTime: number, endTime: number) => {
			if (!processedData) return;

			// Ensure the time range is valid
			if (startTime >= endTime) return;

			// Add a small padding (5% on each side) for better visibility
			const timeRange = endTime - startTime;
			const padding = timeRange * 0.05;

			const paddedStartTime = Math.max(
				processedData.startTime,
				startTime - padding,
			);
			const paddedEndTime = Math.min(processedData.endTime, endTime + padding);

			// Update view state to zoom to the specified time range
			setViewState((prev) => ({
				...prev,
				startTime: paddedStartTime,
				endTime: paddedEndTime,
			}));
		},
		[processedData],
	);

	// Process trace data
	// useEffect(() => {
	// 	const processed = processTraceData(traceData);
	// 	setProcessedData(processed);

	// 	// Initialize view state to show the entire timeline
	// 	setViewState({
	// 		startTime: processed.startTime,
	// 		endTime: processed.endTime,
	// 		topDepth: 0,
	// 		// Subtract timescale and interactions track height from available height
	// 		visibleDepthCount: Math.min(
	// 			processed.maxDepth + 1,
	// 			Math.floor(
	// 				(height - TIMESCALE_HEIGHT - INTERACTIONS_TRACK_HEIGHT) / ROW_HEIGHT,
	// 			),
	// 		),
	// 	});
	// }, [traceData, height]);

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
					(height - TIMESCALE_HEIGHT - INTERACTIONS_TRACK_HEIGHT) / ROW_HEIGHT,
				),
			),
		});
	}, [processedTrace]);

	// Render the flamegraph
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
			annotations,
			selectedAnnotation,
		});
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

	// Get accurate canvas coordinates from a mouse event
	const getCanvasCoordinates = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
			if (!canvasRef.current) return { x: 0, y: 0 };

			const canvas = canvasRef.current;
			const rect = canvas.getBoundingClientRect();

			// Calculate the scale factor between the CSS size and the canvas logical size
			const scaleX = canvas.width / rect.width;
			const scaleY = canvas.height / rect.height;

			// Get the position within the canvas element
			const x = (e.clientX - rect.left) * scaleX;
			const y = (e.clientY - rect.top) * scaleY;

			return { x, y };
		},
		[],
	);

	// Handle mouse down for dragging
	const handleMouseDown = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			// Skip dragging if we're at the initial resolution (full view  => {
			// Skip dragging if we're at the initial resolution (full view) and time is fully visible
			if (
				processedData &&
				viewState.startTime === processedData.startTime &&
				viewState.endTime === processedData.endTime &&
				viewState.topDepth === 0
			) {
				return;
			}

			const { x, y } = getCanvasCoordinates(e);
			setIsDragging(true);
			setHasDragged(false); // Reset drag tracking on mouse down
			setDragStart({ x, y });
		},
		[getCanvasCoordinates, processedData, viewState],
	);

	// Convert canvas coordinates to time and depth
	const canvasToTimeAndDepth = useCallback(
		(
			x: number,
			y: number,
		): {
			time: number;
			depth: number;
			area: 'timescale' | 'interactions' | 'flamegraph';
		} => {
			if (!processedData) {
				return { time: 0, depth: 0, area: 'flamegraph' };
			}

			const timeRange = viewState.endTime - viewState.startTime;
			const time = viewState.startTime + (x / width) * timeRange;

			// Determine which area was clicked
			let area: 'timescale' | 'interactions' | 'flamegraph' = 'flamegraph';

			if (y < TIMESCALE_HEIGHT) {
				area = 'timescale';
			} else if (y < TIMESCALE_HEIGHT + INTERACTIONS_TRACK_HEIGHT) {
				area = 'interactions';
				return { time, depth: -1, area };
			}

			// Adjust y coordinate to account for timescale and interactions track
			const adjustedY = y - TIMESCALE_HEIGHT - INTERACTIONS_TRACK_HEIGHT;

			// Calculate depth based on adjusted Y
			const depth = viewState.topDepth + Math.floor(adjustedY / ROW_HEIGHT);

			return { time, depth, area };
		},
		[processedData, viewState, width],
	);

	// Convert time and depth to canvas coordinates
	const timeAndDepthToCanvas = useCallback(
		(time: number, depth: number): { x: number; y: number } => {
			if (!processedData) {
				return { x: 0, y: 0 };
			}

			const timeRange = viewState.endTime - viewState.startTime;
			const x = ((time - viewState.startTime) / timeRange) * width;
			// Add offset for timescale and interactions track
			const y =
				(depth - viewState.topDepth) * ROW_HEIGHT +
				TIMESCALE_HEIGHT +
				INTERACTIONS_TRACK_HEIGHT;

			return { x, y };
		},
		[processedData, viewState, width],
	);

	// Find frame at a specific time and depth
	const findFrameAt = useCallback(
		(time: number, depth: number): FrameNode | null => {
			if (!processedData) return null;

			return (
				processedData.frames.find(
					(frame) =>
						frame.depth === depth && time >= frame.start && time <= frame.end,
				) || null
			);
		},
		[processedData],
	);

	// Handle mouse move for dragging and hovering
	const handleMouseMove = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			if (!canvasRef.current || !processedData) return;

			const { x, y } = getCanvasCoordinates(e);

			// Handle dragging - update view state
			if (isDragging) {
				const dx = x - dragStart.x;
				const dy = y - dragStart.y;

				// Check if we've moved enough to consider this a drag
				// This prevents tiny movements from being considered drags
				const dragThreshold = 3; // pixels
				if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
					setHasDragged(true); // Mark that dragging has occurred
				}

				// Convert dx to time delta
				const timeRange = viewState.endTime - viewState.startTime;
				const timeDelta = (dx / width) * timeRange;

				// Calculate new time bounds
				let newStartTime = viewState.startTime - timeDelta;
				let newEndTime = viewState.endTime - timeDelta;

				// Ensure we don't go beyond the trace bounds
				if (newStartTime < processedData.startTime) {
					const adjustment = processedData.startTime - newStartTime;
					newStartTime = processedData.startTime;
					newEndTime += adjustment;
				}

				if (newEndTime > processedData.endTime) {
					const adjustment = newEndTime - processedData.endTime;
					newEndTime = processedData.endTime;
					newStartTime -= adjustment;
				}

				// Calculate new depth bounds - improved for more accurate vertical panning
				// Convert pixel movement to depth change
				const depthDelta = dy / ROW_HEIGHT;
				let newTopDepth = viewState.topDepth - depthDelta;

				// Ensure we don't go beyond the depth bounds
				// Allow panning up to the top (depth 0)
				newTopDepth = Math.max(
					0,
					Math.min(
						newTopDepth,
						processedData.maxDepth - viewState.visibleDepthCount + 1,
					),
				);

				// Round to nearest integer to avoid fractional depths
				newTopDepth = Math.round(newTopDepth * 10) / 10;

				// Update view state
				setViewState({
					startTime: newStartTime,
					endTime: newEndTime,
					topDepth: newTopDepth,
					visibleDepthCount: viewState.visibleDepthCount,
				});

				setDragStart({ x, y });
				return;
			}

			// Handle hovering - find node under cursor
			const { time, depth, area } = canvasToTimeAndDepth(x, y);

			// Handle hovering over different areas
			if (area === 'flamegraph') {
				const node = findFrameAt(time, depth);

				if (node) {
					// Store canvas-relative coordinates for the hover card
					setHoverNode(node);
					setHoverPosition({ x, y });
				} else {
					setHoverNode(null);
					setHoverPosition(null);
				}
			} else if (area === 'interactions' && showInteractions) {
				// Handle hovering over interactions track
				const interaction = findInteractionAt(time, interactions ?? []);

				if (interaction) {
					// Could implement a hover card for interactions here
					// For now, just update cursor style
					if (canvasRef.current) {
						canvasRef.current.style.cursor = 'pointer';
					}
				} else if (canvasRef.current && !isDragging) {
					canvasRef.current.style.cursor = 'default';
				}

				// Clear frame hover state when hovering over interactions
				setHoverNode(null);
				setHoverPosition(null);
			} else {
				// Clear hover state for other areas
				setHoverNode(null);
				setHoverPosition(null);

				// Reset cursor
				if (canvasRef.current && !isDragging) {
					canvasRef.current.style.cursor = 'default';
				}
			}
		},
		[
			isDragging,
			dragStart,
			viewState,
			processedData,
			width,
			getCanvasCoordinates,
			canvasToTimeAndDepth,
			findFrameAt,
			interactions,
			showInteractions,
		],
	);

	// Handle mouse up to end dragging
	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
		// Note: We don't reset hasDragged here, as we need it for the click handler
	}, []);

	// Handle mouse leave to end dragging and hide hover
	const handleMouseLeave = useCallback(() => {
		setIsDragging(false);
		setHasDragged(false); // Reset drag tracking when mouse leaves
		setHoverNode(null);
		setHoverPosition(null);
	}, []);

	// Handle click to select a node, annotation, or interaction
	const handleClick = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			if (!canvasRef.current || !processedData) return;

			// Skip click handling if dragging occurred
			if (hasDragged) {
				setHasDragged(false); // Reset for next interaction
				return;
			}

			const { x, y } = getCanvasCoordinates(e);
			const { time, depth, area } = canvasToTimeAndDepth(x, y);

			// Handle clicks in different areas
			if (area === 'interactions' && showInteractions) {
				// Handle click on interactions track
				const interaction = findInteractionAt(time, interactions ?? []);

				if (interaction) {
					setSelectedInteraction(interaction);
					// Clear other selections
					setSelectedNode(null);
					setSelectedAnnotation(null);

					// Optionally zoom to the interaction time range
					const startMs = interaction.ts / 1000000; // Convert ns to ms
					const endMs = startMs + interaction.dur;
					zoomToTimeRange(startMs, endMs);
				} else {
					setSelectedInteraction(null);
				}

				setHasDragged(false);
				return;
			}

			// Check if we clicked on an annotation (if annotations are visible)
			if (showAnnotations && area === 'flamegraph') {
				// First check for highlight annotations (time-based)
				const clickedHighlightAnnotation = findAnnotationAt(
					time,
					annotations ?? [],
				);

				if (clickedHighlightAnnotation) {
					setSelectedAnnotation(clickedHighlightAnnotation);

					// If the annotation is already selected, zoom to its time range
					if (
						selectedAnnotation?.id === clickedHighlightAnnotation.id &&
						clickedHighlightAnnotation.type === 'highlight'
					) {
						zoomToTimeRange(
							clickedHighlightAnnotation.startTime,
							clickedHighlightAnnotation.endTime,
						);
					}

					// Reset other selections
					setSelectedNode(null);
					setSelectedInteraction(null);
					setHasDragged(false);
					return;
				}
			}

			// Ignore clicks in the timescale area
			if (area === 'timescale') return;

			// Handle frame selection in flamegraph area
			if (area === 'flamegraph') {
				const node = findFrameAt(time, depth);

				if (node) {
					setSelectedNode(node);

					// Check if there's a label or link annotation associated with this frame
					if (showAnnotations) {
						const frameAnnotation = findAnnotationByFrameId(
							node.id,
							annotations ?? [],
						);
						if (frameAnnotation) {
							setSelectedAnnotation(frameAnnotation);
						} else {
							setSelectedAnnotation(null);
						}
					} else {
						setSelectedAnnotation(null);
					}

					// Clear interaction selection
					setSelectedInteraction(null);
				} else {
					setSelectedNode(null);
					setSelectedAnnotation(null);
				}
			}

			// For debugging
			if (process.env.NODE_ENV === 'development') {
				console.log('Click at:', { x, y, time, depth, area });
				console.log('Found node:', selectedNode);
				console.log('Found interaction:', selectedInteraction);
			}

			// Reset drag tracking after handling click
			setHasDragged(false);
		},
		[
			processedData,
			hasDragged,
			getCanvasCoordinates,
			canvasToTimeAndDepth,
			findFrameAt,
			showAnnotations,
			showInteractions,
			annotations,
			interactions,
			selectedAnnotation,
			zoomToTimeRange,
		],
	);

	// Handle mouse wheel for zooming
	const handleWheel = useCallback(
		(e: React.WheelEvent<HTMLCanvasElement>) => {
			// Prevent default scrolling behavior immediately
			e.preventDefault();

			if (!canvasRef.current || !processedData) return;

			const { x } = getCanvasCoordinates(e);

			// Convert mouse position to time
			const timeRange = viewState.endTime - viewState.startTime;

			// Check if we're already at maximum zoom and trying to zoom in further
			if (timeRange <= MIN_TIME_RANGE && e.deltaY < 0) {
				return; // Prevent further zooming in
			}

			// Determine zoom direction and factor
			const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9; // Zoom out (>1) or in (<1)

			setViewState((prev) => {
				// Calculate new time range
				let newTimeRange = timeRange * zoomFactor;

				// Enforce minimum time range (maximum zoom level)
				if (newTimeRange < MIN_TIME_RANGE) {
					newTimeRange = MIN_TIME_RANGE;
				}

				// Calculate how far (in percentage) the mouse is from the left edge
				const mouseTime = prev.startTime + (x / width) * timeRange;
				const mousePositionRatio = (mouseTime - prev.startTime) / timeRange;

				// Calculate new start and end times while keeping the mouse position fixed
				let newStartTime = mouseTime - mousePositionRatio * newTimeRange;
				let newEndTime = newStartTime + newTimeRange;

				// Ensure we don't go beyond the trace bounds
				if (newStartTime < processedData.startTime) {
					newStartTime = processedData.startTime;
					newEndTime = newStartTime + newTimeRange;
				}

				if (newEndTime > processedData.endTime) {
					newEndTime = processedData.endTime;
					newStartTime = Math.max(
						processedData.startTime,
						newEndTime - newTimeRange,
					);
				}

				// If zooming out would show the entire range, just reset to full view
				if (
					zoomFactor > 1 &&
					newStartTime <= processedData.startTime &&
					newEndTime >= processedData.endTime
				) {
					return {
						...prev,
						startTime: processedData.startTime,
						endTime: processedData.endTime,
					};
				}

				return {
					...prev,
					startTime: newStartTime,
					endTime: newEndTime,
				};
			});
		},
		[processedData, viewState, width, getCanvasCoordinates],
	);

	// Zoom in - decrease the visible time range
	const handleZoomIn = useCallback(() => {
		if (!processedData) return;

		setViewState((prev) => {
			// Check if we're already at maximum zoom
			const currentRange = prev.endTime - prev.startTime;
			if (currentRange <= MIN_TIME_RANGE) {
				return prev; // Don't zoom in further
			}

			// Calculate the center point for zooming
			let center: number;

			// If there's a selected node, center on it
			if (selectedNode) {
				// Use the middle of the selected frame as the center point
				center = (selectedNode.start + selectedNode.end) / 2;

				// If the selected node is not fully visible, adjust the center
				if (selectedNode.start < prev.startTime) {
					center = Math.max(
						center,
						prev.startTime + (prev.endTime - prev.startTime) * 0.25,
					);
				}
				if (selectedNode.end > prev.endTime) {
					center = Math.min(
						center,
						prev.endTime - (prev.endTime - prev.startTime) * 0.25,
					);
				}
			} else if (
				selectedAnnotation &&
				selectedAnnotation.type === 'highlight'
			) {
				// If there's a selected highlight annotation, center on it
				center =
					(selectedAnnotation.startTime + selectedAnnotation.endTime) / 2;
			} else if (selectedInteraction) {
				// If there's a selected interaction, center on it
				const startMs = selectedInteraction.ts / 1000000; // Convert ns to ms
				const endMs = startMs + selectedInteraction.dur;
				center = (startMs + endMs) / 2;
			} else {
				// Otherwise use the center of the current view
				center = (prev.startTime + prev.endTime) / 2;
			}

			// Calculate new time range (zoom in by 50%)
			const newRange = Math.max(MIN_TIME_RANGE, currentRange * 0.5);

			// Calculate new start and end times centered around the chosen center point
			const newStartTime = Math.max(
				processedData.startTime,
				center - newRange / 2,
			);
			const newEndTime = Math.min(processedData.endTime, center + newRange / 2);

			// If we hit one bound but not the other, adjust to maintain the zoom level
			const actualRange = newEndTime - newStartTime;
			if (actualRange < newRange && newStartTime === processedData.startTime) {
				// We hit the left bound, extend right if possible
				const rightExtension = newRange - actualRange;
				const adjustedEndTime = Math.min(
					processedData.endTime,
					newEndTime + rightExtension,
				);
				return {
					...prev,
					startTime: newStartTime,
					endTime: adjustedEndTime,
				};
			} else if (
				actualRange < newRange &&
				newEndTime === processedData.endTime
			) {
				// We hit the right bound, extend left if possible
				const leftExtension = newRange - actualRange;
				const adjustedStartTime = Math.max(
					processedData.startTime,
					newStartTime - leftExtension,
				);
				return {
					...prev,
					startTime: adjustedStartTime,
					endTime: newEndTime,
				};
			}

			return {
				...prev,
				startTime: newStartTime,
				endTime: newEndTime,
			};
		});
	}, [processedData, selectedNode, selectedAnnotation, selectedInteraction]);

	// Zoom out - increase the visible time range
	const handleZoomOut = useCallback(() => {
		if (!processedData) return;

		setViewState((prev) => {
			// If we're already at full range, don't change anything
			if (
				prev.startTime === processedData.startTime &&
				prev.endTime === processedData.endTime
			) {
				return prev;
			}

			// Calculate the center point for zooming
			let center: number;

			// If there's a selected node, center on it
			if (selectedNode) {
				// Use the middle of the selected frame as the center point
				center = (selectedNode.start + selectedNode.end) / 2;
			} else if (
				selectedAnnotation &&
				selectedAnnotation.type === 'highlight'
			) {
				// If there's a selected highlight annotation, center on it
				center =
					(selectedAnnotation.startTime + selectedAnnotation.endTime) / 2;
			} else if (selectedInteraction) {
				// If there's a selected interaction, center on it
				const startMs = selectedInteraction.ts / 1000000; // Convert ns to ms
				const endMs = startMs + selectedInteraction.dur;
				center = (startMs + endMs) / 2;
			} else {
				// Otherwise use the center of the current view
				center = (prev.startTime + prev.endTime) / 2;
			}

			// Calculate new time range (zoom out by 200%)
			const currentRange = prev.endTime - prev.startTime;
			const newRange = currentRange * 2;

			// Calculate new start and end times centered around the chosen center point
			let newStartTime = Math.max(
				processedData.startTime,
				center - newRange / 2,
			);
			let newEndTime = Math.min(processedData.endTime, center + newRange / 2);

			// If we hit one bound but not the other, extend the other side
			if (
				newStartTime === processedData.startTime &&
				newEndTime < processedData.endTime
			) {
				newEndTime = Math.min(processedData.endTime, newStartTime + newRange);
			} else if (
				newEndTime === processedData.endTime &&
				newStartTime > processedData.startTime
			) {
				newStartTime = Math.max(processedData.startTime, newEndTime - newRange);
			}

			// If zooming out would show the entire range, just reset to full view
			if (
				newStartTime <= processedData.startTime &&
				newEndTime >= processedData.endTime
			) {
				return {
					...prev,
					startTime: processedData.startTime,
					endTime: processedData.endTime,
				};
			}

			return {
				...prev,
				startTime: newStartTime,
				endTime: newEndTime,
			};
		});
	}, [processedData, selectedNode, selectedAnnotation, selectedInteraction]);

	// Reset view to show the entire timeline
	const handleReset = useCallback(() => {
		if (!processedData) return;

		setViewState({
			startTime: processedData.startTime,
			endTime: processedData.endTime,
			topDepth: 0,
			visibleDepthCount: Math.min(
				processedData.maxDepth + 1,
				Math.floor(
					(height - TIMESCALE_HEIGHT - INTERACTIONS_TRACK_HEIGHT) / ROW_HEIGHT,
				),
			),
		});

		setSelectedNode(null);
		setSelectedAnnotation(null);
		setSelectedInteraction(null);
	}, [processedData, height]);

	// Add functions for vertical navigation
	const handleScrollUp = useCallback(() => {
		if (!processedData) return;

		setViewState((prev) => {
			// Calculate new top depth, ensuring we don't go above 0
			const newTopDepth = Math.max(0, prev.topDepth - DEPTH_STEP);
			return {
				...prev,
				topDepth: newTopDepth,
			};
		});
	}, [processedData]);

	const handleScrollDown = useCallback(() => {
		if (!processedData) return;

		setViewState((prev) => {
			// Calculate new top depth, ensuring we don't go below the maximum depth minus visible rows
			const newTopDepth = Math.min(
				processedData.maxDepth - prev.visibleDepthCount + 1,
				prev.topDepth + DEPTH_STEP,
			);
			return {
				...prev,
				topDepth: newTopDepth,
			};
		});
	}, [processedData]);

	// Calculate zoom percentage
	const zoomPercentage = processedData
		? Math.round(
				((processedData.endTime - processedData.startTime) /
					(viewState.endTime - viewState.startTime)) *
					100,
			)
		: 100;

	// Add a new function to handle annotation clicks and update the AnnotationPanel component usage
	const handleAnnotationClick = useCallback(
		(annotation: Annotation) => {
			// Set the clicked annotation as selected
			setSelectedAnnotation(annotation);

			// Zoom to the annotation based on its type
			if (annotation.type === 'highlight') {
				// For highlight annotations, zoom to the time range
				zoomToTimeRange(annotation.startTime, annotation.endTime);
			} else if (annotation.type === 'link' && processedData) {
				// For link annotations, find both frames and zoom to include both
				const fromFrame = processedData.frameMap.get(annotation.fromFrameId);
				const toFrame = processedData.frameMap.get(annotation.toFrameId);

				if (fromFrame && toFrame) {
					// Calculate the time range that includes both frames with padding
					const minTime = Math.min(fromFrame.start, toFrame.start);
					const maxTime = Math.max(fromFrame.end, toFrame.end);

					// Add 10% padding on each side
					const timeRange = maxTime - minTime;
					const padding = timeRange * 0.1;

					zoomToTimeRange(minTime - padding, maxTime + padding);
				}
			} else if (annotation.type === 'label' && processedData) {
				// For label annotations, zoom to the frame
				const frame = processedData.frameMap.get(annotation.frameId);

				if (frame) {
					// Calculate a time range centered on the frame with padding
					const frameDuration = frame.end - frame.start;
					const padding = frameDuration * 2; // Add 200% padding for context

					zoomToTimeRange(
						Math.max(processedData.startTime, frame.start - padding),
						Math.min(processedData.endTime, frame.end + padding),
					);
				}
			}

			// Clear any selected node and interaction when selecting an annotation
			setSelectedNode(null);
			setSelectedInteraction(null);
		},
		[processedData, zoomToTimeRange],
	);

	// Define the interaction threshold in milliseconds
	const INTERACTION_THRESHOLD_MS = 16.7; // ~60 frames per second

	// Render interaction info panel
	const renderInteractionInfo = useCallback(() => {
		if (!selectedInteraction) return null;

		// Convert timestamps from nanoseconds to milliseconds
		const startTimeMs = selectedInteraction.ts / 1000000;
		const processingStartMs = selectedInteraction.processingStart / 1000000;
		const processingEndMs = selectedInteraction.processingEnd / 1000000;
		const endTimeMs = startTimeMs + selectedInteraction.dur;

		// Calculate processing time
		const processingTimeMs = processingEndMs - processingStartMs;

		// Determine if the interaction exceeds the threshold
		const exceedsThreshold = selectedInteraction.dur > INTERACTION_THRESHOLD_MS;

		return (
			<div className="space-y-2">
				<h3 className="text-perfagent-text text-lg font-medium">
					{selectedInteraction.name || 'Interaction'}
					{exceedsThreshold && (
						<span className="ml-2 text-sm font-normal text-red-500">
							(Exceeds {INTERACTION_THRESHOLD_MS}ms threshold)
						</span>
					)}
				</h3>

				<div className="grid grid-cols-2 gap-x-4 gap-y-2">
					<div className="text-perfagent-muted text-sm">Total Duration:</div>
					<div className="font-mono text-sm font-medium">
						{selectedInteraction.dur.toFixed(2)}ms
						{exceedsThreshold && ' ⚠️'}
					</div>

					<div className="text-perfagent-muted text-sm">Input Delay:</div>
					<div className="font-mono text-sm font-medium">
						{selectedInteraction.inputDelay.toFixed(2)}ms
					</div>

					<div className="text-perfagent-muted text-sm">Processing Time:</div>
					<div className="font-mono text-sm font-medium">
						{processingTimeMs.toFixed(2)}ms
					</div>

					<div className="text-perfagent-muted text-sm">
						Presentation Delay:
					</div>
					<div className="font-mono text-sm font-medium">
						{selectedInteraction.presentationDelay.toFixed(2)}ms
					</div>

					<div className="text-perfagent-muted text-sm">Start Time:</div>
					<div className="font-mono text-sm font-medium">
						{startTimeMs.toFixed(2)}ms
					</div>

					<div className="text-perfagent-muted text-sm">End Time:</div>
					<div className="font-mono text-sm font-medium">
						{endTimeMs.toFixed(2)}ms
					</div>
				</div>

				<div className="mt-2">
					<Button
						size="sm"
						variant="outline"
						onClick={() => zoomToTimeRange(startTimeMs, endTimeMs)}
						className="hover:bg-perfagent-bg bg-white"
					>
						Zoom to Interaction
					</Button>
				</div>
			</div>
		);
	}, [selectedInteraction, zoomToTimeRange]);

	// Render annotation info based on type
	const renderAnnotationInfo = useCallback(() => {
		if (!selectedAnnotation) return null;

		switch (selectedAnnotation.type) {
			case 'highlight':
				return (
					<div className="space-y-2">
						<h3 className="text-perfagent-text text-lg font-medium">
							{selectedAnnotation.label}
						</h3>
						<div className="grid grid-cols-2 gap-x-4 gap-y-2">
							<div className="text-perfagent-muted text-sm">Time Range:</div>
							<div className="font-mono text-sm font-medium">
								{selectedAnnotation.startTime.toFixed(2)}ms -{' '}
								{selectedAnnotation.endTime.toFixed(2)}ms
							</div>
							<div className="text-perfagent-muted text-sm">Duration:</div>
							<div className="font-mono text-sm font-medium">
								{(
									selectedAnnotation.endTime - selectedAnnotation.startTime
								).toFixed(2)}
								ms
							</div>
						</div>
						<div className="mt-2">
							<Button
								size="sm"
								variant="outline"
								onClick={() =>
									zoomToTimeRange(
										selectedAnnotation.startTime,
										selectedAnnotation.endTime,
									)
								}
								className="hover:bg-perfagent-bg bg-white"
							>
								Zoom to Annotation
							</Button>
						</div>
					</div>
				);

			case 'link':
				return (
					<div className="space-y-2">
						<h3 className="text-perfagent-text text-lg font-medium">
							Link Annotation
						</h3>
						<div className="grid grid-cols-2 gap-x-4 gap-y-2">
							<div className="text-perfagent-muted text-sm">Type:</div>
							<div className="text-sm font-medium">Directional Link</div>
							<div className="text-perfagent-muted text-sm">From:</div>
							<div className="font-mono text-sm font-medium">
								{selectedAnnotation.fromFrameId.split('-')[2]}
							</div>
							<div className="text-perfagent-muted text-sm">To:</div>
							<div className="font-mono text-sm font-medium">
								{selectedAnnotation.toFrameId.split('-')[2]}
							</div>
						</div>
					</div>
				);

			case 'label':
				return (
					<div className="space-y-2">
						<h3 className="text-perfagent-text text-lg font-medium">
							Label Annotation
						</h3>
						<div className="grid grid-cols-2 gap-x-4 gap-y-2">
							<div className="text-perfagent-muted text-sm">Label:</div>
							<div className="text-sm font-medium">
								{selectedAnnotation.label}
							</div>
							<div className="text-perfagent-muted text-sm">Attached to:</div>
							<div className="font-mono text-sm font-medium">
								{selectedAnnotation.frameId.split('-')[2]}
							</div>
						</div>
					</div>
				);
		}
	}, [selectedAnnotation, zoomToTimeRange]);

	// Add a non-passive wheel event listener to ensure preventDefault works in all browsers
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const handleWheelEvent = (e: WheelEvent) => {
			e.preventDefault();
			// The actual zoom logic is handled by the React onWheel handler
		};

		// Add event listener with passive: false to ensure preventDefault works
		canvas.addEventListener('wheel', handleWheelEvent, { passive: false });

		// Clean up
		return () => {
			canvas.removeEventListener('wheel', handleWheelEvent);
		};
	}, [canvasRef]);

	return (
		<div className={`flex flex-col space-y-4 ${className}`} ref={containerRef}>
			{/* Toolbar */}
			<div className="bg-perfagent-panel border-perfagent-border flex items-center space-x-2 rounded-md border p-2">
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								onClick={handleZoomIn}
								className="hover:bg-perfagent-bg bg-white"
								disabled={Boolean(
									processedData &&
										viewState.endTime - viewState.startTime <= MIN_TIME_RANGE,
								)}
							>
								<ZoomIn className="text-perfagent-text h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							{processedData &&
							viewState.endTime - viewState.startTime <= MIN_TIME_RANGE
								? 'Maximum zoom level reached'
								: 'Zoom In'}
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								onClick={handleZoomOut}
								className="hover:bg-perfagent-bg bg-white"
								disabled={Boolean(
									processedData &&
										viewState.startTime === processedData.startTime &&
										viewState.endTime === processedData.endTime,
								)}
							>
								<ZoomOut className="text-perfagent-text h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Zoom Out</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								onClick={handleReset}
								className="hover:bg-perfagent-bg bg-white"
							>
								<RotateCcw className="text-perfagent-text h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Reset View</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				{/* Add vertical navigation buttons */}
				<div className="ml-2 flex items-center space-x-1">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="icon"
									onClick={handleScrollUp}
									className="hover:bg-perfagent-bg bg-white"
									disabled={viewState.topDepth <= 0}
								>
									<ArrowUp className="text-perfagent-text h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Scroll Up</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="icon"
									onClick={handleScrollDown}
									className="hover:bg-perfagent-bg bg-white"
									disabled={Boolean(
										processedData &&
											viewState.topDepth >=
												processedData.maxDepth -
													viewState.visibleDepthCount +
													1,
									)}
								>
									<ArrowDown className="text-perfagent-text h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Scroll Down</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>

				<div className="text-perfagent-text ml-4 flex items-center text-sm">
					<Move className="mr-1 h-4 w-4" />
					<span>
						{processedData &&
						viewState.startTime === processedData.startTime &&
						viewState.endTime === processedData.endTime &&
						viewState.topDepth === 0
							? 'Zoom in or scroll down to enable panning'
							: 'Click and drag to move'}
					</span>
				</div>

				{/* Annotations toggle */}
				<div className="ml-4 flex items-center space-x-2">
					<Switch
						id="annotations-toggle"
						checked={showAnnotations}
						onCheckedChange={setShowAnnotations}
					/>
					<Label
						htmlFor="annotations-toggle"
						className="text-perfagent-text flex items-center text-sm"
					>
						<BookMarked className="mr-1 h-4 w-4" />
						<span>Annotations</span>
					</Label>
				</div>

				{/* Interactions toggle */}
				<div className="ml-4 flex items-center space-x-2">
					<Switch
						id="interactions-toggle"
						checked={showInteractions}
						onCheckedChange={setShowInteractions}
					/>
					<Label
						htmlFor="interactions-toggle"
						className="text-perfagent-text flex items-center text-sm"
					>
						<span>Interactions Track</span>
					</Label>
				</div>

				<div className="text-perfagent-muted ml-auto font-mono text-xs">
					Zoom: {zoomPercentage}% | Time: {viewState.startTime.toFixed(2)}ms -{' '}
					{viewState.endTime.toFixed(2)}ms | Depth: {viewState.topDepth} -{' '}
					{viewState.topDepth + viewState.visibleDepthCount - 1}
				</div>
			</div>

			{/* Annotation Panel - Always visible but can be disabled */}
			<AnnotationPanel
				annotations={annotations ?? []}
				selectedAnnotationId={selectedAnnotation?.id}
				onAnnotationClick={handleAnnotationClick}
				frameMap={processedData?.frameMap || new Map()}
				viewState={viewState}
				isEnabled={showAnnotations}
			/>

			{/* Canvas */}
			<div className="relative">
				<canvas
					ref={canvasRef}
					width={width}
					height={height}
					className="border-perfagent-border w-full rounded-md border bg-white"
					onMouseDown={handleMouseDown}
					onMouseMove={handleMouseMove}
					onMouseUp={handleMouseUp}
					onMouseLeave={handleMouseLeave}
					onClick={handleClick}
					onWheel={handleWheel}
					style={{
						cursor: isDragging
							? 'grabbing'
							: processedData &&
								  viewState.startTime === processedData.startTime &&
								  viewState.endTime === processedData.endTime &&
								  viewState.topDepth === 0
								? 'default'
								: 'grab',
					}}
				/>

				{/* Hover card */}
				{hoverNode && hoverPosition && (
					<HoverCard
						node={hoverNode}
						position={hoverPosition}
						canvasRef={canvasRef}
					/>
				)}
			</div>

			{/* Node info panel */}
			{selectedNode && (
				<Card className="bg-perfagent-panel border-perfagent-border p-4">
					<NodeInfoPanel node={selectedNode} />
				</Card>
			)}

			{/* Interaction info panel */}
			{selectedInteraction && (
				<Card className="bg-perfagent-panel border-perfagent-border p-4">
					{renderInteractionInfo()}
				</Card>
			)}

			{/* Annotation info panel */}
			{selectedAnnotation && (
				<Card className="bg-perfagent-panel border-perfagent-border p-4">
					{renderAnnotationInfo()}
				</Card>
			)}

			{/* Debug info panel - only in development */}
			{process.env.NODE_ENV === 'development' && processedData && (
				<Card className="bg-perfagent-panel border-perfagent-border p-4">
					<h3 className="text-perfagent-text mb-2 text-sm font-medium">
						Debug Info
					</h3>
					<div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
						<div className="text-perfagent-muted">Max Depth:</div>
						<div className="font-mono">{processedData.maxDepth}</div>
						<div className="text-perfagent-muted">Total Frames:</div>
						<div className="font-mono">{processedData.frames.length}</div>
						<div className="text-perfagent-muted">View Top Depth:</div>
						<div className="font-mono">{viewState.topDepth}</div>
						<div className="text-perfagent-muted">Visible Depths:</div>
						<div className="font-mono">{viewState.visibleDepthCount}</div>
						<div className="text-perfagent-muted">Interactions:</div>
						<div className="font-mono">{interactions?.length}</div>
					</div>
				</Card>
			)}
		</div>
	);
}
