import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sql = fs.readFileSync(path.join(root, "supabase/migrations/202610150009_operational_modules.sql"), "utf8");
assert.match(sql, /create table public\.attendance_records/);
assert.match(sql, /create table public\.tasks/);
assert.match(sql, /create table public\.announcements/);
assert.match(sql, /create table public\.weekly_reports/);
assert.match(sql, /create table public\.giveaways/);
assert.equal(sql.includes("drop table"), false);
assert.match(sql, /revoke all on/);

const register = fs.readFileSync(path.join(root, "src/app/register/page.tsx"), "utf8");
assert.match(register, /Invitation required/);
assert.equal(register.includes("submitOnboarding"), false);
console.log("m5 schema and registration-path checks passed");
