# Cross-lane request — wire the S-PERF budget gate into the existing pipeline

**From:** shard S-PERF (`scripts/perf/**`, `artifacts/ux-v5-1/performance/**`)
**To:** Integrator (`shard-int-integration`) — owns `package.json` and root scripts
**Rule:** WORKSTREAMS.json `fallbackRule` — shared/root/config files are Integrator-only.
**Status:** OPEN — the gate is NOT wired yet (handoff tracked here per PERF-04).

## What S-PERF cannot do itself

`scripts/perf/check-budgets.mjs` is ready and fails closed, but it is not invoked
by `npm run verify` (= `typecheck && lint && test`) because `package.json` is
outside this shard's ownership. §48.2 requires budget checking be wired into the
**existing** verification/build pipeline — explicitly *not* a new CI platform.

## The gate is non-vacuous by construction (fixes PERF-04)

`scripts/perf/budgets.json` is DERIVED FROM `baseline.json` (the regression tier
is `baseline p75 × 1.25`). Enforcing those budgets against `baseline.json` itself
would be **tautological** — measured == baseline for every cell by construction —
so every regression-tier check would trivially pass and the gate could never go
red on a real change. An earlier revision of this request did exactly that and was
therefore self-defeating; it is corrected here. The gate now:

1. enforces a **different** artifact — the recorded **candidate measurement**
   (`--results` defaults to `candidate.json`); and
2. **refuses** (exit 1) to enforce the budgets' own source, pointing the caller at
   `--integrity` instead.

`--integrity` is the deterministic self-consistency check (budgets match the
recorded baseline and the canonical C16 thresholds). It is an integrity check,
NOT a regression gate, and it never depends on a fresh lab run, so it is safe to
append to `verify`.

## Requested change (exact, minimal)

Add two scripts to `package.json`:

```json
"perf:budget": "node scripts/perf/check-budgets.mjs",
"perf:budget:integrity": "node scripts/perf/check-budgets.mjs --integrity"
```

and append the deterministic integrity check to `verify`:

```json
"verify": "npm run typecheck && npm run lint && npm test && npm run perf:budget:integrity"
```

`perf:budget` is the enforcing regression gate: it compares the committed
candidate measurement against the baseline-derived budgets and exits non-zero on
any over-budget, non-exempt cell or missing evidence. Because it reads a recorded
candidate artifact rather than re-measuring a live app, it is a
**recorded-evidence** regression gate, not a live one — wire it where a fresh
`candidate.json` exists (`npm run perf:budget`), and keep `perf:budget:integrity`
(the run-independent check) in the always-on `verify`.

## Behavior

- PASS (exit 0): every cell's lab p75 is within its CWV budget (C16) and its
  regression budget (baseline p75 × headroom), ignoring documented exceptions.
- FAIL (exit 1): any over-budget, non-exempt cell **or any missing measurement**
  (fail closed), or an attempt to enforce the budgets' own source baseline.
- VARIANCE (exit 0, printed): a regression-tier breach that cannot evidence a
  code defect — a degenerate near-zero baseline still within C16 good, or a
  same-checkout re-run (candidate and baseline share a recorded git SHA, so there
  is no code delta to regress from). The CWV tier is never VARIANCE.
- `--integrity` (exit 0/1): budgets are consistent with the recorded baseline and
  the canonical C16 thresholds.
- Exceptions (exit 0, still printed): cells in `budget-exceptions.json`. Pass
  `--no-exceptions` to enforce the raw result.
- Thresholds are read live from `src/telemetry/web-vitals.ts`; none are restated.
- No network/browser needed at gate time — it reads the recorded JSON artifacts.

## Known over-budget cells (returned to the owning lane, not hidden)

The `/tasks` table-view family (table, open-detail, search, bulk) exceeds the C16
LCP budget (≤ 2.5 s) on this lab host — **8 cells** across desktop and mobile — in
**both** the baseline and the candidate recorded back-to-back at K=5. This is a
pre-existing surface bottleneck, not a regression introduced by this shard (which
changes no application code), and each cell is recorded as a documented exception
in `scripts/perf/budget-exceptions.json` — printed by the gate as `WAIVED`, never
silently dropped. It is returned to the owning surface lane per T77. Every other
cell in the candidate is within budget; the only other non-PASS rows are
same-checkout regression-tier VARIANCE rows (printed), which cannot evidence a
code defect (see the Behavior section).

## Optional: regenerate

```bash
node scripts/perf/measure.mjs --label=baseline --runs=5                # CWV baseline (+ screenshots)
node scripts/perf/measure.mjs --label=candidate --runs=5               # candidate (+ screenshots)
node scripts/perf/report.mjs --write-budgets                           # §48.1 budgets
node scripts/perf/report.mjs                                           # delta.json / delta.md (§28 Q5)
node scripts/perf/seed-volumes.mjs --api                               # T75 volumes (disposable DB)
```

## Not requested / out of scope

- Any change to `src/**` or `tests/**` (perf findings per T77 return to the owning
  lane; this shard does not fix application code).
- A new CI service or dashboard.
- Fixing the `/tasks` LCP bottleneck — that returns to the owning surface lane;
  S-PERF only records and waives it.
