'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckIcon, XIcon, SettingsIcon } from 'lucide-react';

interface ToolCallPromptProps {
	toolName: string;
	description: string;
	parameters: any;
	onApprove: () => void;
	onDecline: () => void;
}

export const ToolCallPrompt = ({
	toolName,
	description,
	parameters,
	onApprove,
	onDecline,
}: ToolCallPromptProps) => {
	const [loading, setLoading] = useState(false);

	const handleApprove = async () => {
		setLoading(true);
		try {
			await onApprove();
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card className="w-full max-w-md border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20">
			<CardHeader>
				<div className="flex items-center space-x-2">
					<SettingsIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
					<CardTitle className="text-lg">Tool Call Request</CardTitle>
				</div>
				<CardDescription>
					The AI wants to call the <Badge variant="secondary">{toolName}</Badge>{' '}
					tool
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div>
					<h4 className="font-medium">Description:</h4>
					<p className="text-muted-foreground text-sm">{description}</p>
				</div>

				{parameters && Object.keys(parameters).length > 0 && (
					<div>
						<h4 className="font-medium">Parameters:</h4>
						<pre className="mt-1 rounded bg-gray-100 p-2 text-xs dark:bg-gray-800">
							{JSON.stringify(parameters, null, 2)}
						</pre>
					</div>
				)}

				<div className="flex space-x-2">
					<Button
						onClick={handleApprove}
						disabled={loading}
						className="flex-1"
						size="sm"
					>
						<CheckIcon className="mr-2 h-4 w-4" />
						Approve
					</Button>
					<Button
						onClick={onDecline}
						variant="outline"
						disabled={loading}
						className="flex-1"
						size="sm"
					>
						<XIcon className="mr-2 h-4 w-4" />
						Decline
					</Button>
				</div>
			</CardContent>
		</Card>
	);
};
