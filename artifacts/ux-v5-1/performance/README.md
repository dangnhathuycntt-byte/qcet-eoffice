# S-PERF evidence — performance baseline, budgets, Q5 evaluation

Shard S-PERF. Tooling lives in `scripts/perf/**` (see its README).

| File | What it is |
|---|---|
| `baseline.json` | Recorded metric baseline: T74 route matrix + T76 interactions, LCP/INP/CLS/TTFB/FCP, per cell `{n, median, p75, min, max}` + raw runs. |
| `candidate.json` | Same schema, produced by `measure.mjs --label=candidate`. |
| `delta.json` / `delta.md` | §28 Q5 output: Baseline vs candidate only, plus regressions. |
| `volume-probe.json` | T75 seeded 100/500/1000 tasks + org/department fan-out + notifications/documents; server-side query/API latency. |
| `perf-probe.json` | Ad-hoc K=6 `/tasks` table-vs-kanban LCP stability probe (raw per-run LCP published) supporting the K=5 sample-count change in `METHODOLOGY.md` §2. |
| `screenshots/baseline/` | Per-route same-data "before" frames (12 routes x 2 viewports). |
| `screenshots/candidate/` | "After" frames from a candidate run of the same routes/viewports/dataset (regenerate with `measure.mjs --label=candidate`). |
| `build.txt` | Captured `npm run build` (production `next build`) output — R-092 build proof. |
| `METHODOLOGY.md` | How metrics are collected, lab-vs-field caveat, budget derivation, noise policy, build/screenshot proof. |
| `CROSS-LANE-REQUEST.md` | OPEN handoff: wire the budget gate into `npm run verify`. |

## Reproduce

```bash
node scripts/perf/measure.mjs --inp-selftest     # prove the INP pipe
node scripts/perf/measure.mjs --label=baseline --runs=5 --viewports=all --screenshots
node scripts/perf/measure.mjs --label=candidate --runs=5                 # candidate ("after" frames + Q5 delta)
node scripts/perf/seed-volumes.mjs --api
node scripts/perf/report.mjs --write-budgets
node scripts/perf/report.mjs                                            # delta.json / delta.md
node scripts/perf/check-budgets.mjs                                     # enforce candidate vs baseline budgets
node scripts/perf/check-budgets.mjs --integrity                         # baseline/budget self-consistency
```

## Reading the numbers

Every `p75` here is a **lab p75 across K runs**, not a field p75. Do not compare
these to CrUX/field figures. Report deltas as candidate-vs-baseline on the same
host and dataset. See `METHODOLOGY.md` §2.
