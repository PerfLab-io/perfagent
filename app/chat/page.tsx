import { ChatPageComponent } from '@/components/pages/chat';
import { requireUserWithRole } from '@/lib/session';
import { redirect } from 'next/navigation';

/**
 * AiChatPage - Main chat interface component with file handling, messaging,
 * and side panel functionality for data visualization and reports
 */
export default async function AiChatPage() {
	try {
		await requireUserWithRole('agent-user');
	} catch (error) {
		console.error(error);
		return redirect('/login');
	}

	return (
		<main className="relative flex flex-1 flex-col">
			<ChatPageComponent />
		</main>
	);
}
