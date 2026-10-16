import { NextResponse } from "next/server";
import { DataAccessError, jsonErrorResponse } from "@/lib/data/errors";
import { getRequestTrustedProfile } from "@/lib/data/request";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { validateDeclaredUploadLength } from "@/lib/onboarding/upload-policy";
import { internDocumentAccess, uploadInternDocument } from "@/lib/onboarding/service";
import type { DocumentKind } from "@/lib/onboarding/documents";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const profile = await getRequestTrustedProfile();
    const lengthError = validateDeclaredUploadLength(request.headers.get("content-length"));
    if (lengthError) throw new DataAccessError(lengthError, 413);
    const form = await request.formData();
    const kind = form.get("kind");
    const file = form.get("file");
    if (kind !== "photo" && kind !== "cv") throw new DataAccessError("Document kind is invalid.", 400);
    if (!(file instanceof File)) throw new DataAccessError("A file is required.", 400);
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadInternDocument(profile, kind, file.name, buffer);
    if (result.status === "infected") return NextResponse.json({ success: false, error: "The document was rejected by security scanning." }, { status: 422 });
    if (result.status === "failed") return NextResponse.json({ success: false, error: "The document is unavailable until security scanning is configured and succeeds." }, { status: 503 });
    return NextResponse.json({ success: true, status: "clean" });
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
