import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// This utility provides URLs for animations based on topic
export function getAnimationUrlForTopic(topic: string): string {
	// Map of topics to image URLs
	const topicImageMap: Record<string, string[]> = {
		'go-overview': [
			'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image.jpg-EljbehpZsrROFsykPrM7V98LGDL6Ij.jpeg',
			'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image%20%282%29.jpg-XR4hQMGf76MbljfHkqY9rFzQ7qCGj1.jpeg',
			'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image%20%281%29.jpg-Pz4QxdhLrFAVy9nqI9pErtlFMPMw73.jpeg',
			'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/homepage-bg.jpg-aFlNIlG7iU5DseeU9qnyR5yGpjvMIj.jpeg',
		],
		concurrency: [
			'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image%20%281%29.jpg-Pz4QxdhLrFAVy9nqI9pErtlFMPMw73.jpeg',
			'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/homepage-bg.jpg-aFlNIlG7iU5DseeU9qnyR5yGpjvMIj.jpeg',
			'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image.jpg-EljbehpZsrROFsykPrM7V98LGDL6Ij.jpeg',
			'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image%20%282%29.jpg-XR4hQMGf76MbljfHkqY9rFzQ7qCGj1.jpeg',
		],
		'error-handling': [
			'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/homepage-bg.jpg-aFlNIlG7iU5DseeU9qnyR5yGpjvMIj.jpeg',
			'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image.jpg-EljbehpZsrROFsykPrM7V98LGDL6Ij.jpeg',
			'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image%20%282%29.jpg-XR4hQMGf76MbljfHkqY9rFzQ7qCGj1.jpeg',
			'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image%20%281%29.jpg-Pz4QxdhLrFAVy9nqI9pErtlFMPMw73.jpeg',
		],
	};

	// Return the first image URL for the topic, or a default if not found
	const images = topicImageMap[topic] || topicImageMap['go-overview'];
	return images[0]; // In a real implementation, this would be a GIF URL
}

export function yieldToMain() {
	// Use scheduler.yield if it exists:
	/* @ts-ignore */
	if (window && 'scheduler' in window && 'yield' in scheduler) {
		/* @ts-ignore */
		return scheduler.yield();
	}

	// Fall back to setTimeout:
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

export function debounce(func: Function, wait: number) {
	let timeout: NodeJS.Timeout | null = null;
	return function executedFunction(...args: any[]) {
		const later = () => {
			if (timeout) {
				clearTimeout(timeout);
			}

			func(...args);
		};
		if (timeout) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(later, wait);
	};
}
