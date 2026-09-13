/**
 * S-PERF — canonical performance lab harness.
 *
 * Reuses the Wave-0 baseline browser pipeline (Universal Invariant: One
 * Capability, One Implementation) rather than forking a second capture engine:
 *   - login:   POST /api/auth/login (X-Forwarded-For rotated to dodge the
 *              5/15min per-ip:email limiter). Token is never persisted.
 *   - proxy:   spawns the READ-ONLY same-origin cookie proxy that already lives
 *              at artifacts/ux-v5-1/baseline/tools/auth-proxy.mjs (spawned, not
 *              copied, because that path is anti-owned by this shard).
 *   - browser: /usr/bin/chromium --headless=new --no-sandbox, driven over raw
 *              CDP (Node 22 global WebSocket). No Playwright/Puppeteer.
 *
 * Measurement instruments (lab-only, injected via Page.addScriptToEvaluateOnNewDocument):
 *   - LCP / CLS / FCP / TTFB via buffered PerformanceObserver — read by querying
 *     the collector instead of waiting for visibilitychange finalization, because
 *     a CDP-driven headless page never becomes hidden (documented Chromium
 *     headless visibility behaviour).
 *   - INP / interaction latency via the Event Timing API ('event' entryType,
 *     durationThreshold 16ms) fed by REAL CDP input events
 *     (Input.dispatchMouseEvent / dispatchKeyEvent), which are trusted and enter
 *     the renderer's input pipeline. In-page synthetic .click() produces no
 *     PerformanceEventTiming entries and is deliberately not used for INP.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
export const AUTH_PROXY = path.join(
  REPO_ROOT,
  "artifacts",
  "ux-v5-1",
  "baseline",
  "tools",
  "auth-proxy.mjs"
);
export const PERF_ARTIFACTS = path.join(REPO_ROOT, "artifacts", "ux-v5-1", "performance");
export const DEFAULT_TASK_ID = process.env.QCET_TASK_ID || "cmtwgbysl002xi5nosto6ykr4";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32). Used for forwarded-IP rotation and seed-data
// codes so no line depends on a nondeterministic RNG. Seed is derived from the clock so
// successive runs still rotate (login limiter is per ip:email).
// ---------------------------------------------------------------------------
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Raw CDP client over Node's global WebSocket.
// ---------------------------------------------------------------------------
export class CDP {
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
      ws.addEventListener(
        "error",
        () => reject(new Error(`CDP websocket error: ${wsUrl}`)),
        { once: true }
      );
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
// HTTP / process helpers.
// ---------------------------------------------------------------------------
export function resolveChromium() {
  const candidates = [];
  if (process.env.CHROME_BIN) candidates.push(process.env.CHROME_BIN);
  candidates.push("/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/chromium-browser");
  for (const c of ["chromium", "google-chrome", "google-chrome-stable", "chromium-browser"]) {
    const found = spawnSync("sh", ["-c", `command -v ${c}`], { encoding: "utf8" });
    if (found.status === 0 && (found.stdout || "").trim()) candidates.push(found.stdout.trim());
  }
  for (const c of candidates) if (c && fs.existsSync(c)) return c;
  return null;
}

export async function login(base, { email, password } = {}) {
  const rng = makeRng((Date.now() ^ process.pid) >>> 0);
  const user = email || process.env.QCET_SEED_EMAIL || "admin@cdktcnqn.edu.vn";
  const pass = password || process.env.QCET_SEED_PASSWORD || "Qcet@123456";
  let lastErr = "unknown";
  for (let attempt = 0; attempt < 5; attempt++) {
    const forwardedIp = `10.77.${1 + Math.floor(rng() * 254)}.${1 + Math.floor(rng() * 254)}`;
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base, "X-Forwarded-For": forwardedIp },
      body: JSON.stringify({ email: user, password: pass }),
    });
    if (res.ok) {
      const setCookies =
        typeof res.headers.getSetCookie === "function"
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

export async function waitHttp(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url, { method: "GET" });
      if (r.status) return true;
    } catch { /* retry */ }
    await sleep(250);
  }
  return false;
}

export async function waitCdp(port, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) {
        const j = await r.json();
        if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
      }
    } catch { /* retry */ }
    await sleep(250);
  }
  return null;
}

/**
 * Boot the canonical login + read-only auth proxy + headless Chromium.
 * Returns handles plus a `teardown()`.
 */
export async function bootstrap({
  base = process.env.QCET_BASE_URL || "http://127.0.0.1:3000",
  proxyPort = Number(process.env.QCET_PERF_PROXY_PORT || 3421),
  cdpPort = Number(process.env.QCET_PERF_CDP_PORT || 9241),
} = {}) {
  const chromiumBin = resolveChromium();
  if (!chromiumBin) throw new Error("NO BROWSER: chromium not resolved. Set CHROME_BIN.");

  const cookie = await login(base);
  const proxyBase = `http://127.0.0.1:${proxyPort}`;
  const proxy = spawn(process.execPath, [AUTH_PROXY], {
    env: { ...process.env, TARGET_ORIGIN: base, LISTEN_PORT: String(proxyPort), SESSION_COOKIE: cookie },
    stdio: "ignore",
  });
  if (!(await waitHttp(`${proxyBase}/api/health`, 20000)) && !(await waitHttp(`${proxyBase}/`, 20000))) {
    try { proxy.kill("SIGTERM"); } catch { /* ignore */ }
    throw new Error("auth-proxy did not become ready");
  }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "qcet-perf-"));
  const chrome = spawn(
    chromiumBin,
    [
      "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
      `--remote-debugging-port=${cdpPort}`, "--remote-allow-origins=*",
      `--user-data-dir=${profile}`, "about:blank",
    ],
    { stdio: "ignore" }
  );

  const wsUrl = await waitCdp(cdpPort, 30000);
  if (!wsUrl) {
    try { chrome.kill("SIGKILL"); } catch { /* ignore */ }
    try { proxy.kill("SIGTERM"); } catch { /* ignore */ }
    throw new Error("CDP endpoint did not come up");
  }
  const cdp = await CDP.connect(wsUrl);

  const teardown = () => {
    cdp.close();
    try { chrome.kill("SIGKILL"); } catch { /* ignore */ }
    try { proxy.kill("SIGTERM"); } catch { /* ignore */ }
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  };

  return { cdp, proxyBase, chromiumBin, base, teardown };
}

// ---------------------------------------------------------------------------
// In-page instrumentation collector (installed before any page script runs).
// ---------------------------------------------------------------------------
export const COLLECTOR_SOURCE = `(() => {
  var Q = { lcp: [], cls: [], paint: [], events: [], nav: null, errors: [] };
  window.__qcetPerf = Q;
  function observe(type, fn, opts) {
    try { var o = new PerformanceObserver(fn); o.observe(Object.assign({ type: type, buffered: true }, opts || {})); }
    catch (e) { Q.errors.push(type + ':' + (e && e.message)); }
  }
  // Attribute each LCP candidate to its element so a reader can SEPARATE the
  // shell/paint LCP from the virtualized data-grid LCP on the same route (the
  // /tasks table cell can paint either as LCP). inGrid flags an element inside
  // the task table/grid; element is tag + up to the first few classes.
  function lcpDesc(e) {
    var el = e.element;
    if (!el || !el.tagName) return { element: e.url || null, inGrid: false };
    var tag = el.tagName.toLowerCase();
    var cls = (typeof el.className === 'string' ? el.className : '').trim().replace(/\\s+/g, '.').slice(0, 80);
    var inGrid = !!(el.closest && el.closest('table,[role="grid"],[role="treegrid"],[data-task-id]'));
    return { element: cls ? tag + '.' + cls : tag, inGrid: inGrid };
  }
  observe('largest-contentful-paint', function (l) {
    l.getEntries().forEach(function (e) {
      var d = lcpDesc(e);
      Q.lcp.push({ startTime: e.startTime, size: e.size || 0, element: d.element, inGrid: d.inGrid });
    });
  });
  observe('layout-shift', function (l) {
    l.getEntries().forEach(function (e) { if (!e.hadRecentInput) Q.cls.push(e.value); });
  });
  observe('paint', function (l) {
    l.getEntries().forEach(function (e) { Q.paint.push({ name: e.name, startTime: e.startTime }); });
  });
  observe('event', function (l) {
    l.getEntries().forEach(function (e) {
      Q.events.push({ name: e.name, startTime: e.startTime, duration: e.duration,
        processingStart: e.processingStart, processingEnd: e.processingEnd, interactionId: e.interactionId });
    });
  }, { durationThreshold: 16 });
  window.addEventListener('load', function () {
    var n = performance.getEntriesByType('navigation')[0];
    if (n) Q.nav = { ttfb: n.responseStart - n.requestStart, type: n.type };
  });
})();`;

let collectorScriptId = null;

export async function installCollector(cdp, session) {
  const { identifier } = await cdp.send(
    "Page.addScriptToEvaluateOnNewDocument",
    { source: COLLECTOR_SOURCE },
    session
  );
  collectorScriptId = identifier;
  return identifier;
}

export async function removeCollector(cdp, session) {
  if (!collectorScriptId) return;
  try {
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: collectorScriptId }, session);
  } catch { /* ignore */ }
  collectorScriptId = null;
}

// ---------------------------------------------------------------------------
// Page helpers.
// ---------------------------------------------------------------------------
export async function evaluate(cdp, session, expression) {
  const { result, exceptionDetails } = await cdp.send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    session
  );
  if (exceptionDetails) throw new Error(`evaluate threw: ${exceptionDetails.text || "unknown"}`);
  return result && "value" in result ? result.value : undefined;
}

export async function waitReady(cdp, session, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await evaluate(cdp, session, "document.readyState")) === "complete") return true;
    } catch { /* retry */ }
    await sleep(150);
  }
  return false;
}

const DISMISS_OVERLAYS = `(() => {
  const done = [];
  if (document.getElementById('welcome-modal-title')) {
    const wbtn = document.querySelector('[aria-label="Đóng bảng chào mừng"]')
      || Array.from(document.querySelectorAll('button')).find((b) => b.textContent && b.textContent.includes('Vào bàn làm việc ngay'));
    if (wbtn) { wbtn.click(); done.push('welcome'); }
  }
  const ibtn = document.querySelector('[aria-label="Để sau và đóng"]');
  if (ibtn) { ibtn.click(); done.push('install'); }
  return done.length ? done.join('+') : 'none';
})()`;

export async function dismissOverlays(cdp, session) {
  const results = [];
  for (let i = 0; i < 2; i++) {
    try { results.push(await evaluate(cdp, session, DISMISS_OVERLAYS)); } catch { results.push("error"); }
    await sleep(400);
  }
  return results.join(",");
}

export async function setViewport(cdp, session, vp) {
  await cdp.send(
    "Emulation.setDeviceMetricsOverride",
    { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile },
    session
  );
}

export async function navigate(cdp, session, url) {
  await cdp.send("Page.navigate", { url }, session);
  await waitReady(cdp, session, 60000);
}

// ---------------------------------------------------------------------------
// Interaction drivers — REAL CDP input (trusted), never in-page synthetic clicks.
// ---------------------------------------------------------------------------
async function centerOf(cdp, session, selector) {
  return evaluate(
    cdp,
    session,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    })()`
  );
}

export async function clickSelector(cdp, session, selector) {
  const c = await centerOf(cdp, session, selector);
  if (!c) return { ok: false, reason: `selector-not-found:${selector}` };
  await cdp.send(
    "Input.dispatchMouseEvent",
    { type: "mouseMoved", x: c.x, y: c.y, button: "none", buttons: 0 },
    session
  );
  await cdp.send(
    "Input.dispatchMouseEvent",
    { type: "mousePressed", x: c.x, y: c.y, button: "left", buttons: 1, clickCount: 1 },
    session
  );
  await cdp.send(
    "Input.dispatchMouseEvent",
    { type: "mouseReleased", x: c.x, y: c.y, button: "left", buttons: 0, clickCount: 1 },
    session
  );
  return { ok: true, selector };
}

let clickByTextSeq = 0;

/** Click the first element whose trimmed text or aria-label contains `needle`. */
export async function clickByText(cdp, session, needle) {
  // Unique token per call: a fixed marker would let a second call in the same
  // document resolve to the FIRST stamped (stale) element, because
  // querySelector returns the first match in document order (PERF-10).
  const token = `qcet-perf-t${++clickByTextSeq}`;
  const sel = await evaluate(
    cdp,
    session,
    `(() => {
      const needle = ${JSON.stringify(needle)};
      // Clear any earlier stamp so a stale element can never be re-selected.
      document.querySelectorAll('[data-qcet-perf-target]').forEach((n) => n.removeAttribute('data-qcet-perf-target'));
      const nodes = Array.from(document.querySelectorAll('button,a,[role="button"],[role="menuitem"]'));
      // Prefer an EXACT trimmed text match; only then fall back to a substring
      // match (substring alone wrongly hits e.g. "Bảng điều khiển" for "Bảng").
      const hit = nodes.find((n) => (n.textContent || '').trim() === needle)
        || nodes.find((n) => ((n.textContent || '').trim().includes(needle)) || ((n.getAttribute('aria-label') || '').includes(needle)));
      if (!hit) return null;
      hit.setAttribute('data-qcet-perf-target', ${JSON.stringify(token)});
      return '[data-qcet-perf-target="${token}"]';
    })()`
  );
  if (!sel) return { ok: false, reason: `text-not-found:${needle}` };
  return clickSelector(cdp, session, sel);
}

const KEYCODE = (ch) => {
  const c = ch.toUpperCase().charCodeAt(0);
  return c >= 65 && c <= 90 ? c : 0;
};

export async function typeText(cdp, session, selector, text) {
  const focused = await evaluate(
    cdp,
    session,
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.focus(); return document.activeElement === el; })()`
  );
  if (!focused) return { ok: false, reason: `input-not-found:${selector}` };
  for (const ch of text) {
    await cdp.send(
      "Input.dispatchKeyEvent",
      { type: "keyDown", text: ch, unmodifiedText: ch, key: ch, code: `Key${ch.toUpperCase()}`, windowsVirtualKeyCode: KEYCODE(ch) },
      session
    );
    await cdp.send(
      "Input.dispatchKeyEvent",
      { type: "keyUp", key: ch, code: `Key${ch.toUpperCase()}`, windowsVirtualKeyCode: KEYCODE(ch) },
      session
    );
  }
  return { ok: true };
}

export async function pressShortcut(cdp, session, { key, code, vk, ctrl = true }) {
  const modifiers = ctrl ? 2 : 0;
  await cdp.send(
    "Input.dispatchKeyEvent",
    { type: "rawKeyDown", key, code, modifiers, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk },
    session
  );
  await cdp.send(
    "Input.dispatchKeyEvent",
    { type: "keyUp", key, code, modifiers, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk },
    session
  );
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Metric collection.
// ---------------------------------------------------------------------------
export async function collectLoadMetrics(cdp, session) {
  return evaluate(
    cdp,
    session,
    `(() => {
      const Q = window.__qcetPerf || { lcp: [], cls: [], paint: [], events: [], errors: [] };
      const nav = performance.getEntriesByType('navigation')[0];
      const ttfb = Q.nav ? Q.nav.ttfb : (nav ? nav.responseStart - nav.requestStart : null);
      const lcpArr = Q.lcp.length ? Q.lcp : performance.getEntriesByType('largest-contentful-paint').map((e) => ({ startTime: e.startTime }));
      const lcp = lcpArr.length ? lcpArr[lcpArr.length - 1].startTime : null;
      const lastLcp = lcpArr.length ? lcpArr[lcpArr.length - 1] : null;
      const lcpElement = lastLcp ? (lastLcp.element || null) : null;
      const lcpInGrid = lastLcp ? (lastLcp.inGrid === true) : null;
      const paintFcp = Q.paint.find((p) => p.name === 'first-contentful-paint');
      const fcpEntry = paintFcp || performance.getEntriesByName('first-contentful-paint')[0];
      const fcp = fcpEntry ? fcpEntry.startTime : null;
      let cls = 0;
      Q.cls.forEach((v) => { cls += v; });
      return { ttfb, fcp, lcp, lcpElement, lcpInGrid, cls: Math.round(cls * 10000) / 10000,
        lcpSamples: lcpArr.length, clsSamples: Q.cls.length, eventCount: Q.events.length, errors: Q.errors };
    })()`
  );
}

export async function eventCount(cdp, session) {
  return evaluate(cdp, session, "((window.__qcetPerf && window.__qcetPerf.events) || []).length");
}

/**
 * Run one CDP-driven interaction and return its Event Timing-derived latency.
 * INP per page-load is the outlier-trimmed maximum interaction duration; with a
 * handful of lab interactions we report the observed max (no trimming) and the
 * raw entry list, never a fabricated percentile.
 */
export async function measureInteraction(cdp, session, action, { settleMs = 1200 } = {}) {
  const before = await eventCount(cdp, session);
  const t0 = Date.now();
  const outcome = await action(cdp, session);
  const wallMs = Date.now() - t0;
  await sleep(settleMs);
  const entries = await evaluate(
    cdp,
    session,
    `((window.__qcetPerf && window.__qcetPerf.events) || []).slice(${Number(before) || 0}).map((e) => ({ name: e.name, duration: e.duration, interactionId: e.interactionId }))`
  );
  const list = Array.isArray(entries) ? entries : [];
  const withInteraction = list.filter((e) => typeof e.interactionId === "number" && e.interactionId > 0);
  const durations = (withInteraction.length ? withInteraction : list).map((e) => e.duration);
  const latencyMs = durations.length ? Math.max(...durations) : null;
  return {
    action: outcome,
    wallMs,
    eventEntries: list.length,
    interactionEntries: withInteraction.length,
    latencyMs,
    note: list.length === 0 ? "no-event-timing-entries" : withInteraction.length === 0 ? "no-trusted-interaction-id" : null,
  };
}

// ---------------------------------------------------------------------------
// Statistics (lab aggregation — NOT field p75; see METHODOLOGY.md).
// ---------------------------------------------------------------------------
export function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

export function summarize(values) {
  const nums = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return { n: 0, median: null, p75: null, min: null, max: null };
  return {
    n: nums.length,
    median: Number(percentile(nums, 0.5).toFixed(3)),
    p75: Number(percentile(nums, 0.75).toFixed(3)),
    min: Number(nums[0].toFixed(3)),
    max: Number(nums[nums.length - 1].toFixed(3)),
  };
}
