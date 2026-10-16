import "server-only";

import {
  renderInvitationEmail,
  renderActivationEmail,
  renderPasswordRecoveryEmail,
  renderPasswordChangedEmail,
  InvitationEmailParams,
  ActivationEmailParams,
  PasswordRecoveryEmailParams,
  PasswordChangedEmailParams,
} from "./email-templates";
import { publicApplicationLink } from "./app-url";

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string;
  isSimulated: boolean;
  error?: string;
}

const EMAIL_FROM = process.env.EMAIL_FROM || "Enrollaa Internship <internship@enrollaa.com.ng>";

/**
 * Dispatch an email via configured provider (Resend) or log honest diagnostics.
 */
async function dispatchEmail(to: string, subject: string, html: string, text: string): Promise<SendEmailResult> {
  if (process.env.SKIP_EMAIL_DISPATCH === "1") {
    return {
      success: false,
      isSimulated: false,
      error:
        process.env.NODE_ENV === "production"
          ? "Email dispatch is disabled. Unset SKIP_EMAIL_DISPATCH before production delivery."
          : "Email dispatch is disabled in this environment.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (apiKey && apiKey.startsWith("re_") && !apiKey.includes("your_resend_api_key")) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to,
          subject,
          html,
          text,
        }),
      });

      if (!response.ok) {
        // Provider responses can contain operational details. Keep them out of
        // route responses and audit records; the worker only needs a safe state.
        return {
          success: false,
          isSimulated: false,
          error: "The email provider rejected the delivery request.",
        };
      }

      const data = await response.json().catch(() => null);
      if (!data || typeof data.id !== "string" || !data.id.trim()) {
        return { success: false, isSimulated: false, error: "The email provider returned an invalid acceptance response." };
      }
      return {
        success: true,
        messageId: data.id.trim(),
        isSimulated: false,
      };
    } catch {
      return {
        success: false,
        isSimulated: false,
        error: "Unable to reach the email provider.",
      };
    }
  }

  // Provider is not configured. Never represent a simulated message as delivered.
  return {
    success: false,
    isSimulated: false,
    error: "Email delivery is not configured in this environment.",
  };
}

export async function sendApprovalAndInvitationEmail(params: {
  candidateEmail: string;
  candidateName: string;
  firstName?: string;
  roleTitle: string;
  department: string;
  invitationToken: string;
  expiresDateStr?: string;
}): Promise<SendEmailResult> {
  let inviteUrl: string;
  try {
    inviteUrl = publicApplicationLink("/onboarding", params.invitationToken);
  } catch {
    return {
      success: false,
      isSimulated: false,
      error: "Email delivery is unavailable because the public application URL is not configured.",
    };
  }
  const { subject, html, text } = renderInvitationEmail({
    candidateName: params.candidateName,
    firstName: params.firstName,
    roleTitle: params.roleTitle,
    department: params.department,
    inviteUrl,
    expiresDateStr: params.expiresDateStr,
  });

  return dispatchEmail(params.candidateEmail, subject, html, text);
}

export async function sendAccountActivationEmail(params: {
  candidateEmail: string;
  candidateName: string;
  activationToken: string;
  expiresMinutes?: number;
}): Promise<SendEmailResult> {
  let setupPasswordUrl: string;
  try {
    setupPasswordUrl = publicApplicationLink("/create-password", params.activationToken);
  } catch {
    return {
      success: false,
      isSimulated: false,
      error: "Email delivery is unavailable because the public application URL is not configured.",
    };
  }
  const { subject, html, text } = renderActivationEmail({
    candidateName: params.candidateName,
    setupPasswordUrl,
    expiresMinutes: params.expiresMinutes,
  });

  return dispatchEmail(params.candidateEmail, subject, html, text);
}

export async function sendPasswordRecoveryEmail(params: {
  candidateEmail: string;
  candidateName: string;
  resetUrl: string;
  expiresMinutes?: number;
}): Promise<SendEmailResult> {
  const { subject, html, text } = renderPasswordRecoveryEmail({
    candidateName: params.candidateName,
    resetUrl: params.resetUrl,
    expiresMinutes: params.expiresMinutes || 60,
  });

  return dispatchEmail(params.candidateEmail, subject, html, text);
}

export async function sendPasswordChangedNoticeEmail(params: {
  candidateEmail: string;
  candidateName: string;
  changedAtWat: string;
}): Promise<SendEmailResult> {
  const { subject, html, text } = renderPasswordChangedEmail({
    candidateName: params.candidateName,
    email: params.candidateEmail,
    changedAtWat: params.changedAtWat,
  });

  return dispatchEmail(params.candidateEmail, subject, html, text);
}
