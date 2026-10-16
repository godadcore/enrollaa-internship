import "server-only";

import { DataAccessError } from "@/lib/data/errors";
import { privilegedDatabase } from "@/lib/data/database";
import { hashInvitationToken, InvitationError, verifyStaffInvitation } from "@/lib/invitations";
import { validateAccountPassword } from "@/lib/auth/password-rules";

function cleanEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function alreadyRegistered(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message ?? "";
  return error?.code === "email_exists" || /already been registered|already exists/i.test(message);
}

async function createAuthUser(email: string, password: string): Promise<string> {
  const admin = privilegedDatabase();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (created.data.user?.id) return created.data.user.id;

  if (!alreadyRegistered(created.error)) {
    throw new InvitationError("Unable to activate this invitation.", 500);
  }
  throw new InvitationError(
    "An account already exists for this email. Sign in with your existing password or use the password-recovery flow, then contact an administrator to complete the invitation.",
    409,
  );
}

function throwActivationError(error: unknown): never {
  const message =
    error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "";
  if (/already been used/i.test(message)) {
    throw new InvitationError("This invitation has already been used.", 409);
  }
  if (/email does not match/i.test(message)) {
    throw new InvitationError("Use the email address from your invitation.", 400);
  }
  if (/account already exists/i.test(message)) {
    throw new InvitationError("An account already exists for this email.", 409);
  }
  if (/Invalid invitation/i.test(message)) {
    throw new InvitationError("This invitation is invalid, expired, revoked, or already used.", 400);
  }
  throw new InvitationError("Unable to activate this invitation.", 500);
}

/**
 * Creates a new Auth user for a valid invitation, then provisions the profile
 * from invitation rows. Existing Auth passwords are never changed here.
 * Client role/department fields are ignored.
 */
export async function activateInvitationAccount(input: {
  token: unknown;
  email: unknown;
  password: unknown;
}): Promise<{ alreadyComplete: boolean }> {
  const token = typeof input.token === "string" ? input.token.trim() : "";
  const email = cleanEmail(input.email);
  const passwordError = validateAccountPassword(input.password);
  if (!token || token.length > 256) {
    throw new InvitationError("This invitation is invalid, expired, revoked, or already used.", 400);
  }
  if (!email) throw new InvitationError("Use the email address from your invitation.", 400);
  if (passwordError) throw new DataAccessError(passwordError, 400);

  const invitation = await verifyStaffInvitation(token);
  if (!invitation) {
    throw new InvitationError("This invitation is invalid, expired, revoked, or already used.", 400);
  }
  if (invitation.email !== email) {
    throw new InvitationError("Use the email address from your invitation.", 400);
  }

  const authUserId = await createAuthUser(invitation.email, input.password as string);
  const { data, error } = await privilegedDatabase().rpc("activate_staff_invitation", {
    p_token_hash: hashInvitationToken(token),
    p_auth_user_id: authUserId,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) throwActivationError(error);
  return { alreadyComplete: Boolean((row as { already_complete?: boolean }).already_complete) };
}
