import fs from "node:fs";
import path from "node:path";

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

const base = process.env.UI_API_BASE || "http://127.0.0.1:3462";
const internEmail = "ui.intern.acceptance@example.com";
const adminEmail = "ui.admin.acceptance@example.com";
const leadEmail = "ui.lead.acceptance@example.com";
const password = "LocalTest1!";
const otherDept = "712b8b83-536d-421d-89dc-e8aaffffcdfc";

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
  return { status: response.status, json, location: response.headers.get("location") };
}

expect((await hit("GET", "/api/attendance")).status === 401, "unauth attendance");
expect((await hit("GET", "/api/staff")).status === 401, "unauth staff");
expect((await hit("POST", "/api/announcements", { body: { title: "x", content: "y" } })).status === 401, "unauth announcements");

const internJar = new Map();
expect((await hit("POST", "/api/auth/login", { body: { email: internEmail, password }, jar: internJar })).status === 200, "intern login");
expect((await hit("POST", "/api/announcements", { jar: internJar, body: { title: "Nope", content: "Nope" } })).status === 403, "intern cannot publish");
expect((await hit("POST", "/api/tasks", { jar: internJar, body: { title: "Nope", dueAt: new Date().toISOString() } })).status === 403, "intern cannot create tasks");
expect((await hit("POST", "/api/departments", { jar: internJar, body: { name: "Hacked", slug: "hacked" } })).status === 403, "intern cannot create departments");
expect((await hit("GET", "/api/internship-roles", { jar: internJar })).status === 200, "intern can list internship roles");
expect((await hit("GET", "/api/audit")).status === 401 || (await hit("GET", "/api/audit", { jar: internJar })).status === 403, "intern audit denied");
const internAudit = await hit("GET", "/api/audit", { jar: internJar });
expect(internAudit.status === 403, `intern audit ${internAudit.status}`);
expect((await hit("GET", "/admin", { jar: internJar })).status === 307 || (await hit("GET", "/admin", { jar: internJar })).status === 302, "intern admin redirect");

const register = await fetch(base + "/register", { redirect: "manual" });
expect(register.status === 200, "register page");
const registerText = await register.text();
expect(registerText.includes("Invitation required"), "register cannot bypass invitation");

const leadJar = new Map();
expect((await hit("POST", "/api/auth/login", { body: { email: leadEmail, password }, jar: leadJar })).status === 200, "lead login");
const cross = await hit("POST", "/api/tasks", {
  jar: leadJar,
  body: { title: "Cross dept", dueAt: new Date(Date.now() + 86400000).toISOString(), departmentId: otherDept },
});
expect(cross.status === 201 || cross.status === 403 || cross.status === 400, `lead cross-dept ${cross.status} ${cross.json?.error || ""}`);
if (cross.status === 201) {
  const leadTasks = await hit("GET", "/api/tasks", { jar: leadJar });
  const created = (leadTasks.json?.tasks || []).find((task) => task.id === cross.json.id);
  expect(created && created.departmentId !== otherDept, "lead task must stay in assigned department");
}

const adminJar = new Map();
expect((await hit("POST", "/api/auth/login", { body: { email: adminEmail, password }, jar: adminJar })).status === 200, "admin login");
const summary = await hit("GET", "/api/programme-summary", { jar: adminJar });
expect(summary.status === 200 && summary.json?.success === true, "admin summary");
expect((await hit("GET", "/api/onboarding/review", { jar: internJar })).status === 403, "intern cannot review onboarding");
const unofficialInvite = await hit("POST", "/api/invitations", { jar: adminJar, body: { firstName: "Test", surname: "Role", email: `unofficial.role.${Date.now()}@example.com`, departmentSlug: "frontend-engineering", assignedRole: "intern", roleTitle: "Programme Intern" } });
expect(unofficialInvite.status === 400, `unofficial intern role ${unofficialInvite.status}`);

const internProfilePatch = await hit("PATCH", "/api/profile", { jar: internJar, body: { phone: "+2348000000099", role: "admin", departmentId: otherDept } });
expect(internProfilePatch.status === 200 && internProfilePatch.json?.phone === "+2348000000099", "intern phone save");
const internMe = await hit("POST", "/api/auth/login", { body: { email: internEmail, password }, jar: new Map() });
expect(internMe.json?.user?.role === "intern", "client role spoof via profile patch did not escalate");

console.log("ui-security-regression passed");
