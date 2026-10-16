import { NextResponse } from "next/server";
import { verifyStaffInvitation } from "@/lib/invitations";

export async function POST(request: Request) {
  let token = "";
  try {
    const body = await request.json();
    if (body && typeof body === "object" && typeof (body as { token?: unknown }).token === "string") {
      token = (body as { token: string }).token;
    }
  } catch {
    token = "";
  }

  const invitation = await verifyStaffInvitation(token);
  if (!invitation) {
    return NextResponse.json(
      { valid: false, error: "This invitation is invalid, expired, revoked, or already used." },
      { status: 400 },
    );
  }

  return NextResponse.json({ valid: true, invitation });
}
