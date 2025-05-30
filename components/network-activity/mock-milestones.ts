import { MilestoneType, type PageLoadMilestone } from './types';

// Mock page load milestones
export const mockMilestones: PageLoadMilestone[] = [
	{
		type: MilestoneType.NavigationStart,
		time: 0, // 0s
		color: '#1e293b', // Dark slate blue
	},
	{
		type: MilestoneType.FirstContentfulPaint,
		time: 700, // 0.7s
		color: '#65a30d', // Green
	},
	{
		type: MilestoneType.MarkDOMContent,
		time: 1100, // 1.1s
		color: '#94a3b8', // Slate gray
	},
	{
		type: MilestoneType.MarkLoad,
		time: 1500, // 1.5s
		color: '#475569', // Dark gray
	},
	{
		type: MilestoneType.LargestContentfulPaintCandidate,
		time: 1800, // 1.8s
		color: '#166534', // Dark green
	},
];

// Function to get milestones that are visible in the current view
export function getVisibleMilestones(
	milestones: PageLoadMilestone[],
	startTime: number,
	endTime: number,
): PageLoadMilestone[] {
	return milestones.filter(
		(milestone) => milestone.time >= startTime && milestone.time <= endTime,
	);
}
