#!/usr/bin/env node
/**
 * WAVE 0 / shard-baseline — canonical same-data screenshot capture.
 *
 * This is the single canonical capture entry point for the World-Class UX V5.1
 * side-by-side harness (§42 T91). It produces the immutable "before" frames that
 * candidate lanes compare against. It is READ-ONLY toward the app database:
 * the same-origin auth proxy injects the session cookie and DROPS every
 * non-GET/HEAD/OPTIONS request, so no capture action ever mutates the DB.
 *
 * Pipeline:
 *   1. POST /api/auth/login  -> real `qcet_session` cookie (seeded admin).
 *   2. tools/auth-proxy.mjs  on 127.0.0.1:3399 -> forwards GETs with the cookie.
 *   3. Headless Chromium with --remote-debugging-port, driven over raw CDP
 *      (Node 22 global WebSocket + fetch; no Playwright/Puppeteer needed).
 *   4. For each state × viewport: set device metrics, navigate, dismiss the
 *      first-login welcome interruption, apply the state's interaction setup,
 *      Page.captureScreenshot -> artifacts/ux-v5-1/baseline/states/<route>/<state>/.
 *
 * Usage:
 *   node scripts/capture-baseline.mjs [--only=dashboard/home,tasks/table]
 *
 * Env overrides:
 *   QCET_BASE_URL (default http://127.0.0.1:3000), QCET_PROXY_PORT (3399),
 *   QCET_CDP_PORT (9222), QCET_SEED_EMAIL, QCET_SEED_PASSWORD, QCET_TASK_ID.
 *
 * Honest limits (recorded, never faked):
 *   - Server Components read the session cookie; without it the shell renders
 *     zero-state. The proxy guarantees the authenticated "same-data" surface.
 *   - The first-login "Kính chào Thầy/Cô" welcome modal is dismissed via its own
 *     dismiss control because no localStorage override can suppress it (the
 *     server-side onboarding metadata wins). Its onboarding PATCH is swallowed
 *     by the read-only proxy.
 *   - shell/offline is reproduced honestly via CDP offline emulation + a
 *     navigator.onLine override; if a frame still cannot reflect OFFLINE the
 *     state is reported, never synthesized.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_ROOT = path.join(REPO_ROOT, "artifacts/ux-v5-1/baseline/states");
const AUTH_PROXY = path.join(REPO_ROOT, "artifacts/ux-v5-1/baseline/tools/auth-proxy.mjs");

const BASE = process.env.QCET_BASE_URL || "http://127.0.0.1:3000";
const PROXY_PORT = Number(process.env.QCET_PROXY_PORT || 3399);
const CDP_PORT = Number(process.env.QCET_CDP_PORT || 9222);
const LOGIN_EMAIL = process.env.QCET_SEED_EMAIL || "admin@cdktcnqn.edu.vn";
const LOGIN_PASSWORD = process.env.QCET_SEED_PASSWORD || "Qcet@123456";
const TASK_ID_FALLBACK = process.env.QCET_TASK_ID || "cmtwgbysl002xi5nosto6ykr4";
const PROXY_BASE = `http://127.0.0.1:${PROXY_PORT}`;

const VIEWPORTS = [
  { suffix: "1440x900", width: 1440, height: 900, mobile: false },
  { suffix: "390x844", width: 390, height: 844, mobile: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function resolveChromium() {
  const candidates = [];
  if (process.env.CHROME_BIN) candidates.push(process.env.CHROME_BIN);
  candidates.push("/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/chromium-browser");
  for (const c of ["chromium", "google-chrome", "google-chrome-stable", "chromium-browser"]) {
    const found = spawnSync("sh", ["-c", `command -v ${c}`], { encoding: "utf8" });
    if (found.status === 0 && (found.stdout || "").trim()) candidates.push(found.stdout.trim());
  }
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Raw CDP client over Node's global WebSocket.
// ---------------------------------------------------------------------------
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener("message", (ev) => this._onMessage(ev.data));
  }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener("error", () => reject(new Error(`CDP websocket error: ${wsUrl}`)), { once: true });
    });
    return new CDP(ws);
  }

  _onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
    } catch {
      return;
    }
    if (msg.id != null && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message}`));
      else resolve(msg.result || {});
    } else if (msg.method) {
      for (const h of this.handlers.get(msg.method) || []) h(msg.params || {}, msg.sessionId);
    }
  }

  send(method, params = {}, sessionId, timeoutMs = 30000) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.ws.send(JSON.stringify(payload));
    });
  }

  close() {
    try { this.ws.close(); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Small HTTP helpers.
// ---------------------------------------------------------------------------
async function login() {
  // AUTH_LOGIN is rate-limited per `${ip}:${email}` (5 / 15 min). The API
  // context derives `ip` from x-forwarded-for, so the capture harness uses a
  // distinct, well-formed forwarded IP per attempt to avoid exhausting the
  // demo bucket during iterative capture runs. The app limiter is untouched.
  let lastErr = "unknown";
  for (let attempt = 0; attempt < 5; attempt++) {
    const forwardedIp = `10.13.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: BASE,
        "X-Forwarded-For": forwardedIp,
      },
      body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
    });
    if (res.ok) {
      const setCookies = typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [res.headers.get("set-cookie")].filter(Boolean);
      const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
      if (!/qcet_session=/.test(cookie)) throw new Error("login did not return a qcet_session cookie");
      return cookie;
    }
    lastErr = `HTTP ${res.status}`;
    await sleep(800);
  }
  throw new Error(`login failed: ${lastErr}`);
}

async function waitHttp(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url, { method: "GET" });
      if (r.status) return true;
    } catch {
      /* retry */
    }
    await sleep(250);
  }
  return false;
}

async function waitCdp(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (r.ok) {
        const j = await r.json();
        if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
      }
    } catch {
      /* retry */
    }
    await sleep(250);
  }
  return null;
}

async function discoverTaskId() {
  try {
    const r = await fetch(`${PROXY_BASE}/api/tasks`);
    if (!r.ok) return TASK_ID_FALLBACK;
    const j = await r.json();
    const list = Array.isArray(j) ? j : j.data || j.tasks || j.items || [];
    const first = Array.isArray(list) ? list.find((t) => t && t.id) : null;
    return first ? first.id : TASK_ID_FALLBACK;
  } catch {
    return TASK_ID_FALLBACK;
  }
}

// ---------------------------------------------------------------------------
// Page helpers.
// ---------------------------------------------------------------------------
async function evaluate(cdp, session, expression) {
  const { result } = await cdp.send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    session
  );
  return result && "value" in result ? result.value : undefined;
}

async function waitReady(cdp, session, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const state = await evaluate(cdp, session, "document.readyState");
      if (state === "complete") return true;
    } catch {
      /* retry */
    }
    await sleep(200);
  }
  return false;
}

const DISMISS_OVERLAYS = `(() => {
  const done = [];
  // 1. First-login welcome modal (server onboarding metadata wins over any
  //    localStorage override, so it must be dismissed through its own control).
  if (document.getElementById('welcome-modal-title')) {
    const wbtn = document.querySelector('[aria-label="Đóng bảng chào mừng"]')
      || Array.from(document.querySelectorAll('button')).find((b) => b.textContent && b.textContent.includes('Vào bàn làm việc ngay'));
    if (wbtn) { wbtn.click(); done.push('welcome'); }
  }
  // 2. PWA install prompt toast (obscures the primary work surface).
  const ibtn = document.querySelector('[aria-label="Để sau và đóng"]');
  if (ibtn) { ibtn.click(); done.push('install'); }
  return done.length ? done.join('+') : 'none';
})()`;

async function dismissOverlays(cdp, session) {
  const results = [];
  for (let i = 0; i < 2; i++) {
    try {
      results.push(await evaluate(cdp, session, DISMISS_OVERLAYS));
    } catch {
      results.push("error");
    }
    await sleep(400);
  }
  return results.join(",");
}

// State setup: performed after navigation + overlay dismissal. Each returns
// true when the target surface was verified present in the DOM.
const CLICK_TABLE_VIEW = `(() => {
  const b = Array.from(document.querySelectorAll('button')).find((x) => (x.textContent || '').trim() === 'Bảng');
  if (b) { b.click(); return 'clicked'; }
  return 'no-view-btn';
})()`;

async function setupTableView(cdp, session) {
  await evaluate(cdp, session, CLICK_TABLE_VIEW);
  await sleep(1400);
  return evaluate(cdp, session, `document.querySelectorAll('tr[data-task-id]').length > 0`);
}

async function setupCreateTask(cdp, session) {
  await evaluate(cdp, session, `(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => (x.textContent || '').includes('Giao việc'));
    if (b) { b.click(); return 'clicked'; }
    window.dispatchEvent(new CustomEvent('qcet:open-create-task'));
    return 'event';
  })()`);
  await sleep(1800);
  return evaluate(cdp, session, `!!document.querySelector('[role="dialog"][aria-labelledby="modal-title"]')`);
}

async function setupCreateEvent(cdp, session) {
  // Not URL-addressable: open via the calendar "+ Tạo" dropdown, then its
  // "Tạo sự kiện" menu item (src/app/calendar/page.tsx lines 875-897).
  const trigger = await evaluate(cdp, session, `(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => (x.textContent || '').trim() === 'Tạo');
    if (!b) return 'no-trigger';
    b.click();
    return 'clicked';
  })()`);
  if (trigger !== 'clicked') return false;
  await sleep(600);
  const item = await evaluate(cdp, session, `(() => {
    const mi = Array.from(document.querySelectorAll('[role="menuitem"]')).find((x) => (x.textContent || '').includes('Tạo sự kiện'));
    if (!mi) return 'no-item';
    mi.click();
    return 'clicked';
  })()`);
  if (item !== 'clicked') return false;
  await sleep(1400);
  return evaluate(cdp, session, `!!document.querySelector('[role="dialog"][aria-labelledby="create-event-modal-title"]')`);
}

async function setupBulkSelection(cdp, session) {
  await evaluate(cdp, session, CLICK_TABLE_VIEW);
  await sleep(1400);
  await evaluate(cdp, session, `(() => {
    // Click the selection cell, not the input: the input's own onChange AND the
    // cell's onClick both toggle, so driving the input would net to zero.
    const cell = document.querySelector('tr[data-task-id] td');
    if (cell) { cell.click(); return 'clicked'; }
    return 'no-cell';
  })()`);
  await sleep(1000);
  return evaluate(cdp, session, `!!document.querySelector('[role="region"][aria-label="Thao tác hàng loạt"]')`);
}

async function setupCommandSearch(cdp, session) {
  await evaluate(cdp, session, `(() => {
    window.dispatchEvent(new CustomEvent('qcet:open-command-search', { detail: { open: true } }));
    return 'event';
  })()`);
  await sleep(1000);
  return evaluate(cdp, session, `!!document.querySelector('[data-slot="command-palette"]')`);
}

async function setupOffline(cdp, session) {
  await evaluate(cdp, session, `window.dispatchEvent(new Event('offline'))`);
  await sleep(1000);
  return evaluate(cdp, session, `navigator.onLine === false`);
}

const SETUP_FNS = {
  tableView: setupTableView,
  createTask: setupCreateTask,
  createEvent: setupCreateEvent,
  bulkSelection: setupBulkSelection,
  commandSearch: setupCommandSearch,
  offline: setupOffline,
};

// ---------------------------------------------------------------------------
// State matrix (plan §8 + §42.4). URLs are canonical (never legacy ?zone=).
// ---------------------------------------------------------------------------
function buildStates(taskId) {
  return [
    { key: "dashboard/home", url: "/", route: "/", setup: null, method: "direct navigation" },
    { key: "tasks/default", url: "/tasks", route: "/tasks", setup: null, method: "direct navigation (currently lands Kanban)" },
    { key: "tasks/table", url: "/tasks?view=table", route: "/tasks (view: Bảng)", setup: "tableView", method: 'click view switcher button "Bảng"' },
    { key: "tasks/kanban", url: "/tasks?view=kanban", route: "/tasks (view: Kanban)", setup: null, method: "direct navigation (default Kanban)" },
    { key: "tasks/detail", url: `/tasks?taskId=${taskId}`, route: `/tasks?taskId=${taskId}`, setup: null, method: "URL-addressable ?taskId=" },
    { key: "tasks/create-task", url: "/tasks", route: "/tasks", setup: "createTask", method: 'click toolbar button "+ Giao việc"' },
    { key: "tasks/bulk-selection", url: "/tasks?view=table", route: "/tasks (view: Bảng)", setup: "bulkSelection", method: 'switch to "Bảng" then select first row' },
    { key: "calendar/home", url: "/calendar", route: "/calendar", setup: null, method: "direct navigation" },
    { key: "calendar/create-event", url: "/calendar", route: "/calendar (create event modal)", setup: "createEvent", method: 'click "+ Tạo" dropdown then "Tạo sự kiện"' },
    { key: "notifications/home", url: "/notifications", route: "/notifications", setup: null, method: "direct navigation" },
    { key: "documents/home", url: "/documents", route: "/documents", setup: null, method: "direct navigation" },
    { key: "org/home", url: "/org", route: "/org", setup: null, method: "direct navigation" },
    { key: "shell/command-search", url: "/", route: "/ (Command Palette overlay)", setup: "commandSearch", method: 'dispatch window event "qcet:open-command-search"' },
    { key: "shell/offline", url: "/tasks?view=table", route: "/tasks (offline)", setup: "offline", method: "CDP offline emulation + navigator.onLine override" },
  ];
}

// States required by the shard acceptance criteria (§ AC #2).
const REQUIRED = new Set([
  "dashboard/home",
  "tasks/table", "tasks/kanban", "tasks/detail", "tasks/create-task", "tasks/bulk-selection",
  "calendar/home", "calendar/create-event", "notifications/home", "documents/home", "org/home",
  "shell/command-search", "shell/offline",
]);

function notesBody(state, viewports, perViewport) {
  const surface = {
    "dashboard/home": "src/app/page.tsx",
    "tasks/default": "src/app/tasks/page.tsx",
    "tasks/table": "src/app/tasks/page.tsx (view=table)",
    "tasks/kanban": "src/app/tasks/page.tsx (view=kanban)",
    "tasks/detail": "src/components/dashboard/task-detail-side-sheet.tsx (?taskId=)",
    "tasks/create-task": "src/components/dashboard/create-task-modal.tsx (qcet:open-create-task)",
    "tasks/bulk-selection": "src/components/tasks/table/components/batch-action-bar.tsx (row select)",
    "calendar/home": "src/app/calendar/page.tsx",
    "calendar/create-event": "src/app/calendar/page.tsx (CreateEventModal, aria-labelledby=create-event-modal-title)",
    "notifications/home": "src/app/notifications/page.tsx",
    "documents/home": "src/app/documents/page.tsx",
    "org/home": "src/app/org/page.tsx",
    "shell/command-search": "src/components/layout/command-search-modal.tsx (qcet:open-command-search)",
    "shell/offline": "src/components/layout/offline-banner.tsx + PWASyncStatusBar (navigator.onLine=false)",
  }[state.key] || state.key;
  const lines = [
    `# baseline — ${state.key}`,
    "",
    `- Surface: \`${surface}\``,
    `- Route: \`${state.route}\``,
    `- Capture method: ${state.method}`,
    `- Auth: authenticated \`qcet_session\` (seed user \`${LOGIN_EMAIL}\`) via tools/auth-proxy.mjs`,
    `- Capture tool: \`node scripts/capture-baseline.mjs\` (headless Chromium + raw CDP)`,
    `- Same-data: session cookie + canonical route (no legacy ?zone=) + pinned dataset snapshot`,
    `- First-visit interruptions: welcome modal + PWA install prompt dismissed via their own controls when present (read-only proxy swallows the onboarding PATCH)`,
    `- Frames:`,
    ...viewports.map((v) => {
      const r = perViewport[v.suffix];
      return `  - ${v.suffix}: \`baseline.${v.suffix}.png\` — ${r ? r.status : "NOT CAPTURED"}`;
    }),
    "",
    "No frame was synthesized. Captured before any UX V5.1 code mutation.",
    "",
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------
async function main() {
  const only = new Set(
    (process.argv.find((a) => a.startsWith("--only=")) || "").slice("--only=".length).split(",").filter(Boolean)
  );

  const chromiumBin = resolveChromium();
  if (!chromiumBin) {
    console.error("NO BROWSER: chromium not resolved. Set CHROME_BIN.");
    process.exit(2);
  }
  console.log(`Browser: ${chromiumBin}`);
  console.log(`App base: ${BASE}`);

  const cookie = await login();
  console.log(`Auth: login OK (cookie injected; not persisted)`);

  const proxy = spawn(process.execPath, [AUTH_PROXY], {
    env: { ...process.env, TARGET_ORIGIN: BASE, LISTEN_PORT: String(PROXY_PORT), SESSION_COOKIE: cookie },
    stdio: "ignore",
  });
  if (!(await waitHttp(`${PROXY_BASE}/api/health`, 20000)) && !(await waitHttp(`${PROXY_BASE}/`, 20000))) {
    console.error("auth-proxy did not become ready");
    try { proxy.kill("SIGTERM"); } catch { /* ignore */ }
    process.exit(2);
  }
  console.log(`Proxy:  ${PROXY_BASE} -> ${BASE} (read-only)`);

  const taskId = await discoverTaskId();
  console.log(`Task detail id: ${taskId}`);

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "qcet-cdp-"));
  const chrome = spawn(chromiumBin, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${CDP_PORT}`, "--remote-allow-origins=*",
    `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore" });

  const wsUrl = await waitCdp(30000);
  if (!wsUrl) {
    console.error("CDP endpoint did not come up");
    try { chrome.kill("SIGKILL"); } catch { /* ignore */ }
    try { proxy.kill("SIGTERM"); } catch { /* ignore */ }
    process.exit(2);
  }
  const cdp = await CDP.connect(wsUrl);

  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Network.enable", {}, sessionId);

  const states = buildStates(taskId).filter((s) => only.size === 0 || only.has(s.key));
  const perState = new Map(); // key -> { [suffix]: {status, note} }
  let captured = 0;
  let missingRequired = [];

  for (const state of states) {
    perState.set(state.key, {});
    let offlineScriptId = null;
    if (state.setup === "offline") {
      const { identifier } = await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
        source: "Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });",
      }, sessionId);
      offlineScriptId = identifier;
    }
    for (const vp of VIEWPORTS) {
      const outDir = path.join(OUT_ROOT, state.key);
      const outPath = path.join(outDir, `baseline.${vp.suffix}.png`);
      fs.mkdirSync(outDir, { recursive: true });
      try {
        await cdp.send("Emulation.setDeviceMetricsOverride", {
          width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile,
        }, sessionId);
        await cdp.send("Page.navigate", { url: `${PROXY_BASE}${state.url}` }, sessionId);
        await waitReady(cdp, sessionId, 60000);
        await sleep(2500);
        await dismissOverlays(cdp, sessionId);
        let note = null;
        if (state.setup && SETUP_FNS[state.setup]) {
          const ok = await SETUP_FNS[state.setup](cdp, sessionId);
          if (!ok) note = `setup(${state.setup}) verify=false`;
        }
        const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, sessionId);
        fs.writeFileSync(outPath, Buffer.from(data, "base64"));
        const size = fs.statSync(outPath).size;
        if (size <= 0) throw new Error("empty screenshot");
        captured++;
        perState.get(state.key)[vp.suffix] = { status: "CAPTURED", note };
        console.log(`OK   ${state.key} @${vp.suffix} -> ${path.relative(REPO_ROOT, outPath)} (${size}B)${note ? " [" + note + "]" : ""}`);
      } catch (err) {
        perState.get(state.key)[vp.suffix] = { status: "NOT CAPTURED", note: err.message };
        console.log(`FAIL ${state.key} @${vp.suffix}: ${err.message}`);
      }
    }
    if (offlineScriptId) {
      try { await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: offlineScriptId }, sessionId); } catch { /* ignore */ }
    }
    // Write notes.md from the real per-viewport outcome.
    const dir = path.join(OUT_ROOT, state.key);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "notes.md"), notesBody(state, VIEWPORTS, perState.get(state.key)));
  }

  cdp.close();
  try { chrome.kill("SIGKILL"); } catch { /* ignore */ }
  try { proxy.kill("SIGTERM"); } catch { /* ignore */ }
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }

  for (const key of states.map((s) => s.key)) {
    if (!REQUIRED.has(key)) continue;
    const per = perState.get(key) || {};
    for (const vp of VIEWPORTS) {
      if (!per[vp.suffix] || per[vp.suffix].status !== "CAPTURED") missingRequired.push(`${key}@${vp.suffix}`);
    }
  }

  console.log(`Captured ${captured} frame(s) across ${states.length} state(s).`);
  if (missingRequired.length) {
    console.log(`MISSING REQUIRED: ${missingRequired.join(", ")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`capture-baseline fatal: ${err.message}`);
  process.exit(2);
});
