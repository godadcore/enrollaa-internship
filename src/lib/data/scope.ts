import "server-only";

import { AuthorizationError, type EnrollaaRole, type TrustedProfile } from "@/lib/auth/authorization";
import { DataAccessError } from "@/lib/data/errors";

const PROGRAMME_WIDE_ROLES: readonly EnrollaaRole[] = ["admin", "super_admin"];

export function isProgrammeWideRole(role: EnrollaaRole): boolean {
  return PROGRAMME_WIDE_ROLES.includes(role);
}

/**
 * Department for scoped operations comes from the trusted profile, never from
 * a browser-supplied department ID.
 */
export function assignedDepartmentId(profile: TrustedProfile): string {
  if (!profile.department_id) {
    throw new AuthorizationError("This account is not assigned to a department.", 403);
  }
  return profile.department_id;
}

/**
 * Programme-wide roles may operate across departments. All other roles may only
 * act on their assigned department. Client-provided IDs are compared against
 * the trusted profile, not accepted as identity.
 */
export function requireDepartmentScope(profile: TrustedProfile, requestedDepartmentId: unknown): string {
  if (typeof requestedDepartmentId !== "string" || !requestedDepartmentId) {
    throw new DataAccessError("A department is required.", 400);
  }
  if (isProgrammeWideRole(profile.role)) return requestedDepartmentId;
  const assigned = assignedDepartmentId(profile);
  if (assigned !== requestedDepartmentId) {
    throw new AuthorizationError("You do not have access to this department.", 403);
  }
  return assigned;
}
