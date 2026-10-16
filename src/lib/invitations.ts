import "server-only";

import crypto from "crypto";
import { DataAccessError } from "@/lib/data/errors";
import { privilegedDatabase } from "@/lib/data/database";
import { sendApprovalAndInvitationEmail } from "@/lib/email-service";
import type { TrustedProfile } from "@/lib/auth/authorization";
import { isOfficialInternshipRole } from "@/lib/internship-roles";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERIFIABLE_STATUSES = new Set(["selected", "invitation_sent"]);
const validRoles = new Set(["super_admin", "admin", "lead", "manager", "intern"]);

export class InvitationError extends DataAccessError {
  constructor(message: string, status = 400) {
    super(message, status);
  }
}

export type InvitationInput = {
  firstName: string;
  middleName?: string;
  surname: string;
  email: string;
  phone?: string;
  departmentSlug: string;
  assignedRole: string;
  roleTitle: string;
  intendedStartDate?: string;
};

export type InvitationListItem = {
  id: string;
  firstName: string;
  surname: string;
  email: string;
  department: string;
  roleTitle: string;
  status: string;
  invitationSentAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type PublicInvitationVerification = {
  firstName: string;
  surname: string;
  email: string;
  roleTitle: string;
  department: string;
  status: string;
};

type InvitationRow = {
  id: string;
  first_name: string;
  surname: string;
  email: string;
  role_title: string;
  status: string;
  invitation_sent_at: string | null;
  onboarding_token_expires_at: string | null;
  created_at: string;
  departments: { name: string } | { name: string }[] | null;
};

function cleanText(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function cleanEmail(value: unknown): string {
  const email = cleanText(value, 320).toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : "";
}

function departmentName(value: InvitationRow["departments"]): string {
  if (Array.isArray(value)) return typeof value[0]?.name === "string" ? value[0].name : "Unavailable";
  return value?.name ?? "Unavailable";
}

function displayedStatus(status: string, expiresAt: string | null): string {
  if (
    expiresAt &&
    new Date(expiresAt) <= new Date() &&
    (status === "selected" || status === "invitation_sent")
  ) {
    return "expired";
  }
  return status;
}

export function validateInvitationInput(input: unknown): { value?: InvitationInput; error?: string } {
  if (!input || typeof input !== "object") return { error: "Invitation details are required." };
  const record = input as Record<string, unknown>;
  const firstName = cleanText(record.firstName, 100);
  const middleName = cleanText(record.middleName, 100) || undefined;
  const surname = cleanText(record.surname, 100);
  const email = cleanEmail(record.email);
  const phone = cleanText(record.phone, 40) || undefined;
  const departmentSlug = cleanText(record.departmentSlug, 100).toLowerCase();
  const assignedRole = cleanText(record.assignedRole, 40);
  const roleTitle = cleanText(record.roleTitle, 160);
  const intendedStartDate = cleanText(record.intendedStartDate, 10) || undefined;
  if (!firstName || !surname || !email || !departmentSlug || !roleTitle) {
    return { error: "First name, surname, email, department, and role title are required." };
  }
  if (!validRoles.has(assignedRole)) return { error: "The selected account role is invalid." };
  if (assignedRole === "intern" && !isOfficialInternshipRole(roleTitle)) {
    return { error: "Intern invitations must use one of the six official internship roles." };
  }
  if (intendedStartDate && !/^\d{4}-\d{2}-\d{2}$/.test(intendedStartDate)) {
    return { error: "The start date must use YYYY-MM-DD." };
  }
  return {
    value: { firstName, middleName, surname, email, phone, departmentSlug, assignedRole, roleTitle, intendedStartDate },
  };
}

export function hashInvitationToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function tokenMaterial() {
  const token = crypto.randomBytes(32).toString("base64url");
  return {
    token,
    hash: hashInvitationToken(token),
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS).toISOString(),
  };
}

function throwDatabaseError(error: unknown): never {
  const message =
    error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "";
  if (/active invitation/i.test(message)) {
    throw new InvitationError("An active invitation already exists for this email.", 409);
  }
  if (/department/i.test(message)) {
    throw new InvitationError("The selected department is unavailable.", 400);
  }
  if (/Invitation not found/i.test(message)) {
    throw new InvitationError("Invitation not found.", 404);
  }
  if (/cannot be resent/i.test(message)) {
    throw new InvitationError("This invitation cannot be resent.", 409);
  }
  if (/cannot be revoked/i.test(message)) {
    throw new InvitationError("This invitation cannot be revoked.", 409);
  }
  if (/Administrator authorization/i.test(message)) {
    throw new InvitationError("Administrator access is required.", 403);
  }
  if (/Invalid invitation/i.test(message) || /token input/i.test(message)) {
    throw new InvitationError("Invitation details are invalid.", 400);
  }
  throw new InvitationError("Unable to process the invitation.", 500);
}

export async function listStaffInvitations(): Promise<InvitationListItem[]> {
  const { data, error } = await privilegedDatabase()
    .from("staff_invitations")
    .select("id, first_name, surname, email, role_title, status, invitation_sent_at, onboarding_token_expires_at, created_at, departments(name)")
    .limit(400)
    .order("created_at", { ascending: false });
  if (error) throw new InvitationError("Unable to load invitations.", 500);

  return ((data ?? []) as unknown as InvitationRow[]).map((row) => ({
    id: row.id,
    firstName: row.first_name,
    surname: row.surname,
    email: row.email,
    department: departmentName(row.departments),
    roleTitle: row.role_title,
    status: displayedStatus(row.status, row.onboarding_token_expires_at),
    invitationSentAt: row.invitation_sent_at,
    expiresAt: row.onboarding_token_expires_at,
    createdAt: row.created_at,
  }));
}

async function deliverInvitation(
  outboxId: string,
  profile: TrustedProfile,
  invitation: { email: string; firstName: string; surname: string; roleTitle: string; department: string },
  token: string,
) {
  const result = await sendApprovalAndInvitationEmail({
    candidateEmail: invitation.email,
    candidateName: `${invitation.firstName} ${invitation.surname}`,
    firstName: invitation.firstName,
    roleTitle: invitation.roleTitle,
    department: invitation.department,
    invitationToken: token,
    expiresDateStr: new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Africa/Lagos" }).format(
      new Date(Date.now() + INVITATION_TTL_MS),
    ),
  });
  const { error } = await privilegedDatabase().rpc("record_staff_invitation_delivery", {
    p_outbox_id: outboxId,
    p_actor_profile_id: profile.id,
    p_accepted: result.success,
    p_provider_message_id: result.messageId ?? null,
    p_error_code: result.success ? null : "email_delivery_failed",
    p_error_message: result.success ? null : result.error ?? "Email provider rejected the request.",
  });
  if (error) throw new InvitationError("Invitation was saved, but its delivery state could not be recorded.", 500);
  return result;
}

export async function createStaffInvitation(input: InvitationInput, profile: TrustedProfile) {
  const material = tokenMaterial();
  const { data, error } = await privilegedDatabase().rpc("create_staff_invitation", {
    p_email: input.email,
    p_first_name: input.firstName,
    p_middle_name: input.middleName ?? null,
    p_surname: input.surname,
    p_phone: input.phone ?? null,
    p_department_slug: input.departmentSlug,
    p_assigned_role: input.assignedRole,
    p_role_title: input.roleTitle,
    p_intended_start_date: input.intendedStartDate ?? null,
    p_actor_profile_id: profile.id,
    p_token_hash: material.hash,
    p_token_expires_at: material.expiresAt,
  });
  if (error || !data?.[0]) throwDatabaseError(error);
  const row = data[0];
  const delivery = await deliverInvitation(
    row.outbox_id,
    profile,
    {
      email: row.recipient_email,
      firstName: input.firstName,
      surname: input.surname,
      roleTitle: input.roleTitle,
      department: row.department_name,
    },
    material.token,
  );
  return { invitationId: row.invitation_id as string, delivered: delivery.success, error: delivery.error };
}

export async function resendStaffInvitation(invitationId: string, profile: TrustedProfile) {
  if (!UUID_PATTERN.test(invitationId)) throw new InvitationError("Invitation not found.", 404);
  const material = tokenMaterial();
  const { data, error } = await privilegedDatabase().rpc("resend_staff_invitation", {
    p_invitation_id: invitationId,
    p_actor_profile_id: profile.id,
    p_token_hash: material.hash,
    p_token_expires_at: material.expiresAt,
  });
  if (error || !data?.[0]) throwDatabaseError(error);
  const row = data[0];
  const delivery = await deliverInvitation(
    row.outbox_id,
    profile,
    {
      email: row.recipient_email,
      firstName: row.first_name,
      surname: row.surname,
      roleTitle: row.role_title,
      department: row.department_name,
    },
    material.token,
  );
  return { delivered: delivery.success, error: delivery.error };
}

export async function revokeStaffInvitation(invitationId: string, reason: unknown, profile: TrustedProfile) {
  if (!UUID_PATTERN.test(invitationId)) throw new InvitationError("Invitation not found.", 404);
  const cleanReason = cleanText(reason, 240);
  if (!cleanReason) throw new InvitationError("A revocation reason is required.", 400);
  const { error } = await privilegedDatabase().rpc("revoke_staff_invitation", {
    p_invitation_id: invitationId,
    p_actor_profile_id: profile.id,
    p_reason: cleanReason,
  });
  if (error) throwDatabaseError(error);
}

export async function verifyStaffInvitation(rawToken: string): Promise<PublicInvitationVerification | null> {
  if (!rawToken || rawToken.length > 256) return null;
  const hash = hashInvitationToken(rawToken);
  const { data, error } = await privilegedDatabase()
    .from("staff_invitations")
    .select("email, first_name, surname, role_title, status, revoked_at, auth_user_id, activated_at, onboarding_token_expires_at, departments(name)")
    .eq("onboarding_token_hash", hash)
    .maybeSingle();
  if (error || !data) return null;
  if (!VERIFIABLE_STATUSES.has(data.status) || data.revoked_at || data.auth_user_id || data.activated_at) return null;
  if (!data.onboarding_token_expires_at || new Date(data.onboarding_token_expires_at) <= new Date()) return null;
  return {
    firstName: data.first_name,
    surname: data.surname,
    email: data.email,
    roleTitle: data.role_title,
    department: departmentName(data.departments as InvitationRow["departments"]),
    status: data.status,
  };
}

