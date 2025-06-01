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

interface OtpVerificationEmailProps {
	email: string;
	otpCode: string;
}

export const OtpVerificationEmail = ({
	email = 'user@example.com',
	otpCode = 'A7B9X2',
}: OtpVerificationEmailProps) => {
	const verificationUrl = `https://agent.perflab.io/verify?type=onboarding&target=${encodeURIComponent(email)}&code=${otpCode}`;

	return (
		<Html>
			<Head />
			<Preview>Your PerfAgent verification code: {otpCode}</Preview>
			<Tailwind>
				<Body className="m-0 bg-[#0a2824] p-0 font-sans">
					<Container className="mx-auto max-w-[600px] px-4 py-8">
						<Section className="overflow-hidden rounded-lg border-2 border-dotted border-[#67cb87] bg-[#0a2824] shadow-xl">
							{/* Terminal-style Header */}
							<Section className="border-b border-dotted border-[#67cb87] bg-[#0d312d] p-4">
								<div className="flex items-center">
									<div className="mr-2 h-3 w-3 rounded-full bg-[#67cb87]"></div>
									<div className="mr-2 h-3 w-3 rounded-full bg-[#e6c34a]"></div>
									<div className="mr-2 h-3 w-3 rounded-full bg-[#ea5f5f]"></div>
									<Text className="m-0 font-mono text-xs tracking-wider text-[#67cb87] uppercase">
										ACCOUNT VERIFICATION
									</Text>
								</div>
							</Section>

							{/* Main Content */}
							<Section className="relative p-8">
								{/* Grid background - represented as a background color since we can't use CSS backgrounds */}
								<div className="absolute inset-0 bg-[#0a2824] opacity-50"></div>

								<div className="relative">
									<Heading className="mb-6 font-mono text-2xl font-bold text-[#67cb87]">
										&gt; Verify Your Account
									</Heading>

									<Text className="mb-6 font-mono text-[#c3e6d4]">
										To complete your PerfAgent account setup, please verify your
										email address using the code below:
									</Text>

									{/* OTP Code Display */}
									<Section className="mb-6 rounded-md border border-dotted border-[#67cb87] bg-[#0d312d] p-6">
										<Text className="m-0 mb-4 font-mono font-bold text-[#67cb87]">
											&gt; Verification Code:
										</Text>
										<Section className="mb-4 rounded-md border border-dashed border-[#67cb87] bg-[#0a2824] p-6 text-center">
											<Text className="m-0 font-mono text-4xl font-bold tracking-[0.3em] text-[#67cb87]">
												{otpCode}
											</Text>
										</Section>
										<Text className="m-0 font-mono text-sm text-[#c3e6d4]">
											This code expires in 7 days. Enter it on the verification
											page to complete your account setup.
										</Text>
									</Section>

									{/* Command prompt divider */}
									<Section className="mb-6 rounded-md border border-dashed border-[#67cb87] p-2">
										<Text className="m-0 text-center font-mono text-[#67cb87]">
											$ ./verify_account.sh --code={otpCode}
										</Text>
									</Section>

									{/* Verification Link */}
									<Section className="mb-6 rounded-md border border-dotted border-[#67cb87] bg-[#0d312d] p-6">
										<Text className="m-0 mb-4 font-mono font-bold text-[#67cb87]">
											&gt; Quick Verification:
										</Text>
										<Text className="m-0 mb-4 font-mono text-[#c3e6d4]">
											Click the link below to verify your account automatically:
										</Text>
										<Text className="m-0 text-center">
											<Link
												href={verificationUrl}
												className="font-mono font-bold text-[#67cb87] underline"
											>
												Click here to verify your account →
											</Link>
										</Text>
									</Section>

									{/* Security Notice */}
									<Section className="mb-6 rounded-md border border-dashed border-[#67cb87] p-4">
										<Text className="m-0 text-center font-mono text-xs text-[#67cb87]">
											SECURITY: Code requested for {email}
										</Text>
										<Text className="m-0 mt-1 text-center font-mono text-xs text-[#c3e6d4]">
											If you didn't request this, please ignore this email.
										</Text>
									</Section>

									<Text className="font-mono text-sm text-[#c3e6d4]">
										If you're having trouble with verification, please reply to
										this email or contact our support team.
									</Text>
								</div>
							</Section>

							{/* Footer */}
							<Section className="border-t border-dotted border-[#67cb87] bg-[#0d312d] p-4">
								<Text className="m-0 text-center font-mono text-xs text-[#67cb87]">
									&copy; {new Date().getFullYear()} PerfAgent. All rights
									reserved.
								</Text>
								<Text className="m-0 mt-2 text-center font-mono text-xs text-[#c3e6d4]">
									This verification email was sent to {email}
								</Text>
								<Text className="m-0 mt-2 text-center font-mono text-xs text-[#c3e6d4]">
									<Link
										href="mailto:support@perflab.io"
										className="text-[#67cb87] underline"
									>
										Contact Support
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

export default OtpVerificationEmail;
