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

interface OnboardingWelcomeEmailProps {
	previewText?: string;
	userName?: string;
	heroImageUrl?: string;
	heroImageAlt?: string;
	chatUrl?: string;
	dashboardUrl?: string;
	docsUrl?: string;
	supportUrl?: string;
	unsubscribeUrl?: string;
	recipientEmail?: string;
}

export const OnboardingEmail = ({
	previewText = "Welcome to PerfAgent - Let's optimize your web performance together!",
	userName = 'Developer',
	heroImageUrl = 'https://yn20j37lsyu3f9lc.public.blob.vercel-storage.com/newsletter/hero_images/hero16-VKXKwJJzJwMhFV0ovjFpGVljf8nxLL.jpg',
	heroImageAlt = 'Welcome to PerfAgent! - AI-Powered Web Performance Analysis',
	chatUrl = 'https://agent.perflab.io/chat',
	unsubscribeUrl = 'https://agent.perflab.io/unsubscribe',
	recipientEmail = 'user@example.com',
}: OnboardingWelcomeEmailProps) => {
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
												WELCOME ABOARD!
											</Text>
										</div>
									</Column>
								</Row>
							</Section>

							{/* Hero Section */}
							<Section className="m-0 p-0">
								<Img
									src={heroImageUrl}
									alt={heroImageAlt}
									width="600"
									height="300"
									className="w-full max-w-full"
								/>
							</Section>

							{/* Main Content */}
							<Section className="relative p-8">
								{/* Terminal-style welcome */}
								<Heading className="mb-6 font-mono text-2xl font-bold text-[#67cb87]">
									<span className="text-[#67cb87]">{'>'}</span> Welcome to
									PerfAgent, {userName}!
								</Heading>

								<Text className="mb-6 font-mono text-[#c3e6d4]">
									Your account has been successfully granted access. You now
									have access to your personal performance analysis and
									knowledge assistant agent!
								</Text>

								{/* Command prompt divider */}
								<Section className="mb-6 rounded-md border border-dashed border-[#67cb87] p-2">
									<Text className="m-0 text-center font-mono text-[#67cb87]">
										$ ./initialize_performance_journey.sh
									</Text>
								</Section>

								{/* Welcome message */}
								<Section className="mb-6 rounded-md border border-dotted border-[#67cb87] bg-[#0d312d] p-6">
									<Text className="m-0 mb-4 font-mono font-bold text-[#67cb87]">
										<span className="text-[#67cb87]">{'>'}</span> System Status:
										READY
									</Text>

									<Text className="m-0 mb-4 font-mono text-[#c3e6d4]">
										PerfAgent is your AI-powered performance analysis and
										knowledge assistant. We analyze your Chrome DevTools traces,
										identify bottlenecks, and provide actionable insights to
										boost your Core Web Vitals and user experience.
									</Text>

									<Text className="m-0 font-mono text-[#c3e6d4]">
										Ready to supercharge your website's performance? Let's get
										started with your first chat!
									</Text>
								</Section>

								{/* Getting Started Steps */}
								<Section className="mb-8">
									<Text className="mb-4 font-mono font-bold text-[#67cb87]">
										<span className="text-[#67cb87]">{'>'}</span> Quick Start
										Guide:
									</Text>

									<Section className="mb-3 rounded-md border border-dotted border-[#67cb87] bg-[#0d312d] p-4">
										<Text className="m-0 font-mono font-bold text-[#e6c34a]">
											1. Start Your First Chat
										</Text>
										<Text className="m-0 mt-1 font-mono text-sm text-[#c3e6d4]">
											Login with your PerfLab email and password and have your
											first trace file ready! Ask PerfAgent to analyze your
											website's performance and give you actionable insights.
										</Text>
									</Section>

									<Section className="mb-3 rounded-md border border-dotted border-[#67cb87] bg-[#0d312d] p-4">
										<Text className="m-0 font-mono font-bold text-[#e6c34a]">
											2. Expand your knowledge
										</Text>
										<Text className="m-0 mt-1 font-mono text-sm text-[#c3e6d4]">
											Ask PerfAgent to perform research on a specific or
											relevant performance topic according to your trace or
											questions.
										</Text>
									</Section>

									<Section className="mb-3 rounded-md border border-dotted border-[#67cb87] bg-[#0d312d] p-4">
										<Text className="m-0 font-mono font-bold text-[#e6c34a]">
											3. Generate reports
										</Text>
										<Text className="m-0 mt-1 font-mono text-sm text-[#c3e6d4]">
											Generate insightful reports on your performance data and
											share them with your team by downloading the generated
											Markdown file.
										</Text>
									</Section>

									<Section className="mb-3 rounded-md border border-dotted border-[#67cb87] bg-[#0d312d] p-4">
										<Text className="m-0 font-mono font-bold text-[#e6c34a]">
											4. Provide feedback or ask for support
										</Text>
										<Text className="m-0 mt-1 font-mono text-sm text-[#c3e6d4]">
											Provide feedback or ask for support by contacting us at{' '}
											<Link
												href="mailto:support@perflab.io"
												className="text-[#67cb87] underline"
											>
												support@perflab.io
											</Link>
											.
										</Text>
									</Section>
								</Section>

								{/* Main CTA */}
								<Section className="mb-6 text-center">
									<Button
										href={chatUrl}
										className="rounded-md bg-[#67cb87] px-8 py-4 font-mono text-lg font-bold text-[#0a2824]"
									>
										Start Performance Chat →
									</Button>
								</Section>

								{/* Terminal-style closing */}
								<Text className="mt-6 font-mono text-sm text-[#c3e6d4]">
									Welcome to the future of web performance optimization. Let's
									build something fast together.
								</Text>

								<Text className="mt-4 font-mono text-sm text-[#67cb87]">
									— The PerfAgent Team
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
									signup to the PerfAgent and are now granted access.
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

export default OnboardingEmail;
