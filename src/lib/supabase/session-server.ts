import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "./config";

type CookieStore = {
  getAll: () => { name: string; value: string }[];
  set: (name: string, value: string, options?: CookieOptions) => void;
};

export function createSupabaseSessionClient(cookieStore: CookieStore) {
  const { url, publishableKey } = getPublicSupabaseConfig();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });
}
