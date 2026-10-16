import assert from "node:assert/strict";
import { validateMutationOrigin } from "../src/lib/auth/csrf-policy.ts";
import { validateDeclaredUploadLength } from "../src/lib/onboarding/upload-policy.ts";
import { isDocumentDownloadable } from "../src/lib/onboarding/document-policy.ts";

const clean = {
  onboarding_submission_id: "submission-1",
  deleted_at: null,
  malware_scan_status: "clean",
  available_at: "2026-10-16T12:00:00Z",
  storage_path: "submission-1/cv/object",
};

assert.equal(isDocumentDownloadable(clean, "submission-1"), true);
for (const status of ["pending", "infected", "failed", null]) {
  assert.equal(isDocumentDownloadable({ ...clean, malware_scan_status: status }, "submission-1"), false, status);
}
assert.equal(isDocumentDownloadable({ ...clean, available_at: null }, "submission-1"), false);
assert.equal(isDocumentDownloadable({ ...clean, deleted_at: "2026-10-16T12:00:00Z" }, "submission-1"), false);
assert.equal(isDocumentDownloadable({ ...clean, onboarding_submission_id: "submission-2" }, "submission-1"), false);
assert.equal(isDocumentDownloadable({ ...clean, storage_path: null }, "submission-1"), false);

const trusted = { trustedOrigin: "https://enrollaa.com.ng", host: "enrollaa.com.ng", forwardedHost: null, forwardedProto: "https" };
assert.equal(validateMutationOrigin({ ...trusted, origin: "https://enrollaa.com.ng" }), null);
for (const origin of [null, "null", "https://evil.example", "not an origin"]) {
  assert.ok(validateMutationOrigin({ ...trusted, origin }));
}
assert.ok(validateMutationOrigin({ ...trusted, origin: "https://enrollaa.com.ng", host: "evil.example" }));
assert.ok(validateMutationOrigin({ ...trusted, origin: "https://enrollaa.com.ng", forwardedHost: "evil.example" }));
assert.ok(validateMutationOrigin({ ...trusted, origin: "https://enrollaa.com.ng", forwardedProto: "http" }));

assert.equal(validateDeclaredUploadLength(null), null);
assert.equal(validateDeclaredUploadLength("12582913"), "The upload request is too large.");
assert.equal(validateDeclaredUploadLength("not-a-length"), "The upload request length is invalid.");
assert.equal(validateDeclaredUploadLength("1048576"), null);

console.log("security-fixes-behavior: passed");
