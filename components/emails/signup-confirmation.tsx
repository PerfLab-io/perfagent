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
  return (
    <Html>
      <Head />
      <Preview>
        Welcome to PerfAgent - Your Performance Optimization Platform
      </Preview>
      <Tailwind>
        <Body className="bg-[#0a2824] font-sans">
          <Container className="mx-auto py-8 px-4">
            <Section className="border-2 border-dotted border-[#67cb87] bg-[#0a2824] rounded-lg overflow-hidden shadow-xl max-w-[600px] mx-auto">
              {/* Header */}
              <Section className="bg-[#0d312d] border-b border-dotted border-[#67cb87] p-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-[#67cb87] mr-2"></div>
                  <Text className="text-[#67cb87] font-mono text-xs uppercase tracking-wider m-0">
                    PERFAGENT - SIGNUP CONFIRMATION
                  </Text>
                </div>
              </Section>

              {/* Main Content */}
              <Section className="p-8 relative">
                {/* Grid background - represented as a background color since we can't use CSS backgrounds */}
                <div className="absolute inset-0 bg-[#0a2824] opacity-50"></div>

                <div className="relative">
                  <Heading className="text-[#67cb87] font-mono text-2xl mb-6 font-bold">
                    &gt; Welcome to PerfAgent
                  </Heading>

                  <Text className="text-[#c3e6d4] mb-6 font-mono">
                    Thank you for signing up to our performance optimization
                    platform. We've added your email ({email}) to our waitlist.
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
                      We're working hard to finalize our platform. You'll
                      receive an email with your exclusive access link as soon
                      as we launch.
                    </Text>
                  </Section>

                  <Section className="border border-dashed border-[#67cb87] rounded-md p-4 mb-6">
                    <Text className="text-[#67cb87] font-mono text-center m-0">
                      $ ./stay_tuned.sh
                    </Text>
                  </Section>

                  <Text className="text-[#c3e6d4] font-mono text-sm">
                    If you have any questions, please reply to this email or
                    contact our support team.
                  </Text>
                </div>
              </Section>

              {/* Footer */}
              <Section className="bg-[#0d312d] border-t border-dotted border-[#67cb87] p-4">
                <Text className="text-[#67cb87] font-mono text-xs text-center m-0">
                  &copy; 2023 PerfAgent. All rights reserved.
                </Text>
                <Text className="text-[#c3e6d4] font-mono text-xs text-center m-0 mt-2">
                  You're receiving this email because you signed up for
                  PerfAgent updates.
                </Text>
                <Text className="text-[#c3e6d4] font-mono text-xs text-center m-0 mt-2">
                  <Link href="#" className="text-[#67cb87] underline">
                    Unsubscribe
                  </Link>{" "}
                  or{" "}
                  <Link href="#" className="text-[#67cb87] underline">
                    manage preferences
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
