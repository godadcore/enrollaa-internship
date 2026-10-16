import { NextResponse } from "next/server";
import { DataAccessError, jsonErrorResponse } from "@/lib/data/errors";
import { getRequestTrustedProfile } from "@/lib/data/request";
import { internDocumentAccess, uploadInternDocument } from "@/lib/onboarding/service";
import type { DocumentKind } from "@/lib/onboarding/documents";

export async function POST(request: Request) {
  try {
    const profile = await getRequestTrustedProfile();
    const form = await request.formData();
    const kind = form.get("kind");
    const file = form.get("file");
    if (kind !== "photo" && kind !== "cv") throw new DataAccessError("Document kind is invalid.", 400);
    if (!(file instanceof File)) throw new DataAccessError("A file is required.", 400);
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadInternDocument(profile, kind, file.name, buffer);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const profile = await getRequestTrustedProfile();
    const kind = new URL(request.url).searchParams.get("kind");
    if (kind !== "photo" && kind !== "cv") throw new DataAccessError("Document kind is invalid.", 400);
    const url = await internDocumentAccess(profile, kind as DocumentKind);
    return NextResponse.json({ success: true, url });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
