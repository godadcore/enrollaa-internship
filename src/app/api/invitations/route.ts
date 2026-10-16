import { NextResponse } from "next/server";
import { adminApiError, getAdminApiProfile, readJsonBody } from "@/lib/auth/admin-api";
import { createStaffInvitation, listStaffInvitations, validateInvitationInput } from "@/lib/invitations";

export async function GET() {
  try {
    await getAdminApiProfile();
    return NextResponse.json({ success: true, invitations: await listStaffInvitations() });
  } catch (error) {
    const result = adminApiError(error);
    return NextResponse.json({ success: false, error: result.message }, { status: result.status });
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getAdminApiProfile(request);
    const parsed = validateInvitationInput(await readJsonBody(request), profile.role);
    if (!parsed.value) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    const result = await createStaffInvitation(parsed.value, profile);
    return NextResponse.json(
      { success: result.delivered, invitationId: result.invitationId, error: result.error },
      { status: result.delivered ? 201 : 502 },
    );
  } catch (error) {
    const result = adminApiError(error);
    return NextResponse.json({ success: false, error: result.message }, { status: result.status });
  }
}
