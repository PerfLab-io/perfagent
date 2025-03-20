"use client";

import React, { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { emailSchema, type EmailFormValues } from "@/lib/validations/email";
import { unsubscribeFromWaitlist } from "@/app/actions/unsubscribe";
import { AlertCircle, CheckCircle, Frown, Send } from "lucide-react";

export function UnsubscribeForm({
  initialEmail = "",
}: {
  initialEmail?: string;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError: setFormError,
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: initialEmail,
    },
  });

  const onSubmit = async (data: EmailFormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await unsubscribeFromWaitlist(data.email);

      if (result.success) {
        setIsSuccess(true);
      } else {
        setError(result.error || "Failed to unsubscribe. Please try again.");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle className="h-12 w-12 text-green-500" />
        </div>
        <h2 className="text-2xl font-semibold mb-4 text-peppermint-950 dark:text-peppermint-50">
          You've been unsubscribed
        </h2>
        <p className="text-peppermint-600 dark:text-peppermint-400 mb-6">
          We're sorry to see you go. Your email has been removed from our
          waitlist.
        </p>
        <p className="text-peppermint-500 dark:text-peppermint-500">
          Changed your mind? You can always{" "}
          <a
            href="/"
            className="text-peppermint-700 dark:text-peppermint-300 underline hover:text-peppermint-800 dark:hover:text-peppermint-200"
          >
            subscribe again
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Frown className="h-6 w-6 text-peppermint-500 dark:text-peppermint-400" />
        <h2 className="text-xl font-semibold text-peppermint-950 dark:text-peppermint-50">
          Sorry to see you go
        </h2>
      </div>

      <p className="text-peppermint-600 dark:text-peppermint-400 mb-6">
        We understand that you want to unsubscribe from our waitlist. Simply
        confirm your email address below to complete the process.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-peppermint-700 dark:text-peppermint-300 mb-1"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            placeholder="Enter your email address"
            className="w-full p-2 border border-peppermint-300 dark:border-peppermint-700 rounded-md bg-white dark:bg-peppermint-800 text-peppermint-900 dark:text-peppermint-100"
            {...register("email")}
          />
          {errors.email && (
            <div className="mt-1 flex items-center gap-1 text-red-500 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{errors.email.message}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-10 bg-peppermint-600 hover:bg-peppermint-700 text-white"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              Processing
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            </span>
          ) : (
            <span className="flex items-center gap-2 justify-center">
              Unsubscribe <Send size={16} />
            </span>
          )}
        </Button>
      </form>
    </div>
  );
}
