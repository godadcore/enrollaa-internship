import assert from "node:assert/strict";
import { publicApplicationLink, resolveApplicationUrl } from "../src/lib/app-url.ts";
import { renderInvitationEmail } from "../src/lib/email-templates.ts";

const local = resolveApplicationUrl({ NODE_ENV: "development" });
assert.equal(local, "http://localhost:3000");

const slashed = resolveApplicationUrl({
  NODE_ENV: "production",
  APP_URL: "https://internship.example.com/",
});
assert.equal(slashed, "https://internship.example.com");

assert.throws(
  () => resolveApplicationUrl({ NODE_ENV: "production" }),
  /not configured/,
);

assert.throws(
  () => resolveApplicationUrl({ NODE_ENV: "production", APP_URL: "http://localhost:3000" }),
  /not configured/,
);

const link = publicApplicationLink("/onboarding", "abc/token", {
  NODE_ENV: "production",
  APP_URL: "https://internship.example.com/",
});
assert.equal(link, "https://internship.example.com/onboarding?token=abc%2Ftoken");

const email = renderInvitationEmail({
  candidateName: "Ada Okafor",
  firstName: "Ada",
  roleTitle: "Intern",
  department: "Frontend <Engineering>",
  inviteUrl: link,
  expiresDateStr: "22 October 2026",
});
assert.equal(email.html.includes("You've been invited to Enrollaa!"), true);
assert.equal(email.html.includes("Hello Ada,"), true);
assert.equal(email.html.includes("Frontend &lt;Engineering&gt;"), true);
assert.equal(email.html.includes("Accept Invitation"), true);
assert.equal(email.html.includes("You've been approved!"), false);
assert.equal(email.text.includes("Hello Ada,"), true);

console.log("app-url and invitation email checks passed");
