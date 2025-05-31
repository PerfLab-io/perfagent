'use server';

import { resend } from '@/lib/resend';
import {
	getAudienceContacts,
	getUsersWithRoleInfo,
	type UserWithRole,
} from '@/app/actions/onboard';
import { OnboardPageWrapper } from '@/components/onboard-wrapper';

export default async function OnboardAdmin({
	searchParams,
}: {
	searchParams: Promise<{ audienceId?: string }>;
}) {
	// Fetch all audiences
	const { data } = await resend.audiences.list();
	const audiences = data ? data.data : [];

	// If an audience is selected, fetch its users
	let initialUsers: UserWithRole[] = [];
	const { audienceId } = await searchParams;
	if (audienceId) {
		try {
			const contacts = await getAudienceContacts(audienceId);
			initialUsers = await getUsersWithRoleInfo(contacts);
		} catch (error) {
			console.error('Error loading audience users:', error);
		}
	}

	return (
		<OnboardPageWrapper
			audiences={audiences}
			initialUsers={initialUsers}
			selectedAudienceId={audienceId}
		/>
	);
}
