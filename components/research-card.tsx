'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
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
	BrainCircuit,
	Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { FeedbackButtons } from '@/components/feedback-buttons';
import { researchPlanSchema } from '@/lib/ai/mastra/workflows/researchWorkflow';
import { z } from 'zod';
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from './ui/collapsible';
import { Separator } from './ui/separator';
import { useChat } from '@ai-sdk/react';
import { ResearchUpdateArtifactMetadata } from '@/artifacts/research_update/client';

/**
 * Types and Interfaces
 */

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
	query?: string;
	findingType?: string;
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
	researchPlan?: z.infer<typeof researchPlanSchema>;
}

/**
 * Type for research phases
 */
type ResearchPhase = 'planning' | 'searching' | 'analyzing' | 'complete';

/**
 * Props for ResearchCard component
 */
interface ResearchCardProps {
	query: string;
	triggerAnimation?: boolean;
	onAbort?: () => void;
	artifact: ResearchUpdateArtifactMetadata;
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
			: 'bg-midnight-100 text-midnight-800 dark:bg-midnight-800 dark:text-midnight-100';
	},

	/**
	 * Gets CSS classes for step status colors
	 */
	getStatusColor: (status: 'complete' | 'in-progress' | 'pending'): string => {
		const statusColors = {
			complete: 'text-peppermint-600 dark:text-peppermint-300',
			'in-progress': 'text-merino-600 dark:text-merino-200',
			pending: 'text-foreground/50 dark:text-foreground/70',
		};

		return statusColors[status];
	},

	/**
	 * Gets CSS classes for result source badge
	 */
	getSourceColor: (source: string): string => {
		const sourceColors = {
			web: 'bg-midnight-200 text-midnight-800 dark:bg-midnight-800 dark:text-midnight-200',
			analysis:
				'bg-merino-200 text-merino-800 dark:bg-merino-800 dark:text-merino-200',
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
				'-translate-y-1 translate-x-1 bg-accent/10 text-merino-900 shadow-[-4px_4px_0_hsl(var(--merino-900))]',
			step.status === 'complete' && 'bg-background text-base',
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
				? 'bg-peppermint-200 text-peppermint-800 dark:bg-peppermint-800 dark:text-peppermint-100'
				: status === 'in-progress'
					? 'bg-merino-200 text-merino-800 dark:bg-merino-900 dark:text-merino-200'
					: 'bg-muted text-muted-foreground dark:bg-muted/80 dark:text-muted-foreground/90',
		);
	},

	/**
	 * Gets CSS classes for result container
	 */
	getResultContainerStyle: (isExpanded: boolean): string => {
		return cn(
			'rounded-lg border border-border/20 p-3 transition-all duration-200',
			isExpanded
				? 'bg-accent text-accent-foreground'
				: 'bg-white hover:bg-primary',
		);
	},
};

/**
 * Research Card Component
 * Displays research progress, steps, and results
 */
export function ResearchCard({ query, onAbort, artifact }: ResearchCardProps) {
	// Use the artifact hook instead of context
	const { stop } = useChat();

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
		stop();
		if (onAbort) onAbort();
	}, [onAbort, stop]);

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
		if (!artifact || isCancelled) return;

		// Track if we've already processed these annotations by using their IDs
		// This is more reliable than comparing the entire object which may have changing timestamps
		const annotationIds = `research-${artifact.annotations
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
		for (const data of artifact.annotations) {
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
					researchPlan: data.researchPlan,
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
					researchPlan: data.researchPlan,
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
				const processItems = (items: any[], source: 'web' | 'analysis') => {
					if (!items || !Array.isArray(items) || items.length === 0) return;

					const sourceIcon = source === 'web' ? 'Globe' : 'BarChart';

					// Use stable IDs without Date.now() to prevent duplicates on re-renders
					const formattedResults: ResearchResult[] = items.map(
						(item: any, index: number) => ({
							id: `${data.id}-${stepIteration}-${index}`,
							title: item.title || item.insight,
							content:
								typeof item.content === 'string'
									? item.content
									: Array.isArray(item.evidence)
										? item.evidence.join('\n')
										: item.evidence || '',
							source,
							query: source === 'web' ? data.query : undefined,
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
		artifact,
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

			const StepIcon = step.id === 'web' ? Check : BrainCircuit;

			return (
				<ul className="list-disc">
					{step.researchPlan && (
						<li className="flex list-none items-start gap-1 px-0 py-1 text-sm">
							<div className="flex items-start gap-3">
								<div
									className={cn(
										'relative flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md',
										step.status === 'complete' &&
											'bg-peppermint-200 dark:bg-peppermint-900',
										step.status === 'in-progress' &&
											'bg-midnight-200 dark:bg-midnight-900',
									)}
								>
									<Search
										className={cn(
											step.id === 'web' ? 'h-3.5 w-3.5' : 'h-3 w-3',
											step.status === 'complete' &&
												'text-peppermint-600 dark:text-peppermint-400',
											step.status === 'in-progress' &&
												'text-midnight-600 dark:text-midnight-400',
										)}
									/>
								</div>
							</div>
							<p className="flex w-5/6 flex-col gap-2">
								<div className="flex flex-col gap-1">
									<strong>Topic</strong>
									{step.researchPlan.topic}
								</div>
								<Collapsible
									className={cn(
										'w-full rounded-md border border-dashed p-2 data-[state=open]:border-solid',
										step.status === 'complete' &&
											'border-peppermint-500 data-[state=open]:bg-white dark:border-peppermint-900',
										step.status === 'in-progress' &&
											'border-midnight-500 data-[state=open]:bg-midnight-50 dark:border-midnight-900',
									)}
								>
									<CollapsibleTrigger
										className={cn(
											'flex w-full items-center justify-between gap-1',
											step.status === 'complete' &&
												'text-peppermint-700 dark:text-peppermint-300',
											step.status === 'in-progress' &&
												'text-midnight-700 dark:text-midnight-300',
										)}
									>
										<div className="flex items-center gap-1">
											<Globe className="h-3 w-3" />
											<span className="font-semibold">Search Queries</span>
										</div>
										<ChevronDown className="h-3 w-3" />
									</CollapsibleTrigger>
									<CollapsibleContent>
										<Separator
											orientation="horizontal"
											className="my-2 w-full bg-peppermint-300 dark:bg-peppermint-900"
										/>
										<ul>
											{step.researchPlan.searchQueries.map((query) => (
												<li
													key={query.query}
													className="flex list-none items-start gap-2 px-0 py-1 text-sm"
												>
													<div className="flex items-start gap-3">
														<div
															className={cn(
																'relative mt-1 h-3.5 w-3.5 flex-shrink-0 rounded-sm border border-solid',
																step.status === 'complete' &&
																	'border-peppermint-300 bg-peppermint-50 dark:border-peppermint-900',
																step.status === 'in-progress' &&
																	'border-midnight-300 bg-midnight-50 dark:border-midnight-900',
															)}
														/>
													</div>
													<div className="flex flex-col gap-1">
														<span className="font-semibold">{query.query}</span>
														<span className="text-sm text-foreground/70">
															{query.rationale}
														</span>
													</div>
												</li>
											))}
										</ul>
									</CollapsibleContent>
								</Collapsible>
								<Collapsible
									className={cn(
										'w-full rounded-md border border-dashed p-2 data-[state=open]:border-solid',
										step.status === 'complete' &&
											'border-peppermint-500 data-[state=open]:bg-white dark:border-peppermint-900',
										step.status === 'in-progress' &&
											'border-midnight-500 data-[state=open]:bg-midnight-50 dark:border-midnight-900',
									)}
								>
									<CollapsibleTrigger
										className={cn(
											'flex w-full items-center justify-between gap-1',
											step.status === 'complete' &&
												'text-peppermint-700 dark:text-peppermint-300',
											step.status === 'in-progress' &&
												'text-midnight-700 dark:text-midnight-300',
										)}
									>
										<div className="flex items-center gap-1">
											<BarChart className="h-3 w-3" />
											<strong>Required Analyses</strong>
										</div>
										<ChevronDown className="h-3 w-3 text-peppermint-700 dark:text-peppermint-300" />
									</CollapsibleTrigger>
									<CollapsibleContent>
										<Separator
											orientation="horizontal"
											className="my-2 w-full bg-peppermint-300 dark:bg-peppermint-900"
										/>
										<ul>
											{step.researchPlan.requiredAnalyses.map((analysis) => (
												<li
													key={analysis.type}
													className="flex list-none items-start gap-2 px-0 py-1 text-sm"
												>
													<div
														className={cn(
															'relative mt-1 h-3.5 w-3.5 flex-shrink-0 rounded-sm border border-solid',
															step.status === 'complete' &&
																'border-peppermint-300 bg-peppermint-50 dark:border-peppermint-900',
															step.status === 'in-progress' &&
																'border-midnight-300 bg-midnight-50 dark:border-midnight-900',
														)}
													/>
													<div className="flex flex-col gap-1">
														<span className="font-semibold">
															{analysis.type}
														</span>
														<span className="text-sm text-foreground/70">
															{analysis.description}
														</span>
													</div>
												</li>
											))}
										</ul>
									</CollapsibleContent>
								</Collapsible>
							</p>
						</li>
					)}
					{results
						.filter((result) => result.source === stepId)
						.reduce(
							(results, result) => {
								if (result.query) {
									const existing = results.find(
										(r) => r.query === result.query,
									);
									if (existing) {
										existing.results.push(result);
									} else {
										results.push({ query: result.query, results: [result] });
									}
								} else {
									const existing = results.find(
										(r) => r.query === 'global-group',
									);
									if (existing) {
										if (
											!Boolean(
												result.findingType &&
													existing.results.find(
														(r) => r.findingType === result.findingType,
													),
											)
										) {
											existing.results.push(result);
										}
									} else {
										results.push({ query: 'global-group', results: [result] });
									}
								}
								return results;
							},
							[] as { query: string; results: ResearchResult[] }[],
						)
						.map((result) =>
							result.query === 'global-group' ? (
								<>
									{result.results.map((r) => (
										<li
											key={r.id}
											className="flex list-none items-center gap-1 px-0 py-1 text-sm"
										>
											<div className="flex items-start gap-3">
												<div
													className={cn(
														'relative flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md',
														step.status === 'complete' &&
															'bg-peppermint-200 dark:bg-peppermint-900',
														step.status === 'in-progress' &&
															'bg-merino-200 dark:bg-merino-900',
													)}
												>
													<StepIcon
														className={cn(
															step.id === 'web' ? 'h-3.5 w-3.5' : 'h-3 w-3',
															step.status === 'complete' &&
																'text-peppermint-600 dark:text-peppermint-400',
															step.status === 'in-progress' &&
																'text-merino-600 dark:text-merino-400',
														)}
													/>
												</div>
											</div>
											{r.findingType || r.title}
										</li>
									))}
								</>
							) : (
								<li
									key={result.query}
									className="flex list-none items-center gap-1 px-0 py-1 text-sm"
								>
									<Collapsible
										className={cn(
											'group w-full rounded-md border border-dashed p-2 data-[state=open]:border-solid',
											step.status === 'complete' &&
												'border-peppermint-500 data-[state=open]:bg-white dark:border-peppermint-900',
											step.status === 'in-progress' &&
												'border-merino-500 data-[state=open]:bg-merino-50 dark:border-merino-900',
										)}
									>
										<CollapsibleTrigger
											className={cn(
												'flex w-full items-center justify-between gap-1',
												step.status === 'complete' &&
													'text-peppermint-700 dark:text-peppermint-300',
												step.status === 'in-progress' &&
													'text-merino-700 dark:text-merino-300',
											)}
										>
											<div className="flex w-full items-center justify-between gap-1">
												<span className="text-left font-semibold">
													{result.query}
												</span>
												<div
													className={cn(
														'flex items-center space-x-1 rounded border border-dashed bg-transparent p-2 px-2 py-0.5 text-xs group-data-[state=open]:border-solid dark:group-data-[state=open]:bg-white',
														step.status === 'complete' &&
															'border-peppermint-500 dark:bg-peppermint-900',
														step.status === 'in-progress' &&
															'border-merino-500 dark:bg-merino-900',
													)}
												>
													<span
														className={cn(
															'shrink-0',
															step.status === 'complete' &&
																'text-peppermint-700 dark:text-peppermint-300',
															step.status === 'in-progress' &&
																'text-merino-700 dark:text-merino-300',
														)}
													>
														{result.results.length > 1
															? `${result.results.length} results`
															: '1 result'}
													</span>
												</div>
											</div>
											<ChevronDown className="h-3 w-3" />
										</CollapsibleTrigger>
										<CollapsibleContent>
											<Separator
												orientation="horizontal"
												className={cn(
													'my-2 w-full',
													step.status === 'complete' &&
														'bg-peppermint-300 dark:bg-peppermint-900',
													step.status === 'in-progress' &&
														'bg-merino-300 dark:bg-merino-900',
												)}
											/>
											<ul
												className={cn(
													step.status === 'complete' &&
														'text-peppermint-600 dark:text-peppermint-400',
													step.status === 'in-progress' &&
														'text-merino-600 dark:text-merino-400',
												)}
											>
												{result.results.map((r) => (
													<li
														key={r.id}
														className="flex list-none items-start gap-2 px-0 py-1 text-sm"
													>
														<div className="flex items-start gap-3">
															<div
																className={cn(
																	'relative flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-current',
																	step.status === 'complete' &&
																		'bg-peppermint-200 dark:bg-peppermint-900',
																	step.status === 'in-progress' &&
																		'bg-merino-200 dark:bg-merino-900',
																)}
															>
																<StepIcon
																	className={cn(
																		step.id === 'web'
																			? 'h-3.5 w-3.5'
																			: 'h-3 w-3',
																	)}
																/>
															</div>
														</div>
														<div className="flex flex-col gap-1">
															<span className="font-semibold">{r.title}</span>
														</div>
													</li>
												))}
											</ul>
										</CollapsibleContent>
									</Collapsible>
								</li>
							),
						)}
				</ul>
			);
		},
		[results],
	);

	// Only render if we have a research artifact
	if (!artifact) return null;

	return (
		<div className="mt-4 w-full space-y-4">
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
						'overflow-y-scroll transition-all duration-300',
						isCardExpanded
							? 'max-h-[600px] p-4 opacity-100'
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
												<p className="text-text-current/70 text-sm">
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
							Show results
						</Button>
					</DialogTrigger>
					<DialogContent className="w-9/12 max-w-screen-lg">
						<DialogHeader>
							<Card
								className={cn(
									'group relative mt-4 w-full rounded-xl border-border bg-white',
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
											messageId={`research-${artifact.researchId}`}
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
												className="bg-midnight-100/50 text-midnight-800 hover:bg-midnight-100 dark:bg-midnight-800/50 dark:text-midnight-100 dark:hover:bg-midnight-700"
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

										<div className="max-h-[65dvh] space-y-3 overflow-y-scroll">
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
																<h3 className="font-medium text-current">
																	{result.title}
																</h3>
																{expandedResult !== result.id && (
																	<p className="text-current/70 line-clamp-1 text-sm">
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
																<ChevronDown className="text-current/60 h-4 w-4" />
															) : (
																<ChevronRight className="text-current/60 h-4 w-4" />
															)}
														</button>
													</div>

													{expandedResult === result.id && (
														<div className="mt-2 pl-12">
															<p className="text-current/80 mb-2 text-sm">
																{result.content}
															</p>
															{result.url && (
																<a
																	href={result.url}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="inline-flex items-center gap-1 text-xs text-midnight-600 hover:underline dark:text-midnight-400"
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
						</DialogHeader>
					</DialogContent>
				</Dialog>
			)}

			{/* Invisible element for scrolling reference */}
			<div ref={bottomRef} />
		</div>
	);
}
