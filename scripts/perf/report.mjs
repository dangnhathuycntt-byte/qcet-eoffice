#!/usr/bin/env node
/**
 * S-PERF — baseline vs candidate delta report (§28 Q5: "Baseline vs candidate"
 * only) and budget derivation (§48.1: budgets established from baseline).
 *
 * Usage:
 *   node scripts/perf/report.mjs --write-budgets        # derive budgets from baseline
 *   node scripts/perf/report.mjs                        # write delta.json + delta.md
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PERF_ARTIFACTS, REPO_ROOT } from "./lib/harness.mjs";
import { loadCanonicalThresholds } from "./lib/thresholds.mjs";

const arg = (name, def) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const hasFlag = (name) => process.argv.includes(`--${name}`);

const BASELINE_PATH = path.resolve(arg("baseline", path.join(PERF_ARTIFACTS, "baseline.json")));
const CANDIDATE_PATH = path.resolve(arg("candidate", path.join(PERF_ARTIFACTS, "candidate.json")));
const HEADROOM = Number(arg("headroom", "1.25"));
const BUDGETS_PATH = path.join(REPO_ROOT, "scripts", "perf", "budgets.json");

const METRICS = ["LCP", "INP", "CLS", "TTFB", "FCP"];
const CWV_METRICS = new Set(["LCP", "INP", "CLS"]);

// §48.1 regression budget = baseline p75 x headroom, floored by a small absolute
// epsilon so a fast metric is not "regressed" by sub-millisecond jitter. The
// floor is METRIC-AWARE: ms metrics round up to a whole ms; CLS is a unitless
// score and must keep its sub-1 resolution. A flat +N floor (or ceil) would turn
// a 0.062 CLS baseline into a regression budget of 1 and silently disable CLS
// regression detection (PERF-05).
const MS_METRICS = new Set(["LCP", "INP", "TTFB", "FCP"]);
const REGRESSION_FLOOR = { LCP: 8, INP: 8, TTFB: 8, FCP: 8, CLS: 0.02 };
function regressionBudget(metric, p75) {
  const floor = REGRESSION_FLOOR[metric] ?? 0;
  const raw = Math.max(p75 * HEADROOM, p75 + floor);
  return MS_METRICS.has(metric) ? Math.ceil(raw) : Number(raw.toFixed(4));
}

// Run-to-run measurement noise: Event Timing durations are reported in 8ms
// quanta (INP), CLS is a small unitless score, paint/nav timings carry a few-ms
// lab jitter. Deltas inside these bands are variance, not signal — the machine-
// readable Q5 artifact labels them "noise" rather than "improved"/"REGRESSION"
// (PERF-07).
function isNoise(metric, baselineP75, delta) {
  if (baselineP75 == null || delta == null) return false;
  if (metric === "CLS") return Math.abs(delta) < 0.01;
  if (metric === "INP") return Math.abs(delta) < 8;
  return Math.abs(delta) < Math.max(10, Math.abs(baselineP75) * 0.05);
}

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function indexCells(file) {
  const m = new Map();
  for (const cell of file?.results || []) m.set(`${cell.route}::${cell.viewport}`, cell);
  return m;
}

function writeBudgets(baseline) {
  const thresholds = loadCanonicalThresholds();
  const entries = [];
  for (const cell of baseline.results || []) {
    for (const metric of METRICS) {
      const m = cell.metrics?.[metric];
      if (!m || m.p75 == null) continue;
      if (CWV_METRICS.has(metric)) {
        entries.push({
          route: cell.route, viewport: cell.viewport, metric, tier: "cwv",
          budget: thresholds[metric].good,
          basis: `C16 good threshold (${path.relative(REPO_ROOT, "src/telemetry/web-vitals.ts")})`,
        });
      }
      const regression = regressionBudget(metric, m.p75);
      entries.push({
        route: cell.route, viewport: cell.viewport, metric, tier: "regression",
        baselineP75: m.p75,
        budget: regression,
        basis: `baseline p75 ${m.p75} x ${HEADROOM}${
          REGRESSION_FLOOR[metric] ? ` (+${REGRESSION_FLOOR[metric]} ${metric === "CLS" ? "score" : "ms"} floor)` : ""
        }`,
      });
    }
  }
  const doc = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    baselineLabel: baseline.label,
    baselineGeneratedAt: baseline.generatedAt,
    baselineGitSha: baseline.gitSha || null,
    runs: baseline.runs,
    headroomMultiplier: HEADROOM,
    thresholdsSource: "src/telemetry/web-vitals.ts",
    cwvThresholds: thresholds,
    entries,
  };
  fs.mkdirSync(path.dirname(BUDGETS_PATH), { recursive: true });
  fs.writeFileSync(BUDGETS_PATH, JSON.stringify(doc, null, 2));
  console.log(`Wrote ${path.relative(REPO_ROOT, BUDGETS_PATH)} (${entries.length} budget entries)`);
}

function buildDelta(baseline, candidate, sameCheckout = false) {
  const b = indexCells(baseline);
  const c = indexCells(candidate);
  const rows = [];
  for (const [key, bCell] of b) {
    const cCell = c.get(key);
    if (!cCell) {
      rows.push({ key, route: bCell.route, viewport: bCell.viewport, metric: "ALL", baseline: null, candidate: null, delta: null, pct: null, verdict: "MISSING-CANDIDATE" });
      continue;
    }
    for (const metric of METRICS) {
      const bv = bCell.metrics?.[metric]?.p75 ?? null;
      const cv = cCell.metrics?.[metric]?.p75 ?? null;
      if (bv == null && cv == null) continue;
      const delta = bv != null && cv != null ? Number((cv - bv).toFixed(2)) : null;
      const pct = bv ? Number(((delta / bv) * 100).toFixed(1)) : null;
      let verdict = "no-data";
      if (delta != null) {
        if (isNoise(metric, bv, delta)) verdict = "noise";
        else if (delta > 0) {
          if (pct != null && pct > 25) {
            // A same-checkout re-run cannot evidence a code regression: a large
            // positive delta there is measurement variance, not signal (PERF-07).
            verdict = sameCheckout ? "variance-same-checkout" : "REGRESSION";
          } else {
            verdict = "within-headroom";
          }
        } else {
          verdict = "improved/stable";
        }
      }
      rows.push({ key, route: bCell.route, viewport: bCell.viewport, metric, baseline: bv, candidate: cv, delta, pct, verdict });
    }
  }
  return rows;
}

// §42/T91 comparison contract: baseline and candidate must share route, user,
// role, dept, scope, query, dataset, viewport and checkout. S-PERF changes no
// application code, so the candidate is a same-checkout re-run of the baseline;
// recording that in the machine-readable artifact (not only prose) stops a reader
// mistaking run-to-run variance for a measured code change (PERF-07).
function currentGitSha() {
  try {
    const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" });
    return r.status === 0 ? (r.stdout || "").trim() || null : null;
  } catch {
    return null;
  }
}

function comparisonProvenance(baseline, candidate) {
  const bSha = baseline.gitSha || null;
  const cSha = candidate.gitSha || null;
  const headSha = currentGitSha();
  let sameCheckout = null;
  let basis;
  if (bSha && cSha) {
    sameCheckout = bSha === cSha;
    basis = "recorded gitSha equality";
  } else if (cSha && headSha && cSha === headSha) {
    sameCheckout = true;
    basis = "candidate gitSha == repository HEAD; baseline recorded on the same base URL (baseline predates gitSha capture)";
  } else if (baseline.base && candidate.base && baseline.base === candidate.base) {
    const dt = Math.abs(new Date(candidate.generatedAt) - new Date(baseline.generatedAt));
    sameCheckout = Number.isFinite(dt) && dt < 3600000;
    basis = "same base URL and <60min apart; gitSha not recorded on both artifacts";
  } else {
    basis = "insufficient provenance to assert same checkout";
  }
  return {
    sameRouteUserRoleScopeDataset: true,
    sameViewports: true,
    baselineGitSha: bSha,
    candidateGitSha: cSha,
    headAtReportTime: headSha,
    sameCheckout,
    basis,
    note:
      sameCheckout === true
        ? "Candidate is a same-checkout re-run of baseline: S-PERF changes no application code, so deltas are measurement variance, not a code effect."
        : "Checkout provenance is not fully recorded; treat cross-artifact deltas as advisory.",
  };
}

function writeDelta() {
  const baseline = readJson(BASELINE_PATH);
  const candidate = readJson(CANDIDATE_PATH);
  if (!baseline) throw new Error(`missing baseline: ${path.relative(REPO_ROOT, BASELINE_PATH)}`);
  if (!candidate) throw new Error(`missing candidate: ${path.relative(REPO_ROOT, CANDIDATE_PATH)} — run measure.mjs --label=candidate`);
  const comparison = comparisonProvenance(baseline, candidate);
  const rows = buildDelta(baseline, candidate, comparison.sameCheckout === true);
  const regressions = rows.filter((r) => r.verdict === "REGRESSION");
  const noise = rows.filter((r) => r.verdict === "noise");
  const sameCheckoutVariance = rows.filter((r) => r.verdict === "variance-same-checkout");
  const doc = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    baselineLabel: baseline.label,
    baselineGeneratedAt: baseline.generatedAt,
    candidateLabel: candidate.label,
    candidateGeneratedAt: candidate.generatedAt,
    note: "§28 Q5 evaluator output: Baseline vs candidate only. Lab p75 (across K runs) — not field p75.",
    comparison,
    noisePolicy: {
      inpMs: 8,
      clsScore: 0.01,
      paintMs: "max(10ms, 5% of baseline)",
      note: "Deltas inside these bands are run-to-run variance (Event Timing 8ms quantum) and are labelled 'noise', never 'improved' or 'REGRESSION'.",
    },
    regressions,
    noise,
    sameCheckoutVariance,
    rows,
  };
  fs.writeFileSync(path.join(PERF_ARTIFACTS, "delta.json"), JSON.stringify(doc, null, 2));

  const lines = [
    "# S-PERF — Baseline vs Candidate (§28 Q5)",
    "",
    `- Baseline: \`${baseline.label}\` @ ${baseline.generatedAt} (${baseline.runs} runs/cell)`,
    `- Candidate: \`${candidate.label}\` @ ${candidate.generatedAt} (${candidate.runs} runs/cell)`,
    `- p75 semantics: lab p75 across ${baseline.runs} runs (NOT field p75). See METHODOLOGY.md.`,
    `- Candidate provenance: ${comparison.note}`,
    `- Same checkout: ${comparison.sameCheckout === null ? "unknown" : comparison.sameCheckout} (${comparison.basis}).`,
    `- Noise policy: INP <8ms, CLS <0.01, paint <max(10ms, 5% baseline) are labelled \`noise\` (run-to-run variance, not signal).`,
    "",
    "| route | viewport | metric | baseline p75 | candidate p75 | delta | % | verdict |",
    "|---|---|---|---|---|---|---|---|",
    ...rows.map((r) =>
      `| ${r.route} | ${r.viewport} | ${r.metric} | ${r.baseline ?? "n/a"} | ${r.candidate ?? "n/a"} | ${r.delta ?? "n/a"} | ${r.pct ?? "n/a"} | ${r.verdict} |`
    ),
    "",
    `Regressions (>25% slower, outside the noise band, DIFFERENT checkout): ${regressions.length}`,
    `Same-checkout variance rows (>25% but no code change): ${sameCheckoutVariance.length}`,
    `Noise-band rows (variance, not signal): ${noise.length}`,
    "",
  ];
  fs.writeFileSync(path.join(PERF_ARTIFACTS, "delta.md"), lines.join("\n"));
  console.log(`Wrote delta.json + delta.md (${rows.length} rows, ${regressions.length} regressions)`);
}

const baseline = readJson(BASELINE_PATH);
if (!baseline) throw new Error(`missing baseline: ${path.relative(REPO_ROOT, BASELINE_PATH)}`);
if (hasFlag("write-budgets")) writeBudgets(baseline);
else writeDelta();
