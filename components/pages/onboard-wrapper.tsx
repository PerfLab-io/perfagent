'use client';

import type React from 'react';
import { useEffect, useState, useTransition, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { ListAudiencesResponseSuccess } from 'resend';
import type { UserWithRole, PendingUpdate } from '@/app/actions/onboard';
import {
	processPendingRoleUpdates,
	getAudienceContacts,
	getUsersWithRoleInfo,
	inviteUnregisteredUsers,
} from '@/app/actions/onboard';

export type OnboardPageWrapperProps = {
	audiences: ListAudiencesResponseSuccess['data'];
	initialUsers: UserWithRole[];
	selectedAudienceId?: string;
};

function OnboardPageContent({
	audiences,
	initialUsers,
	selectedAudienceId,
}: OnboardPageWrapperProps) {
	const router = useRouter();
	const [selectedAudience, setSelectedAudience] = useState<string>(
		selectedAudienceId || '',
	);
	const [users, setUsers] = useState<UserWithRole[]>(initialUsers);
	const [userSelections, setUserSelections] = useState<Map<string, boolean>>(
		new Map(),
	);
	const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);
	const [inviteMode, setInviteMode] = useState<boolean>(false);
	const [pendingInvites, setPendingInvites] = useState<string[]>([]);
	const [status, setStatus] = useState<null | {
		success: boolean;
		message: string;
	}>(null);
	const [isPending, startTransition] = useTransition();
	const [isLoadingUsers, setIsLoadingUsers] = useState(false);

	// Initialize user selections based on current roles
	useEffect(() => {
		const initialSelections = new Map<string, boolean>();
		users.forEach((user) => {
			initialSelections.set(user.email, user.hasAgentUserRole);
		});
		setUserSelections(initialSelections);
	}, [users]);

	// Calculate pending updates when selections change
	useEffect(() => {
		const updates: PendingUpdate[] = [];
		const invites: string[] = [];

		users.forEach((user) => {
			const shouldHaveRole = userSelections.get(user.email) ?? false;

			if (user.existsInDb) {
				// Only create pending updates for users who exist in database and have actual changes
				if (user.id && shouldHaveRole !== user.hasAgentUserRole) {
					updates.push({
						userId: user.id,
						email: user.email,
						shouldHaveRole,
						currentHasRole: user.hasAgentUserRole,
					});
				}
			} else if (inviteMode && shouldHaveRole) {
				// Add to pending invites if in invite mode and user is selected
				invites.push(user.email);
			}
		});

		setPendingUpdates(updates);
		setPendingInvites(invites);
	}, [userSelections, users, inviteMode]);

	// Handle audience selection change
	const handleAudienceChange = async (audienceId: string) => {
		setSelectedAudience(audienceId);
		setUsers([]);
		setStatus(null);

		if (audienceId) {
			setIsLoadingUsers(true);
			try {
				const contacts = await getAudienceContacts(audienceId);
				const usersWithRoles = await getUsersWithRoleInfo(contacts);
				setUsers(usersWithRoles);

				// Update URL to reflect selection
				const url = new URL(window.location.href);
				url.searchParams.set('audienceId', audienceId);
				router.push(url.pathname + url.search);
			} catch (error) {
				console.error('Error loading users:', error);
				setStatus({
					success: false,
					message: `Failed to load users: ${error}`,
				});
			} finally {
				setIsLoadingUsers(false);
			}
		} else {
			// Clear URL parameter when no audience selected
			const url = new URL(window.location.href);
			url.searchParams.delete('audienceId');
			router.push(url.pathname + url.search);
		}
	};

	const handleUserSelectionChange = (email: string, checked: boolean) => {
		setUserSelections((prev) => new Map(prev).set(email, checked));
	};

	const handleProcessUpdates = async () => {
		console.log('pendingUpdates', pendingUpdates);
		console.log('pendingInvites', pendingInvites);

		if (pendingUpdates.length === 0 && pendingInvites.length === 0) {
			setStatus({
				success: false,
				message: 'No changes to process',
			});
			return;
		}

		startTransition(async () => {
			setStatus(null);

			try {
				let roleUpdateResult = {
					success: true,
					processedCount: 0,
					errors: [] as string[],
				};
				let inviteResult = {
					success: true,
					invitedCount: 0,
					errors: [] as string[],
				};

				// Process role updates for existing users
				if (pendingUpdates.length > 0) {
					roleUpdateResult = await processPendingRoleUpdates(pendingUpdates);
				}

				// Process invites for unregistered users
				if (pendingInvites.length > 0) {
					inviteResult = await inviteUnregisteredUsers(pendingInvites);
				}

				const allErrors = [...roleUpdateResult.errors, ...inviteResult.errors];
				const overallSuccess = roleUpdateResult.success && inviteResult.success;

				if (
					overallSuccess ||
					roleUpdateResult.processedCount > 0 ||
					inviteResult.invitedCount > 0
				) {
					const newlyGrantedCount = pendingUpdates.filter(
						(u) => u.shouldHaveRole && !u.currentHasRole,
					).length;
					const revokedCount = pendingUpdates.filter(
						(u) => !u.shouldHaveRole && u.currentHasRole,
					).length;

					let successMessage = '';

					if (roleUpdateResult.processedCount > 0) {
						successMessage += `Successfully processed ${roleUpdateResult.processedCount} role updates`;

						if (newlyGrantedCount > 0) {
							successMessage += `. Welcome emails sent to ${newlyGrantedCount} newly granted user${newlyGrantedCount > 1 ? 's' : ''}`;
						}

						if (revokedCount > 0) {
							successMessage += `. Revoked access from ${revokedCount} user${revokedCount > 1 ? 's' : ''}`;
						}
					}

					if (inviteResult.invitedCount > 0) {
						if (successMessage) successMessage += '. ';
						successMessage += `Sent invitations to ${inviteResult.invitedCount} unregistered user${inviteResult.invitedCount > 1 ? 's' : ''}`;
					}

					setStatus({
						success: true,
						message: successMessage,
					});

					// Update the users state to reflect the changes
					setUsers((prevUsers) =>
						prevUsers.map((user) => {
							const update = pendingUpdates.find(
								(u) => u.userId === user.id && u.email === user.email,
							);
							if (update) {
								return {
									...user,
									hasAgentUserRole: update.shouldHaveRole,
								};
							}

							// Update verification status for invited users
							if (pendingInvites.includes(user.email)) {
								return {
									...user,
									verificationStatus: 'sent' as const,
								};
							}

							return user;
						}),
					);
				} else {
					const totalProcessed =
						roleUpdateResult.processedCount + inviteResult.invitedCount;
					setStatus({
						success: false,
						message: `Processed ${totalProcessed} updates with ${allErrors.length} errors: ${allErrors.join(', ')}`,
					});
				}
			} catch (error) {
				setStatus({
					success: false,
					message: `Failed to process updates: ${error}`,
				});
			}
		});
	};

	const getDisplayName = (user: UserWithRole): string => {
		if (user.name) return user.name;
		if (user.username) return user.username;
		return user.email.split('@')[0];
	};

	const getUserStatusBadge = (user: UserWithRole): React.ReactNode => {
		if (!user.existsInDb) {
			// Show verification status for unregistered users
			switch (user.verificationStatus) {
				case 'sent':
					return (
						<span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
							Code Sent
						</span>
					);
				case 'expired':
					return (
						<span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
							Code Expired
						</span>
					);
				default:
					return (
						<span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
							Not Registered
						</span>
					);
			}
		}
		if (user.hasAgentUserRole) {
			return (
				<span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
					Has Role
				</span>
			);
		}
		return (
			<span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-900 dark:text-gray-200">
				No Role
			</span>
		);
	};

	return (
		<>
			<h1 className="mb-8 font-mono text-3xl text-[#67cb87]">
				User Onboarding
			</h1>

			{status && (
				<div
					className={`mb-6 rounded-md p-4 ${
						status.success
							? 'border border-[#67cb87] bg-[#0d3d2d]'
							: 'border border-[#cb6767] bg-[#3d1d1d]'
					}`}
				>
					<p className="font-mono text-sm text-[#c3e6d4]">{status.message}</p>
				</div>
			)}

			<div className="mb-6 space-y-4">
				<div>
					<label className="mb-2 block font-mono text-[#67cb87]">
						Select Audience
					</label>
					<Select value={selectedAudience} onValueChange={handleAudienceChange}>
						<SelectTrigger
							disabled={audiences.length === 0}
							className="w-full max-w-md border border-[#67cb87] bg-[#0d312d] font-mono text-[#c3e6d4]"
						>
							<SelectValue
								placeholder={
									audiences.length
										? 'Select an audience to onboard users'
										: 'No audiences found'
								}
							/>
						</SelectTrigger>
						<SelectContent className="border border-[#67cb87] bg-[#0d312d] text-[#c3e6d4]">
							{audiences.map((audience) => (
								<SelectItem
									key={audience.id}
									value={audience.id}
									className="font-mono"
								>
									{audience.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{pendingUpdates.length > 0 && (
					<div className="rounded-md border border-[#67cb87] bg-[#0d3d2d] p-4">
						<p className="font-mono text-sm text-[#c3e6d4]">
							{pendingUpdates.length} pending changes to process
						</p>
					</div>
				)}

				{pendingInvites.length > 0 && (
					<div className="rounded-md border border-[#67cb87] bg-[#0d3d2d] p-4">
						<p className="font-mono text-sm text-[#c3e6d4]">
							{pendingInvites.length} pending invitations to send
						</p>
					</div>
				)}

				<div className="flex items-center space-x-2">
					<Switch
						id="invite-mode"
						checked={inviteMode}
						onCheckedChange={setInviteMode}
					/>
					<Label
						htmlFor="invite-mode"
						className="cursor-pointer font-mono text-[#67cb87]"
					>
						Enable invite mode for unregistered users
					</Label>
				</div>
			</div>

			{isLoadingUsers && (
				<div className="rounded-md border border-[#67cb87] bg-[#0d312d] p-6 text-center">
					<p className="font-mono text-[#c3e6d4]">Loading users...</p>
				</div>
			)}

			{!isLoadingUsers && users.length > 0 && (
				<div className="rounded-md border border-[#67cb87] bg-[#0d312d] p-6">
					<div className="mb-4 flex items-center justify-between">
						<h2 className="font-mono text-xl text-[#67cb87]">
							Users ({users.length})
						</h2>
						<button
							onClick={handleProcessUpdates}
							disabled={
								isPending ||
								(pendingUpdates.length === 0 && pendingInvites.length === 0)
							}
							className="rounded-md bg-[#67cb87] px-4 py-2 font-mono font-medium text-[#0a2824] disabled:opacity-50"
						>
							{isPending
								? 'Processing...'
								: `Process Updates (${pendingUpdates.length + pendingInvites.length})`}
						</button>
					</div>

					<div className="space-y-3">
						{users.map((user) => (
							<div
								key={user.email}
								className="flex items-center space-x-4 rounded-md border border-[#67cb87] bg-[#0a2824] p-4"
							>
								<Checkbox
									id={`user-${user.email}`}
									checked={userSelections.get(user.email) ?? false}
									onCheckedChange={(checked) =>
										handleUserSelectionChange(user.email, checked === true)
									}
									disabled={!user.existsInDb && !inviteMode}
									className="border-[#67cb87] data-[state=checked]:bg-[#67cb87] data-[state=checked]:text-[#0a2824]"
								/>
								<div className="flex-1 space-y-1">
									<div className="flex items-center space-x-3">
										<p className="font-mono font-medium text-[#c3e6d4]">
											{getDisplayName(user)}
										</p>
										{getUserStatusBadge(user)}
										{pendingUpdates.some(
											(update) => update.userId === user.id,
										) && (
											<span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
												Pending Change
											</span>
										)}
										{pendingInvites.includes(user.email) && (
											<span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200">
												Pending Invite
											</span>
										)}
									</div>
									<p className="font-mono text-sm text-[#a3d4c4]">
										{user.email}
									</p>
									{!user.existsInDb && !inviteMode && (
										<p className="font-mono text-xs text-[#e0c068]">
											User must register before role can be granted
										</p>
									)}
									{!user.existsInDb && inviteMode && (
										<p className="font-mono text-xs text-[#67cb87]">
											Select to send signup invitation
										</p>
									)}
								</div>
							</div>
						))}
					</div>

					{users.filter((u) => !u.existsInDb).length > 0 && (
						<div className="mt-4 rounded-md border border-[#e0c068] bg-[#3d3520] p-4">
							<p className="font-mono text-sm text-[#e0c068]">
								{inviteMode
									? 'Note: Enable invite mode and select unregistered users to send them signup invitations.'
									: "Note: Users who haven't registered yet cannot have roles assigned. They will need to sign up first."}
							</p>
						</div>
					)}
				</div>
			)}

			{!isLoadingUsers && selectedAudience && users.length === 0 && (
				<div className="rounded-md border border-[#67cb87] bg-[#0d312d] p-6 text-center">
					<p className="font-mono text-[#c3e6d4]">
						No users found in the selected audience.
					</p>
				</div>
			)}

			{!selectedAudience && (
				<div className="rounded-md border border-[#67cb87] bg-[#0d312d] p-6 text-center">
					<p className="font-mono text-[#c3e6d4]">
						Please select an audience to view and manage users.
					</p>
				</div>
			)}
		</>
	);
}

export function OnboardPageWrapper(props: OnboardPageWrapperProps) {
	return (
		<Suspense
			fallback={
				<div className="rounded-md border border-[#67cb87] bg-[#0d312d] p-6 text-center">
					<p className="font-mono text-[#c3e6d4]">Loading...</p>
				</div>
			}
		>
			<OnboardPageContent {...props} />
		</Suspense>
	);
}
