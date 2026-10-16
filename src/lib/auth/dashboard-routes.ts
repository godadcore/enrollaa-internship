import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthorizationError, getTrustedProfile, type EnrollaaRole, type TrustedProfile } from "./authorization";
import { createSupabaseSessionClient } from "@/lib/supabase/session-server";
import type { UserProfile } from "@/types";

type DashboardPath = "/admin" | "/manager" | "/lead" | "/intern" | "/portal";

const routeForRole: Record<EnrollaaRole, DashboardPath> = {
  super_admin: "/admin", admin: "/admin", manager: "/manager", lead: "/lead", intern: "/portal",
};

function loginRedirect(path: DashboardPath, reason?: "unauthorized") {
  const query = new URLSearchParams({ next: path });
  if (reason) query.set("error", reason);
  return `/login?${query.toString()}`;
}

/** Reads the verified session and trusted database profile on the server. */
export async function getDashboardProfile(): Promise<TrustedProfile> {
  const cookieStore = await cookies();
  const sessionClient = createSupabaseSessionClient({
    getAll: () => cookieStore.getAll(),
    // Server Components cannot persist refreshed cookies. Login issues sessions;
    // a later refresh middleware can persist rotations without changing authorization.
    set: () => {},
  });
  return getTrustedProfile(sessionClient);
}

export function dashboardPathForRole(role: EnrollaaRole): DashboardPath {
  return routeForRole[role];
}

/** The client receives only identity fields returned by the trusted profile query. */
export function dashboardIdentityFromProfile(profile: TrustedProfile): UserProfile {
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    first_name: profile.first_name,
    surname: profile.surname,
    role_title: profile.role_title,
    department_id: profile.department_id,
    department: profile.department,
    phone: profile.phone || undefined,
    is_active: profile.is_active,
    created_at: profile.created_at,
  };
}

export async function requireDashboardRole(allowedRoles: readonly EnrollaaRole[], requestedPath: DashboardPath): Promise<TrustedProfile> {
  let profile: TrustedProfile;
  try {
    profile = await getDashboardProfile();
  } catch (error) {
    if (error instanceof AuthorizationError) redirect(loginRedirect(requestedPath));
    throw error;
  }
  if (!allowedRoles.includes(profile.role)) redirect(loginRedirect(requestedPath, "unauthorized"));
  return profile;
}
