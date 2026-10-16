import "server-only";

import { AuthorizationError, type EnrollaaRole, type TrustedProfile } from "@/lib/auth/authorization";
import { DataAccessError } from "@/lib/data/errors";
import { privilegedDatabase } from "@/lib/data/database";
import { isProgrammeWideRole, requireDepartmentScope } from "@/lib/data/scope";
import { recordSensitiveAudit } from "@/lib/data/audit";
import { isOfficialInternshipRole } from "@/lib/internship-roles";

const ROLES: EnrollaaRole[] = ["super_admin", "admin", "lead", "manager", "intern"];

function requireStaffManager(profile: TrustedProfile) {
  if (!["admin", "super_admin", "lead", "manager"].includes(profile.role)) {
    throw new AuthorizationError("You do not have access to this resource.", 403);
  }
}

export async function listStaff(profile: TrustedProfile) {
  requireStaffManager(profile);
  const db = privilegedDatabase();
  let query = db
    .from("profiles")
    .select("id, email, role, first_name, surname, role_title, department_id, is_active, created_at, departments(name)")
    .order("created_at", { ascending: false })
    .limit(400);
  if (!isProgrammeWideRole(profile.role)) {
    query = query.eq("department_id", requireDepartmentScope(profile, profile.department_id));
  }
  const { data, error } = await query;
  if (error) throw new DataAccessError("Unable to load staff.", 500);
  const { data: leads } = await db.from("department_leads").select("department_id, profile_id");
  const leadSet = new Set((leads ?? []).map((row) => `${row.department_id}:${row.profile_id}`));
  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    firstName: row.first_name,
    surname: row.surname,
    roleTitle: row.role_title,
    departmentId: row.department_id,
    department:
      (Array.isArray(row.departments) ? row.departments[0]?.name : (row.departments as { name?: string } | null)?.name) ??
      null,
    isActive: row.is_active,
    isDepartmentLead: row.department_id ? leadSet.has(`${row.department_id}:${row.id}`) : false,
    createdAt: row.created_at,
  }));
}

export async function updateStaff(profile: TrustedProfile, staffId: string, body: Record<string, unknown>) {
  requireStaffManager(profile);
  if (staffId === profile.id && (body.role !== undefined || body.isActive === false || body.departmentId !== undefined)) {
    throw new AuthorizationError("You cannot change your own role, department, or active status.", 403);
  }
  const db = privilegedDatabase();
  const { data: target, error } = await db
    .from("profiles")
    .select("id, role, department_id, is_active, auth_user_id, role_title")
    .eq("id", staffId)
    .maybeSingle();
  if (error || !target) throw new DataAccessError("Staff member not found.", 404);
  if (!isProgrammeWideRole(profile.role)) {
    requireDepartmentScope(profile, target.department_id);
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.roleTitle === "string") {
    const nextTitle = body.roleTitle.trim().slice(0, 160);
    const nextAccountRole = typeof body.role === "string" ? body.role : target.role;
    if (nextAccountRole === "intern" && !isOfficialInternshipRole(nextTitle) && nextTitle !== target.role_title) {
      throw new DataAccessError("Intern job titles must be one of the six official internship roles.", 400);
    }
    patch.role_title = nextTitle;
  }

  if (isProgrammeWideRole(profile.role)) {
    if (typeof body.role === "string") {
      if (!ROLES.includes(body.role as EnrollaaRole)) throw new DataAccessError("The selected account role is invalid.", 400);
      if (target.role === "intern" && body.role === "lead") {
        if (!target.is_active) throw new DataAccessError("Only an active intern can be promoted.", 409);
        if (typeof body.departmentId !== "string" || !body.departmentId) {
          throw new DataAccessError("A department is required before promoting an intern.", 400);
        }
        if (body.assignLead !== true) {
          throw new DataAccessError("Department-lead assignment is required for promotion.", 400);
        }
      }
      if (
        (target.role === "admin" || target.role === "super_admin") &&
        body.role !== "admin" &&
        body.role !== "super_admin"
      ) {
        const { count } = await db
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .in("role", ["admin", "super_admin"])
          .eq("is_active", true);
        if ((count ?? 0) <= 1) throw new DataAccessError("The last administrator cannot be reassigned.", 409);
      }
      patch.role = body.role;
    }
    if (typeof body.departmentId === "string" || body.departmentId === null) {
      patch.department_id = body.departmentId;
    }
    if (typeof body.isActive === "boolean") {
      if (body.isActive === false && (target.role === "admin" || target.role === "super_admin")) {
        const { count } = await db
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .in("role", ["admin", "super_admin"])
          .eq("is_active", true);
        if ((count ?? 0) <= 1) throw new DataAccessError("The last administrator cannot be deactivated.", 409);
      }
      patch.is_active = body.isActive;
    }
  } else if (body.role !== undefined || body.departmentId !== undefined || body.isActive !== undefined || body.assignLead !== undefined) {
    throw new AuthorizationError("You do not have access to this resource.", 403);
  }

  const { error: updateError } = await db.from("profiles").update(patch).eq("id", staffId);
  if (updateError) throw new DataAccessError("Unable to update the staff member.", 500);

  if (isProgrammeWideRole(profile.role)) {
    const nextDepartmentId =
      patch.department_id !== undefined ? (patch.department_id as string | null) : target.department_id;
    if (target.department_id && target.department_id !== nextDepartmentId) {
      await db.from("department_leads").delete().eq("profile_id", target.id).eq("department_id", target.department_id);
    }
    if (typeof body.assignLead === "boolean") {
      if (body.assignLead) {
        if (!nextDepartmentId) throw new DataAccessError("A department is required before assigning a lead.", 400);
        const { error: leadError } = await db.from("department_leads").upsert(
          { department_id: nextDepartmentId, profile_id: target.id, assigned_by_profile_id: profile.id },
          { onConflict: "department_id,profile_id" },
        );
        if (leadError) throw new DataAccessError("Unable to assign the department lead.", 500);
      } else if (nextDepartmentId) {
        await db.from("department_leads").delete().eq("department_id", nextDepartmentId).eq("profile_id", target.id);
      }
    }
    if (target.role === "lead" && patch.role !== "lead" && patch.role !== undefined) {
      await db.from("department_leads").delete().eq("profile_id", target.id);
    }
  }
  await recordSensitiveAudit({
    actor: profile,
    action: target.role === "intern" && patch.role === "lead" ? "staff_promoted_to_lead" : "staff_updated",
    targetType: "profile",
    targetId: staffId,
    metadata: target.role === "intern" && patch.role === "lead" ? { previousRole: "intern", nextRole: "lead" } : undefined,
  });
}
