import { NextResponse } from "next/server";
import { RECOVERY_UNAVAILABLE } from "@/lib/auth/account-access";

export async function POST() {
  return NextResponse.json({ success: false, error: RECOVERY_UNAVAILABLE }, { status: 503 });
}
