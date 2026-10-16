import "server-only";

import { getApplicationUrl } from "@/lib/app-url";
import { RECOVERY_REQUEST_MESSAGE } from "@/lib/auth/recovery-copy";
import { sendPasswordRecoveryEmail } from "@/lib/email-service";
import { privilegedDatabase } from "@/lib/data/database";

function cleanEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : "";
}

export function recoveryRequestAccepted() {
  return { success: true as const, message: RECOVERY_REQUEST_MESSAGE };
}

/**
 * Starts recovery without revealing whether the address has an account.
 * Uses generateLink (no GoTrue send) and the server email module.
 */
export async function requestPasswordRecovery(emailValue: unknown): Promise<{ success: true; message: string }> {
  const email = cleanEmail(emailValue);
  if (!email) return recoveryRequestAccepted();

  try {
    const redirectTo = `${getApplicationUrl()}/auth/callback?next=/reset-password`;
    const generated = await privilegedDatabase().auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    const actionLink = generated.data.properties?.action_link;
    if (generated.error || !actionLink) return recoveryRequestAccepted();

    const name =
      typeof generated.data.user?.user_metadata?.first_name === "string"
        ? generated.data.user.user_metadata.first_name
        : "there";

    await sendPasswordRecoveryEmail({
      candidateEmail: email,
      candidateName: name,
      resetUrl: actionLink,
    });
  } catch {
    // Identical public result whether the account exists or delivery failed.
  }

  return recoveryRequestAccepted();
}
