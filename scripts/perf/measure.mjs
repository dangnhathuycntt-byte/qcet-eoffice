#!/usr/bin/env node
/**
 * S-PERF — route/interaction CWV measurement driver (§21 T74–T76, §5 C16).
 *
 * Measures the T74 route matrix and T76 interactions at each viewport, K times
 * per cell, over REAL CDP input, and writes a baseline.json / candidate.json
 * plus per-cell screenshots under artifacts/ux-v5-1/performance/.
 *
 * Usage:
 *   node scripts/perf/measure.mjs --label=baseline --runs=5 --viewports=all
 *   node scripts/perf/measure.mjs --label=candidate --runs=5
 *   node scripts/perf/measure.mjs --inp-selftest          # prove INP pipe works
 *
 * This is a LAB harness: p75 here is the 75th percentile across K repeated lab
 * runs of the same route — NOT the field p75 (which is across page loads). See
 * artifacts/ux-v5-1/performance/METHODOLOGY.md.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  bootstrap, installCollector, setViewport, navigate, dismissOverlays, evaluate,
  sleep, summarize, measureInteraction, clickSelector, clickByText, typeText,
  collectLoadMetrics, DEFAULT_TASK_ID, PERF_ARTIFACTS,
  REPO_ROOT,
} from "./lib/harness.mjs";

const arg = (name, def) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const hasFlag = (name) => process.argv.includes(`--${name}`);

const LABEL = arg("label", "baseline");
const RUNS = Number(arg("runs", "5"));
const SETTLE = Number(arg("settle", "2000"));
const VIEWPORT_FILTER = arg("viewports", "all");
const ROUTE_FILTER = arg("routes", "all");
// Capture per-route frames for EVERY label (before AND after), not baseline
// only — R-092 requires before/after same-data screenshots, so a candidate run
// must produce its own frames from the same routes/viewports/dataset.
const SCREENSHOTS = !hasFlag("no-screenshots");

function currentGitSha() {
  try {
    const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" });
    return r.status === 0 ? (r.stdout || "").trim() || null : null;
  } catch {
    return null;
  }
}

const VIEWPORTS = {
  desktop: { suffix: "1440x900", width: 1440, height: 900, mobile: false },
  mobile: { suffix: "390x844", width: 390, height: 844, mobile: true },
};

const TASK_ID = process.env.QCET_TASK_ID || DEFAULT_TASK_ID;

// T74 route matrix + T76 interaction per surface. `setup` runs before metrics;
// `interaction` is the T76 interaction measured with real CDP input.
const ROUTE_MATRIX = [
  { key: "home", path: "/" },
  { key: "tasks-table", path: "/tasks", setup: "tableView", interaction: "filter" },
  { key: "tasks-kanban", path: "/tasks" },
  { key: "tasks-detail", path: `/tasks?taskId=${TASK_ID}` },
  { key: "tasks-open-detail", path: "/tasks", setup: "tableView", interaction: "detail-open" },
  { key: "tasks-search", path: "/tasks", setup: "tableView", interaction: "search" },
  { key: "tasks-bulk", path: "/tasks", setup: "tableView", interaction: "bulk-select" },
  { key: "calendar", path: "/calendar", interaction: "calendar-nav" },
  { key: "notifications", path: "/notifications" },
  { key: "documents", path: "/documents" },
  { key: "org", path: "/org" },
  { key: "command-search", path: "/", interaction: "command-results" },
];

async function firstExisting(cdp, session, selectors) {
  for (const sel of selectors) {
    const found = await evaluate(
      cdp,
      session,
      `!!document.querySelector(${JSON.stringify(sel)})`
    );
    if (found) return sel;
  }
  return null;
}

// Mirrors the canonical Wave-0 capture setup (JS click on the exact view
// switcher). Setup is NOT the measured interaction, so a script click here is
// fine; the T76 interaction that follows still uses real CDP input.
async function setupTableView(cdp, session) {
  const clicked = await evaluate(
    cdp,
    session,
    `(() => { const b = Array.from(document.querySelectorAll('button')).find((x) => (x.textContent || '').trim() === 'Bảng'); if (b) { b.click(); return 'clicked'; } return 'no-view-btn'; })()`
  );
  await sleep(1600);
  const rows = await evaluate(cdp, session, `document.querySelectorAll('tr[data-task-id]').length`);
  return { ok: rows > 0, rows, click: clicked };
}

function interactionAction(kind) {
  switch (kind) {
    case "filter":
      return (cdp, s) => clickByText(cdp, s, "Bộ lọc");
    case "search":
      return (cdp, s) => typeText(cdp, s, 'input[aria-label="Tìm nhiệm vụ"]', "nhiem vu");
    case "detail-open":
      return async (cdp, s) => {
        const sel = await firstExisting(cdp, s, ["tr[data-task-id] td:nth-child(2)", "tr[data-task-id]", 'a[href*="taskId="]']);
        return sel ? clickSelector(cdp, s, sel) : { ok: false, reason: "no-task-row" };
      };
    case "bulk-select":
      return (cdp, s) => clickSelector(cdp, s, "tr[data-task-id] td");
    case "calendar-nav":
      return (cdp, s) => clickSelector(cdp, s, '[aria-label="Tháng sau"]');
    case "command-results":
      return async (cdp, s) => {
        const opened = await clickByText(cdp, s, "Tìm nhanh công việc");
        await sleep(600);
        const input = await firstExisting(cdp, s, [
          '[data-slot="command-palette"] input',
          'input[role="combobox"]',
          "[cmdk-input]",
        ]);
        if (!input) return { ok: false, reason: "palette-input-not-found", opened };
        return typeText(cdp, s, input, "nhiem vu");
      };
    default:
      return null;
  }
}

async function captureScreenshot(cdp, session, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, session);
  fs.writeFileSync(outPath, Buffer.from(data, "base64"));
  return fs.statSync(outPath).size;
}

async function inpSelftest() {
  const { cdp, proxyBase, chromiumBin, teardown } = await bootstrap();
  console.log(`Browser: ${chromiumBin}`);
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await installCollector(cdp, sessionId);
  await setViewport(cdp, sessionId, VIEWPORTS.desktop);
  await navigate(cdp, sessionId, `${proxyBase}/calendar`);
  await sleep(SETTLE);
  await dismissOverlays(cdp, sessionId);
  const result = await measureInteraction(cdp, sessionId, (c, s) =>
    clickSelector(c, s, '[aria-label="Tháng sau"]')
  );
  const report = { cdpInputClick: "Input.dispatchMouseEvent", target: '[aria-label="Tháng sau"]', ...result };
  console.log(JSON.stringify(report, null, 2));
  teardown();
  if (!(result.interactionEntries > 0)) {
    console.error("INP SELFTEST FAILED: no trusted Event Timing entries from CDP-injected input.");
    process.exit(3);
  }
  console.log("INP SELFTEST OK: CDP-injected input produced trusted Event Timing entries.");
  process.exit(0);
}

async function main() {
  if (hasFlag("inp-selftest")) return inpSelftest();

  const vpKeys = VIEWPORT_FILTER === "all" ? Object.keys(VIEWPORTS) : VIEWPORT_FILTER.split(",");
  const routes = ROUTE_FILTER === "all" ? ROUTE_MATRIX : ROUTE_MATRIX.filter((r) => ROUTE_FILTER.split(",").includes(r.key));
  if (!routes.length) throw new Error("no routes selected");

  const { cdp, proxyBase, chromiumBin, base, teardown } = await bootstrap();
  console.log(`Browser: ${chromiumBin}`);
  console.log(`Base:    ${base} (via read-only auth proxy)`);
  console.log(`Label:   ${LABEL}   runs/cell: ${RUNS}   viewports: ${vpKeys.join(",")}`);

  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Network.enable", {}, sessionId);
  await installCollector(cdp, sessionId);

  const results = [];
  const problems = [];
  const shotDir = path.join(PERF_ARTIFACTS, "screenshots", LABEL);

  for (const vpKey of vpKeys) {
    const vp = VIEWPORTS[vpKey];
    if (!vp) throw new Error(`unknown viewport ${vpKey}`);
    await setViewport(cdp, sessionId, vp);
    for (const route of routes) {
      const runs = [];
      const notes = [];
      for (let run = 1; run <= RUNS; run++) {
        try {
          await navigate(cdp, sessionId, `${proxyBase}${route.path}`);
          await sleep(SETTLE);
          await dismissOverlays(cdp, sessionId);
          let setup = null;
          if (route.setup === "tableView") {
            setup = await setupTableView(cdp, sessionId);
            if (!setup.ok) notes.push(`setup(tableView) rows=${setup.rows}`);
          }
          const load = await collectLoadMetrics(cdp, sessionId);
          let interaction = null;
          const action = route.interaction ? interactionAction(route.interaction) : null;
          if (action) {
            interaction = await measureInteraction(cdp, sessionId, (c, s) => action(c, s));
            if (interaction.note) notes.push(`${route.interaction}:${interaction.note}`);
            if (interaction.action && interaction.action.ok === false) notes.push(`${route.interaction}:${interaction.action.reason}`);
          }
          if (SCREENSHOTS && run === 1) {
            const bytes = await captureScreenshot(cdp, sessionId, path.join(shotDir, vp.suffix, `${route.key}.png`));
            if (!bytes) notes.push("empty-screenshot");
          }
          runs.push({
            run,
            lcp: load.lcp,
            cls: load.cls,
            ttfb: load.ttfb,
            fcp: load.fcp,
            inp: interaction ? interaction.latencyMs : null,
            interactionKind: route.interaction || null,
            eventEntries: interaction ? interaction.eventEntries : null,
            interactionEntries: interaction ? interaction.interactionEntries : null,
            collectorErrors: load.errors && load.errors.length ? load.errors : undefined,
          });
        } catch (err) {
          notes.push(`run${run}-error:${err.message}`);
          runs.push({ run, lcp: null, cls: null, ttfb: null, fcp: null, inp: null, error: err.message });
        }
      }
      const inpValues = runs.map((r) => r.inp);
      const cell = {
        route: route.key,
        path: route.path,
        viewport: vpKey,
        viewportPx: vp.suffix,
        interactionKind: route.interaction || null,
        runs: RUNS,
        metrics: {
          LCP: summarize(runs.map((r) => r.lcp)),
          INP: summarize(inpValues),
          CLS: summarize(runs.map((r) => r.cls)),
          TTFB: summarize(runs.map((r) => r.ttfb)),
          FCP: summarize(runs.map((r) => r.fcp)),
        },
        raw: runs,
        notes: notes.length ? notes : undefined,
      };
      if (cell.metrics.LCP.n === 0) problems.push(`${route.key}@${vpKey}: no LCP samples`);
      if (route.interaction && cell.metrics.INP.n === 0) {
        problems.push(`${route.key}@${vpKey}: interaction '${route.interaction}' produced no latency samples`);
      }
      results.push(cell);
      console.log(
        `OK ${route.key}@${vp.suffix} LCP=${fmt(cell.metrics.LCP.p75)} CLS=${fmt(cell.metrics.CLS.p75)} ` +
          `TTFB=${fmt(cell.metrics.TTFB.p75)} INP=${fmt(cell.metrics.INP.p75)} n=${cell.metrics.LCP.n}` +
          (cell.notes ? ` [${cell.notes.join("; ")}]` : "")
      );
    }
  }

  teardown();

  const out = {
    schemaVersion: "1.0.0",
    label: LABEL,
    generatedAt: new Date().toISOString(),
    gitSha: currentGitSha(),
    base,
    runs: RUNS,
    settleMs: SETTLE,
    viewports: vpKeys.map((k) => ({ key: k, ...VIEWPORTS[k] })),
    dataset: {
      taskId: TASK_ID,
      note: "Measured against the live app dataset at capture time; same-data pin = session cookie + canonical route (no legacy ?zone=) + task detail id.",
    },
    methodology: {
      instrument: "raw CDP + in-page buffered PerformanceObserver",
      p75Semantics: "lab p75 = 75th percentile across K repeated lab runs of the same route; NOT the field p75 which is across page loads.",
      inputChannel: "Input.dispatchMouseEvent / dispatchKeyEvent (trusted; in-page synthetic clicks excluded from INP)",
      interactionLatency: "max Event Timing duration of trusted interactions triggered during the cell (no p98 trimming at lab interaction counts)",
    },
    results,
    problems,
  };
  fs.mkdirSync(PERF_ARTIFACTS, { recursive: true });
  const outPath = path.join(PERF_ARTIFACTS, `${LABEL}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Wrote ${path.relative(REPO_ROOT, outPath)} (${results.length} cells)`);
  if (problems.length) console.log(`PROBLEMS (${problems.length}): ${problems.join(" | ")}`);
}

function fmt(v) {
  return v == null ? "n/a" : String(v);
}

main().catch((err) => {
  console.error(`measure fatal: ${err.message}`);
  if (process.env.QCET_PERF_DEBUG) console.error(err.stack);
  process.exit(2);
});
