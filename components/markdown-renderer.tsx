'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Marked, { type ReactRenderer } from 'marked-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from '@/components/ui/hover-card';
import { ArrowLeftRight, Check, Copy, Loader2, WrapText } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

// Types
interface MarkdownRendererProps {
	content: string;
	className?: string;
}

interface LinkMetadata {
	title?: string;
	description?: string;
	image?: string;
	url: string;
}

interface CitationLink {
	text: string;
	link: string;
}

// Font for code blocks
const codeFont = {
	fontFamily: '"JetBrains Mono", monospace',
	style: { fontFamily: '"JetBrains Mono", monospace' },
};

// Utility to check if a string is a valid URL
const isValidUrl = (urlString: string): boolean => {
	try {
		new URL(urlString);
		return true;
	} catch (e) {
		return false;
	}
};

// Utility to fetch metadata for a URL
const fetchMetadata = async (url: string): Promise<LinkMetadata | null> => {
	try {
		// In a real implementation, this would call an API to fetch metadata
		// For now, we'll return mock data
		return {
			title: `Title for ${url}`,
			description: 'This is a description for the link',
			url,
		};
	} catch (error) {
		console.error('Error fetching metadata:', error);
		return null;
	}
};

// Simple syntax highlighter component
const SimpleSyntaxHighlighter = ({
	language,
	children,
	wrapLines = false,
}: {
	language?: string;
	children: string;
	wrapLines?: boolean;
}) => {
	const { theme } = useTheme();
	const isDark = theme === 'dark';

	// Basic styling based on theme
	const baseStyle = {
		backgroundColor: isDark ? '#171717' : '#f5f5f5',
		color: isDark ? '#e4e4e7' : '#18181b',
		padding: '1rem',
		borderRadius: '0.375rem',
		fontFamily: codeFont.style.fontFamily,
		fontSize: '0.85em',
		whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
		overflowX: wrapLines ? 'hidden' : 'auto',
		lineHeight: 1.5,
	};

	return (
		<pre style={baseStyle}>
			<code>{children}</code>
		</pre>
	);
};

export function MarkdownRenderer({
	content,
	className,
}: MarkdownRendererProps) {
	const [metadataCache, setMetadataCache] = useState<
		Record<string, LinkMetadata>
	>({});
	const { theme } = useTheme();

	// Extract citation links from content
	const citationLinks = useMemo<CitationLink[]>(() => {
		return Array.from(content.matchAll(/\[([^\]]+)\]$$([^)]+)$$/g)).map(
			([_, text, link]) => ({ text, link }),
		);
	}, [content]);

	// Fetch metadata with caching
	const fetchMetadataWithCache = useCallback(
		async (url: string) => {
			if (metadataCache[url]) {
				return metadataCache[url];
			}
			const metadata = await fetchMetadata(url);
			if (metadata) {
				setMetadataCache((prev) => ({ ...prev, [url]: metadata }));
			}
			return metadata;
		},
		[metadataCache],
	);

	// Code block component with copy and wrap functionality
	const CodeBlock = ({
		language,
		children,
	}: {
		language: string | undefined;
		children: string;
	}) => {
		const [isCopied, setIsCopied] = useState(false);
		const [isWrapped, setIsWrapped] = useState(false);

		const handleCopy = useCallback(async () => {
			await navigator.clipboard.writeText(children);
			setIsCopied(true);
			setTimeout(() => setIsCopied(false), 2000);
		}, [children]);

		const toggleWrap = useCallback(() => {
			setIsWrapped((prev) => !prev);
		}, []);

		return (
			<div className="group relative my-5">
				<div className="overflow-hidden rounded-md border border-neutral-200 shadow-sm dark:border-neutral-800">
					<div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-100 px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-800">
						<div className="px-2 py-0.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
							{language || 'text'}
						</div>
						<div className="flex items-center gap-1.5">
							<button
								onClick={toggleWrap}
								className={cn(
									'rounded px-2 py-1 text-xs font-medium transition-all duration-200',
									isWrapped
										? 'text-primary'
										: 'text-neutral-500 dark:text-neutral-400',
									'flex items-center gap-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700',
								)}
								aria-label="Toggle line wrapping"
							>
								{isWrapped ? (
									<>
										<ArrowLeftRight className="h-3 w-3" />
										<span className="hidden sm:inline">Unwrap</span>
									</>
								) : (
									<>
										<WrapText className="h-3 w-3" />
										<span className="hidden sm:inline">Wrap</span>
									</>
								)}
							</button>
							<button
								onClick={handleCopy}
								className={cn(
									'rounded px-2 py-1 text-xs font-medium transition-all duration-200',
									isCopied
										? 'text-primary dark:text-primary'
										: 'text-neutral-500 dark:text-neutral-400',
									'flex items-center gap-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700',
								)}
								aria-label="Copy code"
							>
								{isCopied ? (
									<>
										<Check className="h-3 w-3" />
										<span className="hidden sm:inline">Copied!</span>
									</>
								) : (
									<>
										<Copy className="h-3 w-3" />
										<span className="hidden sm:inline">Copy</span>
									</>
								)}
							</button>
						</div>
					</div>
					<div className="overflow-hidden">
						<SimpleSyntaxHighlighter language={language} wrapLines={isWrapped}>
							{children}
						</SimpleSyntaxHighlighter>
					</div>
				</div>
			</div>
		);
	};

	// Link preview component for hover cards
	const LinkPreview = ({ href }: { href: string }) => {
		const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
		const [isLoading, setIsLoading] = useState(false);

		React.useEffect(() => {
			setIsLoading(true);
			fetchMetadataWithCache(href).then((data) => {
				setMetadata(data);
				setIsLoading(false);
			});
		}, [href]);

		if (isLoading) {
			return (
				<div className="flex h-8 items-center justify-center">
					<Loader2 className="h-3 w-3 animate-spin text-neutral-500 dark:text-neutral-400" />
				</div>
			);
		}

		const domain = new URL(href).hostname;
		const title = metadata?.title || domain;

		return (
			<div className="m-0 flex flex-col bg-white text-xs dark:bg-neutral-800">
				<div className="flex h-6 items-center space-x-1.5 px-2 pt-1.5 text-[10px] text-neutral-500 dark:text-neutral-400">
					<Image
						src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
						alt=""
						width={10}
						height={10}
						className="rounded-sm"
					/>
					<span className="truncate">{domain}</span>
				</div>
				{title && (
					<div className="px-2 pb-1.5">
						<h3 className="m-0 line-clamp-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
							{title}
						</h3>
					</div>
				)}
			</div>
		);
	};

	// Render hover card for links
	const renderHoverCard = (
		href: string,
		text: React.ReactNode,
		isCitation = false,
	) => {
		return (
			<HoverCard>
				<HoverCardTrigger asChild>
					<Link
						href={href}
						target="_blank"
						rel="noopener noreferrer"
						className={
							isCitation
								? 'm-0 cursor-pointer rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary no-underline dark:bg-primary/20'
								: 'dark:text-primary-light font-medium text-primary no-underline hover:underline'
						}
					>
						{text}
					</Link>
				</HoverCardTrigger>
				<HoverCardContent
					side="top"
					align="start"
					sideOffset={5}
					className="w-48 overflow-hidden rounded-md border border-neutral-200 p-0 shadow-sm dark:border-neutral-700"
				>
					<LinkPreview href={href} />
				</HoverCardContent>
			</HoverCard>
		);
	};

	// Custom renderer for marked-react
	const renderer: Partial<ReactRenderer> = {
		// Text rendering
		text(text: string) {
			return text;
		},

		// Paragraph rendering
		paragraph(children: React.ReactNode) {
			return (
				<p className="my-5 leading-relaxed text-neutral-700 dark:text-neutral-300">
					{children}
				</p>
			);
		},

		// Code block rendering
		code(children: string, language?: string) {
			return <CodeBlock language={language}>{children}</CodeBlock>;
		},

		// Link rendering with hover cards
		link(href: string, text: React.ReactNode) {
			const citationIndex = citationLinks.findIndex(
				(link) => link.link === href,
			);
			if (citationIndex !== -1) {
				return React.createElement(
					'sup',
					null,
					renderHoverCard(href, citationIndex + 1, true),
				);
			}
			return isValidUrl(href) ? (
				renderHoverCard(href, text)
			) : (
				<a
					href={href}
					className="dark:text-primary-light font-medium text-primary hover:underline"
				>
					{text}
				</a>
			);
		},

		// Heading rendering with proper styling
		heading(children: React.ReactNode, level: number) {
			const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
			const sizeClasses =
				{
					1: 'text-2xl md:text-3xl font-extrabold mt-8 mb-4',
					2: 'text-xl md:text-2xl font-bold mt-7 mb-3',
					3: 'text-lg md:text-xl font-semibold mt-6 mb-3',
					4: 'text-base md:text-lg font-medium mt-5 mb-2',
					5: 'text-sm md:text-base font-medium mt-4 mb-2',
					6: 'text-xs md:text-sm font-medium mt-4 mb-2',
				}[level] || '';

			return (
				<HeadingTag
					className={`${sizeClasses} text-neutral-900 dark:text-neutral-50`}
				>
					{children}
				</HeadingTag>
			);
		},

		// List rendering
		list(children: React.ReactNode, ordered: boolean) {
			const ListTag = ordered ? 'ol' : 'ul';
			return (
				<ListTag
					className={cn(
						'my-5 space-y-2 pl-6 text-neutral-700 dark:text-neutral-300',
						ordered ? 'list-decimal' : 'list-disc',
					)}
				>
					{children}
				</ListTag>
			);
		},

		// List item rendering
		listItem(children: React.ReactNode) {
			return <li className="pl-1 leading-relaxed">{children}</li>;
		},

		// Blockquote rendering
		blockquote(children: React.ReactNode) {
			return (
				<blockquote className="my-6 rounded-r-md border-l-4 border-primary/30 bg-neutral-50 py-1 pl-4 italic text-neutral-700 dark:border-primary/20 dark:bg-neutral-900/50 dark:text-neutral-300">
					{children}
				</blockquote>
			);
		},

		// Table rendering
		table(children: React.ReactNode) {
			return (
				<div className="my-8 w-full overflow-hidden">
					<div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
						<table className="m-0 w-full border-collapse text-sm">
							{children}
						</table>
					</div>
				</div>
			);
		},

		// Table row rendering
		tableRow(children: React.ReactNode) {
			return (
				<tr className="border-b border-neutral-200 transition-colors last:border-0 hover:bg-neutral-50/80 dark:border-neutral-800 dark:hover:bg-neutral-800/50">
					{children}
				</tr>
			);
		},

		// Table cell rendering
		tableCell(
			children: React.ReactNode,
			flags: { header?: boolean; align?: 'left' | 'center' | 'right' },
		) {
			const align = flags.align ? `text-${flags.align}` : 'text-left';
			const isHeader = flags.header;

			return isHeader ? (
				<th
					className={cn(
						'px-4 py-3 font-semibold text-neutral-900 dark:text-neutral-100',
						'bg-neutral-100/80 dark:bg-neutral-800/80',
						'first:pl-6 last:pr-6',
						align,
					)}
				>
					{children}
				</th>
			) : (
				<td
					className={cn(
						'px-4 py-3 text-neutral-700 dark:text-neutral-300',
						'first:pl-6 last:pr-6',
						align,
					)}
				>
					{children}
				</td>
			);
		},

		// Table header rendering
		tableHeader(children: React.ReactNode) {
			return (
				<thead className="border-b border-neutral-200 dark:border-neutral-800">
					{children}
				</thead>
			);
		},

		// Table body rendering
		tableBody(children: React.ReactNode) {
			return (
				<tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
					{children}
				</tbody>
			);
		},

		// Image rendering
		image(src: string, alt: string, title?: string) {
			return (
				<div className="my-6 overflow-hidden rounded-lg border border-neutral-200 shadow-sm dark:border-neutral-800">
					<Image
						src={src || '/placeholder.svg'}
						alt={alt || ''}
						title={title || alt || ''}
						width={800}
						height={450}
						className="h-auto w-full object-cover"
					/>
					{title && (
						<div className="border-t border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
							{title}
						</div>
					)}
				</div>
			);
		},
	};

	return (
		<div
			className={cn(
				'markdown-body prose prose-neutral dark:prose-invert max-w-none font-sans dark:text-neutral-200',
				className,
			)}
		>
			<Marked renderer={renderer}>{content}</Marked>
		</div>
	);
}
