'use client';
import { cn } from '@/lib/utils';
import { SimpleThemeToggle } from './simple-theme-toggle';
import { useState } from 'react';
import { useEffect } from 'react';

export function Header() {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const handleScroll = () => {
			setScrolled(window.scrollY > 50);
		};
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	return (
		<header
			className={cn(
				'fixed left-0 right-0 top-0 z-50 bg-peppermint-950 transition-all duration-300',
				scrolled ? 'bg-black/25 py-2 shadow-md backdrop-blur-md' : 'py-4',
			)}
		>
			<div className="container mx-auto flex items-center justify-between px-4">
				<span className="text-xl font-bold text-white">PerfAgent</span>
				<div className="flex items-center gap-4">
					<SimpleThemeToggle />
				</div>
			</div>
		</header>
	);
}
