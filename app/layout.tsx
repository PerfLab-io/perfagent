import type React from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "PerfAgent - AI-Powered Web Performance Analysis | PerfLab",
  description:
    "PerfAgent is an AI assistant specialized in web performance and Core Web Vitals analysis. Get expert insights and recommendations to optimize your website's performance without traditional monitoring.",
  keywords:
    "web performance, core web vitals, AI agent, performance analysis, web optimization, LCP, CLS, INP, FID, performance insights",
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
  verification: {
    google: "google-site-verification-code", // Replace with actual verification code if available
  },

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
      <head />
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
