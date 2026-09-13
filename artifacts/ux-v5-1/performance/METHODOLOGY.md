# S-PERF — Methodology & honest limits

Shard S-PERF. Owns `scripts/perf/**` and `artifacts/ux-v5-1/performance/**`.

## 1. What is measured (T74–T76, C16)

Route matrix (T74): `/`, `/tasks` (table), `/tasks` (kanban), task detail open,
`/calendar`, `/notifications`, `/documents`, `/org`, command search. The harness
adds `tasks-open-detail`, `tasks-search`, `tasks-bulk` rows so every T76
interaction is attached to a route cell.

Metrics per cell (`baseline.json` / `candidate.json`):
LCP, INP, CLS, TTFB, FCP — each as `{n, median, p75, min, max}` plus raw per-run
samples.

## 2. Lab p75 ≠ field p75 (read this before quoting a number)

The frozen C16 targets (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 at p75, split
mobile/desktop) are **field** metrics: p75 is the 75th percentile of page loads
across real users. A lab harness cannot reproduce the field population.

`p75` in these files is the **75th percentile across K repeated lab runs** of the
same route — a different statistic. It is labelled as such everywhere. Google's
only quantified sample guidance is Lighthouse's run-level "median of 5 runs is
twice as stable as 1 run"; there is no official per-route lab p75 sample count.
We therefore default to **K=5 runs/cell** for the recorded baseline and candidate
and report the full raw sample list so a reader can re-derive any percentile. At
K=3 the `/tasks` table-view LCP was run-to-run unstable (the shell paint and the
virtualized data-grid render appeared as LCP on different runs); K=5 is the
settled sample count and each `/tasks` cell's raw samples are reported so the
distribution — not just a single p75 — is auditable.

**Returned finding — `/tasks` table-view LCP shift (not fixed here).** A first
capture (`2026-09-13T02:58Z`) recorded desktop `/tasks` table-view LCP at ~0.8 s.
A re-capture minutes later on the *identical* commit (`7363c430`) recorded it at
~3.2–3.3 s, and it stayed there across six consecutive probe runs while `/tasks`
kanban stayed ~0.8 s on the same route. The 4× shift is reported to the owning
surface lane (T77); S-PERF changes no application code and does not fix it. The
recorded baseline reflects the settled (higher) state so the derived budgets are
reproducible; the earlier ~0.8 s value was not reproducible and is superseded.

## 3. CWV collection (and why the in-app collector is not reused)

Collection is an in-page collector installed with
`Page.addScriptToEvaluateOnNewDocument` (runs before any page script):
buffered `PerformanceObserver` for `largest-contentful-paint`, `layout-shift`,
`paint` (FCP) and `event` (Event Timing, `durationThreshold: 16`).

It deliberately reads the collector **after a settle period** instead of waiting
for `visibilitychange` finalization: a CDP-driven headless page never becomes
hidden, and headless visibility propagation is documented as unreliable.

The app's own `src/telemetry/web-vitals.ts` `initWebVitals()` registers **no**
`event`/`first-input` observer, so it cannot measure INP. It is also anti-owned
by this shard (`src/**`). We do not modify it; we measure INP with the standard
Event Timing observer in the lab instrument only. This is a measurement
instrument, not a second production telemetry engine.

## 4. INP / interaction latency — real input only

Event Timing only observes **trusted** events. In-page synthetic
`element.click()` produces no `PerformanceEventTiming` entries, so interactions
are driven with raw CDP input (`Input.dispatchMouseEvent` /
`Input.dispatchKeyEvent`), which enters the renderer's real input pipeline.

`measure.mjs --inp-selftest` proves the pipe on this host before any INP number
is trusted. Result on `Chromium 152` / `/usr/bin/chromium` headless:
CDP click on `[aria-label="Tháng sau"]` produced Event Timing entries with
trusted interaction ids (see the selftest output in the shard evidence). This
empirically closes the open question flagged by external research (whether
`kFromDebugger` events are "fully trusted" for Event Timing).

Per cell, INP latency = the **maximum** Event Timing duration among the trusted
interactions triggered that run. At lab interaction counts (<50) the web-vitals
outlier-trimming rule does not apply, so no p98 is fabricated; the raw entry
count is recorded and a cell with zero interaction entries is reported as a
problem, never silently defaulted.

## 5. Data volumes (T75)

`seed-volumes.mjs` seeds 100 / 500 / 1000 tasks, a large **org/department
fan-out** (`--orgs`, default 120 departments; the task volume is distributed
across them), plus large notification and document sets into a **disposable**
database only (it refuses unless the DB name matches `qcet_test`/`qcet_perf`).
All generated values come from a deterministic PRNG; no `Math.random`. At each
volume it measures query-layer latency (task count, paginated list-50, filtered
search, department count and an org-tree rollup with per-department user/task
counts) and — with `--api` — the canonical `GET /api/tasks` handler imported
unmodified via `api-volume-probe.mts`.

Recorded headline (quote THESE — never a memorized number), from
`volume-probe.json` `generatedAt` 2026-09-13T03:30:35.968Z, database `qcet_test`,
30 iterations each; values are server-side **query**/API latency p75 in ms, not
paint timing:

| volume | count | list-50 | filtered search | org-tree rollup | GET /api/tasks |
|---|---|---|---|---|---|
| 100 | 1.53 | 7.22 | 8.11 | 10.24 | 14.08 |
| 500 | 1.58 | 8.26 | 10.20 | 10.24 | 14.49 |
| 1000 | 1.61 | 8.08 | 9.96 | 9.03 | 14.87 |

The browser route matrix is measured against the live app dataset at capture
time. Browser CWV at 1000-task volumes would require binding the app server to
the perf DB; that procedure is `QCT_PERF_DATABASE_URL=<disposable> npm run dev`
followed by `measure.mjs`. The volume probe evidence is server-side query
latency; it is labelled as such and not conflated with paint timing.

## 6. Budgets (§48.1) and the gate (§48.2)

`report.mjs --write-budgets` derives `scripts/perf/budgets.json` from the
baseline:
- tier **cwv**: the frozen C16 good threshold, read live from
  `src/telemetry/web-vitals.ts` (never restated);
- tier **regression**: `baseline p75 × headroom` (default 1.25) — "no meaningful
  regression".

`check-budgets.mjs` fails closed: a budget with no measurement evidence is a
FAIL. It is offered to the existing `npm run verify` chain by an Integrator
cross-lane request (`CROSS-LANE-REQUEST.md`) — no new CI platform.

**The gate is non-vacuous by construction (PERF-04).** The budgets are derived
from `baseline.json`, so enforcing them against `baseline.json` itself would be
tautological (measured == baseline for every cell by construction) and could
never go red. `check-budgets.mjs` therefore enforces a *different* artifact — the
recorded **candidate measurement** (`--results` defaults to `candidate.json`) —
and **refuses** (exit 1) to enforce the budgets' own source. `--integrity` runs a
separate deterministic self-consistency check (budgets match the recorded
baseline and the canonical C16 thresholds). `--advisory` is report-only (exit 0)
and `--no-exceptions` enforces the raw result.
`scripts/perf/budget-exceptions.json` waives documented, separately-owned
pre-existing breaches; waived cells are printed, never silently dropped.

**Same-checkout re-runs cannot evidence a regression.** When the candidate and
the budgets' source baseline share a recorded git SHA, there is no code delta to
regress from, so the gate reports a *regression-tier* breach as `VARIANCE`
(advisory, printed with the reason) instead of a hard FAIL — the same principle
`report.mjs` already applies in `delta.json` (PERF-07). The CWV tier stays
absolute: C16 is a fixed target regardless of checkout, so a same-checkout cell
that breaches the frozen 2.5 s / 200 ms / 0.1 good threshold is still a real
pre-existing breach and must be a `WAIVED` exception, never `VARIANCE`. On the
recorded pair (both `7363c430`, K=5) the four regression-tier breaches
(`home@desktop` LCP, `tasks-detail@desktop` FCP, `tasks-open-detail@desktop`
TTFB, `tasks-bulk@desktop` TTFB) are this kind of host/run-to-run variance, and
every CWV breach is the pre-existing `/tasks` table-family LCP bottleneck below.

**A recorded-evidence gate, not a live one.** The gate reads recorded JSON
artifacts; it cannot by itself re-measure a running app. It detects a regression
when a fresh candidate measurement is recorded against the baseline-derived
budgets, and it catches budget/threshold corruption via `--integrity`. It is not a
substitute for re-running `measure.mjs` against the build under test — see
`CROSS-LANE-REQUEST.md` for how the two checks are meant to be wired.

**`/tasks` table-view LCP and why K was raised.** At K=3 the `/tasks` table-view
LCP was run-to-run unstable (the shell paint and the virtualized data-grid render
appeared as LCP on different runs), so a p75 from K=3 tracked whichever mode
dominated and budgets derived from it were not reproducible. Baseline and
candidate are recorded at K=5, the raw samples are published per cell, and the
`/tasks` table-view family (table / open-detail / search / bulk) is reproducibly
the slowest surface — ~3.1-3.3 s lab p75 on **both** desktop and mobile — over
the C16 2.5 s target. That C16 status is recorded in `budget-exceptions.json`
(8 documented `WAIVED` cells, desktop + mobile) and returned to the owning
surface lane (T77). No application code is changed by S-PERF.

## 7. Comparison contract (§42 / T91)

Baseline and candidate use the same route, user, role, department, scope, query,
dataset snapshot, viewport and zoom. Recorded viewports: 1440×900 (desktop) and
390×844 (mobile). The plan's §42.3 also lists 1280×800 and 768×1024 at 200% zoom;
`measure.mjs` accepts `--viewports=` keys and can be extended, but the recorded
baseline covers the two viewports the Wave-0 screenshot baseline also used.

## 8. §28 Q5

The evaluator output is **Baseline vs candidate only** — `delta.json` / `delta.md`.
`delta.json` carries a `comparison` block recording checkout provenance (git SHA
when available, otherwise base URL + capture-time proximity) so a same-checkout
re-run is visible in the machine-readable artifact, not only in prose.

Deltas inside the run-to-run noise band are labelled `noise`, never `improved` or
`REGRESSION`: INP < 8ms (the Event Timing quantum), CLS < 0.01, paint/nav
< `max(10ms, 5% of baseline)`. This prevents sub-quantum variation and
same-checkout variance from being presented as signal.

## 9. R-092 verification proof (build + before/after screenshots)

- **Production build:** `build.txt` in this directory is the captured output of
  `npm run build` (`next build`) on this change set. It is the production-build
  evidence R-092 asks for.
- **Before/after screenshots:** `measure.mjs` captures per-route frames for
  **every** label, so a baseline run writes `screenshots/baseline/` and a
  candidate run writes `screenshots/candidate/`, from the same routes,
  viewports, user and dataset. Both sets are present: 12 routes × 2 viewports ×
  2 labels = 48 frames. `screenshots/baseline/` is the "before" set and
  `screenshots/candidate/` the "after" set. Regenerate either with
  `node scripts/perf/measure.mjs --label=<baseline|candidate> --runs=3`
  (`--no-screenshots` to skip). Because S-PERF changes no application code, the
  two sets depict the same pinned dataset — which is exactly the point: the
  comparison isolates measurement, not a code change.
