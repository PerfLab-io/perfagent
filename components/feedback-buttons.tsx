'use client';

import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FeedbackButtonsProps {
	messageId: string;
	source?: 'message' | 'research' | 'breakdown' | 'report';
	className?: string;
	size?: 'sm' | 'md';
}

export function FeedbackButtons({
	messageId,
	source = 'message',
	className,
	size = 'sm',
}: FeedbackButtonsProps) {
	const [rating, setRating] = useState<number | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Load saved feedback from localStorage on mount
	useEffect(() => {
		if (typeof window !== 'undefined') {
			try {
				const savedFeedback = localStorage.getItem(`feedback-${messageId}`);
				if (savedFeedback) {
					setRating(JSON.parse(savedFeedback).rating);
				}
			} catch (err) {
				console.error('Error loading saved feedback:', err);
			}
		}
	}, [messageId]);

	const submitFeedback = async (newRating: number) => {
		// If the same rating is clicked again, do nothing
		if (rating === newRating) return;

		setIsSubmitting(true);
		setError(null);

		try {
			const response = await fetch('/api/feedback', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					messageId,
					rating: newRating,
					source,
				}),
			});

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`);
			}

			// Save to localStorage
			localStorage.setItem(
				`feedback-${messageId}`,
				JSON.stringify({
					rating: newRating,
					timestamp: new Date().toISOString(),
				}),
			);

			// Update state
			setRating(newRating);
		} catch (err) {
			console.error('Error submitting feedback:', err);
			setError('Failed to submit feedback');
		} finally {
			setIsSubmitting(false);
		}
	};

	const buttonSize = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';

	return (
		<div className={cn('flex items-center gap-1', className)}>
			<Button
				variant="ghost"
				size="icon"
				className={cn(
					buttonSize,
					'rounded-full',
					rating === 1
						? 'text-peppermint-600 dark:text-peppermint-400'
						: 'text-foreground/60 hover:text-foreground',
					isSubmitting && 'cursor-not-allowed opacity-50',
				)}
				onClick={() => submitFeedback(1)}
				disabled={isSubmitting}
				aria-label="Thumbs up"
			>
				<ThumbsUp
					className={cn('h-4 w-4', rating === 1 ? 'fill-current' : '')}
				/>
			</Button>

			<Button
				variant="ghost"
				size="icon"
				className={cn(
					buttonSize,
					'rounded-full',
					rating === 0
						? 'text-merino-600 dark:text-merino-400'
						: 'text-foreground/60 hover:text-foreground',
					isSubmitting && 'cursor-not-allowed opacity-50',
				)}
				onClick={() => submitFeedback(0)}
				disabled={isSubmitting}
				aria-label="Thumbs down"
			>
				<ThumbsDown
					className={cn('h-4 w-4', rating === 0 ? 'fill-current' : '')}
				/>
			</Button>

			{error && <span className="text-xs text-destructive">{error}</span>}
		</div>
	);
}
