'use client';

import { useState, useEffect } from 'react';
import {
	ChevronDown,
	ChevronRight,
	FileText,
	Image,
	Code,
	File,
	FileCode,
	Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileInsightCard } from './trace-details/trace-insight-card';
import { FrameHistogram } from './trace-details/trace-histogram';
import { InteractionTimeline } from './trace-details/interaction-timeline';
import {
	Clock,
	BarChart3,
	Activity,
	Cpu,
	MousePointer,
	Pointer,
} from 'lucide-react';

interface AttachedFile {
	id: string;
	name: string;
	size: number;
	type: string;
	data: string | ArrayBuffer | null;
}

interface FileContextSectionProps {
	currentFile: AttachedFile | null;
	isVisible: boolean;
}

export function FileContextSection({
	currentFile,
	isVisible,
}: FileContextSectionProps) {
	// Update the FileContextSection component to implement all the requested improvements

	// First, add a max-height to the main container when expanded
	// Add a new state to track the initial animation
	const [isInitialRender, setIsInitialRender] = useState(true);
	const [isExpanded, setIsExpanded] = useState(true);
	const [isAnimating, setIsAnimating] = useState(false);

	// Add useEffect to handle the animation sequence
	useEffect(() => {
		if (isVisible && isInitialRender) {
			// Start with the panel closed
			setIsExpanded(false);

			// Set animating state to true
			setIsAnimating(true);

			// After a short delay, mark initial render as complete
			const timer = setTimeout(() => {
				setIsInitialRender(false);
				setIsAnimating(false);
			}, 600); // Animation duration

			return () => clearTimeout(timer);
		}
	}, [isVisible, isInitialRender]);

	if (!isVisible || !currentFile) {
		return null;
	}

	// Format file size
	const formatFileSize = (bytes: number): string => {
		if (bytes < 1024) return bytes + ' B';
		else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	};

	// Determine file icon based on type
	const getFileIcon = () => {
		const type = currentFile.type;
		if (type.startsWith('image/'))
			return <Image className="h-5 w-5 text-blue-500" />;
		if (type === 'text/plain')
			return <FileText className="h-5 w-5 text-amber-500" />;
		if (type === 'application/json')
			return <Code className="h-5 w-5 text-green-500" />;
		if (type.includes('javascript') || type.includes('typescript'))
			return <FileCode className="h-5 w-5 text-yellow-500" />;
		if (currentFile.name.endsWith('.go'))
			return <FileCode className="h-5 w-5 text-cyan-500" />;
		return <File className="h-5 w-5 text-gray-500" />;
	};

	// Mock frame duration data for histogram
	const frameDurations = [
		8, 12, 9, 11, 14, 10, 9, 13, 16, 22, 18, 15, 12, 10, 9, 11, 14, 17, 19, 24,
		32, 28, 16, 14, 12, 10, 9, 11, 13, 15,
	];

	// Mock timeline events
	const timelineEvents = [
		{ type: 'HTML', startTime: 0, duration: 120, color: 'bg-blue-500/70' },
		{ type: 'CSS', startTime: 100, duration: 180, color: 'bg-purple-500/70' },
		{ type: 'JS', startTime: 250, duration: 350, color: 'bg-yellow-500/70' },
		{ type: 'Images', startTime: 550, duration: 250, color: 'bg-green-500/70' },
		{ type: 'Other', startTime: 750, duration: 150, color: 'bg-gray-500/70' },
	];

	// Mock interaction events from the trace
	const interactionEvents = [
		{ name: 'click', duration: 78, target: 'button.submit' },
		{ name: 'pointer', duration: 124, target: 'div.product-card' },
		{ name: 'keypress', duration: 42, target: 'input.search' },
	];

	return (
		<div
			className={cn(
				'mb-4 overflow-hidden rounded-lg bg-peppermint-50 transition-all duration-300 dark:bg-peppermint-950/30',
				isExpanded
					? 'max-h-[600px] overflow-y-auto border border-peppermint-200 dark:border-peppermint-900'
					: 'max-h-[40px] border border-dashed border-peppermint-200 dark:border-peppermint-900',
				isAnimating &&
					'-translate-y-1 translate-x-1 shadow-[-4px_4px_0_var(--border-color)]',
				isInitialRender && 'file-context-appear',
			)}
		>
			{/* Header */}
			<div
				className="sticky top-0 z-10 flex cursor-pointer items-center justify-between bg-peppermint-50 p-2 hover:bg-peppermint-100 dark:bg-peppermint-950/30 dark:hover:bg-peppermint-900/20"
				onClick={() => setIsExpanded(!isExpanded)}
			>
				<div className="flex items-center space-x-2">
					{isExpanded ? (
						<ChevronDown className="h-4 w-4 text-peppermint-700 dark:text-peppermint-300" />
					) : (
						<ChevronRight className="h-4 w-4 text-peppermint-700 dark:text-peppermint-300" />
					)}
					<span className="text-sm font-medium text-peppermint-800 dark:text-peppermint-200">
						Trace Analysis
					</span>
				</div>
				<div className="flex items-center space-x-2">
					<div className="flex items-center space-x-1 rounded bg-peppermint-100 px-2 py-0.5 text-xs dark:bg-peppermint-900/40">
						<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
						<span className="text-peppermint-700 dark:text-peppermint-300">
							Processing
						</span>
					</div>
				</div>
			</div>

			{/* Content */}
			{isExpanded && (
				<div className="border-t border-peppermint-200 p-3 dark:border-peppermint-900/50">
					<div className="flex items-start">
						<div className="flex-shrink-0 rounded border border-peppermint-200 bg-white p-2 dark:border-peppermint-800 dark:bg-peppermint-900/30">
							{getFileIcon()}
						</div>
						<div className="ml-3">
							<h3 className="font-medium text-peppermint-900 dark:text-peppermint-100">
								{currentFile.name}
							</h3>
							<div className="mt-1 flex flex-wrap gap-2">
								<span className="rounded bg-peppermint-100 px-2 py-0.5 text-xs text-peppermint-800 dark:bg-peppermint-900/40 dark:text-peppermint-300">
									Performance Trace
								</span>
								<span className="rounded bg-peppermint-100 px-2 py-0.5 text-xs text-peppermint-800 dark:bg-peppermint-900/40 dark:text-peppermint-300">
									{formatFileSize(currentFile.size)}
								</span>
							</div>
						</div>
					</div>

					{/* Core Web Vitals Section - Updated with better visuals */}
					<div className="mt-4">
						<h4 className="mb-2 text-xs font-semibold text-peppermint-800 dark:text-peppermint-200">
							Core Web Vitals
						</h4>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
							{/* LCP Card - Updated with better visuals */}
							<FileInsightCard
								title="Largest Contentful Paint"
								value={2.4}
								unit="s"
								icon={<Clock className="h-3.5 w-3.5" />}
								status="warning"
							>
								<div className="mt-1 flex items-center justify-between">
									<div className="flex items-center">
										<div className="mr-1 h-2 w-2 bg-amber-500"></div>
										<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
											Needs improvement
										</span>
									</div>
									<div className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
										<span className="font-medium">Target: &lt;2.5s</span>
									</div>
								</div>
								<div className="mt-1 text-[10px] text-peppermint-600 dark:text-peppermint-400">
									<span className="font-medium">Action:</span> Optimize hero
									image (1.8MB)
								</div>
							</FileInsightCard>

							{/* INP Card - Replaced FID with INP */}
							<FileInsightCard
								title="Interaction to Next Paint"
								value={124}
								unit="ms"
								icon={<MousePointer className="h-3.5 w-3.5" />}
								status="warning"
							>
								<div className="mt-1 flex items-center justify-between">
									<div className="flex items-center">
										<div className="mr-1 h-2 w-2 bg-amber-500"></div>
										<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
											Needs improvement
										</span>
									</div>
									<div className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
										<span className="font-medium">Target: &lt;100ms</span>
									</div>
								</div>
								<div className="mt-1 text-[10px] text-peppermint-600 dark:text-peppermint-400">
									<span className="font-medium">Slowest:</span> Click on
									product-card (124ms)
								</div>
							</FileInsightCard>

							{/* CLS Card - Updated with better visuals */}
							<FileInsightCard
								title="Cumulative Layout Shift"
								value={0.12}
								icon={<Activity className="h-3.5 w-3.5" />}
								status="warning"
							>
								<div className="mt-1 flex items-center justify-between">
									<div className="flex items-center">
										<div className="mr-1 h-2 w-2 bg-amber-500"></div>
										<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
											Needs improvement
										</span>
									</div>
									<div className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
										<span className="font-medium">Target: &lt;0.1</span>
									</div>
								</div>
								<div className="mt-1 text-[10px] text-peppermint-600 dark:text-peppermint-400">
									<span className="font-medium">Action:</span> Set image
									dimensions in CSS
								</div>
							</FileInsightCard>
						</div>
					</div>

					{/* Request Timeline - Updated with overlaid markers */}
					<div className="mt-4">
						<h4 className="mb-2 text-xs font-semibold text-peppermint-800 dark:text-peppermint-200">
							Request Timeline
						</h4>
						<div className="rounded-lg border border-peppermint-200 bg-white p-3 transition-all duration-300 hover:-translate-y-1 hover:translate-x-1 hover:shadow-[-4px_4px_0_var(--border-color)] dark:border-peppermint-800 dark:bg-peppermint-900/30">
							{/* Timeline container with relative positioning */}
							<div className="relative">
								{/* The timeline bars */}
								<InteractionTimeline
									events={timelineEvents}
									totalDuration={1000}
								/>

								{/* Overlaid markers - positioned absolutely on top of the bars */}
								<div className="absolute left-0 top-0 h-8 w-full">
									{/* DOMContentLoaded marker */}
									<div className="absolute top-0 h-8" style={{ left: '45%' }}>
										<div className="absolute top-0 h-full w-[1px] bg-red-500"></div>
										<div className="absolute -top-1 h-2 w-2 -translate-x-1/2 rounded-full bg-red-500"></div>
										<div className="absolute -bottom-6 -translate-x-1/2 whitespace-nowrap text-[10px] text-red-500">
											DOMContentLoaded: 450ms
										</div>
									</div>

									{/* Load marker */}
									<div className="absolute top-0 h-8" style={{ left: '85%' }}>
										<div className="absolute top-0 h-full w-[1px] bg-green-700"></div>
										<div className="absolute -top-1 h-2 w-2 -translate-x-1/2 rounded-full bg-green-700"></div>
										<div className="absolute -bottom-6 -translate-x-1/2 whitespace-nowrap text-[10px] text-green-700">
											Load: 850ms
										</div>
									</div>
								</div>
							</div>

							{/* Timeline scale */}
							<div className="mt-6 flex justify-between text-[10px] text-peppermint-600 dark:text-peppermint-400">
								<span>0ms</span>
								<span>1000ms</span>
							</div>

							{/* Legend */}
							<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-blue-500"></div>
									<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
										HTML
									</span>
								</div>
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-purple-500"></div>
									<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
										CSS
									</span>
								</div>
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-yellow-500"></div>
									<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
										JavaScript
									</span>
								</div>
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-green-500"></div>
									<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
										Images
									</span>
								</div>
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-gray-500"></div>
									<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
										Other
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* Interactions List */}
					<div className="mt-4">
						<h4 className="mb-2 text-xs font-semibold text-peppermint-800 dark:text-peppermint-200">
							User Interactions
						</h4>
						<div className="rounded-lg border border-peppermint-200 bg-white p-3 transition-all duration-300 hover:-translate-y-1 hover:translate-x-1 hover:shadow-[-4px_4px_0_var(--border-color)] dark:border-peppermint-800 dark:bg-peppermint-900/30">
							<div className="space-y-2">
								{interactionEvents.map((event, index) => (
									<div key={index} className="flex items-center">
										<div className="w-20 flex-shrink-0">
											<span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-800 dark:text-amber-100">
												{event.name}
											</span>
										</div>
										<div className="ml-2 flex-grow">
											<div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
												<div
													className={cn(
														'h-full rounded-full',
														event.duration < 50
															? 'bg-green-500'
															: event.duration < 100
																? 'bg-amber-500'
																: 'bg-red-500',
													)}
													style={{
														width: `${Math.min(event.duration / 2, 100)}%`,
													}}
												></div>
											</div>
										</div>
										<div className="ml-2 w-16 text-right">
											<span className="text-xs font-medium text-peppermint-700 dark:text-peppermint-300">
												{event.duration}ms
											</span>
										</div>
										<div className="ml-2 max-w-[120px] flex-grow-0 truncate">
											<span className="text-xs text-peppermint-600 dark:text-peppermint-400">
												{event.target}
											</span>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>

					{/* Frame Histogram */}
					<div className="mt-4">
						<h4 className="mb-2 text-xs font-semibold text-peppermint-800 dark:text-peppermint-200">
							Frame Duration Distribution
						</h4>
						<div className="rounded-lg border border-peppermint-200 bg-white p-3 transition-all duration-300 hover:-translate-y-1 hover:translate-x-1 hover:shadow-[-4px_4px_0_var(--border-color)] dark:border-peppermint-800 dark:bg-peppermint-900/30">
							<div className="h-24">
								<FrameHistogram data={frameDurations} />
							</div>
							<div className="mt-2 flex justify-between text-[10px] text-peppermint-600 dark:text-peppermint-400">
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-green-500"></div>
									<span>&lt;16ms (60fps)</span>
								</div>
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-amber-500"></div>
									<span>16-50ms (20-60fps)</span>
								</div>
								<div className="flex items-center">
									<div className="mr-1 h-2 w-2 bg-red-500"></div>
									<span>&gt;50ms (&lt;20fps)</span>
								</div>
							</div>
						</div>
					</div>

					{/* Task Breakdown */}
					<div className="mt-4">
						<h4 className="mb-2 text-xs font-semibold text-peppermint-800 dark:text-peppermint-200">
							Task Breakdown
						</h4>
						<div className="grid grid-cols-2 gap-3">
							<FileInsightCard
								title="JavaScript Execution"
								value={68}
								unit="%"
								icon={<Cpu className="h-3.5 w-3.5" />}
								status="warning"
							>
								<div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
									<div
										className="h-full rounded-full bg-amber-500"
										style={{ width: '68%' }}
									></div>
								</div>
							</FileInsightCard>

							<FileInsightCard
								title="Rendering & Layout"
								value={24}
								unit="%"
								icon={<Layers className="h-3.5 w-3.5" />}
								status="neutral"
							>
								<div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
									<div
										className="h-full rounded-full bg-blue-500"
										style={{ width: '24%' }}
									></div>
								</div>
							</FileInsightCard>

							<FileInsightCard
								title="Long Tasks (>50ms)"
								value={12}
								icon={<BarChart3 className="h-3.5 w-3.5" />}
								status="critical"
							>
								<div className="mt-1 flex items-center">
									<div className="mr-1 h-2 w-2 bg-red-500"></div>
									<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
										Longest: 124ms
									</span>
								</div>
							</FileInsightCard>

							<FileInsightCard
								title="Event Handlers"
								value={18}
								icon={<Pointer className="h-3.5 w-3.5" />}
								status="neutral"
							>
								<div className="mt-1 flex items-center">
									<div className="mr-1 h-2 w-2 bg-amber-500"></div>
									<span className="text-[10px] text-peppermint-600 dark:text-peppermint-400">
										3 click, 2 pointer events
									</span>
								</div>
							</FileInsightCard>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
