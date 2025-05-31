import {
	Body,
	Container,
	Head,
	Heading,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Text,
} from '@react-email/components';

interface OnboardingSignupEmailProps {
	userEmail?: string;
}

export const OnboardingSignupEmail = ({
	userEmail = 'user@example.com',
}: OnboardingSignupEmailProps) => {
	return (
		<Html>
			<Head />
			<Preview>
				Welcome to PerfAgent - Create your account to get started
			</Preview>
			<Body style={main}>
				<Container style={container}>
					{/* Header */}
					<Section style={header}>
						<Text style={headerText}>PERFAGENT</Text>
						<Text style={headerSubtext}>Performance Monitoring System</Text>
					</Section>

					{/* Hero Image */}
					<Section style={heroSection}>
						<Img
							src="https://yn20j37lsyu3f9lc.public.blob.vercel-storage.com/newsletter/hero_images/hero16-VKXKwJJzJwMhFV0ovjFpGVljf8nxLL.jpg"
							width="600"
							height="300"
							alt="PerfAgent Performance Monitoring"
							style={heroImage}
						/>
					</Section>

					{/* Main Content */}
					<Section style={content}>
						<Text style={terminalPrompt}>
							$ system.welcome --user={userEmail}
						</Text>

						<Heading style={heading}>You're Invited to Join PerfAgent</Heading>

						<Text style={paragraph}>
							We've received your interest in PerfAgent, the AI-powered
							performance analysis and knowledge assistant agent that helps
							developers identify bottlenecks, optimize code, and ship faster
							applications.
						</Text>

						<Text style={paragraph}>
							Ready to transform how you analyze and optimize your applications?
							Create your account and join our community of developers already
							using PerfAgent to build better software.
						</Text>

						{/* System Status */}
						<Section style={statusSection}>
							<Text style={statusTitle}>SYSTEM STATUS</Text>
							<Text style={statusItem}>✓ Platform: OPERATIONAL</Text>
							<Text style={statusItem}>✓ AI Agent: READY</Text>
							<Text style={statusItem}>✓ Account Creation: AVAILABLE</Text>
							<Text style={statusItem}>⏳ Your Account: PENDING SETUP</Text>
						</Section>

						{/* Main CTA */}
						<Section style={ctaSection}>
							<Link
								href="https://agent.perflab.io/signup"
								style={primaryButton}
							>
								Create Your Account →
							</Link>
						</Section>

						{/* Getting Started Steps */}
						<Section style={stepsSection}>
							<Text style={stepsTitle}>QUICK SETUP GUIDE</Text>
							<Text style={stepItem}>
								<strong>1. Create Account</strong>
								<br />
								Sign up with your email and set up your profile in under 2
								minutes.
							</Text>
							<Text style={stepItem}>
								<strong>2. Connect Your Project</strong>
								<br />
								Link your repository or upload your application for instant
								analysis.
							</Text>
							<Text style={stepItem}>
								<strong>3. Start Monitoring</strong>
								<br />
								Get AI-powered insights and performance recommendations
								immediately.
							</Text>
						</Section>

						{/* Secondary CTAs */}
						<Section style={secondaryCtaSection}>
							<Link
								href="https://agent.perflab.io/demo"
								style={secondaryButton}
							>
								View Live Demo
							</Link>
							<Link
								href="https://agent.perflab.io/docs"
								style={secondaryButton}
							>
								Read Documentation
							</Link>
						</Section>

						<Text style={paragraph}>
							Questions about getting started? Our team is here to help you
							succeed.
						</Text>

						<Text style={supportText}>
							Need assistance? Contact us at{' '}
							<Link href="mailto:support@perflab.io" style={link}>
								support@perflab.io
							</Link>
						</Text>

						<Text style={signature}>
							Best regards,
							<br />
							The PerfAgent Team
						</Text>

						<Text style={terminalPrompt}>
							$ session.end --status=pending_signup
						</Text>
					</Section>

					{/* Footer */}
					<Section style={footer}>
						<Text style={footerText}>
							PerfAgent - AI-Powered Performance Monitoring
						</Text>
						<Text style={footerText}>
							This invitation was sent to {userEmail}
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
};

export default OnboardingSignupEmail;

// Styles
const main = {
	backgroundColor: '#0a0a0a',
	fontFamily: '"Courier New", monospace',
	color: '#00ff88',
};

const container = {
	margin: '0 auto',
	padding: '20px 0 48px',
	width: '600px',
	maxWidth: '100%',
};

const header = {
	borderBottom: '2px dotted #00ff88',
	paddingBottom: '16px',
	marginBottom: '24px',
};

const headerText = {
	fontSize: '14px',
	fontWeight: 'bold',
	margin: '0',
	color: '#00ff88',
};

const headerSubtext = {
	fontSize: '12px',
	margin: '4px 0 0 0',
	color: '#888888',
};

const heroSection = {
	marginBottom: '32px',
};

const heroImage = {
	width: '100%',
	height: 'auto',
	border: '2px dotted #00ff88',
};

const content = {
	padding: '0 24px',
};

const terminalPrompt = {
	fontSize: '12px',
	color: '#888888',
	margin: '0 0 16px 0',
	fontFamily: '"Courier New", monospace',
};

const heading = {
	fontSize: '24px',
	fontWeight: 'bold',
	margin: '0 0 24px 0',
	color: '#00ff88',
};

const paragraph = {
	fontSize: '14px',
	lineHeight: '1.6',
	margin: '0 0 16px 0',
	color: '#cccccc',
};

const statusSection = {
	backgroundColor: '#111111',
	border: '1px dotted #00ff88',
	padding: '16px',
	margin: '24px 0',
};

const statusTitle = {
	fontSize: '12px',
	fontWeight: 'bold',
	margin: '0 0 12px 0',
	color: '#00ff88',
};

const statusItem = {
	fontSize: '12px',
	margin: '4px 0',
	color: '#cccccc',
};

const ctaSection = {
	textAlign: 'center' as const,
	margin: '32px 0',
};

const primaryButton = {
	backgroundColor: '#00ff88',
	color: '#000000',
	padding: '12px 32px',
	textDecoration: 'none',
	borderRadius: '0',
	fontSize: '14px',
	fontWeight: 'bold',
	fontFamily: '"Courier New", monospace',
	border: '2px solid #00ff88',
	display: 'inline-block',
};

const stepsSection = {
	backgroundColor: '#111111',
	border: '1px dotted #00ff88',
	padding: '20px',
	margin: '24px 0',
};

const stepsTitle = {
	fontSize: '14px',
	fontWeight: 'bold',
	margin: '0 0 16px 0',
	color: '#00ff88',
};

const stepItem = {
	fontSize: '13px',
	lineHeight: '1.5',
	margin: '0 0 16px 0',
	color: '#cccccc',
};

const secondaryCtaSection = {
	textAlign: 'center' as const,
	margin: '24px 0',
};

const secondaryButton = {
	backgroundColor: 'transparent',
	color: '#00ff88',
	padding: '8px 16px',
	textDecoration: 'none',
	border: '1px dotted #00ff88',
	fontSize: '12px',
	fontFamily: '"Courier New", monospace',
	display: 'inline-block',
	margin: '0 8px',
};

const supportText = {
	fontSize: '12px',
	color: '#888888',
	margin: '24px 0 16px 0',
};

const link = {
	color: '#00ff88',
	textDecoration: 'underline',
};

const signature = {
	fontSize: '14px',
	margin: '24px 0 16px 0',
	color: '#cccccc',
};

const footer = {
	borderTop: '2px dotted #00ff88',
	paddingTop: '16px',
	marginTop: '32px',
	textAlign: 'center' as const,
};

const footerText = {
	fontSize: '11px',
	color: '#888888',
	margin: '4px 0',
};
