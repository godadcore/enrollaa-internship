import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthorizationError, getTrustedProfile } from "@/lib/auth/authorization";
import { dashboardIdentityFromProfile } from "@/lib/auth/dashboard-routes";
import { createSupabaseSessionClient } from "@/lib/supabase/session-server";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!cleanEmail || typeof password !== "string" || !password) {
      return NextResponse.json({ success: false, error: "Please provide both email address and password." }, { status: 400 });
    }

    const supabase = createSupabaseSessionClient(await cookies());
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) return NextResponse.json({ success: false, error: "Invalid email or password." }, { status: 401 });

    try {
      const profile = await getTrustedProfile(supabase);
      return NextResponse.json({
        success: true,
        user: dashboardIdentityFromProfile(profile),
        role: profile.role,
      });
    } catch (error) {
      await supabase.auth.signOut();
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ success: false, error: error.message }, { status: error.status });
      }
      throw error;
    }
  } catch {
    return NextResponse.json({ success: false, error: "Sign in failed." }, { status: 500 });
  }
}
