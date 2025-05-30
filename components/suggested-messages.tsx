'use client';

import { useState, useEffect } from 'react';
import { Lightbulb, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface SuggestedMessagesProps {
	files: Array<{
		id: string;
		name: string;
		type: string;
	}>;
	onSelectSuggestion: (message: string) => void;
	isLoading?: boolean;
	suggestions?: string[];
}

export function SuggestedMessages({
	files,
	onSelectSuggestion,
	isLoading = false,
	suggestions = [],
}: SuggestedMessagesProps) {
	const [visible, setVisible] = useState(false);
	const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);
	const [loadingTimeout, setLoadingTimeout] = useState(false);

	useEffect(() => {
		// Delay to allow for animation
		const timer = setTimeout(() => {
			setVisible(true);
		}, 300); // Slightly delayed after file preview appears

		// Add a timeout for loading state
		let loadingTimer: NodeJS.Timeout | null = null;
		if (isLoading) {
			loadingTimer = setTimeout(() => {
				setLoadingTimeout(true);
			}, 10000); // Show timeout message after 5 seconds
		} else {
			setLoadingTimeout(false);
		}

		return () => {
			clearTimeout(timer);
			if (loadingTimer) clearTimeout(loadingTimer);
		};
	}, [isLoading]);

	const handleSelectSuggestion = (suggestion: string) => {
		setActiveSuggestion(suggestion);
		onSelectSuggestion(suggestion);
	};

	// Only render if there are files or suggestions
	if (!files.length && !suggestions.length) return null;

	return (
		<div
			className={cn(
				'file-section transition-all duration-300 ease-out', // Add file-section class for consistent transitions
				visible ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0',
			)}
		>
			<div className="pb-1 pt-2">
				<div className="mb-2 flex items-center gap-2 text-sm text-foreground">
					<Lightbulb className="h-4 w-4 text-merino-600 dark:text-merino-300" />
					<span>Suggested questions based on your trace file:</span>
				</div>
				<div className="flex flex-wrap gap-2">
					{isLoading ? (
						// Skeleton UI for loading state
						<>
							{loadingTimeout ? (
								<div className="text-sm italic text-foreground">
									Taking longer than expected to load suggestions...
								</div>
							) : (
								<>
									<Skeleton className="h-9 w-32 rounded-lg bg-peppermint-200 dark:bg-peppermint-700" />
									<Skeleton className="h-9 w-48 rounded-lg bg-peppermint-200 dark:bg-peppermint-700" />
									<Skeleton className="h-9 w-40 rounded-lg bg-peppermint-200 dark:bg-peppermint-700" />
									<Skeleton className="h-9 w-36 rounded-lg bg-peppermint-200 dark:bg-peppermint-700" />
								</>
							)}
						</>
					) : suggestions.length > 0 ? (
						suggestions.map((suggestion, index) => {
							const isActive = suggestion === activeSuggestion;
							return (
								<button
									key={index}
									onClick={() => handleSelectSuggestion(suggestion)}
									className={cn(
										'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
										'focus:outline-hidden focus:ring-0',
										isActive
											? 'border border-merino-800 bg-merino-50 text-merino-800 dark:border-merino-900 dark:bg-merino-100 dark:text-merino-900'
											: 'border border-border bg-background text-foreground hover:border-merino-600 hover:bg-merino-50 hover:text-merino-600 dark:hover:border-merino-900 dark:hover:bg-merino-50 dark:hover:text-merino-900',
									)}
								>
									{isActive && (
										<Check className="h-3.5 w-3.5 text-merino-600 dark:text-merino-400" />
									)}
									{suggestion}
								</button>
							);
						})
					) : null}
				</div>
			</div>
		</div>
	);
}
