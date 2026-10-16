import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/data/errors";
import { getRequestTrustedProfile } from "@/lib/data/request";
import { operationsSummary } from "@/lib/operations/reports";

export async function GET() {
  try {
    const profile = await getRequestTrustedProfile();
    return NextResponse.json({ success: true, summary: await operationsSummary(profile) });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
