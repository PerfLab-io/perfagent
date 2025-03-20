import { Metadata } from "next";
import { UnsubscribeForm } from "@/components/unsubscribe-form";

export const metadata: Metadata = {
  title: "Unsubscribe | PerfAgent",
  description: "Unsubscribe from PerfAgent updates and communications",
};

export default function UnsubscribePage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const email = searchParams.email || "";

  return (
    <div className="container mx-auto px-4 py-20">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-peppermint-950 dark:text-peppermint-50">
          Unsubscribe from PerfAgent
        </h1>
        <div className="bg-peppermint-100 dark:bg-peppermint-900 rounded-lg p-8 shadow-sm">
          <UnsubscribeForm initialEmail={email} />
        </div>
      </div>
    </div>
  );
}
