"use server";

import { Resend } from "resend";
import { emailSchema } from "@/lib/validations/email";
import { SignupEmail } from "@/components/emails/signup-confirmation";
import { z } from "zod";

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Check if we're in a local/development environment
const isLocalEnvironment = process.env.NODE_ENV === "development";

export async function subscribeToNewsletter(formData: FormData) {
  try {
    // Extract email from form data
    const email = formData.get("email") as string;

    // Validate email with Zod schema
    const validatedFields = emailSchema.safeParse({ email });

    if (!validatedFields.success) {
      return {
        success: false,
        error:
          validatedFields.error.flatten().fieldErrors.email?.[0] ||
          "Invalid email",
      };
    }

    // In local environment, log to console instead of sending emails
    if (isLocalEnvironment) {
      console.log("🔷 Local environment detected - Email would be sent with:");
      console.log({
        to: email,
        subject: "Welcome to PerfAgent!",
        content: `
          <div>
            <h1>Thanks for subscribing!</h1>
            <p>You'll be the first to know when PerfAgent launches.</p>
          </div>
        `,
      });

      // Return success for local environment
      return { success: true };
    }

    // For production, send confirmation email using Resend
    const { data, error } = await resend.emails.send({
      from: "no-reply@yourdomain.com", // Update with your verified domain
      to: email,
      subject: "Welcome to PerfAgent!",
      react: SignupEmail({ email }),
    });

    if (error) {
      console.error("Error sending email:", error);
      return {
        success: false,
        error: "Failed to send confirmation email",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Subscribe action error:", error);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}
