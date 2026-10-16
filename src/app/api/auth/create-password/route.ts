import { NextResponse } from "next/server";
import { activateInvitationAccount } from "@/lib/auth/activate-invitation";
import { jsonErrorResponse } from "@/lib/data/errors";
import { readJsonBody } from "@/lib/data/request";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request, "Invitation details are required.");
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const result = await activateInvitationAccount({
      token: record.token,
      email: record.email,
      password: record.password,
    });
    return NextResponse.json({
      success: true,
      alreadyComplete: result.alreadyComplete,
    });
  } catch (error) {
    return jsonErrorResponse(error, "Unable to activate this invitation.");
  }
}
