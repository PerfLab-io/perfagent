'use client';

import type React from 'react';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import {
	ZoomIn,
	ZoomOut,
	RotateCcw,
	Move,
	Layers,
	ArrowUp,
	ArrowDown,
	Flag,
} from 'lucide-react';

import {
	type NetworkViewState,
	type ProcessedNetworkData,
	COMPACT_MODE_HEIGHT,
	EXPANDED_MODE_MIN_HEIGHT,
	NETWORK_ENTRY_HEIGHT,
	TIMESCALE_HEIGHT,
	LEGEND_HEIGHT,
	MILESTONE_TRACK_HEIGHT,
} from './types';
import { processNetworkData } from './mock-data';
import { renderCompactMode } from './compact-renderer';
import { renderExpandedMode } from './expanded-renderer';
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

// Add a constant for minimum time range (maximum zoom level)
const MIN_TIME_RANGE = 0.001;

// Add constants for vertical navigation
const DEPTH_STEP = 1; // Number of rows to move when using arrow buttons

// Increase the expanded mode minimum height
// const EXPANDED_MODE_MIN_HEIGHT = 400; // Changed from 150 to 400

export function NetworkActivityCanvas({
	networkData,
	width = 1200,
	height = 300,
	className = '',
	initialViewState,
	firstPartyOrigin,
	loadTimeMetrics,
}: NetworkActivityCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [processedData, setProcessedData] =
		useState<ProcessedNetworkData | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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
	});

	// Calculate actual canvas height based on mode and whether milestones are shown
	const canvasHeight = viewState.isCompact
		? COMPACT_MODE_HEIGHT +
			(viewState.showMilestones ? MILESTONE_TRACK_HEIGHT : 0)
		: Math.max(
				EXPANDED_MODE_MIN_HEIGHT,
				Math.min(
					(processedData?.maxDepth || 0) * NETWORK_ENTRY_HEIGHT +
						TIMESCALE_HEIGHT +
						LEGEND_HEIGHT +
						(viewState.showMilestones ? MILESTONE_TRACK_HEIGHT : 0),
					height * 1.2, // Allow up to 1.5x the container height for expanded view
				),
			);

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
			isCompact:
				initialViewState?.isCompact !== undefined
					? initialViewState.isCompact
					: true,
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
		}));
	}, [networkData, initialViewState, height, viewState.showMilestones]);

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

	// Render the network activity canvas
	useEffect(() => {
		if (!canvasRef.current || !processedData) return;

		const ctx = canvasRef.current.getContext('2d');
		if (!ctx) return;

		// Clear canvas
		ctx.clearRect(0, 0, width, canvasHeight);

		// Render based on mode
		if (viewState.isCompact) {
			renderCompactMode(
				ctx,
				processedData,
				viewState,
				width,
				canvasHeight,
				firstPartyOrigin,
				loadTimeMetrics,
			);
		} else {
			renderExpandedMode(ctx, processedData, viewState, width, canvasHeight);
		}
	}, [processedData, width, canvasHeight, viewState]);

	// Handle mouse down for dragging
	const handleMouseDown = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			// Skip dragging if in compact mode or at the initial resolution
			if (
				viewState.isCompact ||
				(processedData &&
					viewState.startTime === viewState.startTime &&
					viewState.endTime === viewState.endTime &&
					viewState.topDepth === 0)
			) {
				return;
			}

			const { x, y } = getCanvasCoordinates(e);
			setIsDragging(true);
			setDragStart({ x, y });
		},
		[getCanvasCoordinates, processedData, viewState],
	);

	// Handle mouse move for dragging
	const handleMouseMove = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			if (
				!canvasRef.current ||
				!processedData ||
				!isDragging ||
				viewState.isCompact
			)
				return;

			const { x, y } = getCanvasCoordinates(e);

			// Calculate drag distance
			const dx = x - dragStart.x;
			const dy = y - dragStart.y;

			// Convert dx to time delta
			const timeRange = viewState.endTime - viewState.startTime;
			const timeDelta = (dx / width) * timeRange;

			// Calculate new time bounds
			let newStartTime = viewState.startTime - timeDelta;
			let newEndTime = viewState.endTime - timeDelta;

			// Ensure we don't go beyond the trace bounds
			if (newStartTime < viewState.startTime) {
				const adjustment = viewState.startTime - newStartTime;
				newStartTime = viewState.startTime;
				newEndTime += adjustment;
			}

			if (newEndTime > viewState.endTime) {
				const adjustment = newEndTime - viewState.endTime;
				newEndTime = viewState.endTime;
				newStartTime -= adjustment;
			}

			// Calculate new depth bounds for Y-axis panning
			// Convert pixel movement to depth change - use a smaller factor for smoother panning
			const depthDelta = (dy / NETWORK_ENTRY_HEIGHT) * 0.5;
			let newTopDepth = viewState.topDepth - depthDelta;

			// Ensure we don't go beyond the depth bounds
			// Allow slight overscroll at the top for better UX
			newTopDepth = Math.max(
				-0.5,
				Math.min(
					newTopDepth,
					processedData.maxDepth - viewState.visibleDepthCount + 1,
				),
			);

			// Update view state
			setViewState({
				...viewState,
				startTime: newStartTime,
				endTime: newEndTime,
				topDepth: newTopDepth,
			});

			setDragStart({ x, y });
		},
		[
			isDragging,
			dragStart,
			viewState,
			processedData,
			width,
			getCanvasCoordinates,
		],
	);

	// Handle mouse up to end dragging
	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	// Handle mouse leave to end dragging
	const handleMouseLeave = useCallback(() => {
		setIsDragging(false);
	}, []);

	// Handle mouse wheel for zooming
	const handleWheel = useCallback(
		(e: React.WheelEvent<HTMLCanvasElement>) => {
			// Prevent default scrolling behavior
			e.preventDefault();

			if (!canvasRef.current || !processedData || viewState.isCompact) return;

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

				// Enforce minimum time range
				if (newTimeRange < MIN_TIME_RANGE) {
					newTimeRange = MIN_TIME_RANGE;
				}

				// Calculate how far the mouse is from the left edge
				const mouseTime = prev.startTime + (x / width) * timeRange;
				const mousePositionRatio = (mouseTime - prev.startTime) / timeRange;

				// Calculate new start and end times while keeping the mouse position fixed
				let newStartTime = mouseTime - mousePositionRatio * newTimeRange;
				let newEndTime = newStartTime + newTimeRange;

				// Ensure we don't go beyond the trace bounds
				if (newStartTime < viewState.startTime) {
					newStartTime = viewState.startTime;
					newEndTime = newStartTime + newTimeRange;
				}

				if (newEndTime > viewState.endTime) {
					newEndTime = viewState.endTime;
					newStartTime = Math.max(
						viewState.startTime,
						newEndTime - newTimeRange,
					);
				}

				// If zooming out would show the entire range, just reset to full view
				if (
					zoomFactor > 1 &&
					newStartTime <= viewState.startTime &&
					newEndTime >= viewState.endTime
				) {
					return {
						...prev,
						startTime: viewState.startTime,
						endTime: viewState.endTime,
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
		if (!processedData || viewState.isCompact) return;

		setViewState((prev) => {
			// Check if we're already at maximum zoom
			const currentRange = prev.endTime - prev.startTime;
			if (currentRange <= MIN_TIME_RANGE) {
				return prev; // Don't zoom in further
			}

			// Calculate the center point for zooming
			const center = (prev.startTime + prev.endTime) / 2;

			// Calculate new time range (zoom in by 50%)
			const newRange = Math.max(MIN_TIME_RANGE, currentRange * 0.5);

			// Calculate new start and end times centered around the center point
			const newStartTime = Math.max(viewState.startTime, center - newRange / 2);
			const newEndTime = Math.min(viewState.endTime, center + newRange / 2);

			// If we hit one bound but not the other, adjust to maintain the zoom level
			const actualRange = newEndTime - newStartTime;
			if (actualRange < newRange && newStartTime === viewState.startTime) {
				// We hit the left bound, extend right if possible
				const rightExtension = newRange - actualRange;
				const adjustedEndTime = Math.min(
					viewState.endTime,
					newEndTime + rightExtension,
				);
				return {
					...prev,
					startTime: newStartTime,
					endTime: adjustedEndTime,
				};
			} else if (actualRange < newRange && newEndTime === viewState.endTime) {
				// We hit the right bound, extend left if possible
				const leftExtension = newRange - actualRange;
				const adjustedStartTime = Math.max(
					viewState.startTime,
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
	}, [processedData, viewState]);

	// Zoom out - increase the visible time range
	const handleZoomOut = useCallback(() => {
		if (!processedData || viewState.isCompact) return;

		setViewState((prev) => {
			// If we're already at full range, don't change anything
			if (
				prev.startTime === viewState.startTime &&
				prev.endTime === viewState.endTime
			) {
				return prev;
			}

			// Calculate the center point for zooming
			const center = (prev.startTime + prev.endTime) / 2;

			// Calculate new time range (zoom out by 200%)
			const currentRange = prev.endTime - prev.startTime;
			const newRange = currentRange * 2;

			// Calculate new start and end times centered around the center point
			let newStartTime = Math.max(viewState.startTime, center - newRange / 2);
			let newEndTime = Math.min(viewState.endTime, center + newRange / 2);

			// If we hit one bound but not the other, extend the other side
			if (
				newStartTime === viewState.startTime &&
				newEndTime < viewState.endTime
			) {
				newEndTime = Math.min(viewState.endTime, newStartTime + newRange);
			} else if (
				newEndTime === viewState.endTime &&
				newStartTime > viewState.startTime
			) {
				newStartTime = Math.max(viewState.startTime, newEndTime - newRange);
			}

			// If zooming out would show the entire range, just reset to full view
			if (
				newStartTime <= viewState.startTime &&
				newEndTime >= viewState.endTime
			) {
				return {
					...prev,
					startTime: viewState.startTime,
					endTime: viewState.endTime,
				};
			}

			return {
				...prev,
				startTime: newStartTime,
				endTime: newEndTime,
			};
		});
	}, [processedData, viewState]);

	// Reset view to show the entire timeline
	const handleReset = useCallback(() => {
		if (!processedData) return;

		setViewState((prev) => ({
			...prev,
			startTime: viewState.startTime,
			endTime: viewState.endTime,
			topDepth: 0,
		}));
	}, [processedData]);

	// Toggle between compact and expanded modes
	const handleToggleMode = useCallback(() => {
		setViewState((prev) => ({
			...prev,
			isCompact: !prev.isCompact,
		}));
	}, []);

	// Toggle first party visibility in compact mode
	const handleToggleFirstParty = useCallback(() => {
		setViewState((prev) => ({
			...prev,
			showFirstParty: !prev.showFirstParty,
		}));
	}, []);

	// Toggle third party visibility in compact mode
	const handleToggleThirdParty = useCallback(() => {
		setViewState((prev) => ({
			...prev,
			showThirdParty: !prev.showThirdParty,
		}));
	}, []);

	// Toggle milestones visibility
	const handleToggleMilestones = useCallback(() => {
		setViewState((prev) => ({
			...prev,
			showMilestones: !prev.showMilestones,
		}));
	}, []);

	// Add functions for vertical navigation in expanded mode
	const handleScrollUp = useCallback(() => {
		if (!processedData || viewState.isCompact) return;

		setViewState((prev) => {
			// Use a larger step for faster navigation
			const newTopDepth = Math.max(0, prev.topDepth - DEPTH_STEP * 3);
			return {
				...prev,
				topDepth: newTopDepth,
			};
		});
	}, [processedData, viewState.isCompact]);

	const handleScrollDown = useCallback(() => {
		if (!processedData || viewState.isCompact) return;

		setViewState((prev) => {
			// Use a larger step for faster navigation
			const newTopDepth = Math.min(
				processedData.maxDepth - prev.visibleDepthCount + 1,
				prev.topDepth + DEPTH_STEP * 3,
			);
			return {
				...prev,
				topDepth: newTopDepth,
			};
		});
	}, [processedData, viewState.isCompact]);

	// Calculate zoom percentage
	const zoomPercentage =
		viewState.endTime - viewState.startTime > 0
			? Math.round(
					((viewState.endTime - viewState.startTime) /
						(viewState.endTime - viewState.startTime)) *
						100,
				)
			: 100;

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
								onClick={handleToggleMode}
								className="hover:bg-perfagent-bg bg-white"
							>
								<Layers className="text-perfagent-text h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							{viewState.isCompact
								? 'Switch to Expanded Mode'
								: 'Switch to Compact Mode'}
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								onClick={handleZoomIn}
								className="hover:bg-perfagent-bg bg-white"
								disabled={
									viewState.isCompact ||
									Boolean(
										processedData &&
											viewState.endTime - viewState.startTime <= MIN_TIME_RANGE,
									)
								}
							>
								<ZoomIn className="text-perfagent-text h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							{viewState.isCompact
								? 'Zoom is disabled in compact mode'
								: processedData &&
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
								disabled={
									viewState.isCompact ||
									Boolean(
										processedData &&
											viewState.startTime === viewState.startTime &&
											viewState.endTime === viewState.endTime,
									)
								}
							>
								<ZoomOut className="text-perfagent-text h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							{viewState.isCompact
								? 'Zoom is disabled in compact mode'
								: 'Zoom Out'}
						</TooltipContent>
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

				{/* Add vertical navigation buttons for expanded mode */}
				{!viewState.isCompact && (
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
				)}

				<div className="text-perfagent-text ml-4 flex items-center text-sm">
					<Move className="mr-1 h-4 w-4" />
					<span>
						{viewState.isCompact
							? 'Panning is disabled in compact mode'
							: processedData &&
								  viewState.startTime === viewState.startTime &&
								  viewState.endTime === viewState.endTime &&
								  viewState.topDepth === 0
								? 'Zoom in or scroll down to enable panning'
								: 'Click and drag to move'}
					</span>
				</div>

				<div className="ml-4 flex items-center space-x-2">
					<Switch
						id="mode-toggle"
						checked={!viewState.isCompact}
						onCheckedChange={(checked) =>
							setViewState((prev) => ({ ...prev, isCompact: !checked }))
						}
					/>
					<Label
						htmlFor="mode-toggle"
						className="text-perfagent-text flex items-center text-sm"
					>
						<span>Expanded View</span>
					</Label>
				</div>

				{/* First party toggle for compact mode */}
				{viewState.isCompact && (
					<div className="ml-4 flex items-center space-x-2">
						<Switch
							id="first-party-toggle"
							checked={viewState.showFirstParty}
							onCheckedChange={handleToggleFirstParty}
						/>
						<Label
							htmlFor="first-party-toggle"
							className="text-perfagent-text flex items-center text-sm"
						>
							<span>First Party</span>
						</Label>
					</div>
				)}

				{/* Third party toggle for compact mode */}
				{viewState.isCompact && (
					<div className="ml-4 flex items-center space-x-2">
						<Switch
							id="third-party-toggle"
							checked={viewState.showThirdParty}
							onCheckedChange={handleToggleThirdParty}
						/>
						<Label
							htmlFor="third-party-toggle"
							className="text-perfagent-text flex items-center text-sm"
						>
							<span>Third Party</span>
						</Label>
					</div>
				)}

				{/* Milestones toggle */}
				<div className="ml-4 flex items-center space-x-2">
					<Switch
						id="milestones-toggle"
						checked={viewState.showMilestones}
						onCheckedChange={handleToggleMilestones}
					/>
					<Label
						htmlFor="milestones-toggle"
						className="text-perfagent-text flex items-center text-sm"
					>
						<Flag className="mr-1 h-4 w-4" />
						<span>Milestones</span>
					</Label>
				</div>

				<div className="text-perfagent-muted ml-auto font-mono text-xs">
					{!viewState.isCompact && `Zoom: ${zoomPercentage}% | `}
					Time: {viewState.startTime.toFixed(2)}ms -{' '}
					{viewState.endTime.toFixed(2)}ms
					{!viewState.isCompact &&
						` | Depth: ${viewState.topDepth} - ${viewState.topDepth + viewState.visibleDepthCount - 1}`}
				</div>
			</div>

			{/* Canvas */}
			<div className="relative">
				<canvas
					ref={canvasRef}
					width={width}
					height={canvasHeight}
					className="border-perfagent-border w-full rounded-md border bg-white"
					onMouseDown={handleMouseDown}
					onMouseMove={handleMouseMove}
					onMouseUp={handleMouseUp}
					onMouseLeave={handleMouseLeave}
					onWheel={handleWheel}
					style={{
						cursor: isDragging
							? 'grabbing'
							: viewState.isCompact ||
								  (processedData &&
										viewState.startTime === viewState.startTime &&
										viewState.endTime === viewState.endTime &&
										viewState.topDepth === 0)
								? 'default'
								: 'grab',
						height: `${canvasHeight}px`,
					}}
				/>
			</div>

			{/* Network stats */}
			{processedData && (
				<Card className="bg-perfagent-panel border-perfagent-border p-4">
					<h3 className="text-perfagent-text mb-2 text-sm font-medium">
						Network Activity
					</h3>
					<div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
						<div className="text-perfagent-muted">Total Requests:</div>
						<div className="font-mono">{processedData.requests.length}</div>
						<div className="text-perfagent-muted">First Party:</div>
						<div className="font-mono">
							{
								processedData.requests.filter((r) =>
									r.args.data.url.includes(firstPartyOrigin),
								).length
							}
						</div>
						<div className="text-perfagent-muted">Third Party:</div>
						<div className="font-mono">
							{
								processedData.requests.filter(
									(r) => !r.args.data.url.includes(firstPartyOrigin),
								).length
							}
						</div>
						<div className="text-perfagent-muted">Total Duration:</div>
						<div className="font-mono">
							{viewState.endTime - viewState.startTime}ms
						</div>
						{!viewState.isCompact && (
							<>
								<div className="text-perfagent-muted">Max Stack Depth:</div>
								<div className="font-mono">{processedData.maxDepth}</div>
							</>
						)}
					</div>
				</Card>
			)}
		</div>
	);
}
