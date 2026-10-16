import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "src");

const forbidden = [
  "@/lib/email-service",
  "@/lib/server-db",
  "@/lib/invitations",
  "@/lib/programme-summary",
  "@/lib/data",
  "@/lib/data/",
  "@/lib/supabase/server",
  "@/lib/supabase/server-config",
  "@/lib/supabase/session-server",
  "@/lib/auth/admin-api",
  "@/lib/auth/authorization",
  "@/lib/auth/dashboard-routes",
  "@/lib/auth/invitations-disabled",
  "./email-service",
  "../email-service",
  "./server-db",
  "../server-db",
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function isClientModule(source) {
  return /^["']use client["'];?/m.test(source.slice(0, 400));
}

const importPattern = /from\s+["']([^"']+)["']/g;
const violations = [];

for (const file of walk(root)) {
  const source = fs.readFileSync(file, "utf8");
  if (!isClientModule(source)) continue;
  let match;
  while ((match = importPattern.exec(source))) {
    const specifier = match[1];
    const blocked = forbidden.some((prefix) => specifier === prefix || specifier.startsWith(prefix));
    if (blocked) violations.push(`${path.relative(process.cwd(), file)} imports ${specifier}`);
  }
}

if (violations.length) {
  console.error("m2 boundary violations:\n" + violations.join("\n"));
  process.exit(1);
}

console.log("m2 browser/server import boundary checks passed");
