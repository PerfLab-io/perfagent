import { ReactNode } from 'react';

/**
 * Interface for a research step
 */
interface ResearchStep {
  id: string;
  title: string;
  subtitle: string;
  icon: string | ReactNode;
  status: 'complete' | 'in-progress' | 'pending';
  expanded?: boolean;
}

/**
 * Result interface for the filterProgressSteps function
 */
interface FilterProgressResult {
  filteredSteps: ResearchStep[];
  filteredVisibleSteps: string[];
}

/**
 * Filters out progress steps from steps and visibleSteps arrays
 * 
 * @param steps Array of research steps
 * @param visibleSteps Array of visible step IDs
 * @returns Object containing filtered steps and visible step IDs
 */
export const filterProgressSteps = (
  steps: ResearchStep[],
  visibleSteps: string[]
): FilterProgressResult => {
  // Filter out 'progress' steps
  const filteredSteps = steps.filter(step => step.id !== 'progress');
  const filteredVisibleSteps = visibleSteps.filter(id => id !== 'progress');
  
  return { filteredSteps, filteredVisibleSteps };
};
