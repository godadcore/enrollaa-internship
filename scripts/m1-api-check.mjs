const base = process.env.M1_API_BASE || "http://127.0.0.1:3457";

async function hit(method, path, body) {
  const response = await fetch(base + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, location: response.headers.get("location"), json, text: text.slice(0, 180) };
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const health = await hit("GET", "/api/health");
expect(health.status === 200 && health.json?.success === true, `health ${health.status} ${health.text}`);
expect(health.text.includes("SUPABASE_SECRET") === false, "health must not expose secrets");

const internshipRoles = await hit("GET", "/api/internship-roles");
expect(internshipRoles.status === 401, `internship-roles ${internshipRoles.status}`);

const invitations = await hit("GET", "/api/invitations");
expect(invitations.status === 401, `invitations ${invitations.status} ${invitations.text}`);
expect(invitations.json?.success === false, "invitations should not succeed");

const summary = await hit("GET", "/api/programme-summary");
expect(summary.status === 401, `summary ${summary.status}`);

const revoke = await hit("POST", "/api/invitations/revoke", {
  invitationId: "00000000-0000-0000-0000-000000000000",
  reason: "test",
});
expect(revoke.status === 401, `revoke ${revoke.status} ${revoke.text}`);

const resend = await hit("POST", "/api/invitations/resend", {
  invitationId: "00000000-0000-0000-0000-000000000000",
});
expect(resend.status === 401, `resend ${resend.status}`);

const createPassword = await hit("POST", "/api/auth/create-password", {});
expect(createPassword.status === 400, `create-password ${createPassword.status} ${createPassword.text}`);
expect(createPassword.json?.success === false, "create-password must not succeed without a valid invitation");

const escalate = await hit("POST", "/api/auth/create-password", {
  token: "not-a-real-token",
  email: "attacker@example.com",
  password: "Password1",
  role: "super_admin",
  department_id: "00000000-0000-0000-0000-000000000000",
});
expect(escalate.status === 400, `escalation ${escalate.status}`);
expect(escalate.json?.success === false, "role/department in the body must not activate an account");

const forgotUnknown = await hit("POST", "/api/auth/forgot-password", { email: "nobody@example.com" });
expect(forgotUnknown.status === 200, `forgot unknown ${forgotUnknown.status}`);
expect(forgotUnknown.json?.success === true, "recovery must not reveal missing accounts");
expect(forgotUnknown.json?.previewCode == null, "recovery must not return a preview code");
const recoveryMessage = forgotUnknown.json?.message;

const forgotSeed = await hit("POST", "/api/auth/forgot-password", { email: "seed@example.com" });
expect(forgotSeed.status === 200 && forgotSeed.json?.success === true, `forgot seed ${forgotSeed.status}`);
expect(forgotSeed.json?.message === recoveryMessage, "recovery responses must be indistinguishable");
expect(forgotSeed.json?.previewCode == null, "recovery must not return a preview code");

const reset = await hit("POST", "/api/auth/reset-password", { password: "Password123" });
expect(reset.status === 401, `reset ${reset.status}`);
expect(reset.json?.success === false, "reset without a recovery session must fail");

const verify = await hit("POST", "/api/auth/verify-code", { email: "seed@example.com", code: "000000" });
expect(verify.status === 503, `verify-code ${verify.status}`);

const login = await hit("POST", "/api/auth/login", { email: "nobody@example.com", password: "wrong-password" });
expect(login.status === 401, `login ${login.status} ${login.text}`);
expect(login.json?.success === false, "bad login must fail");

const logout = await hit("POST", "/api/auth/logout");
expect(logout.status === 200, `logout ${logout.status}`);
expect(logout.json?.success === true, "logout without a session should still succeed");

const admin = await hit("GET", "/admin");
expect(admin.status === 307 || admin.status === 302, `admin ${admin.status}`);
expect(String(admin.location || "").includes("/login"), `admin redirect ${admin.location}`);

const invitationVerify = await hit("POST", "/api/invitations/verify", { token: "not-a-real-token" });
expect(invitationVerify.status === 400, `verify invitation ${invitationVerify.status}`);
expect(invitationVerify.json?.valid === false, "invalid invitation token must not verify");

console.log("m1 unauthenticated API checks passed");
