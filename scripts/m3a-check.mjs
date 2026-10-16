import assert from "node:assert/strict";
import { validateAccountPassword } from "../src/lib/auth/password-rules.ts";
import { RECOVERY_REQUEST_MESSAGE } from "../src/lib/auth/recovery-copy.ts";
import { renderPasswordRecoveryEmail } from "../src/lib/email-templates.ts";

assert.equal(validateAccountPassword("short"), "Password must be at least 8 characters.");
assert.equal(typeof validateAccountPassword("Password1"), "object");
assert.equal(validateAccountPassword("Password1"), null);
assert.equal(Boolean(validateAccountPassword("password1")), true);
assert.equal(Boolean(validateAccountPassword("PASSWORD1")), true);
assert.equal(Boolean(validateAccountPassword("Password")), true);

const recovery = renderPasswordRecoveryEmail({
  candidateName: "Ada <Okafor>",
  resetUrl: "https://internship.example.com/auth/callback?code=test",
});
assert.equal(recovery.html.includes("Choose a new password"), true);
assert.equal(recovery.html.includes("Ada &lt;Okafor&gt;"), true);
assert.equal(recovery.subject.includes("Reset Your Enrollaa Password"), true);
assert.equal(recovery.html.includes("6-digit"), false);

assert.equal(
  RECOVERY_REQUEST_MESSAGE,
  "If an account exists for that email, you will receive password reset instructions shortly.",
);

console.log("m3a password and recovery copy checks passed");
