'use client';

import type React from 'react';

import { useRef, useEffect } from 'react';
import type { FrameNode } from './types';

interface HoverCardProps {
	node: FrameNode;
	position: { x: number; y: number };
	canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function HoverCard({ node, position, canvasRef }: HoverCardProps) {
	const cardRef = useRef<HTMLDivElement>(null);

	// Calculate the position of the hover card relative to the canvas
	// and position it below the cursor with a 24px gap
	const cardStyle = {
		left: `${position.x}px`,
		top: `${position.y + 24}px`, // Position 24px below the cursor
		position: 'absolute' as const,
		zIndex: 50,
	};

	// Adjust position if card would go off-screen
	useEffect(() => {
		if (!cardRef.current || !canvasRef.current) return;

		const cardRect = cardRef.current.getBoundingClientRect();
		const canvasRect = canvasRef.current.getBoundingClientRect();

		// Get the scale factor between the canvas logical size and CSS size
		const scaleX = canvasRef.current.width / canvasRect.width;
		const scaleY = canvasRef.current.height / canvasRect.height;

		// Adjust for canvas scaling
		const scaledWidth = cardRect.width * scaleX;
		const scaledHeight = cardRect.height * scaleY;

		// Check if the card extends beyond the right edge of the canvas
		if (position.x + scaledWidth / 2 > canvasRef.current.width) {
			cardRef.current.style.left = `${canvasRef.current.width - scaledWidth}px`;
			cardRef.current.style.transform = 'none';
		} else if (position.x - scaledWidth / 2 < 0) {
			// Check if the card extends beyond the left edge of the canvas
			cardRef.current.style.left = '0px';
			cardRef.current.style.transform = 'none';
		} else {
			// Center horizontally if there's enough space
			cardRef.current.style.left = `${position.x}px`;
			cardRef.current.style.transform = 'translateX(-50%)';
		}

		// Check if the card extends beyond the bottom edge of the canvas
		if (position.y + 24 + scaledHeight > canvasRef.current.height) {
			// Position above the cursor if it would go off the bottom
			cardRef.current.style.top = `${position.y - scaledHeight - 8}px`;
		}
	}, [position, canvasRef]);

	return (
		<div
			ref={cardRef}
			className="bg-perfagent-panel text-perfagent-text border-perfagent-border absolute z-50 border p-3 text-sm shadow-lg"
			style={cardStyle}
		>
			<div className="font-mono font-medium">{node.name}</div>
			<div className="text-perfagent-muted mt-1 font-mono">
				{node.value.toFixed(2)} ms
			</div>
			{node.source && (
				<div className="text-perfagent-muted mt-1 max-w-[280px] truncate font-mono text-xs">
					{node.source}
				</div>
			)}
			{node.sourceScript && (
				<div className="text-perfagent-muted mt-1 max-w-[280px] truncate font-mono text-xs">
					Script: {node.sourceScript}
				</div>
			)}
			{node.cat && (
				<div className="text-perfagent-muted mt-1 max-w-[280px] truncate font-mono text-xs">
					Category: {node.cat}
				</div>
			)}
		</div>
	);
}
