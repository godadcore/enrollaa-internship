import "server-only";
import crypto from "crypto";
import { DataAccessError } from "@/lib/data/errors";
import { privilegedDatabase } from "@/lib/data/database";
import { recordSensitiveAudit } from "@/lib/data/audit";
import type { TrustedProfile } from "@/lib/auth/authorization";
import { isDocumentDownloadable } from "./document-policy";
import { MalwareScannerError, scanMalwareBuffer } from "@/lib/scanning/malware-scanner";

const BUCKET = "staff-onboarding";
const PHOTO_MAX = 5 * 1024 * 1024;
const CV_MAX = 10 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CV_TYPES = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
export type DocumentKind = "photo" | "cv";

function sniffMime(buffer: Buffer, filename: string): string | null {
  const lower = filename.toLowerCase();
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  if (lower.endsWith(".docx") && buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return null;
}
function validateFile(kind: DocumentKind, filename: string, buffer: Buffer) {
  const mime = sniffMime(buffer, filename);
  if (!mime) throw new DataAccessError("That file type is not allowed.", 400);
  if (kind === "photo" && (!PHOTO_TYPES.has(mime) || buffer.length > PHOTO_MAX)) throw new DataAccessError("Photographs must be JPEG, PNG, or WebP and 5MB or smaller.", 400);
  if (kind === "cv" && (!CV_TYPES.has(mime) || buffer.length > CV_MAX)) throw new DataAccessError("CVs must be PDF or Word documents and 10MB or smaller.", 400);
  return { mime, safeName: filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || `${kind}.bin` };
}

export async function storeOnboardingDocument(input: { actor: TrustedProfile; submissionId: string; kind: DocumentKind; filename: string; buffer: Buffer }) {
  const { mime, safeName } = validateFile(input.kind, input.filename, input.buffer);
  const storagePath = `${input.submissionId}/${input.kind}/${crypto.randomUUID()}`;
  const db = privilegedDatabase();
  const { data: previous } = await db.from("onboarding_documents").select("id, storage_path").eq("onboarding_submission_id", input.submissionId).eq("kind", input.kind).is("deleted_at", null).maybeSingle();
  const uploaded = await db.storage.from(BUCKET).upload(storagePath, input.buffer, { contentType: mime, upsert: false });
  if (uploaded.error) throw new DataAccessError("The document could not be stored.", 500);
  if (previous) {
    const { error } = await db.from("onboarding_documents").update({ deleted_at: new Date().toISOString() }).eq("id", previous.id);
    if (error) { await db.storage.from(BUCKET).remove([storagePath]); throw new DataAccessError("The document could not be recorded.", 500); }
  }
  const { data: inserted, error: insertError } = await db.from("onboarding_documents").insert({ onboarding_submission_id: input.submissionId, kind: input.kind, storage_bucket: BUCKET, storage_path: storagePath, original_filename: safeName, mime_type: mime, byte_size: input.buffer.length, sha256_hex: crypto.createHash("sha256").update(input.buffer).digest("hex"), malware_scan_status: "pending", available_at: null }).select("id").single();
  if (insertError || !inserted?.id) {
    if (previous) await db.from("onboarding_documents").update({ deleted_at: null }).eq("id", previous.id);
    await db.storage.from(BUCKET).remove([storagePath]);
    throw new DataAccessError("The document could not be recorded.", 500);
  }
  let status: "clean" | "infected" | "failed" = "failed";
  try { status = await scanMalwareBuffer(input.buffer); } catch (error) { if (!(error instanceof MalwareScannerError)) status = "failed"; }
  const { error: statusError } = await db.from("onboarding_documents").update({ malware_scan_status: status, available_at: status === "clean" ? new Date().toISOString() : null }).eq("id", inserted.id);
  if (statusError) throw new DataAccessError("The document could not be verified.", 500);
  if (status === "clean") { if (previous) await db.storage.from(BUCKET).remove([previous.storage_path]); }
  else if (previous) await db.from("onboarding_documents").update({ deleted_at: null }).eq("id", previous.id);
  await recordSensitiveAudit({ actor: input.actor, action: "onboarding_document_uploaded", targetType: "onboarding_submission", targetId: input.submissionId, metadata: { kind: input.kind, malwareScanStatus: status } });
  return { status };
}

export async function signedDocumentUrl(documentId: string, expectedSubmissionId: string): Promise<string> {
  const db = privilegedDatabase();
  const { data: document, error } = await db.from("onboarding_documents").select("storage_path, onboarding_submission_id, deleted_at, malware_scan_status, available_at").eq("id", documentId).eq("onboarding_submission_id", expectedSubmissionId).maybeSingle();
  if (error || !document || !isDocumentDownloadable(document, expectedSubmissionId)) throw new DataAccessError("The document is unavailable.", 404);
  const { data, error: signedError } = await db.storage.from(BUCKET).createSignedUrl(document.storage_path, 60);
  if (signedError || !data?.signedUrl) throw new DataAccessError("The document is unavailable.", 404);
  return data.signedUrl;
}
