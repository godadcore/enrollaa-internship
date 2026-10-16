import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { departmentNameFromValue } from "@/lib/auth/trusted-identity";
import { privilegedDatabase } from "@/lib/data/database";
import type { DepartmentName } from "@/types";

export type EnrollaaRole = "super_admin" | "admin" | "lead" | "manager" | "intern";

export type TrustedProfile = {
  id: string;
  auth_user_id: string;
  email: string;
  role: EnrollaaRole;
  first_name: string;
  surname: string;
  role_title: string;
  department_id: string | null;
  department?: DepartmentName;
  is_active: boolean;
  created_at: string;
  phone?: string | null;
};

export class AuthorizationError extends Error {
  constructor(message: string, public readonly status = 401) { super(message); }
}

async function getVerifiedUser(sessionClient: SupabaseClient): Promise<User> {
  const { data, error } = await sessionClient.auth.getUser();
  if (error || !data.user) throw new AuthorizationError("Authentication is required.");
  return data.user;
}

export async function getTrustedProfile(sessionClient: SupabaseClient): Promise<TrustedProfile> {
  const user = await getVerifiedUser(sessionClient);
  const supabase = privilegedDatabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, auth_user_id, email, role, first_name, surname, role_title, department_id, is_active, created_at, phone")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error || !data || !data.is_active) {
    throw new AuthorizationError("This authenticated account is not provisioned for Enrollaa Internship.", 403);
  }
  const allowedRoles: EnrollaaRole[] = ["super_admin", "admin", "lead", "manager", "intern"];
  if (!allowedRoles.includes(data.role as EnrollaaRole)) {
    throw new AuthorizationError("This authenticated account is not provisioned for Enrollaa Internship.", 403);
  }

  let department: DepartmentName | undefined;
  if (data.department_id) {
    const { data: departmentRow } = await supabase
      .from("departments")
      .select("name")
      .eq("id", data.department_id)
      .maybeSingle();
    department = departmentNameFromValue(departmentRow?.name);
  }

  return {
    id: data.id,
    auth_user_id: data.auth_user_id,
    email: data.email,
    role: data.role as EnrollaaRole,
    first_name: data.first_name,
    surname: data.surname,
    role_title: data.role_title,
    department_id: data.department_id,
    department,
    phone: typeof data.phone === "string" ? data.phone : null,
    is_active: data.is_active,
    created_at: data.created_at,
  };
}

export async function requireRoles(
  sessionClient: SupabaseClient,
  allowedRoles: readonly EnrollaaRole[],
): Promise<TrustedProfile> {
  const profile = await getTrustedProfile(sessionClient);
  if (!allowedRoles.includes(profile.role)) {
    throw new AuthorizationError("You do not have access to this resource.", 403);
  }
  return profile;
}

export async function requireAdmin(sessionClient: SupabaseClient): Promise<TrustedProfile> {
  return requireRoles(sessionClient, ["admin", "super_admin"]);
}
