import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const example = fs.readFileSync(path.join(root, ".env.example"), "utf8");
assert.match(example, /APP_URL=https:\/\/enrollaa\.com\.ng/);
assert.match(example, /SUPABASE_SECRET_KEY=/);
assert.match(example, /SKIP_EMAIL_DISPATCH/);
assert.equal(example.includes("NEXT_PUBLIC_SUPABASE_SECRET"), false);
assert.equal(/sk_live|re_[A-Za-z0-9]{20,}/.test(example), false);

const src = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) src.push(full);
  }
}
walk(path.join(root, "src"));
for (const file of src) {
  const text = fs.readFileSync(file, "utf8");
  assert.equal(text.includes("NEXT_PUBLIC_SUPABASE_SECRET"), false, file);
  assert.equal(text.includes("NEXT_PUBLIC_SUPABASE_SERVICE"), false, file);
}

const production = fs.readFileSync(path.join(root, "docs/PRODUCTION.md"), "utf8");
assert.match(production, /enrollaa\.com\.ng/);
assert.match(production, /Do not apply `supabase\/schema\.sql`/);
assert.match(production, /SKIP_EMAIL_DISPATCH/);

const health = fs.readFileSync(path.join(root, "src/app/api/health/route.ts"), "utf8");
assert.match(health, /database/);
assert.equal(health.includes("process.env.SUPABASE_SECRET_KEY"), false);

console.log("m7 production-configuration checks passed");
