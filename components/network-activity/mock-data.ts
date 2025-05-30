import { type SyntheticNetworkRequest } from '@perflab/trace_engine/models/trace/types/TraceEvents';
import { ResourceType } from './types';

// Helper function to determine resource type from MIME type and URL
function getResourceType(mimeType: string, url: string): ResourceType {
	if (mimeType.includes('html')) return ResourceType.Document;
	if (mimeType.includes('css')) return ResourceType.Stylesheet;
	if (mimeType.includes('javascript') || mimeType.includes('js'))
		return ResourceType.Script;
	if (
		mimeType.includes('image') ||
		url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)
	)
		return ResourceType.Image;
	if (mimeType.includes('font') || url.match(/\.(woff|woff2|ttf|otf|eot)$/i))
		return ResourceType.Font;
	return ResourceType.Other;
}

// Helper function to determine if a URL is first-party
function isFirstParty(url: string): boolean {
	// Assume example.com is the first-party domain
	return url.includes('example.com') || !url.includes('://');
}

// Process the mock data to add additional information
export function processNetworkData(requests: SyntheticNetworkRequest[]) {
	// Calculate stacking depths for expanded view
	let maxDepth = 0;
	const depthMap = new Map<number, number>();

	requests.forEach((request) => {
		const startMs = request.ts / 1000;
		const endMs = (request.ts + request.dur) / 1000;

		// Find the smallest available depth
		let depth = 0;
		while (true) {
			const isOccupied = Array.from(depthMap.entries()).some(([ts, d]) => {
				const entryStartMs = ts / 1000;
				const entryEndMs = entryStartMs + (depthMap.get(ts) || 0);
				return d === depth && entryStartMs < endMs && entryEndMs > startMs;
			});

			if (!isOccupied) break;
			depth++;
		}

		depthMap.set(request.ts, depth);
		maxDepth = Math.max(maxDepth, depth);
	});

	return {
		requests,
		maxDepth: maxDepth + 1,
	};
}
