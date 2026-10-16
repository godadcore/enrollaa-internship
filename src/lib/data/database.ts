import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Privileged database client (service-role / secret key). Server-only.
 * Callers must authorize with the request session first. This is not a
 * generic client-facing proxy: each helper or route must bound the query.
 */
export function privilegedDatabase(): SupabaseClient {
  return getSupabaseServerClient();
}
