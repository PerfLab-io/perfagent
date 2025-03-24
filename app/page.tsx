'use client';

import './landing.css';
import { LowFpsPerformanceViz } from '@/components/landing-hero';
import { LandingBanner } from '@/components/landing-banner';
import { SignupNotification } from '@/components/signup-notification';
import { Header } from '@/components/header';

export default function LandingPage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<Header />

			{/* Hero section */}
			<section className="overflow-hidden">
				<LowFpsPerformanceViz />
			</section>

			{/* Features section */}
			<section
				id="features"
				className="bg-peppermint-50 py-20 dark:bg-background"
			>
				<LandingBanner />
			</section>

			{/* Signup notification section */}
			<section id="signup">
				<SignupNotification />
			</section>

			{/* Simple footer */}
			<footer className="border-t border-border bg-peppermint-50 py-8 dark:bg-background">
				<div className="container mx-auto px-4">
					<div className="flex flex-col items-center justify-between gap-4 md:flex-row">
						<div className="text-sm text-foreground">
							© {new Date().getFullYear()} PerfAgent is part of PerfLab All
							rights reserved.
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}
