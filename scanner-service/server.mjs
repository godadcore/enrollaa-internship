import http from "node:http";
import net from "node:net";
export const MAX_BYTES = 10 * 1024 * 1024;
export const CONFIG = {
  token: process.env.SCANNER_TOKEN ?? "",
  port: Number(process.env.PORT ?? 8080),
  clamdHost: process.env.CLAMD_HOST ?? "127.0.0.1",
  clamdPort: Number(process.env.CLAMD_PORT ?? 3310),
  timeoutMs: Math.min(Math.max(Number(process.env.CLAMD_TIMEOUT_MS ?? 15000) || 15000, 1000), 60000),
};

export function authorized(headers, token = CONFIG.token) {
  return Boolean(token) && headers.authorization === `Bearer ${token}`;
}

export async function scanWithClamd(bytes, config = CONFIG) {
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_BYTES) throw new Error("oversized");
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: config.clamdHost, port: config.clamdPort });
    let result = "";
    let settled = false;
    const finish = (error, verdict) => { if (settled) return; settled = true; clearTimeout(timer); socket.destroy(); error ? reject(error) : resolve(verdict); };
    const timer = setTimeout(() => finish(new Error("clamd timeout")), config.timeoutMs);
    socket.on("connect", () => {
      const header = Buffer.alloc(4); header.writeUInt32BE(bytes.length);
      const frame = Buffer.concat([Buffer.from("nINSTREAM\n"), header, bytes, Buffer.alloc(4)]);
      socket.end(frame);
    });
    socket.on("data", (chunk) => { result += chunk.toString("utf8"); });
    socket.on("end", () => {
      if (/FOUND\s*$/.test(result)) finish(null, "infected");
      else if (/^stream: OK\s*$/.test(result.trim())) finish(null, "clean");
      else finish(new Error("indeterminate clamd result"));
    });
    socket.on("error", (error) => finish(error));
  });
}
export function clamdReady(config = CONFIG) {
  return new Promise((resolve) => {
    if (!config.clamdHost || !config.clamdPort) return resolve(false);
    const socket = net.createConnection({ host: config.clamdHost, port: config.clamdPort });
    let output = "";
    const timer = setTimeout(() => { socket.destroy(); resolve(false); }, Math.min(config.timeoutMs, 2000));
    const done = (value) => { clearTimeout(timer); socket.destroy(); resolve(value); };
    socket.on("connect", () => socket.write("PING\0"));
    socket.on("data", (chunk) => { output += chunk.toString("utf8"); if (output.includes("PONG")) done(true); });
    socket.on("error", () => done(false));
  });
}

function send(res, status, body) { res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(body)); }
async function body(req) {
  const declared = req.headers["content-length"];
  if (!declared || !/^\d+$/.test(declared) || Number(declared) > MAX_BYTES) throw Object.assign(new Error("oversized"), { statusCode: 413 });
  const chunks = []; let total = 0;
  for await (const chunk of req) { total += chunk.length; if (total > MAX_BYTES) throw Object.assign(new Error("oversized"), { statusCode: 413 }); chunks.push(chunk); }
  return Buffer.concat(chunks, total);
}

export function createServer({ config = CONFIG, scan = scanWithClamd } = {}) {
  return http.createServer(async (req, res) => {
    if (req.url === "/healthz" && req.method === "GET") return send(res, 200, { status: "ok" });
    if (req.url === "/readyz" && req.method === "GET") { const ready = Boolean(config.token) && await clamdReady(config); return send(res, ready ? 200 : 503, { ready }); }
    if (req.url !== "/scan" || req.method !== "POST") return send(res, 404, { error: "not_found" });
    if (!authorized(req.headers, config.token) || req.headers["content-type"] !== "application/octet-stream") return send(res, 401, { error: "unauthorized" });
    try { const verdict = await scan(await body(req), config); return send(res, 200, { verdict }); }
    catch (error) { return send(res, error.statusCode === 413 ? 413 : 503, { error: "scan_unavailable" }); }
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) createServer().listen(CONFIG.port, "0.0.0.0");
