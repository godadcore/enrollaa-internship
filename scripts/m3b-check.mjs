import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sql = fs.readFileSync(path.join(root, "supabase/migrations/202610150008_onboarding_review_and_staff.sql"), "utf8");

assert.match(sql, /status in \('draft', 'submitted', 'approved', 'rejected'\)/);
assert.match(sql, /create or replace function public\.save_onboarding_draft/);
assert.match(sql, /create or replace function public\.submit_onboarding/);
assert.match(sql, /create or replace function public\.review_onboarding/);
assert.match(sql, /grant execute on function public\.save_onboarding_draft/);
assert.match(sql, /to service_role/);
assert.match(sql, /onboarding_started', 'onboarding_submitted', 'activation_pending/);
assert.equal(sql.includes("drop table"), false);
assert.equal(/grant execute[\s\S]*to authenticated/i.test(sql), false);

const requiredFiles = [
  "src/app/api/onboarding/me/route.ts",
  "src/app/api/onboarding/documents/route.ts",
  "src/app/api/onboarding/review/route.ts",
  "src/app/api/onboarding/review/document/route.ts",
  "src/app/api/departments/route.ts",
  "src/app/api/staff/route.ts",
  "src/components/InternOnboardingPanel.tsx",
  "src/components/OnboardingReviewPanel.tsx",
  "src/components/DepartmentsManagementPanel.tsx",
  "src/components/StaffManagementPanel.tsx",
];
for (const file of requiredFiles) {
  assert.equal(fs.existsSync(path.join(root, file)), true, `missing ${file}`);
}

const internPanel = fs.readFileSync(path.join(root, "src/components/InternOnboardingPanel.tsx"), "utf8");
assert.match(internPanel, /\/api\/onboarding\/me/);
assert.match(internPanel, /\/api\/onboarding\/documents/);
assert.equal(internPanel.includes("overflow-x-hidden"), false);

const reviewPanel = fs.readFileSync(path.join(root, "src/components/OnboardingReviewPanel.tsx"), "utf8");
assert.match(reviewPanel, /\/api\/onboarding\/review/);
assert.equal(reviewPanel.includes("overflow-x-hidden"), false);

console.log("m3b schema and wiring checks passed");
