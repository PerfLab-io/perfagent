'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
	ChevronDown, 
	ChevronUp, 
	ExternalLink, 
	FileText, 
	Database,
	Link,
	Globe,
	Code,
	Image,
	FileJson,
	File
} from 'lucide-react';
import { MarkdownRenderer } from './markdown-renderer';

interface MCPResource {
	uri: string;
	name?: string;
	description?: string;
	mimeType?: string;
	annotations?: {
		audience?: string[];
		priority?: number;
	};
}

interface MCPResourceContent {
	uri: string;
	mimeType: string;
	text?: string;
	blob?: string;
}

interface MCPResourceCardProps {
	resource: MCPResource;
	content?: MCPResourceContent;
	serverName: string;
	isLoading?: boolean;
	onLoadContent?: (resource: MCPResource, serverName: string) => void;
	className?: string;
}

/**
 * Get appropriate icon for resource based on URI and MIME type
 */
function getResourceIcon(resource: MCPResource) {
	const { uri, mimeType } = resource;
	
	// Check MIME type first
	if (mimeType) {
		if (mimeType.startsWith('image/')) return Image;
		if (mimeType.includes('json')) return FileJson;
		if (mimeType.startsWith('text/')) return FileText;
		if (mimeType.includes('html')) return Globe;
	}
	
	// Check URI pattern
	if (uri.startsWith('http://') || uri.startsWith('https://')) return Link;
	if (uri.includes('/api/') || uri.includes('database')) return Database;
	if (uri.endsWith('.json')) return FileJson;
	if (uri.endsWith('.md') || uri.endsWith('.txt')) return FileText;
	if (uri.endsWith('.html') || uri.endsWith('.htm')) return Globe;
	if (uri.includes('code') || uri.endsWith('.js') || uri.endsWith('.ts')) return Code;
	
	return File;
}

/**
 * Get resource type label based on URI and MIME type
 */
function getResourceType(resource: MCPResource): string {
	const { uri, mimeType } = resource;
	
	if (mimeType) {
		if (mimeType.startsWith('image/')) return 'Image';
		if (mimeType.includes('json')) return 'JSON';
		if (mimeType.startsWith('text/')) return 'Text';
		if (mimeType.includes('html')) return 'HTML';
	}
	
	if (uri.startsWith('http://') || uri.startsWith('https://')) return 'Web Resource';
	if (uri.includes('/api/')) return 'API';
	if (uri.includes('database')) return 'Database';
	if (uri.endsWith('.json')) return 'JSON File';
	if (uri.endsWith('.md')) return 'Markdown';
	if (uri.endsWith('.txt')) return 'Text File';
	
	return 'Resource';
}

/**
 * Truncate content for preview
 */
function truncateContent(content: string, maxLength: number = 300): string {
	if (content.length <= maxLength) return content;
	return content.slice(0, maxLength).trim() + '...';
}

/**
 * Format URI for display
 */
function formatUri(uri: string): string {
	// For HTTP URLs, show hostname + path
	try {
		const url = new URL(uri);
		return `${url.hostname}${url.pathname}`;
	} catch {
		// For non-URL URIs, truncate if too long
		if (uri.length > 50) {
			return uri.slice(0, 47) + '...';
		}
		return uri;
	}
}

export function MCPResourceCard({
	resource,
	content,
	serverName,
	isLoading = false,
	onLoadContent,
	className
}: MCPResourceCardProps) {
	const [expanded, setExpanded] = useState(false);
	const Icon = useMemo(() => getResourceIcon(resource), [resource]);
	const resourceType = useMemo(() => getResourceType(resource), [resource]);
	
	const handleToggleExpanded = () => {
		if (!content && !isLoading && onLoadContent) {
			onLoadContent(resource, serverName);
		}
		setExpanded(!expanded);
	};

	const hasContent = content?.text || content?.blob;
	const canExpand = hasContent || onLoadContent;

	return (
		<Card className={cn(
			'transition-all duration-300 hover:shadow-md',
			'border-l-4 border-l-blue-500',
			className
		)}>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-3 min-w-0 flex-1">
						<div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg shrink-0">
							<Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
						</div>
						<div className="min-w-0 flex-1">
							<CardTitle className="text-base font-semibold truncate">
								{resource.name || formatUri(resource.uri)}
							</CardTitle>
							<div className="flex items-center gap-2 mt-1">
								<Badge variant="secondary" className="text-xs">
									{resourceType}
								</Badge>
								<Badge variant="outline" className="text-xs">
									{serverName}
								</Badge>
								{resource.annotations?.priority && (
									<Badge 
										variant={resource.annotations.priority > 0.7 ? "default" : "secondary"}
										className="text-xs"
									>
										Priority: {Math.round(resource.annotations.priority * 100)}%
									</Badge>
								)}
							</div>
						</div>
					</div>
					{canExpand && (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleToggleExpanded}
							disabled={isLoading}
							className="shrink-0"
						>
							{isLoading ? (
								<div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
							) : expanded ? (
								<ChevronUp className="h-4 w-4" />
							) : (
								<ChevronDown className="h-4 w-4" />
							)}
						</Button>
					)}
				</div>
				
				{resource.description && (
					<p className="text-sm text-muted-foreground mt-2">
						{resource.description}
					</p>
				)}
				
				<div className="text-xs text-muted-foreground mt-1 font-mono">
					{resource.uri}
				</div>
			</CardHeader>

			{expanded && hasContent && (
				<CardContent className="pt-0">
					<div className="border rounded-lg p-4 bg-muted/50">
						{content?.mimeType && (
							<div className="flex items-center justify-between mb-3">
								<Badge variant="outline" className="text-xs">
									{content.mimeType}
								</Badge>
								{resource.uri.startsWith('http') && (
									<Button
										variant="outline"
										size="sm"
										onClick={() => window.open(resource.uri, '_blank')}
										className="text-xs"
									>
										<ExternalLink className="h-3 w-3 mr-1" />
										Open
									</Button>
								)}
							</div>
						)}
						
						{content?.text && (
							<div className="space-y-2">
								{content.mimeType?.includes('json') ? (
									<pre className="text-xs bg-background rounded p-2 overflow-x-auto max-h-96 overflow-y-auto">
										<code>{JSON.stringify(JSON.parse(content.text), null, 2)}</code>
									</pre>
								) : content.mimeType?.includes('markdown') || resource.uri.endsWith('.md') ? (
									<div className="prose prose-sm dark:prose-invert max-w-none">
										<MarkdownRenderer content={truncateContent(content.text, 1000)} />
									</div>
								) : (
									<div className="text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
										{truncateContent(content.text, 1000)}
									</div>
								)}
								
								{content.text.length > 1000 && (
									<div className="text-xs text-muted-foreground italic">
										Content truncated. Full content: {content.text.length} characters
									</div>
								)}
							</div>
						)}
						
						{content?.blob && (
							<div className="text-sm text-muted-foreground">
								Binary content ({content.blob.length} bytes)
							</div>
						)}
					</div>
				</CardContent>
			)}
		</Card>
	);
}

interface MCPResourceListProps {
	resources: MCPResource[];
	serverName: string;
	onLoadContent?: (resource: MCPResource, serverName: string) => void;
	loadingStates?: Record<string, boolean>;
	contents?: Record<string, MCPResourceContent>;
	className?: string;
}

export function MCPResourceList({
	resources,
	serverName,
	onLoadContent,
	loadingStates = {},
	contents = {},
	className
}: MCPResourceListProps) {
	if (resources.length === 0) {
		return (
			<div className={cn("text-center text-muted-foreground py-8", className)}>
				<Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
				<p>No resources available from {serverName}</p>
			</div>
		);
	}

	return (
		<div className={cn("space-y-3", className)}>
			<div className="flex items-center gap-2 mb-4">
				<Database className="h-5 w-5 text-blue-600" />
				<h3 className="font-semibold">Resources from {serverName}</h3>
				<Badge variant="secondary">{resources.length}</Badge>
			</div>
			
			{resources.map((resource) => (
				<MCPResourceCard
					key={resource.uri}
					resource={resource}
					content={contents[resource.uri]}
					serverName={serverName}
					isLoading={loadingStates[resource.uri]}
					onLoadContent={onLoadContent}
				/>
			))}
		</div>
	);
}