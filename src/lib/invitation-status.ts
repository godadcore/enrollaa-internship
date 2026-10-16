export type InvitationStatusView = {
  invitation: "not_sent" | "sent" | "expired" | "revoked";
  onboarding: "not_started" | "in_progress" | "submitted" | "stopped";
  account: "not_created" | "activation_pending" | "active";
};

/** Keeps invitation, onboarding, and account states separate for one invitation row. */
export function invitationStatusView(status: string): InvitationStatusView {
  switch (status) {
    case "selected":
      return { invitation: "not_sent", onboarding: "not_started", account: "not_created" };
    case "invitation_sent":
      return { invitation: "sent", onboarding: "not_started", account: "not_created" };
    case "expired":
      return { invitation: "expired", onboarding: "not_started", account: "not_created" };
    case "revoked":
      return { invitation: "revoked", onboarding: "stopped", account: "not_created" };
    case "onboarding_started":
      return { invitation: "sent", onboarding: "in_progress", account: "not_created" };
    case "onboarding_submitted":
      return { invitation: "sent", onboarding: "submitted", account: "not_created" };
    case "activation_pending":
      return { invitation: "sent", onboarding: "submitted", account: "activation_pending" };
    case "active":
      return { invitation: "sent", onboarding: "submitted", account: "active" };
    default:
      return { invitation: "sent", onboarding: "not_started", account: "not_created" };
  }
}

export function canResendInvitation(status: string): boolean {
  return status === "selected" || status === "invitation_sent" || status === "expired";
}

export function canRevokeInvitation(status: string): boolean {
  return !["revoked", "onboarding_submitted", "activation_pending", "active"].includes(status);
}
