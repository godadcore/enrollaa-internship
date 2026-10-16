import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

function safeNextPath(value: string | null): string {
  return value === "/reset-password" ? "/reset-password" : "/login";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const errorDescription = url.searchParams.get("error_description") || url.searchParams.get("error");

  const redirectInvalid = NextResponse.redirect(new URL("/reset-password?error=invalid", url.origin));
  if (errorDescription || !code) return redirectInvalid;

  const { url: supabaseUrl, publishableKey } = getPublicSupabaseConfig();
  let response = NextResponse.redirect(new URL(next, url.origin));

  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.redirect(new URL(next, url.origin));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/reset-password?error=expired", url.origin));
  return response;
}
