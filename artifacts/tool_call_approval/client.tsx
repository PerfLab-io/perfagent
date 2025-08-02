import { Artifact } from '@/components/artifact';
import {
	CheckCircle,
	XCircle,
	Settings,
	AlertTriangle,
	Loader2,
	ChevronDown,
	ChevronUp,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ToolCallApprovalMetadata {
	title?: string;
	toolCall?: {
		toolName: string;
		arguments: Record<string, any>;
		serverName: string;
		reason: string;
	};
	status?: 'pending' | 'approved' | 'denied';
	timestamp?: Date;
}

export const toolCallApprovalArtifact = new Artifact<
	'tool-call-approval',
	ToolCallApprovalMetadata,
	{
		type: string;
		data: any;
	}
>({
	kind: 'tool-call-approval',
	description: 'Tool call approval interface',
	toolbar: [],
	initialize: async ({ setMetadata }) => {
		setMetadata({
			status: 'pending',
			timestamp: new Date(),
		});
	},
	onStreamPart: ({ streamPart, setArtifact, setMetadata }) => {
		console.log('Tool Call Approval - Received streamPart:', streamPart);
		console.log('Tool Call Approval - Content type:', streamPart.content?.type);
		console.log('Tool Call Approval - Content data:', streamPart.content?.data);

		if (
			streamPart.content.type === 'tool-call-approval' &&
			streamPart.content.data
		) {
			console.log(
				'Tool Call Approval - Processing data:',
				streamPart.content.data,
			);
			console.log(
				'Tool Call Approval - Tool call:',
				streamPart.content.data.toolCall,
			);

			setMetadata((metadata) => {
				const newMetadata = {
					...metadata,
					toolCall: streamPart.content.data.toolCall,
					status: streamPart.content.data.status || 'pending',
					title: streamPart.content.data.title || 'Tool Call Approval',
					timestamp: new Date(streamPart.content.data.timestamp || Date.now()),
				};
				console.log('Tool Call Approval - Setting metadata:', newMetadata);
				return newMetadata;
			});
		} else {
			console.log('Tool Call Approval - Condition not met:', {
				contentType: streamPart.content?.type,
				hasData: !!streamPart.content?.data,
			});
		}
	},
	content: ({ metadata }) => {
		const [showDetails, setShowDetails] = useState(false);

		console.log('Tool Call Approval - Rendering with metadata:', metadata);

		if (!metadata || !metadata.toolCall) {
			console.log(
				'Tool Call Approval - No metadata or toolCall, returning null',
			);
			return null;
		}

		const { toolCall, status, title } = metadata;

		const handleApprove = async () => {
			try {
				// Send approval to the chat API
				const response = await fetch('/api/mcp/approve-tool-call', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						toolCall,
						approved: true,
					}),
				});

				if (!response.ok) {
					throw new Error('Failed to approve tool call');
				}

				// The response will trigger a new message in the chat
			} catch (error) {
				console.error('Error approving tool call:', error);
			}
		};

		const handleDeny = async () => {
			try {
				// Send denial to the chat API
				const response = await fetch('/api/mcp/approve-tool-call', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						toolCall,
						approved: false,
						reason: 'User denied the tool call',
					}),
				});

				if (!response.ok) {
					throw new Error('Failed to deny tool call');
				}

				// The response will trigger a new message in the chat
			} catch (error) {
				console.error('Error denying tool call:', error);
			}
		};

		const getStatusIcon = () => {
			switch (status) {
				case 'approved':
					return <CheckCircle className="h-5 w-5 text-green-500" />;
				case 'denied':
					return <XCircle className="h-5 w-5 text-red-500" />;
				case 'pending':
				default:
					return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
			}
		};

		const getStatusText = () => {
			switch (status) {
				case 'approved':
					return 'Approved';
				case 'denied':
					return 'Denied';
				case 'pending':
				default:
					return 'Pending Approval';
			}
		};

		const getStatusColor = () => {
			switch (status) {
				case 'approved':
					return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100';
				case 'denied':
					return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100';
				case 'pending':
				default:
					return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100';
			}
		};

		return (
			<div className="mb-4 w-full">
				<Card className="border-l-4 border-l-blue-500">
					<CardHeader className="pb-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
									<Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
								</div>
								<div>
									<CardTitle className="text-base font-semibold">
										{title || 'Tool Call Approval'}
									</CardTitle>
									<div className="mt-1 flex items-center gap-2">
										<Badge variant="outline" className="text-xs">
											{toolCall.serverName}
										</Badge>
										<Badge className={cn('text-xs', getStatusColor())}>
											{getStatusIcon()}
											<span className="ml-1">{getStatusText()}</span>
										</Badge>
									</div>
								</div>
							</div>
						</div>
					</CardHeader>

					<CardContent className="space-y-4">
						{/* Tool Information */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<h4 className="text-sm font-medium">
									Tool: {toolCall.toolName}
								</h4>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setShowDetails(!showDetails)}
									className="text-xs"
								>
									{showDetails ? (
										<>
											<ChevronUp className="mr-1 h-3 w-3" />
											Hide Details
										</>
									) : (
										<>
											<ChevronDown className="mr-1 h-3 w-3" />
											Show Details
										</>
									)}
								</Button>
							</div>

							<p className="text-muted-foreground text-sm">{toolCall.reason}</p>
						</div>

						{/* Arguments Details */}
						{showDetails && Object.keys(toolCall.arguments).length > 0 && (
							<div className="space-y-2">
								<h5 className="text-sm font-medium">Arguments:</h5>
								<div className="bg-muted/50 rounded-lg p-3">
									<pre className="overflow-x-auto text-xs">
										{JSON.stringify(toolCall.arguments, null, 2)}
									</pre>
								</div>
							</div>
						)}

						{/* Action Buttons */}
						{status === 'pending' && (
							<div className="flex gap-2 pt-2">
								<Button onClick={handleApprove} size="sm" className="flex-1">
									<CheckCircle className="mr-2 h-4 w-4" />
									Approve
								</Button>
								<Button
									onClick={handleDeny}
									variant="outline"
									size="sm"
									className="flex-1"
								>
									<XCircle className="mr-2 h-4 w-4" />
									Deny
								</Button>
							</div>
						)}

						{/* Status Messages */}
						{status === 'approved' && (
							<div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
								<div className="flex items-center gap-2 text-green-800 dark:text-green-200">
									<CheckCircle className="h-4 w-4" />
									<span className="text-sm font-medium">
										Tool call approved and executing...
									</span>
								</div>
							</div>
						)}

						{status === 'denied' && (
							<div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
								<div className="flex items-center gap-2 text-red-800 dark:text-red-200">
									<XCircle className="h-4 w-4" />
									<span className="text-sm font-medium">Tool call denied</span>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		);
	},
	actions: [],
});
