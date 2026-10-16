import { NextResponse } from "next/server";
import { adminApiError, getAdminApiProfile } from "@/lib/auth/admin-api";
import { getProgrammeSummary } from "@/lib/programme-summary";

export async function GET() {
  try {
    await getAdminApiProfile();
    return NextResponse.json({ success: true, summary: await getProgrammeSummary() });
  } catch (error) {
    const result = adminApiError(error);
    return NextResponse.json({ success: false, error: result.message }, { status: result.status });
  }
}
