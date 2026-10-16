import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const documents = read("src/lib/onboarding/documents.ts");
const onboarding = read("src/lib/onboarding/service.ts");
const uploadRoute = read("src/app/api/onboarding/documents/route.ts");
const csrf = read("src/lib/auth/csrf.ts");
const middleware = read("middleware.ts");

assert.doesNotMatch(documents, /lower\.endsWith\("\.doc"\)/);
assert.match(documents, /available_at: null/);
assert.match(onboarding, /malware_scan_status.*clean/);
assert.match(onboarding, /not\("available_at", "is", null\)/);
assert.match(onboarding, /\.upsert\(/);
assert.doesNotMatch(onboarding, /\.from\("onboarding_bank_details"\)\.delete\(\)/);
assert.match(uploadRoute, /content-length/);
assert.match(uploadRoute, /validateDeclaredUploadLength/);
assert.match(csrf, /request\.headers\.get\("origin"\)/);
assert.match(csrf, /validateMutationOrigin/);
assert.match(middleware, /assertSameOrigin\(request\)/);

console.log("security-fixes-check: passed");
