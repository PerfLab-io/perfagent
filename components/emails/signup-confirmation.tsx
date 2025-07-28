import {
	Body,
	Container,
	Head,
	Heading,
	Html,
	Link,
	Preview,
	Section,
	Text,
} from '@react-email/components';
import { Tailwind } from '@react-email/tailwind';

interface SignupEmailProps {
	email: string;
}

export const SignupEmail = ({
	email = 'user@example.com',
}: SignupEmailProps) => {
	// Create unsubscribe URL using environment variables
	const baseUrl =
		process.env.VERCEL_PROJECT_PRODUCTION_URL || 'http://localhost:3000';
	const unsubscribeUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}`;

	return (
		<Html>
			<Head />
			<Preview>Welcome to PerfAgent!</Preview>
			<Tailwind>
				<Body className="bg-[#0a2824] font-sans">
					<Container className="mx-auto px-4 py-8">
						<Section className="mx-auto max-w-[600px] overflow-hidden rounded-lg border-2 border-dotted border-[#67cb87] bg-[#0a2824] shadow-xl">
							{/* Header */}
							<Section className="border-b border-dotted border-[#67cb87] bg-[#0d312d] p-4">
								<div style={{ alignItems: 'center', display: 'flex' }}>
									<div className="mr-2 h-3 w-3 rounded-full bg-[#67cb87]"></div>
									<Text className="m-0 font-mono text-xs tracking-wider text-[#67cb87] uppercase">
										PERFAGENT WAITLIST - SIGNUP CONFIRMATION
									</Text>
								</div>
							</Section>

							{/* Main Content */}
							<Section className="relative p-8">
								{/* Grid background - represented as a background color since we can't use CSS backgrounds */}
								<div className="absolute inset-0 bg-[#0a2824] opacity-50"></div>

								<div className="relative">
									<Heading className="mb-6 font-mono text-2xl font-bold text-[#67cb87]">
										&gt; Welcome to PerfAgent Waitlist!
									</Heading>

									<Text className="mb-6 font-mono text-[#c3e6d4]">
										Thank you for signing up to our waitlist. We've added your
										email (<span className="text-[#67cb87]">{email}</span>) to
										the waitlist and we'll be in touch very soon!
									</Text>

									<Text className="mb-6 font-mono text-[#c3e6d4]">
										You'll be among the first to know when we launch and get
										early access to our beta features.
									</Text>

									<Section className="mb-6 rounded-md border border-dotted border-[#67cb87] bg-[#0d312d] p-6">
										<Text className="m-0 font-mono font-bold text-[#67cb87]">
											&gt; What's Next?
										</Text>
										<Text className="m-0 mt-2 font-mono text-[#c3e6d4]">
											We're working hard to finalize our agent, you'll receive
											an email with your exclusive access link as soon as we
											launch.
										</Text>
									</Section>

									<Section className="mb-6 rounded-md border border-dashed border-[#67cb87] p-4">
										<Text className="m-0 text-center font-mono text-[#67cb87]">
											$ ./stay_tuned.sh
										</Text>
									</Section>

									<Text className="font-mono text-sm text-[#c3e6d4]">
										If you have any questions, feel free to reach out to us at{' '}
										<Link
											href="mailto:support@perflab.io"
											className="text-[#67cb87] underline"
										>
											support@perflab.io
										</Link>
									</Text>
								</div>
							</Section>

							{/* Footer */}
							<Section className="border-t border-dotted border-[#67cb87] bg-[#0d312d] p-4">
								<Text className="m-0 text-center font-mono text-xs text-[#67cb87]">
									&copy; {new Date().getFullYear()} PerfAgent is a product of
									Perflab. All rights reserved.
								</Text>
								<Text className="m-0 mt-2 text-center font-mono text-xs text-[#c3e6d4]">
									You're receiving this email because you signed up for
									PerfAgent waitlist.
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

export default SignupEmail;
