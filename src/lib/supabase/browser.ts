"use client";

/**
 * Intentionally unused in M2. Browser Supabase access stays off until a later
 * design uses RLS-protected, publishable-key-only queries. Do not import this
 * from operational UI to bypass server authorization.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "./config";

let browserClient: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    const { url, publishableKey } = getPublicSupabaseConfig();
    browserClient = createBrowserClient(url, publishableKey);
  }
  return browserClient;
}
