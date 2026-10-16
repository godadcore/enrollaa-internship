const MAX_MULTIPART_REQUEST_BYTES = 12 * 1024 * 1024;

export function validateDeclaredUploadLength(value: string | null): string | null {
  if (value === null) return null;
  if (!/^\d+$/.test(value.trim())) return "The upload request length is invalid.";
  if (Number(value) > MAX_MULTIPART_REQUEST_BYTES) return "The upload request is too large.";
  return null;
}
