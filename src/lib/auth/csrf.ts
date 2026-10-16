import "server-only";

import { AuthorizationError } from "@/lib/auth/authorization";
import { validateMutationOrigin } from "./csrf-policy";

function configuredOrigin(): string | null {
  const configured = process.env.APP_URL?.trim();
  if (!configured) return null;
  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
}

// The hosted Internship app uses its own subdomain. Keep this exact origin in
// the server-side allowlist while still honoring APP_URL for local/approved
// deployments. No wildcard or substring matching is used.
const INTERNSHIP_ORIGIN = "https://internship.enrollaa.com.ng";

/**
 * Requires a configured trusted origin for every state-changing request.
 * Machine-to-machine exceptions are intentionally not provided because the
 * application has no separate authentication mechanism for them.
 */
export function assertSameOrigin(request: Request): void {
  const configured = configuredOrigin();
  const host = request.headers.get("host") ?? "";
  const localHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  const expected = configured ?? (localHost ? `http://${host}` : null);
  const trustedOrigins = [expected, INTERNSHIP_ORIGIN].filter((origin): origin is string => Boolean(origin));
  const error = validateMutationOrigin({
    origin: request.headers.get("origin"),
    host: request.headers.get("host"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    trustedOrigin: trustedOrigins,
  });
  if (error) throw new AuthorizationError(error, 403);
}
