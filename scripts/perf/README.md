# S-PERF — performance lab harness

Owned by shard **S-PERF** (`scripts/perf/**` + `artifacts/ux-v5-1/performance/**`).
Measures the §21 T74 route matrix and T76 interactions, exercises T75 data
volumes, derives §48.1 budgets, and gates them from the existing pipeline.

## Reuse, not fork

The browser pipeline is the Wave-0 baseline pipeline (raw-CDP + the read-only
same-origin cookie proxy). The proxy is **spawned** from
`artifacts/ux-v5-1/baseline/tools/auth-proxy.mjs` — never copied, never edited
(anti-owned). CWV thresholds are **read** from
`src/telemetry/web-vitals.ts` — never redefined.

Browser: `/usr/bin/chromium --headless=new --no-sandbox`. No Playwright/Puppeteer.

## Commands

```bash
# 1. Record the metric baseline (also the "before" screenshots).
#    Screenshots are captured for EVERY label (use --no-screenshots to skip).
#    K=5 runs/cell: the /tasks table-view LCP is run-to-run noisy at K=3.
node scripts/perf/measure.mjs --label=baseline --runs=5 --viewports=all

# 2. Prove the INP pipe (trusted CDP input -> Event Timing entries).
node scripts/perf/measure.mjs --inp-selftest

# 3. Exercise T75 volumes on a disposable DB (+ API route latency).
node scripts/perf/seed-volumes.mjs --api

# 4. Derive §48.1 budgets from the baseline, then ENFORCE the candidate
#    measurement against them, and separately run the integrity self-check.
node scripts/perf/report.mjs --write-budgets
node scripts/perf/check-budgets.mjs                     # enforce candidate vs baseline budgets
node scripts/perf/check-budgets.mjs --integrity         # baseline/budget self-consistency (NOT a regression gate)
node scripts/perf/check-budgets.mjs --results=artifacts/ux-v5-1/performance/candidate.json --advisory

# 5. Candidate run ("after" screenshots) + baseline-vs-candidate delta (§28 Q5).
node scripts/perf/measure.mjs --label=candidate --runs=5
node scripts/perf/report.mjs
```

`check-budgets.mjs` enforces a **measured** artifact (default `candidate.json`)
against budgets derived from the baseline. It fails closed: a missing measurement
is a failure, not a pass. It **refuses** to enforce the budgets' own source
(`baseline.json`) because that comparison is tautological — measured == baseline by
construction — and could never go red (PERF-04); use `--integrity` for the
baseline/budget self-consistency check instead. It honours
`scripts/perf/budget-exceptions.json` (documented, separately-owned pre-existing
breaches, reported as WAIVED and printed) and supports `--advisory` (report-only,
exit 0) and `--no-exceptions` (enforce raw). A **regression-tier** breach is
reported as `VARIANCE` (advisory, printed, not a hard fail) when it cannot
evidence a code defect: either the baseline is a degenerate near-zero value still
within C16 good, or the candidate and baseline were recorded on the **same git
SHA** (no code delta to regress from). The CWV tier stays absolute — a
same-checkout cell over the frozen C16 threshold is a real pre-existing breach and
must be a documented `WAIVED` exception, not VARIANCE.

## Pipeline integration (cross-lane)

`package.json` and root scripts are **Integrator-only** (WORKSTREAMS.json
fallbackRule), so this shard cannot wire the gate into `npm run verify` directly.
See `artifacts/ux-v5-1/performance/CROSS-LANE-REQUEST.md` for the exact request.
Two distinct checks are requested: an enforcing `perf:budget` (candidate
measurement vs baseline-derived budgets — non-vacuous, can go red) and a
deterministic `perf:budget:integrity` (budgets consistent with the recorded
baseline + canonical thresholds). No new CI platform is introduced. This wiring
is tracked as an OPEN handoff, not claimed as done.

R-092 proof items live under `artifacts/ux-v5-1/performance/`: `build.txt`
(production `next build` output) and `screenshots/{baseline,candidate}/` (the
before/after same-data frames).

## Method notes

- Lab p75 ≠ field p75 (see `artifacts/ux-v5-1/performance/METHODOLOGY.md`).
- INP uses real CDP input (`Input.dispatchMouseEvent` / `dispatchKeyEvent`) because
  in-page synthetic clicks emit no `PerformanceEventTiming` entries.
- Load metrics are read from a buffered `PerformanceObserver` collector rather
  than waiting for `visibilitychange`, which a headless CDP page never fires.
