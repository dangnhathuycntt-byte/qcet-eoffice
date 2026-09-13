#!/usr/bin/env node
/**
 * WAVE 0 baseline — DOM inspection probe (shard-baseline owned).
 *
 * Read-only debugging helper for the capture driver: boots the same auth
 * pipeline as scripts/capture-baseline.mjs and evaluates an arbitrary JS
 * expression against the authenticated page, printing the JSON result.
 *
 * Usage:
 *   node artifacts/ux-v5-1/baseline/tools/inspect-dom.mjs \
 *     [--url=/tasks] [--expr="document.title"] [--width=1440] [--height=900]
 */
import { spawn } from "node:child_process";

const arg = (name, def) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};

const BASE = process.env.QCET_BASE_URL || "http://127.0.0.1:3000";
const PROXY_PORT = Number(process.env.QCET_PROXY_PORT || 3399);
const CDP_PORT = Number(process.env.QCET_CDP_PORT || 9223);
const PROXY_BASE = `http://127.0.0.1:${PROXY_PORT}`;
const url = arg("url", "/tasks");
const expr = arg("expr", "document.title");
const width = Number(arg("width", "1440"));
const height = Number(arg("height", "900"));

const here = new URL(".", import.meta.url);
const AUTH_PROXY = new URL("auth-proxy.mjs", here).pathname;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login() {
  const forwardedIp = `10.14.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE, "X-Forwarded-For": forwardedIp },
    body: JSON.stringify({
      email: process.env.QCET_SEED_EMAIL || "admin@cdktcnqn.edu.vn",
      password: process.env.QCET_SEED_PASSWORD || "Qcet@123456",
    }),
  });
  const cookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

function cdpClient(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result || {});
    }
  });
  return {
    send: (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const mid = ++id;
        pending.set(mid, { resolve, reject });
        ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
      }),
  };
}

const cookie = await login();
const proxy = spawn(process.execPath, [AUTH_PROXY], {
  env: { ...process.env, TARGET_ORIGIN: BASE, LISTEN_PORT: String(PROXY_PORT), SESSION_COOKIE: cookie },
  stdio: "ignore",
});
await sleep(1200);
const chrome = spawn("/usr/bin/chromium", [
  "--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${CDP_PORT}`,
  "--remote-allow-origins=*", "about:blank",
], { stdio: "ignore" });
await sleep(2000);
const ver = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
const cdp = cdpClient(ws);
const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
await cdp.send("Page.enable", {}, sessionId);
await cdp.send("Runtime.enable", {}, sessionId);
await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
await cdp.send("Page.navigate", { url: `${PROXY_BASE}${url}` }, sessionId);
await sleep(6000);
const { result } = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
console.log(JSON.stringify(result.value, null, 2));
try { ws.close(); } catch { /* ignore */ }
try { chrome.kill("SIGKILL"); } catch { /* ignore */ }
try { proxy.kill("SIGTERM"); } catch { /* ignore */ }
process.exit(0);
