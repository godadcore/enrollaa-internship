import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/data/errors";
import { getRequestTrustedProfile, readJsonBody } from "@/lib/data/request";
import { addTaskComment } from "@/lib/operations/tasks";

export async function POST(request: Request) {
  try {
    const profile = await getRequestTrustedProfile();
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const comment = await addTaskComment(profile, body);
    return NextResponse.json({ success: true, comment });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
