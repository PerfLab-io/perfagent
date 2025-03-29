'use client';

import React, {
	useState,
	useEffect,
	useRef,
	useCallback,
	useContext,
	useMemo,
} from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
	Search,
	Globe,
	BookOpen,
	ChevronRight,
	ChevronDown,
	BarChart,
	Loader2,
	ChevronUp,
	X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import type { MessageAnnotation } from '@/lib/hooks/use-chat';
import { FeedbackButtons } from '@/components/feedback-buttons';
import { filterProgressSteps } from '@/lib/filter-progress';

/**
 * Types and Interfaces
 */

/**
 * Research context state structure
 */
interface ResearchContextState {
	[key: string]: ResearchInstance;
}

/**
 * Structure for a single research instance
 */
interface ResearchInstance {
	results: ResearchResult[];
	steps: ResearchStep[];
	visibleSteps: string[];
	activeStep: string | null;
	phase: ResearchPhase;
	progress: number;
	showResults: boolean;
	completed: boolean;
	toolCallId: string | null;
	isCancelled: boolean;
}

/**
 * Type for research phases
 */
type ResearchPhase = 'planning' | 'searching' | 'analyzing' | 'complete';

/**
 * Structure for a research result
 */
interface ResearchResult {
	id: string;
	title: string;
	snippet: string;
	source: 'web' | 'academic' | 'analysis';
	sourceIcon: string | React.ReactNode;
	url?: string;
}

/**
 * Structure for a research step
 */
interface ResearchStep {
	id: string;
	title: string;
	subtitle: string;
	icon: string | React.ReactNode;
	status: 'complete' | 'in-progress' | 'pending';
	expanded?: boolean;
}

/**
 * Props for ResearchCard component
 */
interface ResearchCardProps {
	query: string;
	triggerAnimation: boolean;
	preserveData?: boolean;
	researchId: string;
	toolCallId?: string | null;
	onAbort?: (toolCallId?: string) => void;
	streamedData?: {
		phase?: ResearchPhase;
		progress?: number;
		steps?: ResearchStep[];
		visibleSteps?: string[];
		activeStep?: string | null;
		results?: ResearchResult[];
		showResults?: boolean;
		completed?: boolean;
	};
	annotations?: MessageAnnotation[];
}

/**
 * Context for sharing research data across components
 */
const ResearchContext = React.createContext<{
	state: ResearchContextState;
	setState: React.Dispatch<React.SetStateAction<ResearchContextState>>;
	onAbort?: (toolCallId?: string) => void;
}>({
	state: {},
	setState: () => {},
	onAbort: undefined,
});

/**
 * Research context provider component
 */
export function ResearchProvider({
	children,
	onAbort,
}: {
	children: React.ReactNode;
	onAbort?: (toolCallId?: string) => void;
}) {
	const [state, setState] = useState<ResearchContextState>({});

	return (
		<ResearchContext.Provider
			value={{
				state,
				setState,
				onAbort,
			}}
		>
			{children}
		</ResearchContext.Provider>
	);
}

/**
 * Custom hook for accessing and updating research state
 */
function useResearch(id: string) {
	const { state, setState, onAbort } = useContext(ResearchContext);

	const updateState = useCallback(
		(update: Partial<ResearchInstance>) => {
			setState((prevState) => ({
				...prevState,
				[id]: {
					...(prevState[id] || getInitialResearchState()),
					...update,
				},
			}));
		},
		[id, setState],
	);

	return {
		data: state[id] || getInitialResearchState(),
		updateState,
		onAbort,
	};
}

/**
 * Helper function to get initial research state
 */
function getInitialResearchState(): ResearchInstance {
	return {
		results: [],
		steps: [],
		visibleSteps: [],
		activeStep: null,
		phase: 'planning',
		progress: 0,
		showResults: false,
		completed: false,
		toolCallId: null,
		isCancelled: false,
	};
}

/**
 * Utility functions for icons and styling
 */
const utils = {
	/**
	 * Converts string icon names to React components
	 */
	getIconComponent: (iconName: string) => {
		const iconMap = {
			Search: <Search className="h-5 w-5" />,
			Globe: <Globe className="h-5 w-5" />,
			BarChart: <BarChart className="h-5 w-5" />,
		};

		return iconMap[iconName as keyof typeof iconMap] || iconMap.Search;
	},

	/**
	 * Gets text description for current research phase
	 */
	getPhaseText: (phase: ResearchPhase, isCancelled: boolean): string => {
		if (isCancelled) return 'Research cancelled';

		const phaseTexts = {
			planning: 'Planning research',
			searching: 'Searching sources',
			analyzing: 'Analyzing results',
			complete: 'Research complete',
		};

		return phaseTexts[phase];
	},

	/**
	 * Gets CSS classes for phase badge
	 */
	getPhaseBadgeStyle: (phase: ResearchPhase, isCancelled: boolean): string => {
		if (isCancelled) {
			return 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive-foreground';
		}

		return phase === 'complete'
			? 'bg-peppermint-100 text-peppermint-800 dark:bg-peppermint-800 dark:text-peppermint-100'
			: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100';
	},

	/**
	 * Gets CSS classes for step status colors
	 */
	getStatusColor: (status: 'complete' | 'in-progress' | 'pending'): string => {
		const statusColors = {
			complete: 'text-peppermint-600 dark:text-peppermint-300',
			'in-progress': 'text-indigo-600 dark:text-indigo-200',
			pending: 'text-foreground/50 dark:text-foreground/70',
		};

		return statusColors[status];
	},

	/**
	 * Gets CSS classes for result source badge
	 */
	getSourceColor: (source: string): string => {
		const sourceColors = {
			web: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100',
			academic:
				'bg-peppermint-100 text-peppermint-800 dark:bg-peppermint-800 dark:text-peppermint-100',
			analysis:
				'bg-merino-100 text-merino-800 dark:bg-merino-800 dark:text-merino-100',
			default: 'bg-muted text-muted-foreground',
		};

		return (
			sourceColors[source as keyof typeof sourceColors] || sourceColors.default
		);
	},

	/**
	 * Gets CSS classes for step container
	 */
	getStepContainerStyle: (
		step: ResearchStep,
		visibleSteps: string[],
	): string => {
		return cn(
			'rounded-lg border border-border/20 p-3',
			'transition-all duration-300 ease-in-out',
			!visibleSteps.includes(step.id) && 'hidden',
			step.status === 'in-progress' &&
				'-translate-y-1 translate-x-1 bg-accent/10 shadow-[-4px_4px_0_hsl(var(--border-color))]',
			step.status === 'complete' && 'bg-background',
		);
	},

	/**
	 * Gets CSS classes for step icon
	 */
	getStepIconStyle: (
		status: 'complete' | 'in-progress' | 'pending',
	): string => {
		return cn(
			'rounded-full p-2 transition-colors duration-300',
			status === 'complete'
				? 'bg-peppermint-100 text-peppermint-800 dark:bg-peppermint-800 dark:text-peppermint-100'
				: status === 'in-progress'
					? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
					: 'bg-muted text-muted-foreground dark:bg-muted/80 dark:text-muted-foreground/90',
		);
	},

	/**
	 * Gets CSS classes for result container
	 */
	getResultContainerStyle: (isExpanded: boolean): string => {
		return cn(
			'rounded-lg border border-border/20 p-3 transition-all duration-200',
			isExpanded ? 'bg-accent' : 'bg-background hover:bg-accent/10',
		);
	},
};

/**
 * Research Card Component
 * Displays research progress, steps, and results
 */
export function ResearchCard({
	query,
	triggerAnimation,
	preserveData = false,
	researchId,
	toolCallId: propToolCallId,
	onAbort,
	streamedData,
	annotations,
}: ResearchCardProps) {
	// Context and state management
	const {
		data,
		updateState,
		onAbort: contextOnAbort,
	} = useResearch(researchId);

	// UI state
	const [isCardExpanded, setIsCardExpanded] = useState(true);
	const [expandedResult, setExpandedResult] = useState<string | null>(null);

	// Research state (using derived state from context where possible)
	const [searchPhase, setSearchPhase] = useState<ResearchPhase>(
		preserveData && data.completed ? 'complete' : 'planning',
	);
	const [progress, setProgress] = useState(
		preserveData && data.completed ? 100 : 0,
	);
	const [results, setResults] = useState<ResearchResult[]>(
		preserveData && data.results.length > 0 ? data.results : [],
	);
	const [steps, setSteps] = useState<ResearchStep[]>(
		preserveData && data.steps.length > 0 ? data.steps : [],
	);
	const [visibleSteps, setVisibleSteps] = useState<string[]>(
		preserveData && data.visibleSteps.length > 0 ? data.visibleSteps : [],
	);
	const [activeStep, setActiveStep] = useState<string | null>(data.activeStep);
	const [showResults, setShowResults] = useState(
		preserveData && data.showResults,
	);
	const [isCancelled, setIsCancelled] = useState(data.isCancelled || false);
	const [toolCallId, setToolCallId] = useState<string | null>(
		propToolCallId || data.toolCallId || null,
	);

	// Refs
	const bottomRef = useRef<HTMLDivElement>(null);
	const lastStreamedDataRef = useRef<string | null>(null);
	const isCompletedRef = useRef<boolean>(false);

	// Memoized counts for badges and deduplicated results
	const { resultCounts, uniqueResults } = useMemo(() => {
		// Deduplicate results by title and source
		const seenItems = new Map<string, ResearchResult>();

		results.forEach((result) => {
			const key = `${result.title}-${result.source}`;
			if (!seenItems.has(key)) {
				seenItems.set(key, result);
			}
		});

		const deduplicatedResults = Array.from(seenItems.values());

		return {
			uniqueResults: deduplicatedResults,
			resultCounts: {
				total: deduplicatedResults.length,
				web: deduplicatedResults.filter((r) => r.source === 'web').length,
				academic: deduplicatedResults.filter((r) => r.source === 'academic')
					.length,
				analysis: deduplicatedResults.filter((r) => r.source === 'analysis')
					.length,
			},
		};
	}, [results]);

	/**
	 * Scroll to the bottom of the component
	 */
	const scrollToBottom = useCallback(() => {
		setTimeout(() => {
			bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
		}, 50);
	}, []);

	/**
	 * Generate a unique toolCallId for this research instance if not already set
	 */
	useEffect(() => {
		if (!toolCallId && triggerAnimation && !preserveData) {
			const newToolCallId = `research-${researchId}-${Date.now()}`;
			setToolCallId(newToolCallId);
			updateState({ toolCallId: newToolCallId });
		}
	}, [triggerAnimation, preserveData, toolCallId, researchId, updateState]);

	/**
	 * Process streamed data by converting string icons to React components
	 */
	const processStreamedData = useCallback((data: any) => {
		if (!data) return null;

		const processed: any = { ...data };

		if (data.steps) {
			processed.steps = data.steps.map((step: ResearchStep) => ({
				...step,
				icon:
					typeof step.icon === 'string'
						? utils.getIconComponent(step.icon)
						: step.icon,
			}));
		}

		if (data.results) {
			processed.results = data.results.map((result: ResearchResult) => ({
				...result,
				sourceIcon:
					typeof result.sourceIcon === 'string'
						? utils.getIconComponent(result.sourceIcon)
						: result.sourceIcon,
			}));
		}

		return processed;
	}, []);

	/**
	 * Helper function to update steps from annotation data
	 */
	const updateStepFromAnnotation = useCallback(
		(data: any) => {
			const stepId = data.type;
			const existingStepIndex = steps.findIndex((step) => step.id === stepId);

			if (existingStepIndex === -1) {
				// Create new step
				const newStep: ResearchStep = {
					id: stepId,
					title: data.title,
					subtitle: data.message || '',
					icon: utils.getIconComponent(
						data.type === 'web'
							? 'Globe'
							: data.type === 'analysis'
								? 'BarChart'
								: 'Search',
					),
					status:
						data.status === 'completed'
							? 'complete'
							: data.status === 'running'
								? 'in-progress'
								: 'pending',
					expanded: data.status === 'running',
				};

				setSteps((prev) => [...prev, newStep]);

				// Add to visible steps if not already there
				if (!visibleSteps.includes(stepId)) {
					setVisibleSteps((prev) => [...prev, stepId]);
				}

				// Set as active step if it's in progress
				if (data.status === 'running') {
					setActiveStep(stepId);
				}
			} else {
				// Update existing step
				setSteps((prevSteps) => {
					const updatedSteps = [...prevSteps];
					const currentStep = updatedSteps[existingStepIndex];

					// Don't change status if the step is already complete
					const newStatus =
						currentStep.status === 'complete'
							? 'complete'
							: data.status === 'completed'
								? 'complete'
								: data.status === 'running'
									? 'in-progress'
									: 'pending';

					updatedSteps[existingStepIndex] = {
						...currentStep,
						title: data.title,
						subtitle: data.message || currentStep.subtitle,
						status: newStatus,
						expanded:
							data.status === 'running' && newStatus !== 'complete'
								? true
								: currentStep.expanded,
					};
					return updatedSteps;
				});

				// Add to visible steps if not already there
				if (!visibleSteps.includes(stepId)) {
					setVisibleSteps((prev) => [...prev, stepId]);
				}

				// Set as active step if it's in progress
				if (data.status === 'running') {
					setActiveStep(stepId);
				}
			}
		},
		[steps, visibleSteps],
	);

	/**
	 * Update state when streamed data changes
	 */
	useEffect(() => {
		if (!streamedData || isCancelled) return;

		// Process the streamed data
		const processedData = processStreamedData(streamedData);
		if (!processedData) return;

		// Check if the data has actually changed to prevent unnecessary updates
		const currentDataString = JSON.stringify(processedData);
		if (lastStreamedDataRef.current === currentDataString) return;
		lastStreamedDataRef.current = currentDataString;

		// Check if research is completed
		const isCompleted = processedData.completed || false;
		if (isCompleted) {
			isCompletedRef.current = true;
		}

		// Prepare updates
		const updates: Record<string, any> = {};
		let needsUpdate = false;

		// Only add fields to updates if they're different from current state
		if (processedData.phase && processedData.phase !== searchPhase) {
			updates.phase = processedData.phase;
			needsUpdate = true;
		}

		if (
			processedData.progress !== undefined &&
			processedData.progress !== progress
		) {
			updates.progress = processedData.progress;
			needsUpdate = true;
		}

		if (processedData.steps) {
			// We need to do a deep comparison here
			// Convert steps to a format that can be compared consistently
			const processedStepsString = JSON.stringify(
				processedData.steps.map((s) => ({ ...s, icon: typeof s.icon })),
			);
			const currentStepsString = JSON.stringify(
				steps.map((s) => ({ ...s, icon: typeof s.icon })),
			);

			if (processedStepsString !== currentStepsString) {
				// Preserve completed status for steps
				const newSteps = processedData.steps.map((step: ResearchStep) => {
					const existingStep = steps.find((s) => s.id === step.id);
					if (existingStep && existingStep.status === 'complete') {
						return { ...step, status: 'complete' };
					}
					return step;
				});

				updates.steps = newSteps;
				needsUpdate = true;
			}
		}

		if (
			processedData.visibleSteps &&
			JSON.stringify(processedData.visibleSteps) !==
				JSON.stringify(visibleSteps)
		) {
			updates.visibleSteps = processedData.visibleSteps;
			needsUpdate = true;
		}

		if (
			processedData.activeStep !== undefined &&
			processedData.activeStep !== activeStep
		) {
			updates.activeStep = processedData.activeStep;
			needsUpdate = true;
		}

		if (processedData.results) {
			// Compare results by ID
			const currentResultIds = new Set(results.map((r) => r.id));
			const hasNewResults = processedData.results.some(
				(r: ResearchResult) => !currentResultIds.has(r.id),
			);

			if (hasNewResults) {
				updates.results = processedData.results;
				needsUpdate = true;
			}
		}

		if (
			processedData.showResults !== undefined &&
			processedData.showResults !== showResults
		) {
			updates.showResults = processedData.showResults;
			needsUpdate = true;
		}

		// Only apply state updates if something actually changed
		if (needsUpdate) {
			// Apply state updates
			if (updates.phase) setSearchPhase(updates.phase);
			if (updates.progress !== undefined) setProgress(updates.progress);
			if (updates.steps) setSteps(updates.steps);
			if (updates.visibleSteps) setVisibleSteps(updates.visibleSteps);
			if (updates.activeStep !== undefined) setActiveStep(updates.activeStep);
			if (updates.results) setResults(updates.results);
			if (updates.showResults !== undefined)
				setShowResults(updates.showResults);

			// Update the context state when research is completed
			if (isCompleted) {
				updateState({
					...updates,
					completed: true,
					toolCallId,
				});
			}
		}
	}, [
		streamedData,
		isCancelled,
		processStreamedData,
		toolCallId,
		updateState,
		searchPhase,
		progress,
		steps,
		visibleSteps,
		activeStep,
		results,
		showResults,
	]);

	/**
	 * Process annotations when they change
	 */
	useEffect(() => {
		if (!annotations || annotations.length === 0 || isCancelled) return;

		// Filter annotations related to research updates
		const researchUpdates = annotations.filter(
			(annotation) => annotation.type === 'research_update' && annotation.data,
		);

		if (researchUpdates.length === 0) return;

		// Track if we've already processed these annotations by using their IDs
		// This is more reliable than comparing the entire object which may have changing timestamps
		const annotationIds = researchUpdates
			.map(
				(a) =>
					`${a.data?.id || ''}-${a.data?.status || ''}-${a.data?.timestamp || ''}`,
			)
			.join('|');

		if (lastStreamedDataRef.current === annotationIds) return;
		lastStreamedDataRef.current = annotationIds;

		// Batch all state updates to avoid rerendering loops
		const updates: Partial<{
			searchPhase: ResearchPhase;
			progress: number;
			steps: ResearchStep[];
			visibleSteps: string[];
			activeStep: string | null;
			results: ResearchResult[];
			showResults: boolean;
			completedFlag: boolean;
		}> = {};

		// Process each annotation
		for (const annotation of researchUpdates) {
			const data = annotation.data;
			if (!data) continue;

			// Get the last annotation to check completion status at the end
			const lastData = data;

			// Handle progress updates
			if (data.type === 'progress') {
				if (data.status === 'completed' && data.isComplete) {
					updates.searchPhase = 'complete';
					updates.completedFlag = true;
				}

				if (
					data.completedSteps !== undefined &&
					data.totalSteps !== undefined
				) {
					updates.progress = Math.round(
						(data.completedSteps / data.totalSteps) * 100,
					);
				}

				// Skip creating a step for progress entries
				continue;
			}

			// Update progress if available
			if (data.completedSteps !== undefined && data.totalSteps !== undefined) {
				updates.progress = Math.round(
					(data.completedSteps / data.totalSteps) * 100,
				);
			}

			// Update phase based on status
			if (data.status === 'running') {
				// Set phase based on type
				if (data.type === 'plan' || data.type === 'research_plan') {
					updates.searchPhase = 'planning';
				} else if (
					data.type === 'web' ||
					data.type === 'academic' ||
					data.type.includes('web') ||
					data.type.includes('academic')
				) {
					updates.searchPhase = 'searching';
				} else if (
					['analysis', 'gaps', 'synthesis'].some((t) => data.type.includes(t))
				) {
					updates.searchPhase = 'analyzing';
				}
			}

			// Process step updates
			if (data.type && data.title) {
				// Make a defensive copy of steps and visibleSteps if not already done
				if (!updates.steps) updates.steps = [...steps];
				if (!updates.visibleSteps) updates.visibleSteps = [...visibleSteps];

				// Generate a consistent stepId that works with prefixed types (search-web-0, etc.)
				const stepId = data.id || data.type;
				const existingStepIndex = updates.steps.findIndex(
					(step) => step.id === stepId,
				);

				if (existingStepIndex === -1) {
					// Create a new step
					const newStep: ResearchStep = {
						id: stepId,
						title: data.title,
						subtitle: data.message || '',
						icon: utils.getIconComponent(
							data.type.includes('web') || data.type === 'web'
								? 'Globe'
								: data.type.includes('analysis') || data.type === 'analysis'
									? 'BarChart'
									: 'Search',
						),
						status:
							data.status === 'completed' || data.status === 'complete'
								? 'complete'
								: data.status === 'running' || data.status === 'in-progress'
									? 'in-progress'
									: 'pending',
						expanded:
							data.status === 'running' || data.status === 'in-progress',
					};

					updates.steps.push(newStep);

					// Add to visible steps if not already there
					if (!updates.visibleSteps.includes(stepId)) {
						updates.visibleSteps.push(stepId);
					}

					// Set as active step if it's in progress
					if (data.status === 'running' || data.status === 'in-progress') {
						updates.activeStep = stepId;
					}
				} else {
					// Update existing step
					const currentStep = updates.steps[existingStepIndex];

					// Don't change status if the step is already complete
					const newStatus =
						currentStep.status === 'complete'
							? 'complete'
							: data.status === 'completed' || data.status === 'complete'
								? 'complete'
								: data.status === 'running' || data.status === 'in-progress'
									? 'in-progress'
									: 'pending';

					updates.steps[existingStepIndex] = {
						...currentStep,
						title: data.title || currentStep.title,
						subtitle: data.message || currentStep.subtitle,
						status: newStatus,
						expanded:
							(data.status === 'running' || data.status === 'in-progress') &&
							newStatus !== 'complete'
								? true
								: currentStep.expanded,
					};

					// Add to visible steps if not already there
					if (!updates.visibleSteps.includes(stepId)) {
						updates.visibleSteps.push(stepId);
					}

					// Set as active step if it's in progress
					if (data.status === 'running' || data.status === 'in-progress') {
						updates.activeStep = stepId;
					}
				}
			}

			// Process results
			if (data.results || data.findings) {
				if (!updates.results) updates.results = [...results];

				// Process function to add results
				const processItems = (items: any[], source: string) => {
					if (!items || !Array.isArray(items) || items.length === 0) return;

					const sourceIcon =
						source === 'web' || source.includes('web') ? 'Globe' : 'BarChart';

					// Use stable IDs without Date.now() to prevent duplicates on re-renders
					const formattedResults: ResearchResult[] = items.map(
						(item: any, index: number) => ({
							id:
								item.id ||
								`${source}-${index}-${item.title?.slice(0, 10) || ''}`,
							title: item.title || item.insight || '',
							snippet:
								typeof item.content === 'string'
									? item.content
									: Array.isArray(item.evidence)
										? item.evidence.join('\n')
										: item.evidence || '',
							source: source === 'findings' ? 'analysis' : source,
							sourceIcon: utils.getIconComponent(sourceIcon),
							url: item.url,
						}),
					);

					// Only add new results that don't already exist (by title + source)
					const existingTitles = new Set(
						updates.results.map((r) => `${r.title}-${r.source}`),
					);
					formattedResults.forEach((result) => {
						const key = `${result.title}-${result.source}`;
						if (!existingTitles.has(key)) {
							updates.results.push(result);
							// Only set showResults when fully complete
							if (data.status === 'completed' || data.status === 'complete') {
								updates.showResults = true;
							}
						}
					});
				};

				// Process standard results
				if (data.results) {
					processItems(data.results, data.type || 'web');
				}

				// Process findings (analysis results)
				if (data.findings) {
					processItems(data.findings, 'findings');
				}
			}

			// If this is a completed status, check if it's the final completion
			if (
				(data.status === 'completed' || data.status === 'complete') &&
				(data.isComplete || data.type === 'progress')
			) {
				updates.searchPhase = 'complete';
				updates.completedFlag = true;
			}
		}

		// Apply all state updates at once to prevent render loops
		// Only update states that have actually changed
		if (
			updates.searchPhase !== undefined &&
			updates.searchPhase !== searchPhase
		) {
			setSearchPhase(updates.searchPhase);
		}

		if (updates.progress !== undefined && updates.progress !== progress) {
			setProgress(updates.progress);
		}

		if (updates.steps) {
			// Deduplicate steps by ID - this prevents duplicates from multiple annotations
			const stepMap = new Map<string, ResearchStep>();
			updates.steps.forEach((step) => stepMap.set(step.id, step));
			const uniqueSteps = Array.from(stepMap.values());

			// Check if steps have actually changed before updating
			if (JSON.stringify(uniqueSteps) !== JSON.stringify(steps)) {
				setSteps(uniqueSteps);
			}
		}

		if (updates.visibleSteps) {
			// Deduplicate visible steps
			const uniqueVisibleSteps = [...new Set(updates.visibleSteps)];

			// Check if visible steps have actually changed
			if (JSON.stringify(uniqueVisibleSteps) !== JSON.stringify(visibleSteps)) {
				setVisibleSteps(uniqueVisibleSteps);
			}
		}

		if (updates.activeStep !== undefined && updates.activeStep !== activeStep) {
			setActiveStep(updates.activeStep);
		}

		if (updates.results) {
			// Do a deeper check to see if results have actually changed
			const oldIds = new Set(results.map((r) => `${r.title}-${r.source}`));
			const newIds = new Set(
				updates.results.map((r) => `${r.title}-${r.source}`),
			);

			// Only update if there are different results
			if (
				oldIds.size !== newIds.size ||
				updates.results.some((r) => !oldIds.has(`${r.title}-${r.source}`))
			) {
				setResults(updates.results);
			}
		}

		if (
			updates.showResults !== undefined &&
			updates.showResults !== showResults
		) {
			setShowResults(updates.showResults);
		}

		// Handle completion state
		if (updates.completedFlag) {
			isCompletedRef.current = true;

			// Only update context state once on completion
			if (steps.length > 0 && !isCompletedRef.current) {
				updateState({
					phase: updates.searchPhase || searchPhase,
					progress: updates.progress || progress,
					steps: updates.steps || steps,
					visibleSteps: updates.visibleSteps || visibleSteps,
					activeStep: updates.activeStep || activeStep,
					results: updates.results || results,
					showResults:
						updates.showResults !== undefined
							? updates.showResults
							: showResults,
					completed: true,
					toolCallId,
				});
			}
		}
	}, [
		// Include necessary dependencies
		annotations,
		isCancelled,
		updateState,
		toolCallId,
		// Include state variables that are both read and potentially updated
		activeStep,
		progress,
		results,
		searchPhase,
		showResults,
		steps,
		visibleSteps,
	]);

	/**
	 * Scroll to bottom when visible steps change
	 */
	useEffect(() => {
		if (visibleSteps.length > 0) {
			requestAnimationFrame(scrollToBottom);
		}
	}, [visibleSteps, scrollToBottom]);

	/**
	 * Scroll to bottom when results appear
	 */
	useEffect(() => {
		if (showResults) {
			requestAnimationFrame(scrollToBottom);
		}
	}, [showResults, scrollToBottom]);

	/**
	 * When research is completed, ensure all visible steps are marked as complete
	 */
	useEffect(() => {
		if (searchPhase === 'complete' && !isCancelled) {
			// Using the utility function from filter-progress.ts
			const { filteredSteps, filteredVisibleSteps } = filterProgressSteps(
				steps,
				visibleSteps,
			);

			// Only update state if there are actual changes to avoid infinite loop
			const hasProgressSteps = steps.some((step) => step.id === 'progress');
			const hasIncompleteSteps = steps.some(
				(step) => visibleSteps.includes(step.id) && step.status !== 'complete',
			);

			if (hasProgressSteps || hasIncompleteSteps) {
				// Mark all visible steps as complete and collapse them
				setSteps(
					filteredSteps.map((step) =>
						filteredVisibleSteps.includes(step.id)
							? { ...step, status: 'complete', expanded: false }
							: step,
					),
				);

				// Update visible steps without progress steps
				if (hasProgressSteps) {
					setVisibleSteps(filteredVisibleSteps);
				}

				// Only show results once we have fully completed steps
				// and delay to avoid UI jumping around
				if (uniqueResults.length > 0 && !showResults) {
					// Use a timeout to ensure the research progress card updates first
					setTimeout(() => {
						setShowResults(true);
					}, 500);
				}
			}
		}
	}, [
		searchPhase,
		visibleSteps,
		isCancelled,
		steps,
		uniqueResults,
		showResults,
	]);

	/**
	 * When active step changes, ensure previous steps are marked as completed
	 */
	useEffect(() => {
		if (activeStep && !isCancelled) {
			setSteps((prevSteps) => {
				const stepIds = prevSteps.map((step) => step.id);
				const activeStepIndex = stepIds.indexOf(activeStep);

				if (activeStepIndex > 0) {
					return prevSteps.map((step) => {
						const stepIndex = stepIds.indexOf(step.id);
						// Mark all previous steps as complete
						if (stepIndex < activeStepIndex && stepIndex !== -1) {
							return { ...step, status: 'complete' };
						}
						return step;
					});
				}
				return prevSteps;
			});
		}
	}, [activeStep, isCancelled]);

	/**
	 * Toggle result expansion
	 */
	const toggleResultExpansion = useCallback(
		(id: string) => {
			setExpandedResult((prev) => {
				const newValue = prev === id ? null : id;
				return newValue;
			});
		},
		[scrollToBottom],
	);

	/**
	 * Toggle step expansion
	 */
	const toggleStepExpansion = useCallback((id: string) => {
		setSteps((prev) =>
			prev.map((step) =>
				step.id === id ? { ...step, expanded: !step.expanded } : step,
			),
		);
	}, []);

	/**
	 * Toggle card expansion
	 */
	const toggleCardExpansion = useCallback(() => {
		setIsCardExpanded((prev) => !prev);
	}, []);

	/**
	 * Handle research cancellation
	 */
	const handleAbort = useCallback(() => {
		if (searchPhase !== 'complete' && !isCancelled) {
			console.log('Aborting research with toolCallId:', toolCallId);

			setIsCancelled(true);
			updateState({ isCancelled: true });
			setSearchPhase('complete');
			setProgress(0);
			setActiveStep(null);

			// Call the onAbort callback with this instance's toolCallId
			if (onAbort) {
				onAbort(toolCallId || undefined);
			} else if (contextOnAbort) {
				contextOnAbort(toolCallId || undefined);
			}

			// Update all steps to show they were cancelled
			setSteps((prev) =>
				prev.map((step) =>
					step.status === 'in-progress'
						? { ...step, status: 'pending', expanded: false }
						: step,
				),
			);
		}
	}, [
		searchPhase,
		isCancelled,
		toolCallId,
		updateState,
		onAbort,
		contextOnAbort,
	]);

	/**
	 * Render step content based on step type
	 */
	const renderStepContent = useCallback(
		(stepId: string) => {
			// Find the step in our steps array to access its data
			const step = steps.find((s) => s.id === stepId);
			if (!step) return null;

			// Extract content from step subtitle
			const content = step.subtitle || '';

			// Check for special handling of different step types
			if (
				stepId.startsWith('search-web-') ||
				stepId === 'web' ||
				stepId.includes('web')
			) {
				const webResults = uniqueResults
					.filter((r) => r.source === 'web')
					.slice(0, 3);
				return (
					<>
						<p>Web search results:</p>
						{webResults.length > 0 ? (
							<ul className="list-disc space-y-1 pl-5">
								{webResults.map((item, idx) => (
									<li key={`web-${idx}`}>{item.title}</li>
								))}
							</ul>
						) : (
							<p className="text-sm">{content}</p>
						)}
					</>
				);
			}

			if (
				stepId.startsWith('search-academic-') ||
				stepId === 'academic' ||
				stepId.includes('academic')
			) {
				const academicResults = uniqueResults
					.filter((r) => r.source === 'academic')
					.slice(0, 3);
				return (
					<>
						<p>Academic sources:</p>
						{academicResults.length > 0 ? (
							<ul className="list-disc space-y-1 pl-5">
								{academicResults.map((item, idx) => (
									<li key={`academic-${idx}`}>{item.title}</li>
								))}
							</ul>
						) : (
							<p className="text-sm">{content}</p>
						)}
					</>
				);
			}

			if (
				stepId.startsWith('analysis-') ||
				stepId === 'analysis' ||
				stepId === 'synthesis' ||
				stepId === 'gaps' ||
				stepId.includes('analysis')
			) {
				// Try to find analysis results in the results array
				const analysisResults = uniqueResults.filter(
					(r) => r.source === 'analysis',
				);
				return (
					<>
						<p>{step.title || 'Analysis'} findings:</p>
						{analysisResults.length > 0 ? (
							<ul className="list-disc space-y-1 pl-5">
								{analysisResults.slice(0, 3).map((item, idx) => (
									<li key={`analysis-${idx}`}>{item.title}</li>
								))}
							</ul>
						) : (
							<p className="text-sm">{content}</p>
						)}
					</>
				);
			}

			if (
				stepId === 'plan' ||
				stepId === 'research-plan' ||
				stepId.includes('plan')
			) {
				// Try to extract structured plan data if available
				let planItems: string[] = [];

				// Check for JSON plan data
				try {
					const jsonMatch = content.match(/\{.*\}/s);
					if (jsonMatch) {
						const planData = JSON.parse(jsonMatch[0]);
						if (planData.plan && Array.isArray(planData.plan)) {
							planItems = planData.plan;
						} else if (
							planData.search_queries &&
							Array.isArray(planData.search_queries)
						) {
							// Extract from search queries format
							planItems = planData.search_queries
								.map((q: any) =>
									q.query
										? `${q.query}${q.rationale ? ` (${q.rationale})` : ''}`
										: '',
								)
								.filter(Boolean);
						}
					}
				} catch (e) {
					// If JSON parsing fails, use content as is
				}

				// If we have no structured data, use content as is or defaults
				if (planItems.length === 0) {
					if (content) {
						// Split content by newlines or bullet points
						const lines = content
							.split(/[\n•]+/)
							.map((line) => line.trim())
							.filter(Boolean);

						if (lines.length > 0) {
							planItems = lines;
						}
					}

					// If still no items, use defaults
					if (planItems.length === 0) {
						planItems = [
							'Query authoritative web sources',
							'Analyze performance patterns',
							'Identify optimization opportunities',
						];
					}
				}

				return (
					<>
						<p>Research plan for "{query}":</p>
						<ul className="list-disc space-y-1 pl-5">
							{planItems.map((item, idx) => (
								<li key={`plan-${idx}`}>{item}</li>
							))}
						</ul>
					</>
				);
			}

			// Default content rendering for any other step type
			return (
				<div className="text-sm">
					{content || `Processing ${step.title || 'research'} data...`}
				</div>
			);
		},
		// Include all dependencies to fix the linting issue
		[query, uniqueResults, steps],
	);

	return (
		<div className="mt-4 space-y-4">
			{/* Research Progress Card */}
			<Card className="group relative rounded-lg border border-border bg-card transition-all duration-300">
				<CardHeader
					className={cn(
						'flex flex-row items-center justify-between border-b border-border bg-accent p-4 font-mono text-midnight-950 dark:text-peppermint-950',
						'rounded-t-lg',
						!isCardExpanded && 'rounded-lg', // Apply rounded-lg to all corners when collapsed
					)}
				>
					<div className="flex items-center gap-2">
						<CardTitle className="text-lg font-bold">
							Research Progress
						</CardTitle>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 rounded-full p-0"
							onClick={toggleCardExpansion}
						>
							{isCardExpanded ? (
								<ChevronUp className="h-4 w-4 text-foreground/70" />
							) : (
								<ChevronDown className="h-4 w-4 text-foreground/70" />
							)}
							<span className="sr-only">Toggle card</span>
						</Button>
					</div>

					<div className="flex items-center gap-2">
						<div
							className={cn(
								'rounded-full px-3 py-1 text-sm font-medium',
								utils.getPhaseBadgeStyle(searchPhase, isCancelled),
							)}
						>
							{utils.getPhaseText(searchPhase, isCancelled)}
						</div>

						{/* Cancel button - only show when research is in progress */}
						{!isCancelled && searchPhase !== 'complete' && (
							<Button
								variant="outline"
								size="icon"
								className="h-8 w-8 rounded-full border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
								onClick={handleAbort}
								title="Cancel research"
							>
								<X className="h-4 w-4" />
								<span className="sr-only">Cancel research</span>
							</Button>
						)}
					</div>
				</CardHeader>

				<CardContent
					className={cn(
						'overflow-hidden transition-all duration-300',
						isCardExpanded
							? 'max-h-[1000px] p-4 opacity-100'
							: 'max-h-0 p-0 opacity-0',
					)}
				>
					<div className="mb-4 space-y-2">
						<div className="flex justify-between text-xs text-foreground/60">
							<span>Progress</span>
							<span>{progress}%</span>
						</div>
						<Progress value={progress} className="h-1.5" />
					</div>

					<div className="space-y-3">
						{steps.map((step) => (
							<div
								key={step.id}
								className={utils.getStepContainerStyle(step, visibleSteps)}
								style={{
									transitionProperty: 'transform, box-shadow, background-color',
									transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
								}}
							>
								<div
									className="flex cursor-pointer items-start justify-between"
									onClick={() => toggleStepExpansion(step.id)}
								>
									<div className="flex items-start gap-3">
										<div className={utils.getStepIconStyle(step.status)}>
											{step.status === 'in-progress' ? (
												<div className="animate-spin">
													<Loader2 className="h-5 w-5" />
												</div>
											) : (
												step.icon
											)}
										</div>
										<div>
											<h3
												className={cn(
													'font-medium',
													utils.getStatusColor(step.status),
												)}
											>
												{step.title}
											</h3>
											<p className="text-sm text-foreground/70">
												{step.subtitle}
											</p>
										</div>
									</div>
									<button type="button" className="mt-1 flex-shrink-0">
										{step.expanded ? (
											<ChevronDown className="h-4 w-4 text-foreground/60" />
										) : (
											<ChevronRight className="h-4 w-4 text-foreground/60" />
										)}
									</button>
								</div>

								{step.expanded && (
									<div className="mt-3 space-y-2 pl-12 text-sm text-foreground/90 animate-in fade-in-50 dark:text-foreground/90">
										{renderStepContent(step.id)}
									</div>
								)}
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Results Card - Only show when research is complete and we have results */}
			{showResults && uniqueResults.length > 0 && (
				<Card
					className={cn(
						'group relative w-full rounded-xl border-border bg-background transition-all duration-300 hover:-translate-y-1 hover:translate-x-1 hover:shadow-[-8px_8px_0_hsl(var(--border-color))]',
						'animate-in fade-in slide-in-from-bottom-5',
					)}
				>
					<CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
						<div className="flex items-center gap-2">
							<Search className="h-4 w-4 text-foreground/70" />
							<CardTitle className="text-lg font-bold text-foreground">
								Research Results: {query}
							</CardTitle>
						</div>
						<div className="flex items-center gap-2">
							<Badge
								variant="outline"
								className="bg-peppermint-100/50 text-peppermint-800 dark:bg-peppermint-800/50 dark:text-peppermint-100"
							>
								Complete
							</Badge>
							<FeedbackButtons
								messageId={`research-${researchId}`}
								source="research"
							/>
						</div>
					</CardHeader>

					<CardContent className="p-4 pt-2">
						<div className="space-y-4">
							<div className="mb-2 flex flex-wrap gap-2">
								<Badge
									variant="outline"
									className="bg-background text-foreground/70 hover:bg-accent"
								>
									{resultCounts.total} results
								</Badge>
								<Badge
									variant="outline"
									className="bg-indigo-100/50 text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-800/50 dark:text-indigo-100 dark:hover:bg-indigo-700"
								>
									<Globe className="mr-1 h-3 w-3" /> Web: {resultCounts.web}
								</Badge>
								<Badge
									variant="outline"
									className="bg-peppermint-100/50 text-peppermint-800 hover:bg-peppermint-100 dark:bg-peppermint-800/50 dark:text-peppermint-100 dark:hover:bg-peppermint-700"
								>
									<BookOpen className="mr-1 h-3 w-3" /> Academic:{' '}
									{resultCounts.academic}
								</Badge>
								<Badge
									variant="outline"
									className="bg-merino-100/50 text-merino-800 hover:bg-merino-100 dark:bg-merino-800/50 dark:text-merino-100 dark:hover:bg-merino-700"
								>
									<BarChart className="mr-1 h-3 w-3" /> Analysis:{' '}
									{resultCounts.analysis}
								</Badge>
							</div>

							<div className="space-y-3">
								{uniqueResults.map((result) => (
									<div
										key={result.id}
										className={utils.getResultContainerStyle(
											expandedResult === result.id,
										)}
									>
										<div
											className="flex cursor-pointer items-start justify-between"
											onClick={() => toggleResultExpansion(result.id)}
										>
											<div className="flex items-start gap-3">
												<div
													className={cn(
														'rounded-md p-2',
														utils.getSourceColor(result.source),
													)}
												>
													{result.sourceIcon}
												</div>
												<div>
													<h3 className="font-medium text-foreground">
														{result.title}
													</h3>
													{expandedResult !== result.id && (
														<p className="line-clamp-1 text-sm text-foreground/70">
															{result.snippet}
														</p>
													)}
												</div>
											</div>
											<button type="button" className="mt-1 flex-shrink-0">
												{expandedResult === result.id ? (
													<ChevronDown className="h-4 w-4 text-foreground/60" />
												) : (
													<ChevronRight className="h-4 w-4 text-foreground/60" />
												)}
											</button>
										</div>

										{expandedResult === result.id && (
											<div className="mt-2 pl-12">
												<p className="mb-2 text-sm text-foreground/80">
													{result.snippet}
												</p>
												{result.url && (
													<a
														href={result.url}
														target="_blank"
														rel="noopener noreferrer"
														className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
													>
														View source <ChevronRight className="h-3 w-3" />
													</a>
												)}
											</div>
										)}
									</div>
								))}
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Invisible element for scrolling reference */}
			<div ref={bottomRef} />
		</div>
	);
}
