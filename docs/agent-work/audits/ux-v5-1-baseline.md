# UX V5.1 — Wave 0 Baseline Audit (shard-baseline)

Date: 2026-09-13
Shard: `shard-baseline` (infrastructure)
Owner: qcet-builder
Plan anchors: §8 WAVE 0 — BASELINE; §42 T91 side-by-side; §32 orchestrator steps 1-4; §3 source baseline.
Owned paths: `artifacts/ux-v5-1/baseline/**`, `docs/agent-work/audits/ux-v5-1-baseline.md`, `docs/agent-work/handoffs/BASELINE.md`, `scripts/capture-baseline.mjs`.

## 1. Objective

Capture the Wave 0 immutable baseline (branch/SHA/dirty files/runtime identity) plus
same-data screenshots for every route/state before any code mutation, producing the
before image for the §42 T91 side-by-side harness.

## 2. Immutable baseline (verbatim)

- branch: `main`
- HEAD: `7363c4309007a776269f57cb3058bb64cf059c2e` (Merge branch 'feat/ux-reconstruction-master-v3')
- `log -5`: `7363c430`, `3fdee2e0`, `633f364d`, `4782f013`, `3883e7d0`
- runtime: node `v22.23.2`, npm `10.9.8`, Chromium `152.0.7977.82`
- dirty tree at capture: 107 entries; **54 PRESERVE-ONLY** (every dirty path this lane
  does not own). Full verbatim capture: `artifacts/ux-v5-1/baseline/git-snapshot.txt`.

The preserve-only set explicitly includes the files named by the acceptance criteria
(`src/server/tasks/task-query-service.ts`, `src/app/api/dashboard/overview/route.ts`,
`src/components/dashboard/upcoming-deadlines-widget.tsx`,
`src/components/tasks/table/utils/table-date-helpers.ts`, untracked `src/lib/format/`,
untracked `tests/content-terminology.test.ts`) plus the many other `src/**` / `tests/**`
files other lanes have since modified. None were touched by this lane.

## 3. Required documents read

- `AGENTS.md`, `ARCHITECTURE.md`
- `docs/product/invariants.md`, `docs/product/metrics.md`, `docs/product/roles-and-scopes.md`
- `src/components/tasks/AGENTS.md`, `src/app/api/AGENTS.md`, `tests/AGENTS.md`

Key constraints honoured: Light-Only; Role Is Not Scope (scope is a dataset filter, not
authority); Server Truth Wins (a real authenticated session is required for same-data);
Never Invent Operational Data (no synthesized frames or metrics); Never Claim Unexecuted
Verification.

## 4. DATABASE_URL disposal proof — PASS

`node artifacts/ux-v5-1/baseline/tools/env-probe.mjs` resolved dev DB
`localhost:5432/qcet_eoffice` (NOT disposable) and the `npm test` rewrite to
`localhost:5432/qcet_test?schema=public` (disposable, host local, dbname endsWith `_test`).
`devDbIsDisposable=false`, `testDbIsDisposable=true`. Evidence:
`artifacts/ux-v5-1/baseline/env-disposal-proof.txt`. No full `npm test` was run by this lane.

## 5. Same-data screenshot capture — COMPLETE

Headless Chromium 152 is present and works with `--no-sandbox`. The canonical driver
`scripts/capture-baseline.mjs` logs in via `POST /api/auth/login`, injects `qcet_session`
through the read-only same-origin `tools/auth-proxy.mjs`, drives Chromium over raw CDP
(Node 22 WebSocket/fetch — no Playwright/Puppeteer), and captures both viewports.

Result: **26 frames across 13 states**, exit 0, no fabrication. Verified with `file`
(1440x900 / 390x844 RGB PNGs) and by visual inspection of the interactive states
(table, create-task modal, bulk-selection bar, command palette, offline banner).

First-visit interruption overlays (welcome modal, PWA install prompt) are dismissed
through their own client controls so the primary surface is unobstructed; the read-only
proxy answers every mutating request with 204, so the dataset is never mutated.

Notable, honestly-recorded findings:
- `/tasks` lands in **Kanban** and ignores `?view=table` (hardcoded
  `initialViewMode="kanban"` overrides the URL view — plan P1-01 / T09). `tasks/table`
  is captured via the visible "Bảng" view switcher; `tasks/default` is byte-identical
  to `tasks/kanban`.
- `calendar/create-event` is documented but not in the acceptance list; left as
  NOT CAPTURED (see its `notes.md`).

## 6. Prior-artifact correction

The previous revision of this lane's audit/handoff/`browser-probe.txt` declared the
screenshot work BLOCKED ("no headless browser; zero frames"). That was incorrect: it was
inferred from a script's detection chain rather than a real capture, and contradicted
the real PNGs on disk. It is retracted; the measured host facts and the 26-frame capture
supersede it. The stale `git-snapshot.txt` (10 dirty entries) was likewise regenerated
(107 entries).

## 7. Acceptance criteria disposition

| # | Criterion | Status |
|---|---|---|
| 1 | git/branch/HEAD/log/node/npm + exact dirty list recorded verbatim | PASS |
| 2 | Same-data screenshots @1440x900 & 390x844 for all required states | PASS (26 frames / 13 states) |
| 3 | DATABASE_URL proven disposable before full npm test | PASS |
| 4 | Unrelated dirty files enumerated and marked preserve-only | PASS (54) |
| 5 | No `src/` file modified by this shard | PASS (only owned artifacts + `scripts/capture-baseline.mjs`) |

## 8. Handoff

See `docs/agent-work/handoffs/BASELINE.md`.
