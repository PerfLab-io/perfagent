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
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";

interface SignupEmailProps {
  email: string;
}

export const SignupEmail = ({
  email = "user@example.com",
}: SignupEmailProps) => {
  // Create unsubscribe URL using environment variables
  const baseUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || "http://localhost:3000";
  const unsubscribeUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}`;

  return (
    <Html>
      <Head />
      <Preview>Welcome to PerfAgent!</Preview>
      <Tailwind>
        <Body className="bg-[#0a2824] font-sans">
          <Container className="mx-auto py-8 px-4">
            <Section className="border-2 border-dotted border-[#67cb87] bg-[#0a2824] rounded-lg overflow-hidden shadow-xl max-w-[600px] mx-auto">
              {/* Header */}
              <Section className="bg-[#0d312d] border-b border-dotted border-[#67cb87] p-4">
                <div style={{ alignItems: "center", display: "flex" }}>
                  <div className="w-3 h-3 rounded-full bg-[#67cb87] mr-2"></div>
                  <Text className="text-[#67cb87] font-mono text-xs uppercase tracking-wider m-0">
                    PERFAGENT WAITLIST - SIGNUP CONFIRMATION
                  </Text>
                </div>
              </Section>

              {/* Main Content */}
              <Section className="p-8 relative">
                {/* Grid background - represented as a background color since we can't use CSS backgrounds */}
                <div className="absolute inset-0 bg-[#0a2824] opacity-50"></div>

                <div className="relative">
                  <Heading className="text-[#67cb87] font-mono text-2xl mb-6 font-bold">
                    &gt; Welcome to PerfAgent Waitlist!
                  </Heading>

                  <Text className="text-[#c3e6d4] mb-6 font-mono">
                    Thank you for signing up to our waitlist. We've added your
                    email (<span className="text-[#67cb87]">{email}</span>) to
                    the waitlist and we'll be in touch very soon!
                  </Text>

                  <Text className="text-[#c3e6d4] mb-6 font-mono">
                    You'll be among the first to know when we launch and get
                    early access to our beta features.
                  </Text>

                  <Section className="bg-[#0d312d] border border-dotted border-[#67cb87] p-6 rounded-md mb-6">
                    <Text className="text-[#67cb87] font-mono font-bold m-0">
                      &gt; What's Next?
                    </Text>
                    <Text className="text-[#c3e6d4] font-mono m-0 mt-2">
                      We're working hard to finalize our agent, you'll receive
                      an email with your exclusive access link as soon as we
                      launch.
                    </Text>
                  </Section>

                  <Section className="border border-dashed border-[#67cb87] rounded-md p-4 mb-6">
                    <Text className="text-[#67cb87] font-mono text-center m-0">
                      $ ./stay_tuned.sh
                    </Text>
                  </Section>

                  <Text className="text-[#c3e6d4] font-mono text-sm">
                    If you have any questions, feel free to reach out to us at{" "}
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
              <Section className="bg-[#0d312d] border-t border-dotted border-[#67cb87] p-4">
                <Text className="text-[#67cb87] font-mono text-xs text-center m-0">
                  &copy; {new Date().getFullYear()} PerfAgent is a product of
                  Perflab. All rights reserved.
                </Text>
                <Text className="text-[#c3e6d4] font-mono text-xs text-center m-0 mt-2">
                  You're receiving this email because you signed up for
                  PerfAgent waitlist.
                </Text>
                <Text className="text-[#c3e6d4] font-mono text-xs text-center m-0 mt-2">
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
