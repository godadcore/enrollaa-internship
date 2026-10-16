import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateAccountPassword } from "@/lib/auth/password-rules";
import { DataAccessError, jsonErrorResponse } from "@/lib/data/errors";
import { readJsonBody } from "@/lib/data/request";
import { createSupabaseSessionClient } from "@/lib/supabase/session-server";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request, "A new password is required.");
    const password = body && typeof body === "object" ? (body as { password?: unknown }).password : undefined;
    const passwordError = validateAccountPassword(password);
    if (passwordError) throw new DataAccessError(passwordError, 400);

    const supabase = createSupabaseSessionClient(await cookies());
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw new DataAccessError("This reset link is invalid or has expired. Request a new password reset email.", 401);
    }

    const updated = await supabase.auth.updateUser({ password: password as string });
    if (updated.error) {
      throw new DataAccessError("Unable to update the password. Request a new reset email and try again.", 400);
    }

    await supabase.auth.signOut();
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonErrorResponse(error, "Unable to update the password.");
  }
}
