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
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  if (!process.env[key]) process.env[key] = value;
}

const base = process.env.M5_API_BASE || "http://127.0.0.1:3461";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Local Supabase environment is not configured.");
if (/supabase\.co/i.test(url)) throw new Error("Refusing to run M5 integration against hosted Supabase.");

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = Date.now().toString(36);
const internEmail = `m5.intern.${stamp}@example.com`;
const adminEmail = `m5.admin.${stamp}@example.com`;
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
async function hit(method, pathname, { body, jar } = {}) {
  const headers = {};
  if (jar) headers.cookie = cookieHeader(jar);
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(base + pathname, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  if (jar) storeCookies(jar, response);
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

expect((await hit("GET", "/api/attendance")).status === 401, "unauth attendance");
expect((await hit("GET", "/api/tasks")).status === 401, "unauth tasks");
expect((await hit("POST", "/api/announcements", { body: { title: "x", content: "y" } })).status === 401, "unauth announcements");

const { data: department } = await admin.from("departments").select("id").eq("is_active", true).limit(1).maybeSingle();
if (!department?.id) throw new Error("No local department is available.");
const token = crypto.randomBytes(32).toString("base64url");
const { error: inviteError } = await admin.from("staff_invitations").insert({
  invitation_number: 1,
  email: internEmail,
  first_name: "M5",
  surname: "Intern",
  department_id: department.id,
  assigned_role: "intern",
  role_title: "Programme Intern",
  status: "invitation_sent",
  onboarding_token_hash: crypto.createHash("sha256").update(token).digest("hex"),
  onboarding_token_expires_at: new Date(Date.now() + 86400000).toISOString(),
});
if (inviteError) throw new Error("Could not prepare intern invitation.");
expect((await hit("POST", "/api/auth/create-password", { body: { token, email: internEmail, password, role: "admin" } })).json?.success === true, "activation");

const internJar = new Map();
expect((await hit("POST", "/api/auth/login", { body: { email: internEmail, password }, jar: internJar })).status === 200, "intern login");
const checkin = await hit("POST", "/api/attendance", { jar: internJar });
expect(checkin.status === 200 && checkin.json?.success === true, `checkin ${checkin.status} ${checkin.json?.error || ""}`);
const duplicate = await hit("POST", "/api/attendance", { jar: internJar });
expect(duplicate.status === 409, `duplicate checkin ${duplicate.status}`);
expect((await hit("POST", "/api/tasks", { jar: internJar, body: { title: "Should fail", dueAt: new Date().toISOString(), role: "admin" } })).status === 403, "intern cannot create tasks");
expect((await hit("POST", "/api/announcements", { jar: internJar, body: { title: "Nope", content: "Nope" } })).status === 403, "intern cannot publish");

const adminAuth = await admin.auth.admin.createUser({ email: adminEmail, password, email_confirm: true });
if (adminAuth.error || !adminAuth.data.user) throw new Error("Could not create admin user.");
const { error: adminProfileError } = await admin.from("profiles").insert({
  auth_user_id: adminAuth.data.user.id,
  email: adminEmail,
  role: "admin",
  first_name: "M5",
  surname: "Admin",
  role_title: "Programme Admin",
  is_active: true,
  department_id: department.id,
});
if (adminProfileError) throw new Error("Could not create admin profile.");
const adminJar = new Map();
expect((await hit("POST", "/api/auth/login", { body: { email: adminEmail, password }, jar: adminJar })).status === 200, "admin login");

const { data: internProfile } = await admin.from("profiles").select("id").eq("email", internEmail).maybeSingle();
const created = await hit("POST", "/api/tasks", {
  jar: adminJar,
  body: {
    title: "M5 task",
    description: "Submit a URL",
    dueAt: new Date(Date.now() + 86400000).toISOString(),
    assignedToProfileId: internProfile.id,
    departmentId: department.id,
    priority: "high",
  },
});
expect(created.status === 201 && created.json?.id, `create task ${created.status} ${created.json?.error || ""}`);
const internTasks = await hit("GET", "/api/tasks", { jar: internJar });
expect((internTasks.json?.tasks || []).some((task) => task.id === created.json.id), "intern cannot see assigned task");
const submit = await hit("POST", "/api/tasks/submissions", {
  jar: internJar,
  body: { taskId: created.json.id, internId: "other-user", deliverableUrl: "https://example.com/work", notes: "done" },
});
expect(submit.status === 200, `submit ${submit.status} ${submit.json?.error || ""}`);
expect((await hit("POST", "/api/tasks/review", { jar: internJar, body: { taskId: created.json.id, decision: "approved" } })).status === 403, "intern cannot review");
const review = await hit("POST", "/api/tasks/review", {
  jar: adminJar,
  body: { taskId: created.json.id, internProfileId: internProfile.id, decision: "approved", feedback: "Good" },
});
expect(review.status === 200, `review ${review.status} ${review.json?.error || ""}`);
const published = await hit("POST", "/api/announcements", { jar: adminJar, body: { title: "M5 notice", content: "Please check in.", target: "interns" } });
expect(published.status === 201, `announcement ${published.status}`);
const internNotices = await hit("GET", "/api/announcements", { jar: internJar });
expect((internNotices.json?.announcements || []).some((row) => row.title === "M5 notice"), "intern should see intern announcement");
const giveaway = await hit("POST", "/api/giveaways", {
  jar: adminJar,
  body: {
    title: "M5 Friday",
    description: "Punctuality reward",
    scheduledAt: new Date().toISOString(),
    scoringPeriodStart: new Date(Date.now() - 86400000).toISOString(),
    scoringPeriodEnd: new Date(Date.now() + 86400000).toISOString(),
    prize1st: 3000,
    prize2nd: 2000,
  },
});
expect(giveaway.status === 201, `giveaway ${giveaway.status} ${giveaway.json?.error || ""}`);
expect((await hit("POST", "/api/giveaways", { jar: internJar, body: { title: "x", scheduledAt: new Date().toISOString() } })).status === 403, "intern cannot create giveaway");
const registerPage = await fetch(base + "/register");
const registerHtml = await registerPage.text();
expect(registerHtml.includes("Invitation required"), "register must not offer untrusted signup");
console.log("m5 operational integration checks passed");
