import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ServerCardSkeleton() {
	return (
		<div className="space-y-4">
			{[1, 2, 3].map((i) => (
				<Card key={i}>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-4">
								<Skeleton className="h-10 w-10 rounded-full" />
								<div>
									<Skeleton className="h-6 w-32" />
									<Skeleton className="mt-2 h-4 w-48" />
								</div>
							</div>
							<div className="flex items-center space-x-2">
								<Skeleton className="h-6 w-11 rounded-full" />
								<Skeleton className="h-9 w-9" />
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<div className="flex space-x-4">
							<Skeleton className="h-6 w-20" />
							<Skeleton className="h-6 w-28" />
							<Skeleton className="h-6 w-24" />
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}
