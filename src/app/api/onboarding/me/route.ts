import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/data/errors";
import { getRequestTrustedProfile, readJsonBody } from "@/lib/data/request";
import { getInternOnboarding, saveInternDraft, submitInternOnboarding } from "@/lib/onboarding/service";

export async function GET() {
  try {
    const profile = await getRequestTrustedProfile();
    return NextResponse.json({ success: true, onboarding: await getInternOnboarding(profile) });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const profile = await getRequestTrustedProfile();
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const result = await saveInternDraft(profile, body);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getRequestTrustedProfile();
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const result = await submitInternOnboarding(profile, body);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
