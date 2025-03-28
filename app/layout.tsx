import type React from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "PerfAgent - AI-Powered Web Performance Analysis | PerfLab",
  description:
    "PerfAgent is an AI assistant specialized in web performance and Core Web Vitals analysis. Get expert insights and recommendations to optimize your website's performance without traditional monitoring.",
  keywords:
    "web performance, core web vitals, AI agent, performance analysis, web optimization, performance insights, performance agent, performance analysis agent, performance optimization agent, performance insights agent",
  authors: [{ name: "PerfLab Team" }],
  creator: "PerfLab",
  publisher: "PerfLab",

  // Open Graph metadata
  openGraph: {
    type: "website",
    url: "https://agent.perflab.io",
    title: "PerfAgent - AI-Powered Web Performance Analysis",
    description:
      "Get expert insights on Core Web Vitals and performance optimization from an AI specialized in web performance analysis.",
    siteName: "PerfAgent by PerfLab",
    images: [
      {
        url: "/images/logo.svg",
        width: 1200,
        height: 630,
        alt: "PerfAgent - AI-Powered Web Performance Analysis",
      },
    ],
  },

  // Twitter metadata
  twitter: {
    card: "summary_large_image",
    title: "PerfAgent - AI-Powered Web Performance Analysis",
    description:
      "Get expert insights on Core Web Vitals and performance optimization from an AI specialized in web performance analysis.",
    creator: "@perflabio",
    images: ["/images/logo.svg"],
  },

  // Icons
  icons: {
    icon: [{ url: "/favicons/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/favicons/apple-icon.png" }],
  },

  // App manifest
  manifest: "/site.webmanifest",

  // Verification for search engines
  // verification: {
  //   google: "google-site-verification-code", // Replace with actual verification code if available
  // },

  // Canonical URL
  alternates: {
    canonical: "https://agent.perflab.io",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="PerfAgent" />
        <meta name="theme-color" content="#4ade80" />

        {/* Schema.org markup for Google */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "PerfAgent",
              applicationCategory: "WebApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              description:
                "AI-powered web performance analysis and Core Web Vitals optimization assistant.",
              creator: {
                "@type": "Organization",
                name: "PerfLab",
                logo: "/images/logo.svg",
                url: "https://agent.perflab.io",
              },
            }),
          }}
        />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
