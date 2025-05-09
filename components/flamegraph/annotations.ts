import type {
	Annotation,
	HighlightAnnotation,
	LinkAnnotation,
	LabelAnnotation,
	FrameNode,
	ViewState,
} from './types';

// Update the sample annotations to remove the label from the link annotation
export const sampleAnnotations: Annotation[] = [
	// Highlight annotations (existing)
	{
		id: 'annotation-1',
		type: 'highlight',
		startTime: 50, // in ms
		endTime: 80, // in ms
		label: 'Annotation 1',
		color: '#e6d7c3', // Light merino color
	},
	{
		id: 'annotation-2',
		type: 'highlight',
		startTime: 100, // in ms
		endTime: 145, // in ms
		label: 'yay',
		color: '#e8c4d4', // Light pink merino color
	},
	// Link annotation - linking uT at 50.40ms to i at 116ms
	{
		id: 'link-1',
		type: 'link',
		fromFrameId: '45', // This will be matched to the actual frame ID in the renderer
		toFrameId: '116', // This will be matched to the actual frame ID in the renderer
		color: '#333333', // Dark color for the arrow
	},
	// Label annotation - labeling uD at 71.70ms as 'Forced Layout'
	{
		id: 'label-1',
		type: 'label',
		frameId: '71', // This will be matched to the actual frame ID in the renderer
		label: 'Forced Layout',
		color: '#f43f5e', // Rose color for the label
	},
];

// Render annotations on the canvas
export function renderAnnotations(
	ctx: CanvasRenderingContext2D,
	annotations: Annotation[],
	viewState: ViewState,
	dimensions: { width: number; height: number },
	frameMap: Map<string, FrameNode>,
	selectedAnnotationId?: string,
	yOffset = 0, // Add offset for interactions track
): void {
	const { startTime, endTime } = viewState;
	const { width, height } = dimensions;
	const timeRange = endTime - startTime;

	// Skip if no annotations or time range is invalid
	if (annotations.length === 0 || timeRange <= 0) return;

	// Save the current context state to restore later
	ctx.save();

	// Process each annotation by type
	annotations.forEach((annotation) => {
		if (annotation.type === 'highlight') {
			renderHighlightAnnotation(
				ctx,
				annotation,
				viewState,
				dimensions,
				selectedAnnotationId,
				yOffset,
			);
		} else if (annotation.type === 'link') {
			renderLinkAnnotation(
				ctx,
				annotation,
				viewState,
				dimensions,
				frameMap,
				selectedAnnotationId,
				yOffset,
			);
		} else if (annotation.type === 'label') {
			renderLabelAnnotation(
				ctx,
				annotation,
				viewState,
				dimensions,
				frameMap,
				selectedAnnotationId,
				yOffset,
			);
		}
	});

	// Restore the context state
	ctx.restore();
}

// Render highlight annotation (time range)
function renderHighlightAnnotation(
	ctx: CanvasRenderingContext2D,
	annotation: HighlightAnnotation,
	viewState: ViewState,
	dimensions: { width: number; height: number },
	selectedAnnotationId?: string,
	yOffset = 0, // Add offset for interactions track
): void {
	const { startTime, endTime } = viewState;
	const { width, height } = dimensions;
	const timeRange = endTime - startTime;

	// Skip annotations outside the visible range
	if (annotation.endTime < startTime || annotation.startTime > endTime) return;

	// Calculate position and dimensions
	const annotationStartX = Math.max(
		0,
		((annotation.startTime - startTime) / timeRange) * width,
	);
	const annotationEndX = Math.min(
		width,
		((annotation.endTime - startTime) / timeRange) * width,
	);
	const annotationWidth = Math.max(1, annotationEndX - annotationStartX);

	// Determine if this annotation is selected
	const isSelected = selectedAnnotationId === annotation.id;

	// Set styles for the annotation overlay
	ctx.fillStyle = annotation.color || '#e6d7c3'; // Default to light merino if no color specified
	ctx.globalAlpha = 0.25;

	// Draw the annotation overlay - full height of the canvas, starting below the timescale and interactions track
	const startY = 30 + yOffset; // Start below the timescale and interactions track
	ctx.fillRect(annotationStartX, startY, annotationWidth, height - startY);

	// Draw a border for the annotation
	ctx.strokeStyle = darkenColor(
		annotation.color || '#e6d7c3',
		isSelected ? 0.45 : 0.3,
	);
	ctx.lineWidth = isSelected ? 2 : 1;
	ctx.globalAlpha = isSelected ? 0.8 : 0.6;
	ctx.strokeRect(annotationStartX, startY, annotationWidth, height - startY);

	// Reset alpha for text
	ctx.globalAlpha = 1.0;

	// Draw the label at the bottom of the canvas
	ctx.fillStyle = '#8b4513'; // Dark brown text for contrast
	ctx.font = isSelected ? 'bold 12px sans-serif' : '12px sans-serif';
	ctx.textBaseline = 'bottom';
	ctx.textAlign = 'center';

	// Calculate label position (centered in the annotation)
	const labelX = annotationStartX + annotationWidth / 2;
	const labelY = height - 8; // 8px padding from bottom

	// Draw the label
	ctx.fillText(annotation.label, labelX, labelY);

	// Draw time range below the label if there's enough space
	if (annotationWidth > 80) {
		ctx.font = '10px monospace';
		ctx.fillStyle = '#5d4037'; // Darker brown for time text
		ctx.fillText(
			`${annotation.startTime.toFixed(1)}ms - ${annotation.endTime.toFixed(1)}ms`,
			labelX,
			labelY - 16,
		);
	}
}

// Render link annotation (connecting two frames)
function renderLinkAnnotation(
	ctx: CanvasRenderingContext2D,
	annotation: LinkAnnotation,
	viewState: ViewState,
	dimensions: { width: number; height: number },
	frameMap: Map<string, FrameNode>,
	selectedAnnotationId?: string,
	yOffset = 0, // Add offset for interactions track
): void {
	const { startTime, endTime, topDepth, visibleDepthCount } = viewState;
	const { width, height } = dimensions;
	const timeRange = endTime - startTime;

	// Find the source and target frames
	const fromFrame = findFrameById(frameMap, annotation.fromFrameId);
	const toFrame = findFrameById(frameMap, annotation.toFrameId);

	// Skip if either frame is not found
	if (!fromFrame || !toFrame) return;

	// Determine if this annotation is selected
	const isSelected = selectedAnnotationId === annotation.id;

	// Calculate the time range that the link spans
	const linkStartTime = Math.min(fromFrame.start, toFrame.start);
	const linkEndTime = Math.max(fromFrame.end, toFrame.end);

	// Check if the link's time range overlaps with the visible time range
	const linkTimeVisible = linkEndTime >= startTime && linkStartTime <= endTime;

	// If the link doesn't pass through the visible time range, skip rendering
	if (!linkTimeVisible) return;

	// Calculate frame positions for edge-to-edge connection
	// We need to handle cases where frames might be partially or fully outside the visible area

	// Calculate the visible portion of the frames or their projected positions
	let fromStartX, fromEndX, fromY, toStartX, toEndX, toY;

	// Calculate Y positions (depth) for both frames, adding the yOffset for interactions track
	fromY = (fromFrame.depth - topDepth) * 24 + 30 + 12 + yOffset; // Center Y of the frame
	toY = (toFrame.depth - topDepth) * 24 + 30 + 12 + yOffset; // Center Y of the frame

	// Check if frames are within the visible depth range
	const fromDepthVisible =
		fromFrame.depth >= topDepth &&
		fromFrame.depth < topDepth + visibleDepthCount;
	const toDepthVisible =
		toFrame.depth >= topDepth && toFrame.depth < topDepth + visibleDepthCount;

	// If both frames are outside the visible depth range, skip rendering
	if (!fromDepthVisible && !toDepthVisible) return;

	// Calculate X positions for the source frame
	if (fromFrame.end <= startTime) {
		// Frame is completely to the left of the visible area
		// Project the right edge to the left edge of the view
		fromStartX = fromEndX = 0;
	} else if (fromFrame.start >= endTime) {
		// Frame is completely to the right of the visible area
		// Project the left edge to the right edge of the view
		fromStartX = fromEndX = width;
	} else {
		// Frame is at least partially visible
		fromStartX = Math.max(
			0,
			((Math.max(fromFrame.start, startTime) - startTime) / timeRange) * width,
		);
		fromEndX = Math.min(
			width,
			((Math.min(fromFrame.end, endTime) - startTime) / timeRange) * width,
		);
	}

	// Calculate X positions for the target frame
	if (toFrame.end <= startTime) {
		// Frame is completely to the left of the visible area
		// Project the right edge to the left edge of the view
		toStartX = toEndX = 0;
	} else if (toFrame.start >= endTime) {
		// Frame is completely to the right of the visible area
		// Project the left edge to the right edge of the view
		toStartX = toEndX = width;
	} else {
		// Frame is at least partially visible
		toStartX = Math.max(
			0,
			((Math.max(toFrame.start, startTime) - startTime) / timeRange) * width,
		);
		toEndX = Math.min(
			width,
			((Math.min(toFrame.end, endTime) - startTime) / timeRange) * width,
		);
	}

	// Determine which edges to connect based on relative positions
	let fromX, toX;

	// Determine the connection points based on the relative positions of the frames
	if (fromFrame.end <= toFrame.start) {
		// Source is before target - connect right edge of source to left edge of target
		fromX = fromEndX;
		toX = toStartX;
	} else if (toFrame.end <= fromFrame.start) {
		// Target is before source - connect left edge of source to right edge of target
		fromX = fromStartX;
		toX = toEndX;
	} else {
		// Frames overlap in time - connect centers
		fromX = (fromStartX + fromEndX) / 2;
		toX = (toStartX + toEndX) / 2;
	}

	// Set styles for the arrow
	ctx.strokeStyle = annotation.color || '#333333';
	ctx.lineWidth = isSelected ? 2 : 1.5;
	ctx.globalAlpha = isSelected ? 1.0 : 0.8;

	// Draw a straight line
	ctx.beginPath();
	ctx.moveTo(fromX, fromY);
	ctx.lineTo(toX, toY);
	ctx.stroke();

	// Draw the arrow head
	const headLength = 10; // Length of arrow head in pixels
	const headAngle = Math.PI / 6; // 30 degrees angle for arrow head

	// Calculate angle of the line
	const angle = Math.atan2(toY - fromY, toX - fromX);

	// Draw the arrow head
	ctx.beginPath();
	ctx.moveTo(toX, toY);
	ctx.lineTo(
		toX - headLength * Math.cos(angle - headAngle),
		toY - headLength * Math.sin(angle - headAngle),
	);
	ctx.lineTo(
		toX - headLength * Math.cos(angle + headAngle),
		toY - headLength * Math.sin(angle + headAngle),
	);
	ctx.closePath();
	ctx.fill();
}

// Render label annotation (attached to a frame)
function renderLabelAnnotation(
	ctx: CanvasRenderingContext2D,
	annotation: LabelAnnotation,
	viewState: ViewState,
	dimensions: { width: number; height: number },
	frameMap: Map<string, FrameNode>,
	selectedAnnotationId?: string,
	yOffset = 0, // Add offset for interactions track
): void {
	const { startTime, endTime, topDepth } = viewState;
	const { width } = dimensions;
	const timeRange = endTime - startTime;

	// Find the frame to attach the label to
	const frame = findFrameById(frameMap, annotation.frameId);

	// Skip if frame is not found or not visible
	if (!frame || !isFrameVisible(frame, viewState)) return;

	// Determine if this annotation is selected
	const isSelected = selectedAnnotationId === annotation.id;

	// Calculate frame position, adding the yOffset for interactions track
	const frameX =
		((frame.start + (frame.end - frame.start) / 2 - startTime) / timeRange) *
		width;
	const frameY = (frame.depth - topDepth) * 24 + 30 + yOffset; // Top of the frame (30px timescale offset + yOffset)

	// Set styles for the label
	ctx.fillStyle = '#000000';
	ctx.globalAlpha = 1.0;
	ctx.font = isSelected ? 'bold 12px sans-serif' : '12px sans-serif';
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'center';

	// Measure label text
	const labelWidth = ctx.measureText(annotation.label).width + 16;
	const labelHeight = 24;

	// Draw label background (black rectangle with rounded corners)
	ctx.fillStyle = annotation.color || '#000000';
	roundRect(
		ctx,
		frameX - labelWidth / 2,
		frameY - labelHeight - 10,
		labelWidth,
		labelHeight,
		4,
	);
	ctx.fill();

	// Draw label text (white)
	ctx.fillStyle = '#ffffff';
	ctx.fillText(annotation.label, frameX, frameY - labelHeight / 2 - 10);

	// Draw connector line from label to frame
	ctx.strokeStyle = annotation.color || '#000000';
	ctx.lineWidth = isSelected ? 2 : 1.5;
	ctx.beginPath();
	ctx.moveTo(frameX, frameY - labelHeight - 10 + labelHeight);
	ctx.lineTo(frameX, frameY);
	ctx.stroke();
}

// Helper function to darken a color by a specified amount
function darkenColor(color: string, amount: number): string {
	// Convert hex to RGB
	let r = Number.parseInt(color.slice(1, 3), 16);
	let g = Number.parseInt(color.slice(3, 5), 16);
	let b = Number.parseInt(color.slice(5, 7), 16);

	// Darken each component
	r = Math.max(0, Math.floor(r * (1 - amount)));
	g = Math.max(0, Math.floor(g * (1 - amount)));
	b = Math.max(0, Math.floor(b * (1 - amount)));

	// Convert back to hex
	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Helper function to draw a rounded rectangle
function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
): void {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}

// Improve the findFrameById function to better handle frame matching

// Replace the existing findFrameById function with this improved version
function findFrameById(
	frameMap: Map<string, FrameNode>,
	frameId: string,
): FrameNode | undefined {
	// Try exact match first
	if (frameMap.has(frameId)) {
		return frameMap.get(frameId);
	}

	// If not found, try to find a frame with a similar ID
	// This is useful when the exact timestamp might not match
	const [pid, tid, name, timestamp] = frameId.split('-');

	// Convert timestamp to number for comparison
	const targetTime = Number.parseFloat(timestamp);

	// Find the closest frame by name and time
	let closestFrame: FrameNode | undefined;
	let minTimeDiff = Number.MAX_VALUE;

	for (const [id, frame] of frameMap.entries()) {
		// Check if the frame name matches
		if (id.includes(`${pid}-${tid}-${name}`)) {
			// Calculate time difference
			const frameTime = (frame.start + frame.end) / 2;
			const timeDiff = Math.abs(frameTime - targetTime);

			// Update closest frame if this one is closer
			if (timeDiff < minTimeDiff) {
				minTimeDiff = timeDiff;
				closestFrame = frame;
			}
		}
	}

	// Only return if we found a reasonably close match (within 5ms)
	return minTimeDiff <= 5 ? closestFrame : undefined;
}

// Check if a frame is visible in the current view
function isFrameVisible(frame: FrameNode, viewState: ViewState): boolean {
	const { startTime, endTime, topDepth, visibleDepthCount } = viewState;

	// Check if frame is within the visible time range
	const timeVisible = frame.end >= startTime && frame.start <= endTime;

	// Check if frame is within the visible depth range
	const depthVisible =
		frame.depth >= topDepth && frame.depth < topDepth + visibleDepthCount;

	return timeVisible && depthVisible;
}

// Find annotation at a specific time (for highlight annotations)
export function findAnnotationAt(
	time: number,
	annotations: Annotation[],
): Annotation | null {
	// Only consider highlight annotations for time-based selection
	const highlightAnnotations = annotations.filter(
		(annotation): annotation is HighlightAnnotation =>
			annotation.type === 'highlight',
	);

	return (
		highlightAnnotations.find(
			(annotation) =>
				time >= annotation.startTime && time <= annotation.endTime,
		) || null
	);
}

// Find annotation by frame ID (for link and label annotations)
export function findAnnotationByFrameId(
	frameId: string,
	annotations: Annotation[],
): Annotation | null {
	return (
		annotations.find(
			(annotation) =>
				(annotation.type === 'label' && annotation.frameId === frameId) ||
				(annotation.type === 'link' &&
					(annotation.fromFrameId === frameId ||
						annotation.toFrameId === frameId)),
		) || null
	);
}
