import "server-only";

import type { TrustedProfile } from "@/lib/auth/authorization";
import { privilegedDatabase } from "@/lib/data/database";
import { DataAccessError } from "@/lib/data/errors";

const SECRET_KEY = /token|password|secret|cookie|authorization|credential|hash/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  if (!metadata) return next;
  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_KEY.test(key)) continue;
    if (typeof value === "string") {
      next[key] = value.slice(0, 240);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      next[key] = value;
    }
  }
  return next;
}

/**
 * Writes a row to `audit_logs` after the caller has authorized the mutation.
 * Invitation RPCs already insert their own audit rows; do not double-write those.
 * Metadata must not include tokens, passwords, cookies, or raw secrets.
 */
export async function recordSensitiveAudit(input: {
  actor: TrustedProfile;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const targetId = input.targetId && UUID_PATTERN.test(input.targetId) ? input.targetId : null;
  const { error } = await privilegedDatabase().from("audit_logs").insert({
    actor_auth_user_id: input.actor.auth_user_id,
    actor_profile_id: input.actor.id,
    action: input.action.slice(0, 120),
    target_type: input.targetType.slice(0, 120),
    target_id: targetId,
    metadata: sanitizeMetadata(input.metadata),
  });
  if (error) throw new DataAccessError("The change could not be recorded.", 500);
}
