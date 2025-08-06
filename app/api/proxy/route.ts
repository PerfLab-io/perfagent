import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Simple proxy endpoint to handle CORS issues for client-side metadata fetching
 */
export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const url = searchParams.get('url');

		if (!url) {
			return NextResponse.json({ error: 'URL is required' }, { status: 400 });
		}

		const acceptLanguage = request.headers.get('Accept-Language') || 'en-US';

		// Fetch the webpage content with the user's language preference
		const response = await fetch(url, {
			headers: {
				'User-Agent':
					'Mozilla/5.0 (compatible; PerfAgentBot/1.0; +https://agent.perflab.io)',
				'Accept-Language': acceptLanguage,
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch URL: ${response.statusText}`);
		}

		const html = await response.text();

		// Return the HTML content as text
		return new NextResponse(html, {
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
				'Access-Control-Allow-Origin': '*',
			},
		});
	} catch (error) {
		console.error('Error in proxy service:', error);
		return NextResponse.json(
			{ error: error.message || 'Failed to fetch URL' },
			{ status: 500 },
		);
	}
}
