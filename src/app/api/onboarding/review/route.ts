import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/data/errors";
import { getRequestTrustedProfile, readJsonBody } from "@/lib/data/request";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { getReviewSubmission, listReviewSubmissions, reviewSubmission } from "@/lib/onboarding/service";

export async function GET(request: Request) {
  try {
    assertSameOrigin(request);
    const profile = await getRequestTrustedProfile();
    const id = new URL(request.url).searchParams.get("id");
    if (id) return NextResponse.json({ success: true, submission: await getReviewSubmission(profile, id) });
    return NextResponse.json({ success: true, submissions: await listReviewSubmissions(profile) });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getRequestTrustedProfile();
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const submissionId = typeof body.submissionId === "string" ? body.submissionId : "";
    await reviewSubmission(profile, submissionId, body.decision, body.note);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
