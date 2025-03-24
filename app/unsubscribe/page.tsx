"use client";

import type React from "react";

import { useState, useTransition, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { unsubscribeFromWaitlist } from "@/app/actions/unsubscribe";
import { emailSchema } from "@/lib/validations/email";
import { z } from "zod";
import Link from "next/link";

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const validateEmail = (email: string) => {
    try {
      emailSchema.parse({ email });
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setError(error.errors[0]?.message || "Invalid email");
      }
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Reset error state
    setError(undefined);

    // Client-side validation
    if (!validateEmail(email)) {
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", email);
      const result = await unsubscribeFromWaitlist(formData);

      if (result.success) {
        setSubmitted(true);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="min-h-screen w-full py-16 bg-peppermint-950 dark:bg-peppermint-100 relative overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 dark:opacity-5"></div>

      {/* Scan lines effect */}
      <div className="absolute inset-0 bg-scanlines dark:bg-scanlines-light pointer-events-none"></div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto">
          {/* Terminal-style header */}
          <div className="mb-6 flex items-center">
            <div className="h-3 w-3 rounded-full bg-peppermint-500 dark:bg-peppermint-700 mr-2"></div>
            <div className="font-mono text-peppermint-500 dark:text-peppermint-700 text-sm uppercase tracking-wider">
              $ ./unsubscribe_from_updates.sh
            </div>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-peppermint-50 dark:text-peppermint-950">
            <span className="text-peppermint-500 dark:text-peppermint-700">
              {">"}
            </span>{" "}
            We're sorry to see you go
          </h2>

          {!submitted ? (
            <>
              <p className="text-peppermint-300 dark:text-peppermint-700 mb-8 max-w-2xl">
                We understand that inboxes can get crowded. If you'd like to
                unsubscribe from our updates, please confirm your email address
                below. You can always resubscribe later if you change your mind.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="flex w-full flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-peppermint-500 dark:text-peppermint-700">
                      <span className="font-mono">{">"}</span>
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(undefined);
                      }}
                      placeholder="Confirm your email address"
                      className="w-full h-12 bg-peppermint-50 dark:bg-white border border-peppermint-700 dark:border-peppermint-400 text-peppermint-600 dark:text-peppermint-500 px-8 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-peppermint-500 dark:focus:ring-peppermint-700 placeholder:text-peppermint-600 dark:placeholder:text-peppermint-500"
                      required
                      aria-invalid={error ? "true" : "false"}
                      aria-describedby={error ? "email-error" : undefined}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="h-12 bg-peppermint-500 hover:bg-peppermint-600 dark:bg-peppermint-700 dark:hover:bg-peppermint-800 text-peppermint-950 dark:text-peppermint-50 font-medium px-6 rounded-md transition-all flex items-center justify-center gap-2"
                  >
                    {isPending ? (
                      <span className="flex items-center gap-2">
                        Processing
                        <span className="inline-block w-4 h-4 border-2 border-peppermint-950 border-t-transparent rounded-full animate-spin"></span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Unsubscribe
                      </span>
                    )}
                  </Button>
                </div>
                {error && (
                  <div className="mt-2 flex items-start gap-2 text-red-500">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}
              </form>
            </>
          ) : (
            <>
              <div className="bg-peppermint-900/30 dark:bg-peppermint-200/30 border border-peppermint-700 dark:border-peppermint-400 rounded-md p-6 mb-8 flex items-start gap-4 animate-fadeIn">
                <CheckCircle className="text-peppermint-500 dark:text-peppermint-700 h-8 w-8 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-peppermint-50 dark:text-peppermint-950 mb-2">
                    You've been unsubscribed
                  </h4>
                  <p className="text-peppermint-300 dark:text-peppermint-700 mb-4">
                    We've removed your email from our waitlist.
                  </p>
                  <p className="text-peppermint-300 dark:text-peppermint-700">
                    If you unsubscribed by mistake or change your mind, you can
                    always sign up again on our homepage.
                  </p>
                </div>
              </div>

              <div className="flex justify-center">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-peppermint-500 dark:text-peppermint-700 hover:text-peppermint-400 dark:hover:text-peppermint-600 transition-colors"
                >
                  <ArrowLeft size={16} />
                  <span>Return to homepage</span>
                </Link>
              </div>
            </>
          )}

          <div className="mt-12 pt-8 border-t border-peppermint-800/50 dark:border-peppermint-300/50">
            <div className="text-center text-peppermint-400 dark:text-peppermint-600 text-sm">
              <p>
                If you have any questions or need assistance, please contact our
                support team.
              </p>
              <p className="mt-2">
                <span className="font-mono text-peppermint-500 dark:text-peppermint-700">
                  {"{"}
                </span>
                <span> support@perflab.io </span>
                <span className="font-mono text-peppermint-500 dark:text-peppermint-700">
                  {"}"}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
