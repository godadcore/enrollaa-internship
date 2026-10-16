import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseSessionClient } from "@/lib/supabase/session-server";

export async function POST() {
  const supabase = createSupabaseSessionClient(await cookies());
  const { error } = await supabase.auth.signOut();
  if (error) return NextResponse.json({ success: false, error: "Unable to sign out." }, { status: 500 });
  return NextResponse.json({ success: true });
}
