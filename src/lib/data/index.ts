import "server-only";

/**
 * Operational API pattern for later milestones (attendance, tasks, announcements, reports).
 *
 * 1. Route handlers live under `src/app/api/...` and import only this data layer,
 *    authorization, and a purpose-built query module. Never import `state.tsx`.
 * 2. Authenticate with `getRequestTrustedProfile` / `requireApiRoles` / `requireApiAdmin`.
 *    Identity, role, and department_id come from the verified session and profile row.
 * 3. Authorize on the server before any privileged read or write. Do not trust
 *    client-provided user IDs, roles, department IDs, or ownership flags.
 * 4. Department-scoped work uses `requireDepartmentScope` or `assignedDepartmentId`.
 * 5. Query a named table or RPC through `privilegedDatabase()` with an explicit
 *    filter. Do not expose a generic table/column proxy.
 * 6. Sensitive mutations call `recordSensitiveAudit` (unless a database RPC already
 *    writes `audit_logs`, as invitation RPCs do).
 * 7. Return `jsonErrorResponse` / `{ success: false, error }` with sanitized copy.
 *    Never log tokens, passwords, cookies, or provider payload dumps.
 * 8. Keep the JSON password/recovery 503s until M3. Do not mint Auth users here.
 */

export { AuthorizationError, getTrustedProfile, requireAdmin, requireRoles } from "@/lib/auth/authorization";
export type { EnrollaaRole, TrustedProfile } from "@/lib/auth/authorization";
export { DataAccessError, describeDataAccessError, jsonErrorResponse } from "@/lib/data/errors";
export { privilegedDatabase } from "@/lib/data/database";
export { assignedDepartmentId, isProgrammeWideRole, requireDepartmentScope } from "@/lib/data/scope";
export { recordSensitiveAudit } from "@/lib/data/audit";
export {
  cookieSessionClient,
  getRequestTrustedProfile,
  readJsonBody,
  requireApiAdmin,
  requireApiRoles,
} from "@/lib/data/request";
