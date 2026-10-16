import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
for (const file of ["docs/PILOT.md", "docs/PILOT_INTERN_GUIDE.md", "docs/PILOT_STAFF_GUIDE.md"]) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  assert.match(text, /invitation/i);
  assert.equal(text.includes("password="), false);
}
const pilot = fs.readFileSync(path.join(root, "docs/PILOT.md"), "utf8");
assert.match(pilot, /Frontend Developer/);
assert.match(pilot, /Pause/);
assert.match(pilot, /Do not contact real candidates/);
console.log("m8 pilot-document checks passed");
