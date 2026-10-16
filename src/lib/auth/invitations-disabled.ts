import "server-only";

import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/data/errors";
import { requireApiAdmin } from "@/lib/data/request";

export async function requireAdminThenBlockInvitationWrite(): Promise<NextResponse> {
  try {
    await requireApiAdmin();
  } catch (error) {
    return jsonErrorResponse(error, "Authorization verification failed.");
  }

  return NextResponse.json(
    { success: false, error: "Persistent staff invitations are not enabled yet." },
    { status: 503 }
  );
}
