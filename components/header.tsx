'use client';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

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
				'bg-peppermint-950 fixed top-0 right-0 left-0 z-50 transition-all duration-300',
				scrolled ? 'bg-black/25 py-2 shadow-md backdrop-blur-md' : 'py-4',
			)}
		>
			<div className="container mx-auto flex items-center justify-between px-4">
				<span className="text-xl font-bold text-white">PerfAgent</span>
				<div className="flex items-center gap-4">
					<Button asChild>
						<Link href="/chat" prefetch>
							Try it out now
						</Link>
					</Button>
				</div>
			</div>
		</header>
	);
}
