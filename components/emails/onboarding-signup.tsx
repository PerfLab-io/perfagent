import {
	Body,
	Container,
	Column,
	Head,
	Heading,
	Html,
	Img,
	Preview,
	Row,
	Section,
	Text,
} from '@react-email/components';
import { Tailwind } from '@react-email/tailwind';

interface OnboardingSignupEmailProps {
	recipientEmail?: string;
}

export const OnboardingSignupEmail = ({
	recipientEmail = 'user@example.com',
}: OnboardingSignupEmailProps) => {
	return (
		<Html>
			<Head />
			<Preview>Welcome to PerfAgent! You're on the waitlist!</Preview>
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
									src="https://yn20j37lsyu3f9lc.public.blob.vercel-storage.com/newsletter/hero_images/hero16-VKXKwJJzJwMhFV0ovjFpGVljf8nxLL.jpg"
									alt="PerfAgent Performance Analysis"
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
									PerfAgent!
								</Heading>

								<Text className="mb-6 font-mono text-[#c3e6d4]">
									Your account is now created, but we're not ready to give you
									access yet. You'll be notified when we're ready to launch!
								</Text>

								{/* Command prompt divider */}
								<Section className="mb-6 rounded-md border border-dashed border-[#67cb87] p-2">
									<Text className="m-0 text-center font-mono text-[#67cb87]">
										$ ./add_to_waitlist.sh
									</Text>
								</Section>

								{/* Welcome message */}
								<Section className="mb-6 rounded-md border border-dotted border-[#67cb87] bg-[#0d312d] p-6">
									<Text className="m-0 mb-4 font-mono font-bold text-[#67cb87]">
										<span className="text-[#67cb87]">{'>'}</span> System Status:
										UNDER DEVELOPMENT
									</Text>

									<Text className="m-0 mb-4 font-mono text-[#c3e6d4]">
										PerfAgent is your AI-powered performance analysis and
										knowledge assistant. We analyze your Chrome DevTools traces,
										identify bottlenecks, and provide actionable insights to
										boost your Core Web Vitals and user experience.
									</Text>

									<Text className="m-0 font-mono text-[#c3e6d4]">
										Your account is now created and added to our waitlist, we'll
										soon be reaching out to get you onboarded!
									</Text>
								</Section>
							</Section>

							{/* Footer */}
							<Section className="border-t border-dotted border-[#67cb87] bg-[#0d312d] p-4">
								<Text className="m-0 text-center font-mono text-xs text-[#67cb87]">
									&copy; {new Date().getFullYear()} PerfAgent. All rights
									reserved.
								</Text>
								<Text className="m-0 mt-2 text-center font-mono text-xs text-[#c3e6d4]">
									You're receiving this email at {recipientEmail} because you
									signed up to the PerfAgent waitlist.
								</Text>
							</Section>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

export default OnboardingSignupEmail;
