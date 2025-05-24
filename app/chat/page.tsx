import type React from 'react';
import { ChatPageComponent } from '@/components/pages/chat';

/**
 * AiChatPage - Main chat interface component with file handling, messaging,
 * and side panel functionality for data visualization and reports
 */
export default async function AiChatPage() {
	return (
		<main className="relative flex flex-1 flex-col">
			<ChatPageComponent />
		</main>
	);
}
