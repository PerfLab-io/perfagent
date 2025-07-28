'use client';

import { useEffect, useRef, useState } from 'react';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Monitor } from 'lucide-react';

interface UIResourceRendererProps {
	uri: string;
	content?: string;
	title?: string;
	description?: string;
}

export const UIResourceRenderer = ({
	uri,
	content,
	title,
	description,
}: UIResourceRendererProps) => {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [isExpanded, setIsExpanded] = useState(false);

	useEffect(() => {
		if (content && iframeRef.current) {
			// Create a safe HTML document with CSP
			const safeContent = `
				<!DOCTYPE html>
				<html>
					<head>
						<meta charset="utf-8">
						<meta name="viewport" content="width=device-width, initial-scale=1">
						<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline'; script-src 'none'; object-src 'none';">
						<style>
							body { 
								font-family: system-ui, -apple-system, sans-serif; 
								margin: 16px; 
								background: white; 
								color: #333;
							}
							* { box-sizing: border-box; }
						</style>
					</head>
					<body>
						${content}
					</body>
				</html>
			`;

			const blob = new Blob([safeContent], { type: 'text/html' });
			const url = URL.createObjectURL(blob);
			iframeRef.current.src = url;

			return () => {
				URL.revokeObjectURL(url);
			};
		}
	}, [content]);

	const handleOpenExternal = () => {
		if (uri.startsWith('http')) {
			window.open(uri, '_blank', 'noopener,noreferrer');
		}
	};

	return (
		<Card className="w-full border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20">
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-2">
						<Monitor className="h-5 w-5 text-purple-600 dark:text-purple-400" />
						<div>
							<CardTitle className="text-lg">
								{title || 'UI Resource'}
							</CardTitle>
							{description && <CardDescription>{description}</CardDescription>}
						</div>
					</div>
					<div className="flex space-x-2">
						{uri.startsWith('http') && (
							<Button variant="outline" size="sm" onClick={handleOpenExternal}>
								<ExternalLink className="mr-2 h-4 w-4" />
								Open
							</Button>
						)}
						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsExpanded(!isExpanded)}
						>
							{isExpanded ? 'Collapse' : 'Expand'}
						</Button>
					</div>
				</div>
			</CardHeader>
			{isExpanded && (
				<CardContent>
					{content ? (
						<iframe
							ref={iframeRef}
							className="h-96 w-full rounded border"
							sandbox="allow-same-origin"
							title={title || 'UI Resource'}
						/>
					) : uri.startsWith('http') ? (
						<iframe
							src={uri}
							className="h-96 w-full rounded border"
							sandbox="allow-same-origin allow-scripts"
							title={title || 'UI Resource'}
						/>
					) : (
						<div className="text-muted-foreground flex h-32 items-center justify-center">
							Unable to render resource: {uri}
						</div>
					)}
				</CardContent>
			)}
		</Card>
	);
};
