import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/data/errors";
import { getRequestTrustedProfile, readJsonBody } from "@/lib/data/request";
import { checkIn, checkOut, correctAttendance, listAttendance } from "@/lib/operations/attendance";

export async function GET() {
  try {
    const profile = await getRequestTrustedProfile();
    return NextResponse.json({ success: true, records: await listAttendance(profile) });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function POST() {
  try {
    const profile = await getRequestTrustedProfile();
    const result = await checkIn(profile);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const profile = await getRequestTrustedProfile();
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    if (body.action === "checkout") {
      await checkOut(profile);
      return NextResponse.json({ success: true });
    }
    await correctAttendance(profile, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
