import "server-only";

import { privilegedDatabase } from "@/lib/data/database";
import { DataAccessError } from "@/lib/data/errors";

export type ProgrammeDepartment = {
  id: string;
  name: string;
  slug: string;
  internCount: number;
  leads: string[];
};

export type ProgrammeSummary = {
  totalInvitations: number;
  awaitingResponse: number;
  notYetDelivered: number;
  onboardingInProgress: number;
  submissionsAwaitingReview: number;
  activeInterns: number;
  revokedOrExpired: number;
  departments: ProgrammeDepartment[];
  submissions: ProgrammeSubmission[];
};

export type ProgrammeSubmission = {
  id: string;
  firstName: string;
  surname: string;
  email: string;
  department: string;
  roleTitle: string;
  status: string;
  submittedAt: string;
};

type InvitationCountRow = {
  status: string;
  onboarding_token_expires_at: string | null;
  department_id: string;
};

function effectiveStatus(status: string, expiresAt: string | null): string {
  if (
    expiresAt &&
    new Date(expiresAt) <= new Date() &&
    (status === "selected" || status === "invitation_sent")
  ) {
    return "expired";
  }
  return status;
}

export async function getProgrammeSummary(): Promise<ProgrammeSummary> {
  const supabase = privilegedDatabase();
  const [invitationResult, submissionResult, profileResult, departmentResult] = await Promise.all([
    supabase.from("staff_invitations").select("status, onboarding_token_expires_at, department_id"),
    supabase
      .from("onboarding_submissions")
      .select("id, first_name, surname, email, role_title, status, created_at, departments(name)")
      .neq("status", "draft")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, first_name, surname, role, is_active, department_id"),
    supabase.from("departments").select("id, name, slug, is_active").order("name", { ascending: true }),
  ]);

  if (invitationResult.error || submissionResult.error || profileResult.error || departmentResult.error) {
    throw new DataAccessError("Unable to load the programme summary.", 500);
  }

  const invitations = (invitationResult.data ?? []) as InvitationCountRow[];
  const statuses = invitations.map((row) => effectiveStatus(row.status, row.onboarding_token_expires_at));
  const profiles = profileResult.data ?? [];
  const activeInterns = profiles.filter((profile) => profile.role === "intern" && profile.is_active);

  const departments = ((departmentResult.data ?? []) as { id: string; name: string; slug: string; is_active: boolean }[])
    .filter((department) => department.is_active)
    .map((department) => ({
      id: department.id,
      name: department.name,
      slug: department.slug,
      internCount: activeInterns.filter((profile) => profile.department_id === department.id).length,
      leads: profiles
        .filter(
          (profile) =>
            profile.is_active &&
            profile.department_id === department.id &&
            (profile.role === "lead" || profile.role === "manager"),
        )
        .map((profile) => `${profile.first_name} ${profile.surname}`),
    }));

  const submissions = ((submissionResult.data ?? []) as unknown as {
    id: string;
    first_name: string;
    surname: string;
    email: string;
    role_title: string;
    status: string;
    created_at: string;
    departments: { name: string } | { name: string }[] | null;
  }[]).map((row) => {
    const department = Array.isArray(row.departments) ? row.departments[0]?.name : row.departments?.name;
    return {
      id: row.id,
      firstName: row.first_name,
      surname: row.surname,
      email: row.email,
      department: department || "Unavailable",
      roleTitle: row.role_title,
      status: row.status,
      submittedAt: row.created_at,
    };
  });

  return {
    totalInvitations: invitations.length,
    awaitingResponse: statuses.filter((status) => status === "selected" || status === "invitation_sent").length,
    notYetDelivered: statuses.filter((status) => status === "selected").length,
    onboardingInProgress: statuses.filter((status) => status === "onboarding_started").length,
    submissionsAwaitingReview: submissions.filter((submission) => submission.status === "submitted").length,
    activeInterns: activeInterns.length,
    revokedOrExpired: statuses.filter((status) => status === "revoked" || status === "expired").length,
    departments,
    submissions,
  };
}
