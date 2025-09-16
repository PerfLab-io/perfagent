'use client';

import './landing.css';
import { LowFpsPerformanceViz } from '@/components/landing-hero';
import { LandingBanner } from '@/components/landing-banner';
import { Header } from '@/components/header';

export default function LandingPage() {
	return (
		<div className="bg-background text-foreground min-h-screen">
			<Header />

			{/* Hero section */}
			<section className="overflow-hidden">
				<LowFpsPerformanceViz />
			</section>

			{/* Features section */}
			<section
				id="features"
				className="bg-peppermint-50 dark:bg-background py-20"
			>
				<LandingBanner />
			</section>

			{/* Simple footer */}
			<footer className="border-border bg-peppermint-50 dark:bg-background border-t py-8">
				<div className="container mx-auto px-4">
					<div className="flex flex-col items-center justify-between gap-4 md:flex-row">
						<div className="text-foreground text-sm">
							© {new Date().getFullYear()} PerfAgent is part of PerfLab All
							rights reserved.
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}
