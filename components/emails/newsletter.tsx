import {
	Body,
	Button,
	Container,
	Column,
	Head,
	Heading,
	Html,
	Img,
	Link,
	Preview,
	Row,
	Section,
	Text,
} from '@react-email/components';
import { Tailwind } from '@react-email/tailwind';

interface NewsletterEmailProps {
	previewText?: string;
	headline?: string;
	heroImageUrl?: string;
	heroImageAlt?: string;
	heroLinkUrl?: string;
	updates?: {
		title: string;
		content: string;
		imageUrl?: string;
		linkUrl?: string;
		linkText?: string;
	}[];
	ctaText?: string;
	ctaUrl?: string;
	unsubscribeUrl?: string;
	currentDate?: string;
	recipientEmail?: string;
}

export const NewsletterEmail = ({
	previewText = 'Latest updates from PerfAgent - Your Performance Optimization Platform',
	headline = 'Performance Insights: May Edition',
	heroImageUrl = 'https://example.com/newsletter-hero.webp',
	heroImageAlt = 'PerfAgent Newsletter Hero Image',
	heroLinkUrl,
	updates = [
		{
			title: 'Core Web Vitals Update',
			content:
				"Google has released new thresholds for Core Web Vitals. Learn how these changes affect your site's performance score and what you can do to stay ahead.",
			imageUrl: 'https://example.com/web-vitals-update.png',
			linkUrl: 'https://perfagent.dev/blog/core-web-vitals-update',
			linkText: 'Read More',
		},
		{
			title: 'Performance Analysis Breakthrough',
			content:
				'Our AI has learned to identify complex performance bottlenecks with 40% more accuracy. Discover how this improvement helps pinpoint issues that traditional tools miss.',
			linkUrl: 'https://perfagent.dev/blog/ai-breakthrough',
			linkText: 'Learn More',
		},
		{
			title: 'Case Study: E-commerce Speed Optimization',
			content:
				'See how we helped an e-commerce client improve conversion rates by 23% through targeted performance optimizations to their product pages.',
			imageUrl: 'https://example.com/case-study.png',
			linkUrl: 'https://perfagent.dev/case-studies/ecommerce',
			linkText: 'View Case Study',
		},
	],
	ctaText = 'Try PerfAgent Today',
	ctaUrl = 'https://perfagent.dev/signup',
	unsubscribeUrl = 'https://perfagent.dev/unsubscribe',
	currentDate = new Date().toLocaleDateString('en-US', {
		month: 'long',
		year: 'numeric',
	}),
	recipientEmail = 'user@example.com',
}: NewsletterEmailProps) => {
	return (
		<Html>
			<Head />
			<Preview>{previewText}</Preview>
			<Tailwind>
				<Body className="m-0 bg-[#0a2824] p-0 font-sans">
					<Container className="mx-auto max-w-[600px] px-4 py-8">
						{/* Terminal-style Header */}
						<Section className="overflow-hidden rounded-lg border-2 border-dotted border-[#67cb87] bg-[#0a2824] shadow-xl">
							<Section className="border-b border-dotted border-[#67cb87] bg-[#0d312d] p-4">
								<Row>
									<Column>
										<div className="flex items-center">
											<div className="mr-2 h-3 w-3 rounded-full bg-[#67cb87]"></div>
											<div className="mr-2 h-3 w-3 rounded-full bg-[#e6c34a]"></div>
											<div className="mr-2 h-3 w-3 rounded-full bg-[#ea5f5f]"></div>
											<Text className="m-0 font-mono text-xs tracking-wider text-[#67cb87] uppercase">
												PERFAGENT - NEWSLETTER {currentDate}
											</Text>
										</div>
									</Column>
								</Row>
							</Section>

							{/* Hero Section */}
							<Section className="m-0 p-0">
								{heroLinkUrl ? (
									<Link href={heroLinkUrl}>
										<Img
											src={heroImageUrl}
											alt={heroImageAlt || 'PerfAgent Newsletter Hero Image'}
											width="600"
											className="w-full max-w-full"
										/>
									</Link>
								) : (
									<Img
										src={heroImageUrl}
										alt={heroImageAlt || 'PerfAgent Newsletter Hero Image'}
										width="600"
										className="w-full max-w-full"
									/>
								)}
							</Section>

							{/* Main Content */}
							<Section className="relative p-8">
								{/* Terminal-style headline */}
								<Heading className="mb-6 font-mono text-2xl font-bold text-[#67cb87]">
									<span className="text-[#67cb87]">{'>'}</span> {headline}
								</Heading>

								<Text className="mb-6 font-mono text-[#c3e6d4]">
									Welcome to our latest performance insights newsletter. Here's
									what's new in the world of web performance optimization.
								</Text>

								{/* Command prompt divider */}
								<Section className="mb-6 rounded-md border border-dashed border-[#67cb87] p-2">
									<Text className="m-0 text-center font-mono text-[#67cb87]">
										$ ./view_updates.sh
									</Text>
								</Section>

								{/* Updates/Stories Section */}
								{updates.map((update, index) => (
									<Section key={index} className="mb-8">
										<Section className="mb-4 rounded-md border border-dotted border-[#67cb87] bg-[#0d312d] p-6">
											<Text className="m-0 font-mono font-bold text-[#67cb87]">
												<span className="text-[#67cb87]">{'>'}</span>{' '}
												{update.title}
											</Text>

											<Text className="m-0 mt-2 font-mono text-[#c3e6d4]">
												{update.content}
											</Text>

											{update.imageUrl &&
												(update.linkUrl ? (
													<Link href={update.linkUrl}>
														<Img
															src={update.imageUrl}
															alt={`Image for ${update.title}`}
															width="500"
															className="border-opacity-50 mt-4 rounded-md border border-[#67cb87]"
														/>
													</Link>
												) : (
													<Img
														src={update.imageUrl}
														alt={`Image for ${update.title}`}
														width="500"
														className="border-opacity-50 mt-4 rounded-md border border-[#67cb87]"
													/>
												))}

											{update.linkUrl && (
												<Section className="mt-4">
													<Button
														href={update.linkUrl}
														className="rounded border border-[#67cb87] bg-[#0a2824] px-4 py-2 font-mono text-sm text-[#67cb87]"
													>
														{update.linkText || 'Read More'}
													</Button>
												</Section>
											)}
										</Section>

										{index < updates.length - 1 && (
											<Text className="m-0 text-center font-mono text-sm text-[#67cb87]">
												# # # # #
											</Text>
										)}
									</Section>
								))}

								{/* Main CTA */}
								{/* <Section className="mt-8 mb-6 text-center">
									<Button
										href={ctaUrl}
										className="rounded-md bg-[#67cb87] px-6 py-3 font-mono font-bold text-[#0a2824]"
									>
										{ctaText}
									</Button>
								</Section> */}

								{/* Terminal-style closing */}
								<Text className="mt-6 font-mono text-sm text-[#c3e6d4]">
									Thank you for being part of our community. We're excited to
									continue helping you optimize your web performance.
								</Text>
							</Section>

							{/* Footer */}
							<Section className="border-t border-dotted border-[#67cb87] bg-[#0d312d] p-4">
								<Text className="m-0 text-center font-mono text-xs text-[#67cb87]">
									&copy; {new Date().getFullYear()} PerfAgent. All rights
									reserved.
								</Text>
								<Text className="m-0 mt-2 text-center font-mono text-xs text-[#c3e6d4]">
									You're receiving this email at {recipientEmail} because you
									signed up for PerfAgent waitlist.
								</Text>
								<Text className="m-0 mt-2 text-center font-mono text-xs text-[#c3e6d4]">
									<Link
										href={unsubscribeUrl}
										className="text-[#67cb87] underline"
									>
										Unsubscribe
									</Link>
								</Text>
							</Section>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

export default NewsletterEmail;
