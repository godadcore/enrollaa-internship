import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
  const eq = trimmed.indexOf("=");
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = value;
}

const base = process.env.M3B_API_BASE || "http://127.0.0.1:3460";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Local Supabase environment is not configured.");
if (/supabase\.co/i.test(url)) throw new Error("Refusing to run M3B integration against hosted Supabase.");

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = Date.now().toString(36);
const internEmail = `m3b.intern.${stamp}@example.com`;
const internBEmail = `m3b.internb.${stamp}@example.com`;
const adminEmail = `m3b.admin.${stamp}@example.com`;
const leadEmail = `m3b.lead.${stamp}@example.com`;
const password = "Password1";

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function storeCookies(jar, response) {
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const cookie of cookies) {
    const pair = cookie.split(";", 1)[0];
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

async function hit(method, pathname, { body, jar, form } = {}) {
  const headers = {};
  if (jar) headers.cookie = cookieHeader(jar);
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(base + pathname, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
    redirect: "manual",
  });
  if (jar) storeCookies(jar, response);
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

const unauthMe = await hit("GET", "/api/onboarding/me");
expect(unauthMe.status === 401, `unauth onboarding ${unauthMe.status}`);
const unauthReview = await hit("GET", "/api/onboarding/review");
expect(unauthReview.status === 401, `unauth review ${unauthReview.status}`);
const unauthStaff = await hit("GET", "/api/staff");
expect(unauthStaff.status === 401, `unauth staff ${unauthStaff.status}`);
const unauthDept = await hit("GET", "/api/departments");
expect(unauthDept.status === 401, `unauth departments ${unauthDept.status}`);

const { data: departments, error: departmentError } = await admin
  .from("departments")
  .select("id, name")
  .eq("is_active", true)
  .order("name");
if (departmentError || !departments?.length) throw new Error("No local department is available.");
const departmentA = departments[0];
const departmentB = departments[1] ?? departmentA;

const internToken = crypto.randomBytes(32).toString("base64url");
const internBToken = crypto.randomBytes(32).toString("base64url");
const { error: inviteError } = await admin.from("staff_invitations").insert({
  invitation_number: 1,
  email: internEmail,
  first_name: "M3B",
  surname: "Intern",
  department_id: departmentA.id,
  assigned_role: "intern",
  role_title: "Programme Intern",
  status: "invitation_sent",
  onboarding_token_hash: crypto.createHash("sha256").update(internToken).digest("hex"),
  onboarding_token_expires_at: new Date(Date.now() + 86400000).toISOString(),
});
if (inviteError) throw new Error("Could not prepare intern invitation.");

const { error: inviteBError } = await admin.from("staff_invitations").insert({
  invitation_number: 1,
  email: internBEmail,
  first_name: "M3B",
  surname: "Other",
  department_id: departmentB.id,
  assigned_role: "intern",
  role_title: "Programme Intern",
  status: "invitation_sent",
  onboarding_token_hash: crypto.createHash("sha256").update(internBToken).digest("hex"),
  onboarding_token_expires_at: new Date(Date.now() + 86400000).toISOString(),
});
if (inviteBError) throw new Error("Could not prepare second intern invitation.");

const activate = await hit("POST", "/api/auth/create-password", {
  body: { token: internToken, email: internEmail, password, role: "super_admin" },
});
expect(activate.status === 200 && activate.json?.success === true, `activation ${activate.status}`);

const activateB = await hit("POST", "/api/auth/create-password", {
  body: { token: internBToken, email: internBEmail, password },
});
expect(activateB.status === 200 && activateB.json?.success === true, `activation B ${activateB.status}`);

const internJar = new Map();
const loginIntern = await hit("POST", "/api/auth/login", { body: { email: internEmail, password }, jar: internJar });
expect(loginIntern.status === 200 && loginIntern.json?.role === "intern", `intern login ${loginIntern.status}`);

const internBJar = new Map();
const loginInternB = await hit("POST", "/api/auth/login", { body: { email: internBEmail, password }, jar: internBJar });
expect(loginInternB.status === 200, `intern B login ${loginInternB.status}`);

const forbiddenReview = await hit("GET", "/api/onboarding/review", { jar: internJar });
expect(forbiddenReview.status === 403, `intern review ${forbiddenReview.status}`);
const forbiddenStaff = await hit("GET", "/api/staff", { jar: internJar });
expect(forbiddenStaff.status === 403, `intern staff ${forbiddenStaff.status}`);
const forbiddenDeptWrite = await hit("POST", "/api/departments", {
  jar: internJar,
  body: { name: "Should Fail", role: "admin" },
});
expect(forbiddenDeptWrite.status === 403, `intern department create ${forbiddenDeptWrite.status}`);

const draft = await hit("PUT", "/api/onboarding/me", {
  jar: internJar,
  body: {
    phone: "08012345678",
    locationState: "Lagos",
    locationCity: "Ikeja",
    sex: "Prefer not to say",
    institution: "University of Lagos",
    bankName: "Access Bank",
    accountName: "M3B Intern",
    role: "super_admin",
    departmentId: departmentB.id,
  },
});
expect(draft.status === 200 && draft.json?.success === true, `draft ${draft.status} ${draft.json?.error || ""}`);

const internJar2 = new Map();
const resumeLogin = await hit("POST", "/api/auth/login", { body: { email: internEmail, password }, jar: internJar2 });
expect(resumeLogin.status === 200, "resume session login failed");
const resumed = await hit("GET", "/api/onboarding/me", { jar: internJar2 });
expect(resumed.json?.onboarding?.submission?.status === "draft", "draft did not persist across sessions");
expect(resumed.json?.onboarding?.submission?.phone === "08012345678", "draft phone did not persist");
expect(resumed.json?.onboarding?.invitation?.invitationStatus === "onboarding_started", "activation is not completed onboarding");

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
const photoForm = new FormData();
photoForm.set("kind", "photo");
photoForm.set("file", new Blob([jpeg], { type: "image/jpeg" }), "headshot.jpg");
const photoUpload = await hit("POST", "/api/onboarding/documents", { jar: internJar2, form: photoForm });
expect(photoUpload.status === 200 && photoUpload.json?.success === true, `photo ${photoUpload.status} ${photoUpload.json?.error || ""}`);

const badForm = new FormData();
badForm.set("kind", "photo");
badForm.set("file", new Blob([Buffer.from("not-an-image")], { type: "image/jpeg" }), "headshot.jpg");
const badUpload = await hit("POST", "/api/onboarding/documents", { jar: internJar2, form: badForm });
expect(badUpload.status === 400, `invalid photo ${badUpload.status}`);

const oversized = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(5 * 1024 * 1024 + 10, 1)]);
const bigForm = new FormData();
bigForm.set("kind", "photo");
bigForm.set("file", new Blob([oversized], { type: "image/jpeg" }), "big.jpg");
const bigUpload = await hit("POST", "/api/onboarding/documents", { jar: internJar2, form: bigForm });
expect(bigUpload.status === 400, `oversized photo ${bigUpload.status}`);

const replaceForm = new FormData();
replaceForm.set("kind", "photo");
replaceForm.set("file", new Blob([jpeg], { type: "image/jpeg" }), "headshot-2.jpg");
const replaceUpload = await hit("POST", "/api/onboarding/documents", { jar: internJar2, form: replaceForm });
expect(replaceUpload.status === 200, `replace photo ${replaceUpload.status}`);

const cvForm = new FormData();
cvForm.set("kind", "cv");
cvForm.set("file", new Blob([pdf], { type: "application/pdf" }), "cv.pdf");
const cvUpload = await hit("POST", "/api/onboarding/documents", { jar: internJar2, form: cvForm });
expect(cvUpload.status === 200, `cv ${cvUpload.status} ${cvUpload.json?.error || ""}`);

const submit = await hit("POST", "/api/onboarding/me", {
  jar: internJar2,
  body: { typedSignature: "M3B Intern", accountNumber: "0123456789", bankName: "Access Bank", accountName: "M3B Intern" },
});
expect(submit.status === 200 && submit.json?.success === true, `submit ${submit.status} ${submit.json?.error || ""}`);

const duplicate = await hit("POST", "/api/onboarding/me", {
  jar: internJar2,
  body: { typedSignature: "M3B Intern", accountNumber: "0123456789" },
});
expect(duplicate.status === 409 || duplicate.status === 400, `duplicate submit ${duplicate.status}`);

const adminAuth = await admin.auth.admin.createUser({
  email: adminEmail,
  password,
  email_confirm: true,
});
if (adminAuth.error || !adminAuth.data.user) throw new Error("Could not create local admin test user.");
const { error: adminProfileError } = await admin.from("profiles").insert({
  auth_user_id: adminAuth.data.user.id,
  email: adminEmail,
  role: "admin",
  first_name: "M3B",
  surname: "Admin",
  role_title: "Programme Admin",
  is_active: true,
  department_id: departmentA.id,
});
if (adminProfileError) throw new Error("Could not create local admin profile.");

const leadAuth = await admin.auth.admin.createUser({
  email: leadEmail,
  password,
  email_confirm: true,
});
if (leadAuth.error || !leadAuth.data.user) throw new Error("Could not create local lead test user.");
const { data: leadProfile, error: leadProfileError } = await admin
  .from("profiles")
  .insert({
    auth_user_id: leadAuth.data.user.id,
    email: leadEmail,
    role: "lead",
    first_name: "M3B",
    surname: "Lead",
    role_title: "Department Lead",
    is_active: true,
    department_id: departmentB.id,
  })
  .select("id")
  .single();
if (leadProfileError) throw new Error("Could not create local lead profile.");

const adminJar = new Map();
const loginAdmin = await hit("POST", "/api/auth/login", { body: { email: adminEmail, password }, jar: adminJar });
expect(loginAdmin.status === 200 && loginAdmin.json?.role === "admin", `admin login ${loginAdmin.status}`);

const list = await hit("GET", "/api/onboarding/review", { jar: adminJar });
expect(list.status === 200, `review list ${list.status}`);
const submission = (list.json?.submissions || []).find((row) => row.email?.toLowerCase() === internEmail);
expect(Boolean(submission), "admin did not see intern submission");
expect(submission.status === "submitted", "submission status incorrect");

const detail = await hit("GET", `/api/onboarding/review?id=${submission.id}`, { jar: adminJar });
expect(detail.status === 200, `review detail ${detail.status}`);
const documentId = detail.json?.submission?.documents?.[0]?.id;
expect(Boolean(documentId), "review documents missing");
const signed = await hit("GET", `/api/onboarding/review/document?documentId=${documentId}`, { jar: adminJar });
expect(signed.status === 200 && typeof signed.json?.url === "string", "signed document url missing");
expect(!JSON.stringify(signed.json.url).includes("service_role"), "service role leaked");

const internDoc = await hit("GET", `/api/onboarding/review/document?documentId=${documentId}`, { jar: internBJar });
expect(internDoc.status === 403 || internDoc.status === 401, `cross-user document ${internDoc.status}`);

const leadJar = new Map();
const loginLead = await hit("POST", "/api/auth/login", { body: { email: leadEmail, password }, jar: leadJar });
expect(loginLead.status === 200, `lead login ${loginLead.status}`);
if (departmentA.id !== departmentB.id) {
  const crossDept = await hit("POST", "/api/onboarding/review", {
    jar: leadJar,
    body: { submissionId: submission.id, decision: "approved", note: "no" },
  });
  expect(crossDept.status === 403, `cross-dept review ${crossDept.status}`);
}

const rejectMissingNote = await hit("POST", "/api/onboarding/review", {
  jar: adminJar,
  body: { submissionId: submission.id, decision: "rejected", note: "" },
});
expect(rejectMissingNote.status === 400, `reject without note ${rejectMissingNote.status}`);

const corrections = await hit("POST", "/api/onboarding/review", {
  jar: adminJar,
  body: { submissionId: submission.id, decision: "rejected", note: "Update the photograph." },
});
expect(corrections.status === 200, `corrections ${corrections.status} ${corrections.json?.error || ""}`);

const internStatus = await hit("GET", "/api/onboarding/me", { jar: internJar2 });
expect(internStatus.json?.onboarding?.submission?.status === "rejected", "intern did not see correction status");

const resubmit = await hit("POST", "/api/onboarding/me", {
  jar: internJar2,
  body: { typedSignature: "M3B Intern", accountNumber: "0123456789" },
});
expect(resubmit.status === 200, `resubmit ${resubmit.status} ${resubmit.json?.error || ""}`);

const approve = await hit("POST", "/api/onboarding/review", {
  jar: adminJar,
  body: { submissionId: submission.id, decision: "approved", note: "Complete." },
});
expect(approve.status === 200, `approve ${approve.status} ${approve.json?.error || ""}`);

const repeat = await hit("POST", "/api/onboarding/review", {
  jar: adminJar,
  body: { submissionId: submission.id, decision: "approved", note: "Complete." },
});
expect(repeat.status === 409 || repeat.status === 400, `repeat approve ${repeat.status}`);

const approvedView = await hit("GET", "/api/onboarding/me", { jar: internJar2 });
expect(approvedView.json?.onboarding?.submission?.status === "approved", "intern did not see approved status");

const created = await hit("POST", "/api/departments", {
  jar: adminJar,
  body: { name: `M3B Dept ${stamp}`, description: "Created by M3B test" },
});
expect(created.status === 201 && created.json?.id, `create department ${created.status} ${created.json?.error || ""}`);
const duplicateDept = await hit("POST", "/api/departments", {
  jar: adminJar,
  body: { name: `M3B Dept ${stamp}` },
});
expect(duplicateDept.status === 409, `duplicate department ${duplicateDept.status}`);
const edited = await hit("PATCH", "/api/departments", {
  jar: adminJar,
  body: { id: created.json.id, description: "Updated", isActive: true },
});
expect(edited.status === 200, `edit department ${edited.status}`);

const staffList = await hit("GET", "/api/staff", { jar: adminJar });
expect(staffList.status === 200, `staff list ${staffList.status}`);
const leadRow = (staffList.json?.staff || []).find((row) => row.email?.toLowerCase() === leadEmail);
expect(Boolean(leadRow), "lead missing from staff list");
const assign = await hit("PATCH", "/api/staff", {
  jar: adminJar,
  body: { id: leadRow.id, assignLead: true, departmentId: departmentB.id, role: "lead" },
});
expect(assign.status === 200, `assign lead ${assign.status} ${assign.json?.error || ""}`);

const selfEscalate = await hit("PATCH", "/api/staff", {
  jar: adminJar,
  body: { id: (staffList.json.staff.find((row) => row.email?.toLowerCase() === adminEmail) || {}).id, role: "intern" },
});
expect(selfEscalate.status === 403, `self role change ${selfEscalate.status}`);

const leadStaffWrite = await hit("PATCH", "/api/staff", {
  jar: leadJar,
  body: { id: leadProfile.id, role: "admin", departmentId: departmentA.id },
});
expect(leadStaffWrite.status === 403, `lead self-assign ${leadStaffWrite.status}`);

console.log("m3b local onboarding, document, review, department, and staff checks passed");
