import type React from 'react';
import { cn } from '@/lib/utils';

function Skeleton({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				'animate-pulse rounded-md',
				'bg-gray-200 dark:bg-gray-700', // Better contrast in both modes
				className,
			)}
			{...props}
		/>
	);
}

export { Skeleton };
