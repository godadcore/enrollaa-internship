import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/data/errors";
import { getRequestTrustedProfile, readJsonBody } from "@/lib/data/request";
import { archiveAnnouncement, createAnnouncement, listAnnouncements } from "@/lib/operations/announcements";

export async function GET() {
  try {
    const profile = await getRequestTrustedProfile();
    return NextResponse.json({ success: true, announcements: await listAnnouncements(profile) });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getRequestTrustedProfile();
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const result = await createAnnouncement(profile, body);
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const profile = await getRequestTrustedProfile();
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    await archiveAnnouncement(profile, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
