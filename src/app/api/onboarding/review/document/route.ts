import { NextResponse } from "next/server";
import { DataAccessError, jsonErrorResponse } from "@/lib/data/errors";
import { getRequestTrustedProfile } from "@/lib/data/request";
import { reviewerDocumentAccess } from "@/lib/onboarding/service";

export async function GET(request: Request) {
  try {
    const profile = await getRequestTrustedProfile();
    const documentId = new URL(request.url).searchParams.get("documentId") || "";
    if (!documentId) throw new DataAccessError("The document is unavailable.", 404);
    const url = await reviewerDocumentAccess(profile, documentId);
    return NextResponse.json({ success: true, url });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
