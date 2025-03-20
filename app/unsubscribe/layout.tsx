import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unsubscribe - PerfAgent",
  description: "Unsubscribe from PerfAgent newsletter and updates",
};

export default function UnsubscribeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-peppermint-950 dark:bg-peppermint-100">
      {children}
    </div>
  );
}
