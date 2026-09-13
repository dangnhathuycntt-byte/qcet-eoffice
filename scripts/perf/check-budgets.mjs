#!/usr/bin/env node
/**
 * S-PERF — performance budget gate (§48.2, fails closed).
 *
 * Compares a MEASURED results artifact against scripts/perf/budgets.json (which
 * is DERIVED FROM the recorded baseline) and FAILS (exit 1) if any cell
 * violates its budget:
 *   - tier "cwv"        : the frozen C16 good threshold, sourced live from
 *                         src/telemetry/web-vitals.ts (never redefined here).
 *   - tier "regression" : baseline p75 + headroom — "no meaningful regression".
 * Missing measurement evidence is a failure (fail closed), never a pass.
 *
 * WHY THE DEFAULT TARGET IS THE CANDIDATE, NOT THE BASELINE
 * --------------------------------------------------------
 * The budgets are derived from baseline.json, so enforcing them against
 * baseline.json itself is tautological: measured == baseline for every cell by
 * construction, every regression-tier check trivially passes, and the gate can
 * never go red on a real change (PERF-04). The gate therefore enforces a
 * DIFFERENT artifact — the candidate measurement — and refuses (exit 1) to
 * enforce the budgets' own source. Use `--integrity` to run the
 * baseline/budget self-consistency check: an integrity check, NOT a regression
 * gate.
 *
 * Intended to be invoked from the EXISTING verification pipeline (npm run
 * verify) via an Integrator cross-lane request — NOT a new CI platform. See
 * artifacts/ux-v5-1/performance/CROSS-LANE-REQUEST.md.
 *
 * Usage:
 *   node scripts/perf/check-budgets.mjs                                    # enforce candidate vs baseline budgets
 *   node scripts/perf/check-budgets.mjs --integrity                        # baseline/budget self-consistency
 *   node scripts/perf/check-budgets.mjs --results=.../candidate.json --advisory
 *   node scripts/perf/check-budgets.mjs --results=... --json
 *   node scripts/perf/check-budgets.mjs --results=... --no-exceptions     # raw result
 *
 * Documented exceptions (scripts/perf/budget-exceptions.json) are known,
 * separately-owned pre-existing breaches; they are reported as WAIVED (never
 * silently dropped) and do not fail the gate. Use `--no-exceptions` to see the
 * raw result.
 *
 * TWO kinds of regression-tier breach are reported as VARIANCE (advisory, never
 * a hard FAIL) because they cannot evidence a code defect:
 *   1. DEGENERATE baseline — a relative budget derived from a near-zero baseline
 *      is meaningless (0 -> 5ms is not a regression), provided the value is still
 *      within the C16 good threshold; and
 *   2. SAME-CHECKOUT re-run — when the results and the budgets' source baseline
 *      were recorded on the SAME git SHA, there is no code delta to regress from,
 *      so a breach is host/run-to-run variance. The CWV tier stays absolute: a
 *      same-checkout cell that breaches the frozen C16 good threshold is still a
 *      real (pre-existing) breach and must be a WAIVED exception, not VARIANCE.
 * Both kinds are printed with the reason, never dropped.
 */
import fs from "node:fs";
import path from "node:path";
import { loadCanonicalThresholds, REPO_ROOT } from "./lib/thresholds.mjs";
import { PERF_ARTIFACTS } from "./lib/harness.mjs";

const arg = (name, def) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const hasFlag = (name) => process.argv.includes(`--${name}`);

const BUDGETS_PATH = path.resolve(arg("budgets", path.join(REPO_ROOT, "scripts", "perf", "budgets.json")));
const INTEGRITY = hasFlag("integrity");
const RESULTS_PATH = path.resolve(
  arg("results", path.join(PERF_ARTIFACTS, INTEGRITY ? "baseline.json" : "candidate.json"))
);
const EXCEPTIONS_PATH = path.resolve(arg("exceptions", path.join(REPO_ROOT, "scripts", "perf", "budget-exceptions.json")));
const AS_JSON = hasFlag("json");
const ADVISORY = hasFlag("advisory");
const NO_EXCEPTIONS = hasFlag("no-exceptions");

if (!fs.existsSync(BUDGETS_PATH)) {
  console.error(`check-budgets: budgets file not found: ${path.relative(REPO_ROOT, BUDGETS_PATH)}`);
  console.error("check-budgets: run `node scripts/perf/report.mjs --write-budgets` first.");
  process.exit(1);
}
if (!fs.existsSync(RESULTS_PATH)) {
  console.error(`check-budgets: results file not found: ${path.relative(REPO_ROOT, RESULTS_PATH)}`);
  process.exit(1);
}

const budgets = JSON.parse(fs.readFileSync(BUDGETS_PATH, "utf8"));
const results = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8"));
const thresholds = loadCanonicalThresholds();

// Same-checkout provenance: if the results artifact and the baseline that the
// budgets were derived from share a recorded git SHA, the comparison is a re-run
// of the SAME software. A regression-tier breach then cannot evidence a code
// regression — it is run-to-run/host variance (mirrors report.mjs PERF-07). The
// CWV tier is unaffected: C16 is an absolute target regardless of checkout.
const sameCheckout =
  typeof budgets.baselineGitSha === "string" &&
  typeof results.gitSha === "string" &&
  budgets.baselineGitSha.length > 0 &&
  budgets.baselineGitSha === results.gitSha;
const sameCheckoutBasis = sameCheckout
  ? `same git SHA ${results.gitSha.slice(0, 12)} as the budgets' source baseline`
  : "different/unknown checkout (or git SHA not recorded on the budgets)";

// ---------------------------------------------------------------------------
// Integrity mode: verify scripts/perf/budgets.json is genuinely DERIVED from the
// recorded baseline it names (regression budget's baselineP75 == baseline cell
// p75; cwv budget == the canonical C16 threshold; every baseline metric covered).
// This is a self-consistency check of the budget artifact, NOT a regression gate:
// it cannot detect an application slowdown, only a corrupted/forged/stale budget
// file. It is the "secondary integrity check" referenced by FILE-HEADER, and it
// is deliberately distinct from the candidate-vs-baseline enforcement below.
// ---------------------------------------------------------------------------
function runIntegrityCheck() {
  const problems = [];
  if (results.label !== budgets.baselineLabel || results.generatedAt !== budgets.baselineGeneratedAt) {
    problems.push(
      `results artifact (${results.label} @ ${results.generatedAt}) is not the budgets' recorded source ` +
        `(${budgets.baselineLabel} @ ${budgets.baselineGeneratedAt})`
    );
  }
  const cells = new Map();
  for (const cell of results.results || []) cells.set(`${cell.route}::${cell.viewport}`, cell);

  const covered = new Set();
  for (const entry of budgets.entries || []) {
    const key = `${entry.route}::${entry.viewport}::${entry.metric}`;
    covered.add(key);
    const cell = cells.get(`${entry.route}::${entry.viewport}`);
    const baseP75 = cell?.metrics?.[entry.metric]?.p75 ?? null;
    if (entry.tier === "cwv") {
      const good = thresholds[entry.metric]?.good;
      if (typeof good !== "number") problems.push(`no canonical threshold for ${entry.metric}`);
      else if (Number(entry.budget) !== Number(good))
        problems.push(`${key} cwv budget ${entry.budget} != canonical ${good}`);
    } else if (baseP75 == null) {
      problems.push(`${key} regression budget has no baseline p75`);
    } else if (Number(entry.baselineP75) !== Number(baseP75)) {
      problems.push(`${key} baselineP75 ${entry.baselineP75} != baseline cell p75 ${baseP75}`);
    }
  }
  for (const cell of results.results || []) {
    for (const metric of ["LCP", "INP", "CLS", "TTFB", "FCP"]) {
      if (cell.metrics?.[metric]?.p75 == null) continue;
      if (!covered.has(`${cell.route}::${cell.viewport}::${metric}`))
        problems.push(`${cell.route}@${cell.viewport} ${metric}: baseline metric has no budget entry`);
    }
  }
  return problems;
}

if (INTEGRITY) {
  const problems = runIntegrityCheck();
  if (AS_JSON) {
    console.log(JSON.stringify({ mode: "integrity", passed: problems.length === 0, problems }, null, 2));
  } else {
    console.log("S-PERF budget integrity check — budgets.json vs recorded baseline + canonical C16 thresholds");
    console.log(`  source baseline : ${budgets.baselineLabel} @ ${budgets.baselineGeneratedAt}`);
    console.log(`  budget entries  : ${budgets.entries?.length ?? 0}`);
    if (problems.length === 0) {
      console.log("\ncheck-budgets: INTEGRITY PASS — budgets are consistent with the recorded baseline.");
    } else {
      console.error(`\ncheck-budgets: INTEGRITY FAIL (${problems.length} inconsistency(ies))`);
      for (const p of problems) console.error(`  - ${p}`);
      process.exit(1);
    }
  }
  process.exit(0);
}

// Circularity guard: enforcing regression budgets derived FROM baseline.json
// against baseline.json itself is tautological (measured == baseline by
// construction). Refuse instead of printing a constant PASS (PERF-04).
if (results.label === budgets.baselineLabel && results.generatedAt === budgets.baselineGeneratedAt) {
  console.error("check-budgets: results artifact IS the baseline the budgets were derived from");
  console.error("check-budgets: (regression-tier checks would be tautological). Point --results at a candidate");
  console.error("check-budgets: measurement, or pass --integrity for the baseline/budget self-check.");
  process.exit(1);
}

const exemptReasons = new Map();
if (!NO_EXCEPTIONS && fs.existsSync(EXCEPTIONS_PATH)) {
  const doc = JSON.parse(fs.readFileSync(EXCEPTIONS_PATH, "utf8"));
  for (const e of doc.entries || []) {
    exemptReasons.set(`${e.route}::${e.viewport}::${e.metric}`, e.reason || "documented exception");
  }
}

const cellIndex = new Map();
for (const cell of results.results || []) {
  cellIndex.set(`${cell.route}::${cell.viewport}`, cell);
}

const failures = [];
const waived = [];
const variance = [];
const rows = [];

// A regression-tier budget derived from a near-zero baseline is degenerate: the
// relative headroom is meaningless, so a same-checkout re-run can "regress" from
// 0 to a value still absolutely good. Such a cell is reported as VARIANCE
// (advisory), never a hard FAIL, provided it is still within the C16 good
// threshold. Real regressions (baseline well above the noise quantum) still FAIL.
function baselineIsDegenerate(metric, baselineP75) {
  if (baselineP75 == null) return false;
  if (metric === "CLS") return baselineP75 <= 0.01;
  if (metric === "INP") return baselineP75 <= 8;
  return baselineP75 <= 10;
}

for (const entry of budgets.entries) {
  const cell = cellIndex.get(`${entry.route}::${entry.viewport}`);
  const measured = cell && cell.metrics && cell.metrics[entry.metric] ? cell.metrics[entry.metric].p75 : null;
  const budget = entry.tier === "cwv" ? thresholds[entry.metric]?.good : entry.budget;
  let status;
  if (measured == null) {
    status = "FAIL";
    failures.push(`${entry.route}@${entry.viewport} ${entry.metric} [${entry.tier}]: no measurement evidence`);
  } else if (typeof budget !== "number") {
    status = "FAIL";
    failures.push(`${entry.route}@${entry.viewport} ${entry.metric} [${entry.tier}]: budget undefined`);
  } else if (measured > budget) {
    const cwvGood = thresholds[entry.metric]?.good;
    const reason = exemptReasons.get(`${entry.route}::${entry.viewport}::${entry.metric}`);
    if (
      entry.tier === "regression" &&
      baselineIsDegenerate(entry.metric, entry.baselineP75) &&
      typeof cwvGood === "number" &&
      measured <= cwvGood
    ) {
      status = "VARIANCE";
      variance.push({ route: entry.route, viewport: entry.viewport, metric: entry.metric, tier: entry.tier, measured, budget, kind: "degenerate-baseline", reason: "regression budget from a near-zero baseline; still within C16 good" });
    } else if (reason) {
      status = "WAIVED";
      waived.push({ route: entry.route, viewport: entry.viewport, metric: entry.metric, tier: entry.tier, measured, budget, reason });
    } else if (entry.tier === "regression" && sameCheckout) {
      // No code delta between the two artifacts, so a relative budget breach is
      // host/run-to-run variance, not a regression signal (PERF-04/PERF-07).
      status = "VARIANCE";
      variance.push({ route: entry.route, viewport: entry.viewport, metric: entry.metric, tier: entry.tier, measured, budget, kind: "same-checkout", reason: sameCheckoutBasis });
    } else {
      status = "FAIL";
      failures.push(`${entry.route}@${entry.viewport} ${entry.metric} [${entry.tier}]: p75=${measured} > budget=${budget}`);
    }
  } else {
    status = "PASS";
  }
  rows.push({ route: entry.route, viewport: entry.viewport, metric: entry.metric, tier: entry.tier, budget, measured, status });
}

if (AS_JSON) {
  console.log(
    JSON.stringify(
      {
        passed: failures.length === 0,
        advisory: ADVISORY,
        resultsLabel: results.label || null,
        passedChecks: rows.length - failures.length - waived.length - variance.length,
        failures,
        waived,
        variance,
        rows,
        thresholdsSource: "src/telemetry/web-vitals.ts",
      },
      null,
      2
    )
  );
} else {
  console.log(
    `S-PERF budget gate — ${results.label || "results"} vs baseline budgets (canonical C16 thresholds from src/telemetry/web-vitals.ts)`
  );
  console.log("route".padEnd(20), "viewport".padEnd(9), "metric".padEnd(5), "tier".padEnd(11), "budget".padEnd(8), "p75".padEnd(9), "status");
  for (const r of rows) {
    console.log(
      r.route.padEnd(20), r.viewport.padEnd(9), r.metric.padEnd(5), r.tier.padEnd(11),
      String(r.budget).padEnd(8), String(r.measured).padEnd(9), r.status
    );
  }
}

if (waived.length) {
  console.log(`\ncheck-budgets: ${waived.length} WAIVED cell(s) — documented pre-existing breach(es), tracked not fixed here:`);
  for (const w of waived) console.log(`  - ${w.route}@${w.viewport} ${w.metric} [${w.tier}]: p75=${w.measured} > budget=${w.budget} — ${w.reason}`);
}

if (variance.length) {
  console.log(`\ncheck-budgets: ${variance.length} VARIANCE cell(s) — regression-tier breach that cannot evidence a code defect (advisory, not a hard fail):`);
  for (const v of variance) console.log(`  - ${v.route}@${v.viewport} ${v.metric} [${v.tier}] (${v.kind}): p75=${v.measured} > budget=${v.budget} — ${v.reason}`);
}

if (failures.length) {
  const line = `\ncheck-budgets: ${ADVISORY ? "ADVISORY" : "FAIL"} (${failures.length} violation(s))`;
  console.error(line);
  for (const f of failures) console.error(`  - ${f}`);
  if (!ADVISORY) process.exit(1);
  console.log("check-budgets: advisory mode — exiting 0 (violations reported, not enforced).");
  process.exit(0);
}
console.log(`\ncheck-budgets: PASS (${rows.length} budget checks, ${results.label || "unknown"} results, ${results.runs} runs/cell)`);
