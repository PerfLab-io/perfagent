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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTrigger,
} from '@/components/ui/dialog';

import { cn } from '@/lib/utils';
import {
	Search,
	Globe,
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

export interface ResearchMessageAnnotation {
	type: string;
	data: any;
	toolCallId: string;
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
	content: string;
	source: 'web' | 'analysis';
	sourceIcon: string | React.ReactNode;
	url?: string;
}

/**
 * Structure for a research step
 */
interface ResearchStep {
	id: string;
	iteration: string;
	title: string;
	message: string;
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
	annotations?: ResearchMessageAnnotation[];
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
	getStepContainerStyle: (step: ResearchStep): string => {
		return cn(
			'rounded-lg border border-border/20 p-3',
			'transition-all duration-300 ease-in-out',
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
export function ResearchCard({ query, annotations }: ResearchCardProps) {
	// Context and state management
	const { onAbort: contextOnAbort } = useResearch('asd');

	const [isCardExpanded, setIsCardExpanded] = useState(true);
	const [isCancelled, setIsCancelled] = useState(false);
	const [searchPhase, setSearchPhase] = useState<ResearchPhase>('planning');
	const [progress, setProgress] = useState(0);

	const [steps, setSteps] = useState<ResearchStep[]>([]);
	const [activeStep, setActiveStep] = useState<string | null>(null);
	const [results, setResults] = useState<ResearchResult[]>([]);
	const [expandedResult, setExpandedResult] = useState<string | null>(null);

	const handleAbort = useCallback(() => {
		setIsCancelled(true);
		contextOnAbort?.();
	}, [contextOnAbort]);

	const toggleCardExpansion = useCallback(() => {
		setIsCardExpanded((prev) => !prev);
	}, []);

	// Refs
	const bottomRef = useRef<HTMLDivElement>(null);
	const lastStreamedDataRef = useRef<string>('');

	/**
	 * Scroll to the bottom of the component
	 */
	const scrollToBottom = useCallback(() => {
		// setTimeout(() => {
		// 	bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
		// }, 50);
	}, []);

	/**
	 * Process annotations when they change
	 */
	useEffect(() => {
		if (!annotations || annotations.length === 0 || isCancelled) return;

		// Track if we've already processed these annotations by using their IDs
		// This is more reliable than comparing the entire object which may have changing timestamps
		const annotationIds = `research-${annotations.at(0)?.toolCallId}-${annotations
			.map(
				(a) =>
					`${a.data?.id || ''}-${a.data?.status || ''}-${a.data?.timestamp || ''}`,
			)
			.join('|')}`;

		if (lastStreamedDataRef.current === annotationIds) return;
		lastStreamedDataRef.current = annotationIds;

		// Batch all state updates to avoid rerendering loops
		const updates: {
			searchPhase: ResearchPhase;
			progress: number;
			steps: ResearchStep[];
			activeStep: string | null;
			results: ResearchResult[];
			showResults: boolean;
		} = {
			searchPhase: 'planning',
			progress: 0,
			steps: [],
			activeStep: null,
			results: [],
			showResults: false,
		};

		// Process each annotation
		for (const annotation of annotations) {
			const { data, toolCallId } = annotation;
			if (!data) continue;

			// Update progress if available
			if (data.completedSteps !== undefined && data.totalSteps !== undefined) {
				updates.progress = Math.round(
					(data.completedSteps / data.totalSteps) * 100,
				);
			}

			// Handle main research and analysis step updates
			if (data.type === 'research-and-analysis') {
				if (data.status === 'complete') {
					updates.searchPhase = 'complete';
				}

				continue;
			}

			const stepId = data.type;
			const stepIteration = data.id;
			const existingStepIndex = updates.steps.findIndex(
				(step: ResearchStep) => step.id === stepId,
			);

			if (existingStepIndex === -1) {
				// Create a new step
				const newStep: ResearchStep = {
					id: stepId,
					iteration: stepIteration,
					title: data.title,
					message: data.message || '',
					icon: utils.getIconComponent(
						data.type === 'web'
							? 'Globe'
							: data.type === 'analysis'
								? 'BarChart'
								: 'Search',
					),
					status:
						data.status === 'complete'
							? 'complete'
							: data.status === 'in-progress'
								? 'in-progress'
								: 'pending',
					expanded: data.status === 'in-progress',
				};

				updates.steps.push(newStep);
			} else {
				// Update existing step
				const currentStep = updates.steps[existingStepIndex];

				// Don't change status if the step is already complete
				const newStatus =
					data.status === 'complete'
						? 'complete'
						: data.status === 'in-progress'
							? 'in-progress'
							: 'pending';

				updates.steps[existingStepIndex] = {
					...currentStep,
					iteration: stepIteration,
					title:
						newStatus === 'complete'
							? (() => {
									if (data.type === 'web') {
										return `Web Search ${newStatus}`;
									}
									if (data.type === 'analysis') {
										return `Analysis ${newStatus}`;
									}
									if (data.type === 'research_plan') {
										return `Research Plan ${newStatus}`;
									}
									return currentStep.title;
								})()
							: data.title,
					message: data.message || currentStep.message,
					status: newStatus,
					expanded: newStatus !== 'complete',
				};
			}

			// Set as active step if it's in progress
			if (data.status !== 'complete') {
				updates.activeStep = stepId;
			}

			// Process results
			if (data.results || data.findings) {
				if (!updates.results) updates.results = [];

				// Process function to add results
				const processItems = (items: any[], source: string) => {
					if (!items || !Array.isArray(items) || items.length === 0) return;

					const sourceIcon = source === 'web' ? 'Globe' : 'BarChart';

					// Use stable IDs without Date.now() to prevent duplicates on re-renders
					const formattedResults: ResearchResult[] = items.map(
						(item: any, index: number) => ({
							id: `${toolCallId}-${stepIteration}-${index}`,
							title: item.title || item.insight,
							content:
								typeof item.content === 'string'
									? item.content
									: Array.isArray(item.evidence)
										? item.evidence.join('\n')
										: item.evidence || '',
							source,
							sourceIcon: utils.getIconComponent(sourceIcon),
							url: item.url,
							findingType: data.analysisType
								? `Analysis of results for '${data.analysisType}'`
								: undefined,
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
						}
					});
				};

				// Process standard results
				if (data.results) {
					processItems(data.results, data.type);
				}

				// Process findings (analysis results)
				if (data.findings) {
					processItems(data.findings, data.type);
				}
			}

			// If this is a completed status, check if it's the final completion
			if (data.status === 'complete' && data.type === 'research-and-analysis') {
				updates.searchPhase = 'complete';
			}
		}

		// Apply all state updates at once to prevent render loops
		// Only update states that have actually changed
		if (
			updates.searchPhase !== undefined &&
			updates.searchPhase !== searchPhase
		) {
			setSearchPhase(updates.searchPhase);
			scrollToBottom();
		}

		if (updates.progress !== undefined && updates.progress !== progress) {
			setProgress(updates.progress);
		}

		if (updates.steps) {
			setSteps(updates.steps);
		}

		if (updates.activeStep !== undefined && updates.activeStep !== activeStep) {
			setActiveStep(updates.activeStep);
			scrollToBottom();
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
	}, [
		// Include necessary dependencies
		annotations,
		isCancelled,
	]);

	const toggleStepExpansion = useCallback((stepId: string) => {
		setSteps((prevSteps) =>
			prevSteps.map((step) =>
				step.id === stepId ? { ...step, expanded: !step.expanded } : step,
			),
		);
	}, []);

	const toggleResultExpansion = useCallback((resultId: string) => {
		setExpandedResult((prev) => (prev === resultId ? null : resultId));
	}, []);

	const renderStepContent = useCallback(
		(stepId: string) => {
			const step = steps.find((step) => step.id === stepId);
			if (!step) return null;

			return (
				<ul className="list-disc">
					{results
						.filter((result) => result.source === stepId)
						.reduce((results, result) => {
							if (
								results.length &&
								result.findingType &&
								results.find((r) => r.findingType === result.findingType)
							) {
								return results;
							}

							results.push(result);
							return results;
						}, [] as ResearchResult[])
						.map((result) => (
							<li
								key={result.id}
								className="flex list-none items-center gap-1 px-0 py-1 text-sm"
							>
								<div className="relative h-4 w-4 flex-shrink-0">
									{step.id === 'web' ? (
										<svg
											className="absolute inset-0"
											viewBox="0 0 20 20"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<rect
												width="20"
												height="20"
												rx="4"
												className={cn(
													step.status === 'complete' &&
														'fill-peppermint-200 dark:fill-peppermint-900',
													step.status === 'in-progress' &&
														'fill-midnight-200 dark:fill-midnight-900',
												)}
											/>
											<path
												d="M5 10L8 13L15 7"
												stroke="currentColor"
												strokeWidth="1.5"
												strokeLinecap="round"
												strokeLinejoin="round"
												className={cn(
													step.status === 'complete' &&
														'text-peppermint-600 dark:text-peppermint-400',
													step.status === 'in-progress' &&
														'text-midnight-600 dark:text-midnight-400',
												)}
											/>
										</svg>
									) : (
										<svg
											className="absolute inset-0"
											viewBox="0 0 20 20"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<rect
												width="20"
												height="20"
												rx="4"
												className={cn(
													step.status === 'complete' &&
														'fill-peppermint-200 dark:fill-peppermint-900',
													step.status === 'in-progress' &&
														'fill-midnight-200 dark:fill-midnight-900',
												)}
											/>
											<path
												d="M10 5V15M5 10H15"
												stroke="currentColor"
												strokeWidth="1.5"
												strokeLinecap="round"
												strokeLinejoin="round"
												className={cn(
													step.status === 'complete' &&
														'text-peppermint-600 dark:text-peppermint-400',
													step.status === 'in-progress' &&
														'text-midnight-600 dark:text-midnight-400',
												)}
											/>
										</svg>
									)}
								</div>
								{result.findingType || result.title}
							</li>
						))}
				</ul>
			);
		},
		[results],
	);

	return (
		<div className="mt-4 w-4/6 space-y-4">
			{/* Research Progress Card */}
			<Card className="group relative rounded-lg border border-border bg-card transition-all duration-300">
				<CardHeader
					className={cn(
						'flex flex-row items-center justify-between border-b border-border bg-accent p-4 font-mono text-midnight-950 dark:text-peppermint-950',
						'rounded-t-lg',
						!isCardExpanded && 'rounded-lg',
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
						{steps.map((step, index) => {
							return (
								<div
									key={`${step.id}-${index}`}
									className={utils.getStepContainerStyle(step)}
									style={{
										transitionProperty:
											'transform, box-shadow, background-color',
										transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
									}}
								>
									<div
										className="flex cursor-pointer items-start justify-between"
										onClick={() => toggleStepExpansion(step.id)}
									>
										<div className="flex items-start gap-3 truncate">
											<div className={utils.getStepIconStyle(step.status)}>
												{step.status === 'in-progress' ? (
													<div className="animate-spin">
														<Loader2 className="h-5 w-5" />
													</div>
												) : (
													step.icon
												)}
											</div>
											<div className="shrink">
												<h3
													className={cn(
														'font-medium',
														utils.getStatusColor(step.status),
													)}
												>
													{step.title}
												</h3>
												<p className="text-sm text-foreground/70">
													{step.message}
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
							);
						})}
					</div>
				</CardContent>
			</Card>

			{/* Results Card - Only show when research is complete and we have results */}
			{searchPhase === 'complete' && results.length > 0 && (
				<Dialog>
					<DialogTrigger>
						<Button
							variant="outline"
							size="sm"
							className="rounded-full transition-all duration-300 hover:-translate-y-0.5 hover:translate-x-0.5 hover:shadow-[-4px_4px_0_hsl(var(--border-color))]"
						>
							Show resuls
						</Button>
					</DialogTrigger>
					<DialogContent className="w-9/12 max-w-screen-lg">
						<DialogHeader>
							<DialogDescription className="my-8">
								<Card
									className={cn(
										'group relative w-full rounded-xl border-border bg-background',
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
												messageId={`research-${annotations?.[0]?.toolCallId}`}
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
													{results.length} results
												</Badge>
												<Badge
													variant="outline"
													className="bg-indigo-100/50 text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-800/50 dark:text-indigo-100 dark:hover:bg-indigo-700"
												>
													<Globe className="mr-1 h-3 w-3" /> Web:{' '}
													{
														results.filter((result) => result.source === 'web')
															.length
													}
												</Badge>
												<Badge
													variant="outline"
													className="bg-merino-100/50 text-merino-800 hover:bg-merino-100 dark:bg-merino-800/50 dark:text-merino-100 dark:hover:bg-merino-700"
												>
													<BarChart className="mr-1 h-3 w-3" /> Analysis:{' '}
													{
														results.filter(
															(result) => result.source === 'analysis',
														).length
													}
												</Badge>
											</div>

											<div className="max-h-[530px] space-y-3 overflow-y-scroll xl:max-h-[900px]">
												{results.map((result) => (
													<div
														key={`${result.id}-${Math.random()}`}
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
																			{result.content}
																		</p>
																	)}
																</div>
															</div>
															<button
																type="button"
																className="mt-1 flex-shrink-0"
															>
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
																	{result.content}
																</p>
																{result.url && (
																	<a
																		href={result.url}
																		target="_blank"
																		rel="noopener noreferrer"
																		className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
																	>
																		View source{' '}
																		<ChevronRight className="h-3 w-3" />
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
							</DialogDescription>
						</DialogHeader>
					</DialogContent>
				</Dialog>
			)}

			{/* Invisible element for scrolling reference */}
			<div ref={bottomRef} />
		</div>
	);
}
