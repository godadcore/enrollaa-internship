import { NextResponse } from "next/server";
import { adminApiError, getAdminApiProfile, readJsonBody } from "@/lib/auth/admin-api";
import { InvitationError, revokeStaffInvitation } from "@/lib/invitations";

export async function POST(request: Request) {
  try {
    const profile = await getAdminApiProfile(request);
    const body = await readJsonBody(request);
    if (!body || typeof body !== "object") throw new InvitationError("Invitation not found.", 404);
    const record = body as Record<string, unknown>;
    await revokeStaffInvitation(typeof record.invitationId === "string" ? record.invitationId : "", record.reason, profile);
    return NextResponse.json({ success: true });
  } catch (error) {
    const result = adminApiError(error);
    return NextResponse.json({ success: false, error: result.message }, { status: result.status });
  }
}
