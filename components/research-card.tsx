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
 * Helper function to convert string icon names to React components
 */
const getIconComponent = (iconName: string) => {
	const iconMap = {
		Search: <Search className="h-5 w-5" />,
		Globe: <Globe className="h-5 w-5" />,
		BookOpen: <BookOpen className="h-5 w-5" />,
		BarChart: <BarChart className="h-5 w-5" />,
	};

	return iconMap[iconName as keyof typeof iconMap] || iconMap.Search;
};

/**
 * Style utility functions
 */
const styleUtils = {
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

	getPhaseBadgeStyle: (phase: ResearchPhase, isCancelled: boolean): string => {
		if (isCancelled) {
			return 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive-foreground';
		}

		return phase === 'complete'
			? 'bg-peppermint-100 text-peppermint-800 dark:bg-peppermint-800 dark:text-peppermint-100'
			: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100';
	},

	getStatusColor: (status: 'complete' | 'in-progress' | 'pending'): string => {
		const statusColors = {
			complete: 'text-peppermint-600 dark:text-peppermint-300',
			'in-progress': 'text-indigo-600 dark:text-indigo-200',
			pending: 'text-foreground/50 dark:text-foreground/70',
		};

		return statusColors[status];
	},

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

	// Memoized counts for badges
	const resultCounts = useMemo(() => {
		return {
			total: results.length,
			web: results.filter((r) => r.source === 'web').length,
			academic: results.filter((r) => r.source === 'academic').length,
			analysis: results.filter((r) => r.source === 'analysis').length,
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
	 * Process annotations when they change
	 */
	useEffect(() => {
		if (!annotations || annotations.length === 0 || isCancelled) return;

		// Filter annotations
		const researchUpdates = annotations.filter(
			(annotation) => annotation.type === 'research_update' && annotation.data,
		);

		if (researchUpdates.length === 0) return;

		// Process each annotation
		for (const annotation of researchUpdates) {
			const data = annotation.data;
			if (!data) continue;

			// Update progress if available
			if (data.completedSteps !== undefined && data.totalSteps !== undefined) {
				const newProgress = Math.round(
					(data.completedSteps / data.totalSteps) * 100,
				);
				setProgress(newProgress);
			}

			// Update phase based on status
			if (data.status === 'completed') {
				if (data.type === 'progress' && data.isComplete) {
					setSearchPhase('complete');
					isCompletedRef.current = true;
				}
			} else if (data.status === 'running') {
				// Set phase based on type
				if (data.type === 'plan') {
					setSearchPhase('planning');
				} else if (data.type === 'web' || data.type === 'academic') {
					setSearchPhase('searching');
				} else if (['analysis', 'gaps', 'synthesis'].includes(data.type)) {
					setSearchPhase('analyzing');
				}
			}

			// Update steps
			if (data.type && data.title) {
				updateStepFromAnnotation(data);
			}

			// Update results if available
			if (
				data.results &&
				Array.isArray(data.results) &&
				data.results.length > 0
			) {
				const formattedResults: ResearchResult[] = data.results.map(
					(result, index) => ({
						id: result.id || `result-${index}`,
						title: result.title || '',
						snippet: result.content || '',
						source: result.source || 'web',
						sourceIcon: getIconComponent(
							result.source === 'web'
								? 'Globe'
								: result.source === 'academic'
									? 'BookOpen'
									: 'BarChart',
						),
						url: result.url,
					}),
				);

				setResults(formattedResults);
				setShowResults(true);
			}

			// Process findings
			if (
				data.findings &&
				Array.isArray(data.findings) &&
				data.findings.length > 0
			) {
				const formattedResults: ResearchResult[] = data.findings.map(
					(finding, index) => ({
						id: `finding-${index}`,
						title: finding.insight || '',
						snippet: Array.isArray(finding.evidence)
							? finding.evidence.join('\n')
							: finding.evidence || '',
						source: 'analysis',
						sourceIcon: getIconComponent('BarChart'),
						url: undefined,
					}),
				);

				setResults((prev) => [...prev, ...formattedResults]);
				setShowResults(true);
			}
		}

		// Update the context state
		updateState({
			phase: searchPhase,
			progress,
			steps,
			visibleSteps,
			activeStep,
			results,
			showResults,
			completed: isCompletedRef.current,
			toolCallId,
		});

		// Scroll to bottom when new data arrives
		scrollToBottom();
	}, [
		annotations,
		isCancelled,
		searchPhase,
		progress,
		steps,
		visibleSteps,
		activeStep,
		results,
		showResults,
		toolCallId,
		updateState,
		scrollToBottom,
	]);

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
					icon: getIconComponent(
						data.type === 'web'
							? 'Globe'
							: data.type === 'academic'
								? 'BookOpen'
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
					updatedSteps[existingStepIndex] = {
						...updatedSteps[existingStepIndex],
						title: data.title,
						subtitle: data.message || updatedSteps[existingStepIndex].subtitle,
						status:
							data.status === 'completed'
								? 'complete'
								: data.status === 'running'
									? 'in-progress'
									: 'pending',
						expanded:
							data.status === 'running'
								? true
								: updatedSteps[existingStepIndex].expanded,
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
	 * Process streamed data
	 */
	const processStreamedData = useCallback((data: any) => {
		if (!data) return null;

		const processed: any = { ...data };

		if (data.steps) {
			processed.steps = data.steps.map((step: ResearchStep) => ({
				...step,
				icon:
					typeof step.icon === 'string'
						? getIconComponent(step.icon)
						: step.icon,
			}));
		}

		if (data.results) {
			processed.results = data.results.map((result: ResearchResult) => ({
				...result,
				sourceIcon:
					typeof result.sourceIcon === 'string'
						? getIconComponent(result.sourceIcon)
						: result.sourceIcon,
			}));
		}

		return processed;
	}, []);

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
		if (processedData.completed) {
			isCompletedRef.current = true;
		}

		// Update component state based on the streamed data
		if (processedData.phase) setSearchPhase(processedData.phase);
		if (processedData.progress !== undefined)
			setProgress(processedData.progress);

		// Special handling for steps to ensure completed steps stay completed
		if (processedData.steps) {
			setSteps((prevSteps) => {
				// Create a map of previous steps with "complete" status
				const completedStepsMap = new Map();
				prevSteps.forEach((step) => {
					if (step.status === 'complete') {
						completedStepsMap.set(step.id, true);
					}
				});

				// Update new steps, preserving "complete" status for previously completed steps
				return processedData.steps.map((step) => {
					// If the step was previously completed or is now completed, mark it as complete
					if (completedStepsMap.has(step.id) || step.status === 'complete') {
						return { ...step, status: 'complete' };
					}
					return step;
				});
			});
		}

		if (processedData.visibleSteps) setVisibleSteps(processedData.visibleSteps);
		if (processedData.activeStep !== undefined)
			setActiveStep(processedData.activeStep);
		if (processedData.results) setResults(processedData.results);
		if (processedData.showResults !== undefined)
			setShowResults(processedData.showResults);

		// Update the context state when research is completed
		if (processedData.completed) {
			updateState({
				phase: processedData.phase || data.phase,
				progress:
					processedData.progress !== undefined
						? processedData.progress
						: data.progress,
				steps: streamedData.steps || data.steps,
				visibleSteps: processedData.visibleSteps || data.visibleSteps,
				activeStep:
					processedData.activeStep !== undefined
						? processedData.activeStep
						: data.activeStep,
				results: streamedData.results || data.results,
				showResults:
					processedData.showResults !== undefined
						? processedData.showResults
						: data.showResults,
				completed: true,
				toolCallId: toolCallId,
			});
		}
	}, [
		streamedData,
		isCancelled,
		processStreamedData,
		updateState,
		data,
		toolCallId,
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
			setSteps((prevSteps) =>
				prevSteps.map((step) =>
					visibleSteps.includes(step.id)
						? { ...step, status: 'complete' }
						: step,
				),
			);
		}
	}, [searchPhase, visibleSteps, isCancelled]);

	/**
	 * Toggle result expansion
	 */
	const toggleResultExpansion = useCallback(
		(id: string) => {
			setExpandedResult((prev) => {
				const newValue = prev === id ? null : id;
				if (newValue) {
					// Schedule scroll after state update and DOM render
					requestAnimationFrame(scrollToBottom);
				}
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
			switch (stepId) {
				case 'plan':
					return (
						<>
							<p>Research plan for "{query}":</p>
							<ul className="list-disc space-y-1 pl-5">
								<li>Query Go documentation for concurrency patterns</li>
								<li>Search academic papers on CSP implementation in Go</li>
								<li>Analyze common usage patterns in open source projects</li>
								<li>Compare with other language concurrency models</li>
							</ul>
						</>
					);
				case 'web':
					return (
						<>
							<p>Web search results:</p>
							<ul className="list-disc space-y-1 pl-5">
								<li>Go Blog: Concurrency Patterns</li>
								<li>GitHub: Go Concurrency Examples</li>
								<li>Medium: Advanced Go Concurrency</li>
							</ul>
						</>
					);
				case 'academic':
					return (
						<>
							<p>Academic sources:</p>
							<ul className="list-disc space-y-1 pl-5">
								<li>Paper: "Effective Go Concurrency Patterns"</li>
								<li>Research: "CSP vs Actor Model in Modern Languages"</li>
							</ul>
						</>
					);
				case 'analysis':
					return (
						<>
							<p>Analysis findings:</p>
							<ul className="list-disc space-y-1 pl-5">
								<li>Worker pools are the most common pattern</li>
								<li>Context package is underutilized for cancellation</li>
								<li>Error handling in concurrent code needs improvement</li>
							</ul>
						</>
					);
				default:
					return null;
			}
		},
		[query],
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
								styleUtils.getPhaseBadgeStyle(searchPhase, isCancelled),
							)}
						>
							{styleUtils.getPhaseText(searchPhase, isCancelled)}
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
								className={styleUtils.getStepContainerStyle(step, visibleSteps)}
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
										<div className={styleUtils.getStepIconStyle(step.status)}>
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
													styleUtils.getStatusColor(step.status),
												)}
											>
												{step.title}
											</h3>
											<p className="text-sm text-foreground/70">
												{step.subtitle}
											</p>
										</div>
									</div>
									<button className="mt-1 flex-shrink-0">
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

			{/* Results Card - Only show when research is complete */}
			{showResults && (
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
								{results.map((result) => (
									<div
										key={result.id}
										className={styleUtils.getResultContainerStyle(
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
														styleUtils.getSourceColor(result.source),
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
											<button className="mt-1 flex-shrink-0">
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
