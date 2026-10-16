export type DocumentAccessRecord = {
  onboarding_submission_id: string;
  deleted_at: string | null;
  malware_scan_status: string | null;
  available_at: string | null;
  storage_path: string | null;
};

export function isDocumentDownloadable(document: DocumentAccessRecord, expectedSubmissionId: string): boolean {
  return (
    document.onboarding_submission_id === expectedSubmissionId &&
    !document.deleted_at &&
    document.malware_scan_status === "clean" &&
    Boolean(document.available_at) &&
    Boolean(document.storage_path)
  );
}
