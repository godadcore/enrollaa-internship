import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/data/errors";
import { getRequestTrustedProfile, readJsonBody } from "@/lib/data/request";
import { listNotifications, markNotificationRead } from "@/lib/operations/announcements";

export async function GET() {
  try {
    const profile = await getRequestTrustedProfile();
    return NextResponse.json({ success: true, notifications: await listNotifications(profile) });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const profile = await getRequestTrustedProfile();
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    await markNotificationRead(profile, typeof body.id === "string" ? body.id : "", body.all === true);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
