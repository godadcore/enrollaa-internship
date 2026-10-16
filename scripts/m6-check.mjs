import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { OFFICIAL_INTERNSHIP_ROLE_NAMES } from "../src/lib/internship-roles.ts";

const root = process.cwd();
const expected = [
  "Frontend Developer",
  "Backend Developer",
  "UI/UX Developer",
  "UI/UX Designer",
  "Data Researcher",
  "Graphic Designer",
];
assert.deepEqual([...OFFICIAL_INTERNSHIP_ROLE_NAMES], expected);

const sql = fs.readFileSync(path.join(root, "supabase/migrations/202610150010_internship_roles.sql"), "utf8");
for (const name of expected) assert.match(sql, new RegExp(name.replace("/", "\\/")));
assert.equal(sql.includes("drop table"), false);
assert.match(sql, /revoke all on public\.internship_roles/);

const invitations = fs.readFileSync(path.join(root, "src/lib/invitations.ts"), "utf8");
assert.match(invitations, /isOfficialInternshipRole/);
assert.match(invitations, /assignedRole === "intern"/);

const email = fs.readFileSync(path.join(root, "src/lib/email-service.ts"), "utf8");
assert.match(email, /SKIP_EMAIL_DISPATCH/);
assert.equal(email.includes("isSimulated: true"), false);

const reports = fs.readFileSync(path.join(root, "src/lib/operations/reports.ts"), "utf8");
assert.match(reports, /getProgrammeWeekWAT/);
assert.equal(reports.includes("2026-10-19"), false);

console.log("m6 reliability and internship-role checks passed");
