"use client";

import type React from "react";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bell, CheckCircle, AlertCircle } from "lucide-react";
import { emailSchema, type EmailFormValues } from "@/lib/validations/email";
import { subscribeToNewsletter } from "@/app/actions/subscribe";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

export function SignupNotification() {
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: EmailFormValues) => {
    setServerError(null);

    const formData = new FormData();
    formData.append("email", data.email);

    startTransition(async () => {
      const result = await subscribeToNewsletter(formData);

      if (result.success) {
        setSubmitted(true);
        reset();
      } else {
        setServerError(
          result.error || "Something went wrong. Please try again."
        );
      }
    });
  };

  return (
    <div className="w-full py-16 bg-peppermint-950 dark:bg-peppermint-100 relative overflow-hidden">
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
              $ ./subscribe_to_updates.sh
            </div>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-peppermint-50 dark:text-peppermint-950">
            <span className="text-peppermint-500 dark:text-peppermint-700">
              {">"}
            </span>{" "}
            Be the first to know when we launch
          </h2>

          <p className="text-peppermint-300 dark:text-peppermint-700 mb-8 max-w-2xl">
            Our performance optimization platform is almost ready. Sign up now
            to get early access, exclusive beta features, and performance
            insights before anyone else.
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit(onSubmit)} className="mb-8">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-peppermint-500 dark:text-peppermint-700">
                    <span className="font-mono">{">"}</span>
                  </div>
                  <input
                    type="email"
                    {...register("email")}
                    placeholder="Enter your email address"
                    className="w-full h-12 bg-peppermint-900/50 dark:bg-peppermint-200/50 border border-peppermint-700 dark:border-peppermint-400 text-peppermint-600 dark:text-peppermint-500 px-8 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-peppermint-500 dark:focus:ring-peppermint-700 placeholder:text-peppermint-600 dark:placeholder:text-peppermint-500"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="h-12 bg-peppermint-500 hover:bg-peppermint-600 dark:bg-peppermint-700 dark:hover:bg-peppermint-800 text-peppermint-950 dark:text-peppermint-50 font-medium px-6 rounded-md transition-all flex items-center justify-center gap-2 min-w-[180px]"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      Processing
                      <span className="inline-block w-4 h-4 border-2 border-peppermint-950 border-t-transparent rounded-full animate-spin"></span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Notify Me <ArrowRight size={16} />
                    </span>
                  )}
                </Button>
              </div>

              {/* Error messages */}
              {(errors.email || serverError) && (
                <div className="mt-2 flex items-start gap-2 text-red-500">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">
                    {errors.email?.message || serverError}
                  </span>
                </div>
              )}
            </form>
          ) : (
            <div className="bg-peppermint-900/30 dark:bg-peppermint-200/30 border border-peppermint-700 dark:border-peppermint-400 rounded-md p-6 mb-8 flex items-center gap-4 animate-fadeIn">
              <CheckCircle className="text-peppermint-500 dark:text-peppermint-700 h-8 w-8 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-peppermint-50 dark:text-peppermint-950 mb-1">
                  You're on the list!
                </h4>
                <p className="text-peppermint-300 dark:text-peppermint-700">
                  We'll notify you when PerfAgent launches. Keep an eye on your
                  inbox.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-peppermint-400 dark:text-peppermint-600 text-sm">
            <div className="flex items-center gap-2">
              <Bell
                size={16}
                className="text-peppermint-500 dark:text-peppermint-700"
              />
              <span>Early access to beta features</span>
            </div>
            <div className="hidden sm:block h-1 w-1 rounded-full bg-peppermint-700 dark:bg-peppermint-500"></div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-peppermint-500 dark:text-peppermint-700">
                {"{"}
              </span>
              <span>No spam, unsubscribe anytime</span>
              <span className="font-mono text-peppermint-500 dark:text-peppermint-700">
                {"}"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
