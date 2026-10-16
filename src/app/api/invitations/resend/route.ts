import { NextResponse } from "next/server";
import { adminApiError, getAdminApiProfile, readJsonBody } from "@/lib/auth/admin-api";
import { InvitationError, resendStaffInvitation } from "@/lib/invitations";

export async function POST(request: Request) {
  try {
    const profile = await getAdminApiProfile();
    const body = await readJsonBody(request);
    if (!body || typeof body !== "object") throw new InvitationError("Invitation not found.", 404);
    const invitationId = (body as Record<string, unknown>).invitationId;
    const result = await resendStaffInvitation(typeof invitationId === "string" ? invitationId : "", profile);
    return NextResponse.json({ success: result.delivered, error: result.error }, { status: result.delivered ? 200 : 502 });
  } catch (error) {
    const result = adminApiError(error);
    return NextResponse.json({ success: false, error: result.message }, { status: result.status });
  }
}
