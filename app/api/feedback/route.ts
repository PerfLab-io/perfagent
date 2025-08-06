import { type NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { messageId, rating, source } = body;

		if (!messageId || rating === undefined) {
			return NextResponse.json(
				{ error: 'Missing required fields' },
				{ status: 400 },
			);
		}

		// Log the feedback (in a real implementation, this would be saved to a database)
		console.log(
			`Feedback received: messageId=${messageId}, rating=${rating}, source=${source || 'message'}`,
		);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Error processing feedback:', error);
		return NextResponse.json(
			{
				error: 'Internal server error',
				message: error.message || 'Unknown error',
			},
			{ status: 500 },
		);
	}
}
