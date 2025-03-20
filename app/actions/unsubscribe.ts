"use server";

import { z } from "zod";
import { emailSchema } from "@/lib/validations/email";

// Check if we're in a local/development environment
const isLocalEnvironment = process.env.NODE_ENV === "development";

export async function unsubscribeFromWaitlist(email: string) {
  try {
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

    // In local environment, just log to console
    if (isLocalEnvironment) {
      console.log(`🔷 Local environment - Would remove ${email} from waitlist`);
      return { success: true };
    }

    // Here you would normally remove the email from your database/waitlist
    // Example: await db.waitlist.delete({ where: { email } });

    // For now, let's assume it's successful
    console.log(`Removed ${email} from waitlist`);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Unsubscribe action error:", error);
    return {
      success: false,
      error: "Something went wrong while processing your unsubscribe request.",
    };
  }
}
