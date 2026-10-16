import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "./config";
import { getServerSupabaseSecretKey } from "./server-config";

export function getSupabaseServerClient(): SupabaseClient {
  const { url } = getPublicSupabaseConfig();
  const secretKey = getServerSupabaseSecretKey();

  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
