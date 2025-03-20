"use server";

import { z } from "zod";
import { Resend } from "resend";
import { emailSchema } from "@/lib/validations/email";

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Check if we're in a local/development environment
const isLocalEnvironment = process.env.NODE_ENV === "development";

// Waitlist audience name - should match the one in subscribe.ts
const WAITLIST_AUDIENCE_NAME = "PerfAgent Waitlist";
let WAITLIST_AUDIENCE_ID: string | null = null;

/**
 * Finds the waitlist audience ID
 */
async function getWaitlistAudienceId() {
  if (isLocalEnvironment) {
    return "local-audience-id";
  }

  try {
    // If we already have the audience ID cached, return it
    if (WAITLIST_AUDIENCE_ID) {
      return WAITLIST_AUDIENCE_ID;
    }

    // Get all audiences to find ours
    const { data: audiences, error: audiencesError } =
      await resend.audiences.list();

    if (audiencesError || !audiences) {
      console.error("Error listing audiences:", audiencesError);
      throw new Error("Failed to list audiences");
    }

    // Check if our waitlist audience already exists
    const waitlistAudience = audiences.data.find(
      (audience) => audience.name === WAITLIST_AUDIENCE_NAME
    );

    if (waitlistAudience) {
      WAITLIST_AUDIENCE_ID = waitlistAudience.id;
      return waitlistAudience.id;
    }

    // If audience doesn't exist, there's nothing to unsubscribe from
    console.log("Waitlist audience not found");
    return null;
  } catch (error) {
    console.error("Error finding waitlist audience:", error);
    throw new Error("Failed to find waitlist audience");
  }
}

/**
 * Removes an email from the waitlist audience
 */
async function removeFromWaitlist(email: string) {
  if (isLocalEnvironment) {
    console.log(
      `🔷 Local environment - Would remove ${email} from waitlist audience`
    );

    // Simulate "Email not found in waitlist" error for test@test.com
    if (email === "test@test.com") {
      throw new Error("Email not found in waitlist");
    }

    return { success: true };
  }

  try {
    const audienceId = await getWaitlistAudienceId();

    // If no audience found, we consider it a success (nothing to remove from)
    if (!audienceId) {
      return { success: true };
    }

    // Find all contacts in the audience
    const { data: contacts, error: findError } = await resend.contacts.list({
      audienceId,
    });

    if (findError || !contacts) {
      console.error("Error finding contacts:", findError);
      throw new Error("Failed to find contacts in waitlist");
    }

    // Filter for the specific email we want to unsubscribe
    const contactToUpdate = contacts.data.find(
      (contact) => contact.email === email
    );

    // If contact not found, return an error
    if (!contactToUpdate) {
      console.log(`Email ${email} not found in waitlist`);
      throw new Error("Email not found in waitlist");
    }

    // If contact is already unsubscribed, return an error
    if (contactToUpdate.unsubscribed) {
      console.log(`Email ${email} is already unsubscribed`);
      throw new Error("No such email with active subscription found");
    }

    // Update contact to mark as unsubscribed
    const { error: updateError } = await resend.contacts.update({
      audienceId,
      id: contactToUpdate.id,
      unsubscribed: true,
    });

    if (updateError) {
      console.error("Error unsubscribing from waitlist:", updateError);
      throw new Error("Failed to unsubscribe from waitlist");
    }

    return { success: true };
  } catch (error) {
    console.error("Remove from waitlist error:", error);
    throw error;
  }
}

export async function unsubscribeFromWaitlist(formData: FormData) {
  try {
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

    // For production, remove from the waitlist audience
    try {
      await removeFromWaitlist(email);
    } catch (error) {
      console.error("Failed to remove from waitlist:", error);
      // Handle different error cases with user-friendly messages
      if (error instanceof Error) {
        if (error.message === "Email not found in waitlist") {
          return {
            success: false,
            error: "This email is not subscribed to our waitlist.",
          };
        }
        if (error.message === "No such email with active subscription found") {
          return {
            success: false,
            error: "This email is already unsubscribed from our waitlist.",
          };
        }
      }
      return {
        success: false,
        error: "Failed to remove you from our waitlist. Please try again.",
      };
    }

    // We successfully unsubscribed the user from the waitlist
    console.log(`Unsubscribed ${email} from waitlist`);

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
