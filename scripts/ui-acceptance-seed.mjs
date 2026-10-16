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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Local Supabase environment is not configured.");
if (/supabase\.co/i.test(url)) throw new Error("Refusing to seed against hosted Supabase.");

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const password = "LocalTest1!";
const internEmail = "ui.intern.acceptance@example.com";
const adminEmail = "ui.admin.acceptance@example.com";
const leadEmail = "ui.lead.acceptance@example.com";
const managerEmail = "ui.manager.acceptance@example.com";
const superAdminEmail = "ui.superadmin.acceptance@example.com";

async function findUser(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function ensureAuthUser(email) {
  const existing = await findUser(email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (error) throw error;
    return existing.id;
  }
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error || new Error("Could not create user.");
  return created.data.user.id;
}

async function ensureProfile({ authUserId, email, role, firstName, surname, roleTitle, departmentId }) {
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing?.id) {
    const { error } = await admin
      .from("profiles")
      .update({
        auth_user_id: authUserId,
        role,
        first_name: firstName,
        surname,
        role_title: roleTitle,
        is_active: true,
        department_id: departmentId,
        phone: "+2348000000001",
      })
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await admin
    .from("profiles")
    .insert({
      auth_user_id: authUserId,
      email,
      role,
      first_name: firstName,
      surname,
      role_title: roleTitle,
      is_active: true,
      department_id: departmentId,
      phone: "+2348000000001",
    })
    .select("id")
    .single();
  if (error || !data) throw error || new Error("Could not create profile.");
  return data.id;
}

const { data: departments, error: deptError } = await admin
  .from("departments")
  .select("id, name")
  .eq("is_active", true)
  .order("name");
if (deptError || !departments?.length) throw new Error("No local department is available.");
const primary = departments[0];
const secondary = departments[1] || departments[0];

const internAuthId = await ensureAuthUser(internEmail);
const adminAuthId = await ensureAuthUser(adminEmail);
const leadAuthId = await ensureAuthUser(leadEmail);
const managerAuthId = await ensureAuthUser(managerEmail);
const superAdminAuthId = await ensureAuthUser(superAdminEmail);

const internProfileId = await ensureProfile({
  authUserId: internAuthId,
  email: internEmail,
  role: "intern",
  firstName: "UI",
  surname: "Intern",
  roleTitle: "Programme Intern",
  departmentId: primary.id,
});
await ensureProfile({
  authUserId: adminAuthId,
  email: adminEmail,
  role: "admin",
  firstName: "UI",
  surname: "Admin",
  roleTitle: "Programme Admin",
  departmentId: primary.id,
});
const leadProfileId = await ensureProfile({
  authUserId: leadAuthId,
  email: leadEmail,
  role: "lead",
  firstName: "UI",
  surname: "Lead",
  roleTitle: "Department Lead",
  departmentId: primary.id,
});
await ensureProfile({
  authUserId: managerAuthId,
  email: managerEmail,
  role: "manager",
  firstName: "UI",
  surname: "Manager",
  roleTitle: "Programme Manager",
  departmentId: primary.id,
});
await ensureProfile({
  authUserId: superAdminAuthId,
  email: superAdminEmail,
  role: "super_admin",
  firstName: "UI",
  surname: "Superadmin",
  roleTitle: "Programme Super Admin",
  departmentId: null,
});

const { data: existingLead } = await admin
  .from("department_leads")
  .select("department_id")
  .eq("department_id", primary.id)
  .eq("profile_id", leadProfileId)
  .maybeSingle();
if (!existingLead) {
  const { error } = await admin.from("department_leads").insert({ department_id: primary.id, profile_id: leadProfileId });
  if (error) throw error;
}

const { data: existingInvite } = await admin.from("staff_invitations").select("id").eq("email", internEmail).maybeSingle();
if (!existingInvite) {
  const { data: lastInvite } = await admin.from("staff_invitations").select("invitation_number").order("invitation_number", { ascending: false }).limit(1).maybeSingle();
  const token = crypto.randomBytes(32).toString("base64url");
  const { error } = await admin.from("staff_invitations").insert({
    invitation_number: Number(lastInvite?.invitation_number || 0) + 1,
    email: internEmail,
    first_name: "UI",
    surname: "Intern",
    department_id: primary.id,
    assigned_role: "intern",
    role_title: "Programme Intern",
    status: "onboarding_started",
    auth_user_id: internAuthId,
    onboarding_token_hash: crypto.createHash("sha256").update(token).digest("hex"),
    onboarding_token_expires_at: new Date(Date.now() + 86400000).toISOString(),
  });
  if (error) throw error;
}

console.log(
  JSON.stringify({
    ok: true,
    internEmail,
    adminEmail,
    leadEmail,
    managerEmail,
    superAdminEmail,
    internProfileId,
    primaryDepartmentId: primary.id,
    secondaryDepartmentId: secondary.id,
    departments: departments.map((row) => row.name),
  }),
);
