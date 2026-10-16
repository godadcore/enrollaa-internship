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

const base = process.env.M3A_API_BASE || "http://127.0.0.1:3458";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Local Supabase environment is not configured.");

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = Date.now().toString(36);
const internEmail = `m3a.intern.${stamp}@example.com`;
const mismatchEmail = `m3a.other.${stamp}@example.com`;
const token = crypto.randomBytes(32).toString("base64url");
const hash = crypto.createHash("sha256").update(token).digest("hex");
const password = "Password1";

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function hit(method, path, body) {
  const response = await fetch(base + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

const { data: department, error: departmentError } = await admin
  .from("departments")
  .select("id")
  .eq("is_active", true)
  .limit(1)
  .maybeSingle();
if (departmentError || !department?.id) throw new Error("No local department is available for activation tests.");

const { error: insertError } = await admin.from("staff_invitations").insert({
  invitation_number: 1,
  email: internEmail,
  first_name: "M3A",
  surname: "Intern",
  department_id: department.id,
  assigned_role: "intern",
  role_title: "Programme Intern",
  status: "invitation_sent",
  onboarding_token_hash: hash,
  onboarding_token_expires_at: new Date(Date.now() + 86400000).toISOString(),
});
if (insertError) throw new Error("Could not prepare a local invitation for activation tests.");

const invalid = await hit("POST", "/api/auth/create-password", {
  token: "expired-or-unknown",
  email: internEmail,
  password,
});
expect(invalid.status === 400 && invalid.json?.success === false, "invalid invitation must fail");

const mismatch = await hit("POST", "/api/auth/create-password", {
  token,
  email: mismatchEmail,
  password,
  role: "super_admin",
});
expect(mismatch.status === 400 && mismatch.json?.success === false, "email mismatch must fail");

const activate = await hit("POST", "/api/auth/create-password", {
  token,
  email: internEmail,
  password,
  role: "super_admin",
  department_id: "00000000-0000-0000-0000-000000000000",
});
expect(activate.status === 200 && activate.json?.success === true, `activation failed ${activate.status}`);

const { data: profile } = await admin
  .from("profiles")
  .select("role, department_id, email, is_active")
  .eq("email", internEmail)
  .maybeSingle();
expect(profile?.role === "intern", "browser role must not override invitation role");
expect(profile?.department_id === department.id, "browser department must not override invitation department");
expect(profile?.is_active === true, "activated profile must be active");

const reused = await hit("POST", "/api/auth/create-password", {
  token,
  email: internEmail,
  password,
});
expect(reused.status === 400 || reused.status === 409, `reused invitation ${reused.status}`);
expect(reused.json?.success === false, "used invitation must not activate again");

const verifyUsed = await hit("POST", "/api/invitations/verify", { token });
expect(verifyUsed.json?.valid === false, "used invitation must not verify");

const retry = await hit("POST", "/api/auth/create-password", {
  token,
  email: internEmail,
  password,
});
expect(retry.json?.success !== true, "repeat activation after use must fail");

const login = await hit("POST", "/api/auth/login", { email: internEmail, password });
expect(login.status === 200 && login.json?.success === true, `login after activation ${login.status}`);
expect(login.json?.role === "intern", "login role must come from the provisioned profile");

const internInvites = await hit("GET", "/api/invitations");
expect(internInvites.status === 401 || internInvites.status === 403, "intern must not list invitations");

const expiredToken = crypto.randomBytes(32).toString("base64url");
const expiredEmail = `m3a.expired.${stamp}@example.com`;
const { error: expiredInsertError } = await admin.from("staff_invitations").insert({
  invitation_number: 1,
  email: expiredEmail,
  first_name: "M3A",
  surname: "Expired",
  department_id: department.id,
  assigned_role: "intern",
  role_title: "Programme Intern",
  status: "invitation_sent",
  onboarding_token_hash: crypto.createHash("sha256").update(expiredToken).digest("hex"),
  onboarding_token_expires_at: new Date(Date.now() - 60000).toISOString(),
});
if (expiredInsertError) throw new Error("Could not prepare an expired invitation.");
const expired = await hit("POST", "/api/auth/create-password", {
  token: expiredToken,
  email: expiredEmail,
  password,
});
expect(expired.status === 400 && expired.json?.success === false, "expired invitation must fail");

const revokedToken = crypto.randomBytes(32).toString("base64url");
const revokedEmail = `m3a.revoked.${stamp}@example.com`;
const { error: revokedInsertError } = await admin.from("staff_invitations").insert({
  invitation_number: 1,
  email: revokedEmail,
  first_name: "M3A",
  surname: "Revoked",
  department_id: department.id,
  assigned_role: "intern",
  role_title: "Programme Intern",
  status: "revoked",
  revoked_at: new Date().toISOString(),
  onboarding_token_hash: crypto.createHash("sha256").update(revokedToken).digest("hex"),
  onboarding_token_expires_at: new Date(Date.now() + 86400000).toISOString(),
});
if (revokedInsertError) throw new Error("Could not prepare a revoked invitation.");
const revoked = await hit("POST", "/api/auth/create-password", {
  token: revokedToken,
  email: revokedEmail,
  password,
});
expect(revoked.status === 400 && revoked.json?.success === false, "revoked invitation must fail");

console.log("m3a local activation integration checks passed");
