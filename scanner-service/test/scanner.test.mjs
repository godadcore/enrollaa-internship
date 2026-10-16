import test from "node:test";
import assert from "node:assert/strict";
import { authorized, MAX_BYTES, createServer } from "../server.mjs";

test("authentication and limits fail safely", () => {
  assert.equal(authorized({ authorization: "Bearer good" }, "good"), true);
  assert.equal(authorized({ authorization: "Bearer bad" }, "good"), false);
  assert.equal(MAX_BYTES, 10 * 1024 * 1024);
});
test("health does not imply scanner readiness", async () => {
  const server = createServer({ config: { token: "", clamdHost: "", clamdPort: 0, timeoutMs: 1000 }, scan: async () => "clean" });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const ready = await fetch(`http://127.0.0.1:${port}/readyz`);
  const health = await fetch(`http://127.0.0.1:${port}/healthz`);
  assert.equal(health.status, 200); assert.equal(ready.status, 503); server.close();
});
test("invalid request cannot produce a verdict", async () => {
  const server = createServer({ config: { token: "good", clamdHost: "x" }, scan: async () => { throw new Error("must not run"); } });
  await new Promise((resolve) => server.listen(0, resolve)); const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/scan`, { method: "POST", headers: { Authorization: "Bearer bad", "Content-Type": "application/octet-stream", "Content-Length": "1" }, body: "x" });
  assert.equal(response.status, 401); server.close();
});
console.log("scanner-service unit checks passed; no ClamAV daemon was used");
