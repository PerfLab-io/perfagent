'use client';

/**
 * Utility for fetching metadata from URLs client-side
 */

export interface LinkMetadata {
	title?: string;
	description?: string;
	image?: string;
	url: string;
}

/**
 * Fetches metadata for a URL using a client-side approach with DOMParser
 *
 * This extracts basic metadata by fetching the HTML and parsing it client-side.
 * Note: Cross-origin restrictions apply; this works best with CORS-enabled sites.
 */
export async function fetchMetadata(url: string): Promise<LinkMetadata | null> {
	try {
		// Create a proxy URL to handle CORS issues
		const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;

		// Fetch the page content with user's preferred language
		const response = await fetch(proxyUrl, {
			headers: {
				'Accept-Language': navigator.language || 'en-US',
			},
		});

		if (!response.ok) {
			throw new Error(`Error fetching URL: ${response.statusText}`);
		}

		const html = await response.text();

		// Parse the HTML
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');

		// Extract metadata
		const metadata: LinkMetadata = {
			url,
			title: extractTitle(doc),
			description: extractDescription(doc),
			image: extractImage(doc, url),
		};

		return metadata;
	} catch (error) {
		console.error('Error fetching metadata:', error);

		// Fallback: Return basic metadata based on URL
		const domain = extractDomainFromUrl(url);
		return {
			url,
			title: domain,
			description: `Content from ${domain}`,
		};
	}
}

// Helper function to extract domain from URL
function extractDomainFromUrl(url: string): string {
	try {
		const urlObj = new URL(url);
		return urlObj.hostname;
	} catch (e) {
		// If URL parsing fails, just return the URL
		return url;
	}
}

// Helper functions to extract metadata
function extractTitle(document: Document): string {
	// Try og:title first, then twitter:title, then regular title
	const ogTitle = document
		.querySelector('meta[property="og:title"]')
		?.getAttribute('content');
	const twitterTitle = document
		.querySelector('meta[name="twitter:title"]')
		?.getAttribute('content');
	const regularTitle = document.querySelector('title')?.textContent;

	return ogTitle || twitterTitle || regularTitle || '';
}

function extractDescription(document: Document): string {
	// Try og:description first, then twitter:description, then meta description
	const ogDesc = document
		.querySelector('meta[property="og:description"]')
		?.getAttribute('content');
	const twitterDesc = document
		.querySelector('meta[name="twitter:description"]')
		?.getAttribute('content');
	const metaDesc = document
		.querySelector('meta[name="description"]')
		?.getAttribute('content');

	return ogDesc || twitterDesc || metaDesc || '';
}

function extractImage(document: Document, baseUrl: string): string {
	// Try og:image first, then twitter:image
	const ogImage = document
		.querySelector('meta[property="og:image"]')
		?.getAttribute('content');
	const twitterImage = document
		.querySelector('meta[name="twitter:image"]')
		?.getAttribute('content');

	let image = ogImage || twitterImage || '';

	// Convert relative URLs to absolute
	if (image && !image.startsWith('http')) {
		try {
			const url = new URL(baseUrl);
			image = image.startsWith('/')
				? `${url.protocol}//${url.host}${image}`
				: `${url.protocol}//${url.host}${url.pathname.replace(/\/[^\/]*$/, '/')}${image}`;
		} catch (e) {
			console.error('Error parsing URL:', e);
		}
	}

	return image;
}
