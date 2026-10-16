import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/data/errors";
import { getRequestTrustedProfile, readJsonBody } from "@/lib/data/request";
import { reviewTask } from "@/lib/operations/tasks";

export async function POST(request: Request) {
  try {
    const profile = await getRequestTrustedProfile();
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    await reviewTask(profile, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
