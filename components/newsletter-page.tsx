'use client';

import type React from 'react';

import { useEffect, useState } from 'react';
import { sendNewsletter } from '@/app/actions/newsletter';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

import type { ListAudiencesResponseSuccess } from 'resend';

export type NewsletterUpdate = {
	title: string;
	content: string;
	imageUrl?: string;
	linkUrl?: string;
	linkText?: string;
};

export function NewsLetterPage({
	audiences,
}: {
	audiences: ListAudiencesResponseSuccess['data'];
}) {
	const [subject, setSubject] = useState(
		`PerfAgent Newsletter - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
	);
	const [headline, setHeadline] = useState('');
	const [heroImageUrl, setHeroImageUrl] = useState('');
	const [recipients, setRecipients] = useState('test@example.com');
	const [recipientType, setRecipientType] = useState<'individual' | 'audience'>(
		'individual',
	);
	const [selectedAudience, setSelectedAudience] = useState<string>('');

	const [updates, setUpdates] = useState<NewsletterUpdate[]>([]);
	const [status, setStatus] = useState<null | {
		success: boolean;
		message: string;
	}>(null);
	const [isLoading, setIsLoading] = useState(false);

	const handleUpdateChange = (index: number, field: string, value: string) => {
		const newUpdates = [...updates];
		// @ts-ignore - We know these fields exist
		newUpdates[index][field] = value;
		setUpdates(newUpdates);
	};

	const addUpdate = () => {
		setUpdates([
			...updates,
			{
				title: 'New Update',
				content: 'Enter update content here',
				linkUrl: '',
				linkText: 'Read More',
			},
		]);
	};

	const removeUpdate = (index: number) => {
		const newUpdates = [...updates];
		newUpdates.splice(index, 1);
		setUpdates(newUpdates);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setStatus(null);

		try {
			let result;

			if (recipientType === 'individual') {
				const recipientList = recipients
					.split(',')
					.map((email) => email.trim());
				result = await sendNewsletter(recipientList, subject, {
					headline,
					heroImageUrl,
					updates,
					currentDate: new Date().toLocaleDateString('en-US', {
						month: 'long',
						year: 'numeric',
					}),
				});
			} else {
				// Send to Resend audience
				result = await sendNewsletter(
					[], // Empty array as we're using audience ID instead
					subject,
					{
						headline,
						heroImageUrl,
						updates,
						currentDate: new Date().toLocaleDateString('en-US', {
							month: 'long',
							year: 'numeric',
						}),
					},
					selectedAudience, // Pass the audience ID
				);
			}

			if (result.success) {
				setStatus({
					success: true,
					message:
						recipientType === 'individual'
							? result.partialFailure
								? `Partially successful: Sent ${result.sent} of ${result.totalAttempted} emails`
								: `Newsletter sent successfully to ${result.sent} recipients`
							: `Newsletter sent successfully to audience: ${audiences.find((a) => a.id === selectedAudience)?.name}`,
				});
			} else {
				setStatus({
					success: false,
					message: `Failed to send newsletter: ${result.error}`,
				});
			}
		} catch (error) {
			setStatus({ success: false, message: `An error occurred: ${error}` });
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<>
			<h1 className="mb-8 font-mono text-3xl text-[#67cb87]">
				Newsletter Admin
			</h1>

			{status && (
				<div
					className={`mb-6 rounded-md p-4 ${status.success ? 'border border-[#67cb87] bg-[#0d3d2d]' : 'border border-[#cb6767] bg-[#3d1d1d]'}`}
				>
					{status.message}
				</div>
			)}

			<form onSubmit={handleSubmit} className="space-y-6">
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					<div>
						<label className="mb-2 block font-mono text-[#67cb87]">
							Subject
						</label>
						<input
							type="text"
							value={subject}
							onChange={(e) => setSubject(e.target.value)}
							className="w-full rounded-md border border-[#67cb87] bg-[#0d312d] p-2 font-mono text-[#c3e6d4]"
							required
						/>
					</div>

					<div>
						<label className="mb-2 block font-mono text-[#67cb87]">
							Headline
						</label>
						<input
							type="text"
							value={headline}
							onChange={(e) => setHeadline(e.target.value)}
							className="w-full rounded-md border border-[#67cb87] bg-[#0d312d] p-2 font-mono text-[#c3e6d4]"
							required
						/>
					</div>
				</div>

				<div>
					<label className="mb-2 block font-mono text-[#67cb87]">
						Hero Image URL or YouTube Video URL
					</label>
					<input
						type="text"
						value={heroImageUrl}
						onChange={(e) => setHeroImageUrl(e.target.value)}
						className="w-full rounded-md border border-[#67cb87] bg-[#0d312d] p-2 font-mono text-[#c3e6d4]"
						placeholder="Enter image URL or YouTube video URL"
						required
					/>
					<p className="mt-1 font-mono text-xs text-[#c3e6d4]">
						For YouTube videos, the thumbnail will be used as the image and link
						to the video
					</p>
				</div>

				<div className="space-y-4">
					<label className="mb-2 block font-mono text-[#67cb87]">
						Recipients
					</label>

					<RadioGroup
						value={recipientType}
						onValueChange={(value) =>
							setRecipientType(value as 'individual' | 'audience')
						}
						className="flex flex-col space-y-3"
					>
						<div className="flex items-center space-x-2">
							<RadioGroupItem
								value="individual"
								id="individual"
								className="border-[#67cb87] text-[#67cb87]"
							/>
							<Label htmlFor="individual" className="font-mono text-[#c3e6d4]">
								Individual Emails
							</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem
								value="audience"
								id="audience"
								className="border-[#67cb87] text-[#67cb87]"
							/>
							<Label htmlFor="audience" className="font-mono text-[#c3e6d4]">
								Resend Audience
							</Label>
						</div>
					</RadioGroup>

					{recipientType === 'individual' ? (
						<textarea
							value={recipients}
							onChange={(e) => setRecipients(e.target.value)}
							className="h-20 w-full rounded-md border border-[#67cb87] bg-[#0d312d] p-2 font-mono text-[#c3e6d4]"
							placeholder="Enter comma-separated email addresses"
							required={recipientType === 'individual'}
						/>
					) : (
						<Select
							value={selectedAudience}
							onValueChange={setSelectedAudience}
						>
							<SelectTrigger
								disabled={audiences.length === 0}
								className="w-full border border-[#67cb87] bg-[#0d312d] font-mono text-[#c3e6d4]"
							>
								<SelectValue
									placeholder={
										audiences.length
											? 'Select an audience'
											: 'No audience found'
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
					)}
				</div>

				<div>
					<div className="mb-4 flex items-center justify-between">
						<label className="font-mono text-[#67cb87]">Updates/Stories</label>
						<button
							type="button"
							onClick={addUpdate}
							className="rounded border border-[#67cb87] bg-[#0d312d] px-3 py-1 font-mono text-sm text-[#67cb87]"
						>
							+ Add Update
						</button>
					</div>

					{updates.map((update, index) => (
						<div
							key={index}
							className="mb-4 rounded-md border border-dotted border-[#67cb87] bg-[#0d312d] p-4"
						>
							<div className="mb-2 flex items-center justify-between">
								<h3 className="font-mono text-[#67cb87]">Update {index + 1}</h3>
								<button
									type="button"
									onClick={() => removeUpdate(index)}
									className="font-mono text-sm text-[#ea5f5f]"
								>
									Remove
								</button>
							</div>

							<div className="space-y-3">
								<div>
									<label className="mb-1 block font-mono text-sm text-[#67cb87]">
										Title
									</label>
									<input
										type="text"
										value={update.title}
										onChange={(e) =>
											handleUpdateChange(index, 'title', e.target.value)
										}
										className="w-full rounded-md border border-[#67cb87] bg-[#0a2824] p-2 font-mono text-sm text-[#c3e6d4]"
										required
									/>
								</div>

								<div>
									<label className="mb-1 block font-mono text-sm text-[#67cb87]">
										Content
									</label>
									<textarea
										value={update.content}
										onChange={(e) =>
											handleUpdateChange(index, 'content', e.target.value)
										}
										className="h-20 w-full rounded-md border border-[#67cb87] bg-[#0a2824] p-2 font-mono text-sm text-[#c3e6d4]"
										required
									/>
								</div>

								<div>
									<label className="mb-1 block font-mono text-sm text-[#67cb87]">
										Image URL or YouTube Video URL (optional)
									</label>
									<input
										type="text"
										value={update.imageUrl || ''}
										onChange={(e) =>
											handleUpdateChange(index, 'imageUrl', e.target.value)
										}
										placeholder="Enter image URL or YouTube video URL"
										className="w-full rounded-md border border-[#67cb87] bg-[#0a2824] p-2 font-mono text-sm text-[#c3e6d4]"
									/>
									<p className="mt-1 font-mono text-xs text-[#c3e6d4]">
										For YouTube videos, the thumbnail will be used as the image
										and link to the video
									</p>
								</div>

								<div className="grid grid-cols-2 gap-3">
									<div>
										<label className="mb-1 block font-mono text-sm text-[#67cb87]">
											Link URL
										</label>
										<input
											type="text"
											value={update.linkUrl || ''}
											onChange={(e) =>
												handleUpdateChange(index, 'linkUrl', e.target.value)
											}
											className="w-full rounded-md border border-[#67cb87] bg-[#0a2824] p-2 font-mono text-sm text-[#c3e6d4]"
										/>
									</div>

									<div>
										<label className="mb-1 block font-mono text-sm text-[#67cb87]">
											Link Text
										</label>
										<input
											type="text"
											value={update.linkText || 'Read More'}
											onChange={(e) =>
												handleUpdateChange(index, 'linkText', e.target.value)
											}
											className="w-full rounded-md border border-[#67cb87] bg-[#0a2824] p-2 font-mono text-sm text-[#c3e6d4]"
										/>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>

				<div className="text-center">
					<button
						type="submit"
						disabled={
							isLoading || (recipientType === 'audience' && !selectedAudience)
						}
						className="rounded-md bg-[#67cb87] px-6 py-3 font-mono font-bold text-[#0a2824] disabled:opacity-50"
					>
						{isLoading ? 'Sending...' : 'Send Newsletter'}
					</button>
				</div>
			</form>
		</>
	);
}
