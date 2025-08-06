import { Artifact } from '@/components/artifact';
import {
	CheckCircle,
	XCircle,
	Loader2,
	ChevronDown,
	ChevronUp,
	Terminal,
} from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ToolExecutionMetadata {
	title?: string;
	toolName?: string;
	serverName?: string;
	status?: 'executing' | 'completed' | 'error';
	result?: any;
	error?: string;
	executionTime?: number;
	timestamp?: Date;
}

export const toolExecutionArtifact = new Artifact<
	'tool-execution',
	ToolExecutionMetadata,
	{
		type: string;
		data: any;
	}
>({
	kind: 'tool-execution',
	description: 'Tool execution result display',
	toolbar: [],
	initialize: async ({ setMetadata }) => {
		setMetadata({
			status: 'executing',
			timestamp: new Date(),
		});
	},
	onStreamPart: ({ streamPart, setMetadata }) => {
		console.log('Tool Execution - Received streamPart:', streamPart);

		if (
			streamPart.content.type === 'tool-execution' &&
			streamPart.content.data
		) {
			const data = streamPart.content.data;
			console.log('Tool Execution - Processing data:', data);

			setMetadata((metadata) => {
				// Determine status based on the message content
				let status: ToolExecutionMetadata['status'] = 'executing';
				if (data.message?.includes('Successfully executed')) {
					status = 'completed';
				} else if (data.message?.includes('Error executing')) {
					status = 'error';
				}

				const newMetadata = {
					...metadata,
					title: data.title || 'Tool Execution',
					toolName: data.toolName || metadata?.toolName,
					serverName: data.serverName || metadata?.serverName,
					status,
					result: data.result ? JSON.parse(data.result) : metadata?.result,
					error: data.error || metadata?.error,
					timestamp: new Date(data.timestamp || Date.now()),
				};
				console.log('Tool Execution - Setting metadata:', newMetadata);
				return newMetadata;
			});
		}
	},
	content: ({ metadata }) => {
		const [showDetails, setShowDetails] = useState(true);

		console.log('Tool Execution - Rendering with metadata:', metadata);

		if (!metadata) {
			return null;
		}

		const { status, title, result, error, toolName, serverName } = metadata;

		const getStatusIcon = () => {
			switch (status) {
				case 'completed':
					return <CheckCircle className="h-5 w-5 text-green-500" />;
				case 'error':
					return <XCircle className="h-5 w-5 text-red-500" />;
				case 'executing':
				default:
					return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
			}
		};

		const getStatusText = () => {
			switch (status) {
				case 'completed':
					return 'Completed';
				case 'error':
					return 'Failed';
				case 'executing':
				default:
					return 'Executing';
			}
		};

		const getStatusColor = () => {
			switch (status) {
				case 'completed':
					return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100';
				case 'error':
					return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100';
				case 'executing':
				default:
					return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100';
			}
		};

		return (
			<div className="mb-4 w-full">
				<Card className="border-l-4 border-l-purple-500">
					<CardHeader className="pb-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900">
									<Terminal className="h-5 w-5 text-purple-600 dark:text-purple-400" />
								</div>
								<div>
									<CardTitle className="text-base font-semibold">
										{title || 'Tool Execution'}
									</CardTitle>
									<div className="mt-1 flex items-center gap-2">
										{toolName && (
											<Badge variant="outline" className="text-xs">
												{toolName}
											</Badge>
										)}
										{serverName && (
											<Badge variant="outline" className="text-xs">
												{serverName}
											</Badge>
										)}
										<Badge className={cn('text-xs', getStatusColor())}>
											{getStatusIcon()}
											<span className="ml-1">{getStatusText()}</span>
										</Badge>
									</div>
								</div>
							</div>
							{(result || error) && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setShowDetails(!showDetails)}
									className="text-xs"
								>
									{showDetails ? (
										<>
											<ChevronUp className="mr-1 h-3 w-3" />
											Hide Result
										</>
									) : (
										<>
											<ChevronDown className="mr-1 h-3 w-3" />
											Show Result
										</>
									)}
								</Button>
							)}
						</div>
					</CardHeader>

					<CardContent className="space-y-4">
						{/* Status Messages */}
						{status === 'executing' && (
							<div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
								<div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
									<Loader2 className="h-4 w-4 animate-spin" />
									<span className="text-sm font-medium">Executing tool...</span>
								</div>
							</div>
						)}

						{status === 'completed' && !error && (
							<div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
								<div className="flex items-center gap-2 text-green-800 dark:text-green-200">
									<CheckCircle className="h-4 w-4" />
									<span className="text-sm font-medium">
										Tool executed successfully
									</span>
								</div>
							</div>
						)}

						{status === 'error' && error && (
							<div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
								<div className="space-y-2">
									<div className="flex items-center gap-2 text-red-800 dark:text-red-200">
										<XCircle className="h-4 w-4" />
										<span className="text-sm font-medium">
											Tool execution failed
										</span>
									</div>
									<p className="text-sm text-red-700 dark:text-red-300">
										{error}
									</p>
								</div>
							</div>
						)}

						{/* Result Details */}
						{showDetails && (result || error) && (
							<div className="space-y-2">
								<h5 className="text-sm font-medium">
									{error ? 'Error Details:' : 'Execution Result:'}
								</h5>
								<div className="bg-muted/50 rounded-lg p-3">
									<pre className="overflow-x-auto text-xs">
										{error || JSON.stringify(result, null, 2)}
									</pre>
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
