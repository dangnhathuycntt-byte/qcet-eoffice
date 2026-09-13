# Progress — workbench UI/UX remediation

Plan: `docs/plans/active/qcet-workbench-uiux-agent-execution-plan.md`
Branch: `feat/workbench-uiux-remediation` · Start HEAD: `65f99561`
Deliverable dir: `docs/agent-work/workbench-uiux/`

Status vocabulary: `pending / in_progress / done / blocked`. Verification is `not_run` until a
command has actually been executed and its output read — `pass` is never assumed.

| Task | Status | Files | Requirement | Verification | Blocker |
|---|---|---|---|---|---|
| T00 | done | `docs/agent-work/workbench-uiux/baseline.md` | Baseline | 16 frames captured, 4 viewports | — |
| T01 | done | `docs/agent-work/workbench-uiux/contract-map.md` | Contract | every row traced to file:line | — |
| T02 | done | `tests/fixtures/workbench-queue-fixture.ts` | Fixture | fixture counts verified (311/20/17/7); prototype folded into production render | prototype not built as a dev route (not required) |
| T03 | done | `use-task-filters.ts`, `use-dashboard-state.ts`, `use-task-mutations.ts`, `latest-request-guard.ts` | AC06/09/14 | `tests/workbench-scope-period-slices.test.ts` (9 pass) | — |
| T04 | done | `executive-matrix-aggregator.ts` | AC01–05/10 | `tests/workbench-action-queue.test.ts` (21 pass) | — |
| T05 | done | `executive-matrix-aggregator.ts`, `academic-calendar.ts`, `dashboard-situation-strip.tsx` | AC07–10 | `workbench-upcoming-deadlines` (18) + `workbench-department-attention` (8) | — |
| T06 | done | `dashboard-zone.tsx`, `executive-action-center.tsx` | F01/02/05 | render tests + AFTER frames | — |
| T07 | done | `department-attention-preview.tsx`, `upcoming-deadlines-widget.tsx`, `activity-feed-widget.tsx` | F06–11 | render tests + AFTER frames | audit link hidden (no route) |
| T08 | done | `dashboard-context.tsx`, `executive-cockpit-workspace.tsx` | AC11–13 | `tests/workbench-drilldown-query.test.ts` (6 pass) | — |
| T09 | partial | `workbench-mobile-feed.tsx`, `zones/dashboard-zone.tsx`, `dashboard-context.tsx` | AC06/13–15 | shared selector wired; loading/error/stale/empty/success states wired from context + tested (`tests/workbench-data-states.test.ts`, 7 pass); duplicate-tree audit clean; label aligned to desktop | AC15 has no automated desktop/mobile top-ID parity test; visual re-capture (390×844, 768×1024) blocked — DB down, harness login 500 |
| T10 | done | six test files replaced with production render | F12/13 | `dashboard-empty-state`, `dashboard-scope-invariants`, `dashboard-composition-invariants`, `executive-action-center-ui` | — |
| T11 | partial | `artifacts/workbench-uiux/after/**` | Technical + visual | typecheck 0, lint 0, test 4673/4726, diff-check 0 | `npm run build` blocked by dev-server guard; perf check not_run |
| T12 | done | `acceptance.md`, `implementation-report.md` | Handoff | this file set | usability `not_run` (no participants) |

## Current uncommitted state (everything below is on disk, uncommitted)

**Pre-existing user changes — DO NOT touch, DO NOT commit:**
- `M Dockerfile`
- `M docker-compose.yml`

**This workstream's changes (37 modified, 10 untracked files):**
- Engine/data: `src/lib/executive-matrix-aggregator.ts`, `src/lib/academic-calendar.ts`,
  `src/lib/unified-task-hub.ts`, `src/lib/latest-request-guard.ts` (new), `src/hooks/use-task-filters.ts`,
  `src/hooks/use-dashboard-state.ts`, `src/hooks/use-task-mutations.ts`, `src/hooks/use-modal-state.ts`.
- UI: `dashboard-zone.tsx`, `executive-action-center.tsx`, `department-attention-preview.tsx` (new),
  `dashboard-situation-strip.tsx`, `dashboard-context.tsx`, `dashboard-modals-host.tsx`,
  `upcoming-deadlines-widget.tsx`, `activity-feed-widget.tsx`, `executive-cockpit-workspace.tsx`,
  `workbench-mobile-feed.tsx`.
- Tests (new): `workbench-upcoming-deadlines`, `workbench-action-queue`, `workbench-department-attention`,
  `workbench-scope-period-slices`, `workbench-drilldown-query`; (replaced) `dashboard-empty-state`,
  `dashboard-scope-invariants`, `dashboard-composition-invariants`, `executive-action-center-ui`,
  `executive-cockpit-ergonomics`, `system-reference-date-unification`, plus wiring-test updates.
- Fixture: `tests/fixtures/workbench-queue-fixture.ts`.
- Docs: `docs/agent-work/workbench-uiux/{acceptance.md,implementation-report.md}`.
- Artifacts: `artifacts/workbench-uiux/{baseline,after}/**`.

## Checks run (real output read)

| Command | Exit | Result |
|---|---|---|
| `npm run typecheck` | 0 | clean |
| `npm run lint` | 0 | 500 files clean |
| `npm test` | 1 | 4726 tests · 4673 pass · 53 fail (all DB/API suites outside this workstream) |
| `npm run build` | **0** | **verified** — production compile passes; the guard was correct (a real `next-server` held `:3001`) and released once it was stopped |
| `git diff --check` | 0 | clean |
| capture harness (after) | 0 | 8 frames vs dev server |

## Open items / blockers

- **T09 (mobile) partial — remaining gap is AC15 proof, not wiring.** The shared selector, the
  loading/error/stale/empty/success states from context, the duplicate-tree audit and the mobile/desktop
  label alignment are now done (see "W-A…W-E pass" below). What is still missing: an automated test that
  the mobile top-3 IDs equal the desktop top-3 IDs for the same role/scope, and fresh 390×844 / 768×1024
  frames — the capture harness cannot authenticate because the dev Postgres is down.
- **Full-suite failures are a database gap, not a regression.** The dev Postgres at `localhost:5432`
  is down and there is no container, volume or native service here to start it from. Every failing
  suite was classified as DB-caused; see "Final verification run" below.
- **Reference-date decision D1** (unify onto `2026-09-09`) is a real semantic change — see
  `implementation-report.md` §Decisions; user may overrule.

## W-A…W-E pass (last open task, this session)

| Item | Change | Evidence |
|---|---|---|
| W-A | `DashboardDataContextValue` now carries `isLoading` + `errorMessage` sourced from the existing `useTaskMutations` result (no new store/fetch); `dashboard-zone.tsx` forwards both into `ExecutiveActionCenter`; `workbench-mobile-feed.tsx` gates its body on context loading/error and never renders `0` or a health claim before a successful load | `tests/workbench-data-states.test.ts` — 7/7 pass, renders the real `DashboardZone` inside the Next router contexts |
| W-B | mobile quick-stat "Chờ phê duyệt" → "Hồ sơ chờ xem xét", matching the desktop lens | `tests/mobile-workbench-feed.test.ts` — 8/8 pass |
| W-C | duplicate-tree audit: no `useEffect`/`fetch`/listener in either tree; no duplicate DOM `id`/`aria-controls`; both consumers share one context (no double-subscribe). Only residual is the always-mounted CSS-hidden tree (pre-existing) | grep + source audit; `tests/dashboard-data-states` renders both trees |
| W-D | visual re-capture at 390×844 / 768×1024 | **not_run — blocked**: fresh `next dev -p 3001` started, harness login returns `HTTP 500` (`Can't reach database server at localhost:5432`). Server stopped again. No frame captured, none synthesized |
| W-E | this file + `acceptance.md` + `implementation-report.md` updated | this file set |

Commands run this session (+ exit codes):

| Command | Exit | Result |
|---|---|---|
| `npm run typecheck` | 0 | clean |
| `npm run lint` | 0 | 500 source files pass |
| `tsx --test tests/workbench-data-states.test.ts` | 0 | 7 pass · 0 fail |
| `tsx --test tests/mobile-workbench-feed.test.ts` | 0 | 8 pass · 0 fail |
| targeted set (7 files: new + mobile + empty-state + composition/scope/zone) | 0 | 49 pass · 0 fail |
| broader set (dashboard-*, workbench-*, mobile-composition/layout, role-aware) | 1 | 201 tests · 192 pass · 7 fail · 2 cancelled — **all 7 fail on missing `DATABASE_URL`**, none on changed code |
| `capture-baseline.mjs --only=dashboard/home` @390×844,768×1024 | 2 | `login failed: HTTP 500` — DB down; **not_run** |

## Environment facts

- Servers: **:3000 is a stale production `next start`** (serves the pre-change UI). The dev server with
  these changes is **:3001**. Point the harness at it: `QCET_BASE_URL=http://127.0.0.1:3001`.
- DB: local Postgres `qcet_eoffice`; the test runner rewrites it to `qcet_test`.
- Harness: `QCET_BASE_URL=http://127.0.0.1:3001 QCET_CAPTURE_OUT=artifacts/workbench-uiux/after QCET_CAPTURE_VIEWPORTS="1440x900,1280x800,768x1024,390x844" node scripts/capture-baseline.mjs --only=dashboard/home,tasks/table`
- No DOM harness — component tests are real SSR renders via `renderToStaticMarkup`.

## Final verification run (coordinator, build gate released)

| Gate | Exit | Result |
|---|---|---|
| `npm run typecheck` | 0 | clean |
| `npm run lint` | 0 | 500 source files pass |
| `npm run build` | **0** | production compile passes, all routes emitted |
| `git diff --check` | 0 | clean |
| Area suites (66 files) | 1 | 466 tests · 441 pass · 8 fail · 17 cancelled |
| **Changed-code suites (15 files)** | **0** | **133 tests · 133 pass · 0 fail** |

**All 8 failures are DB-caused — none is a logic failure.** Each failing suite was classified
individually against `DATABASE_URL` / `Can't reach database` / `P1001`; every one matched. The
development Postgres at `localhost:5432` is down, and this environment has **no** DB container,
**no** qcet volume and **no** native Postgres service, so no DB-backed suite can run here at all.
`src/lib/server/dashboard-service.ts` — the module those suites exercise — is not a changed file.

A clean-HEAD baseline count was **not** measured: with the DB down, a DB-independent baseline is
impossible. "These failures pre-date the workstream" is therefore *classified*, not *measured*.

### Build gate note

`guard-next-build` was first suspected of false-positiving. It was not — `ss -a` showed a real
`next-server` bound to `*:3001`, a different process from the one the user had stopped. That process
was stopped to release the gate and the build then passed. The guard behaves correctly and was left
unmodified.

## Independent verification (coordinator, after the implementation agent stopped)

Re-run by the coordinating session on the frozen working tree, not taken from the agent's report.

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Area suites (63 files: dashboard/executive/workbench/date) | `tsx --test --test-concurrency=1` | 471 tests · 447 pass · 7 fail · 17 cancelled |
| New workbench suites | 5 files | 62 tests, 0 fail |
| Full suite | `npm test` | 4723 tests · 4643 pass · 58 fail · 22 cancelled |

**The 7 in-area failures are environmental, not regressions.** Every one reports
`error: Environment variable not found: DATABASE_URL` when run outside `npm test`; under
`npm test` the DB-dependent suites fail on database *state* (missing seed rows, missing
`task_title_trgm_idx`), not on assertions. `src/lib/server/dashboard-service.ts` — the module under
test — is **not** among the changed files.

Cause attribution for the whole failure set (checked, not assumed):
- 30 of the 31 failing files reference **no** changed module.
- The single exception, `tests/domain-organization-positions.test.ts`, references
  `academic-calendar`, whose diff is **purely additive** — `git diff src/lib/academic-calendar.ts`
  yields zero removed or modified lines. It fails on the missing `DATABASE_URL`, not on logic.

**Not independently confirmed:** that the same `npm test` failure count existed at HEAD. A
clean-HEAD baseline run was attempted via an isolated `git worktree`, but the setup command was
denied by the permission layer, so the pre-existing count is *argued* (above) rather than *measured*.
Treat "these failures pre-date the workstream" as supported but not proven.

**Verified directly against the hand-written fixture** (not via the agent's summary):

```
order      : q06,q04,q05,q03,q11        == EXPECTED_QUEUE_ORDER
ALL total  : 5 | review: 3 | blocked/overdue: 3 | sum: 6
union-distinct holds: YES (5 != 6, q04 counted once)
q04 reasons: REVIEW+OVERDUE             (one row, two reasons)
q02 present: false                      (100% progress is not a review request)
```

Also confirmed by reading the source: the hardcoded `>Live<` badge is gone (0 occurrences) and
`auditLogHref` now has **no default** — the dead `/tasks?view=audit` link renders only when a real
href is passed; `formatDateTime` replaced the raw ISO print; `openTaskDetailById` exists and is
wired from the queue (`dashboard-zone.tsx:85,109`).

## Remaining gaps found by verification

1. **Mobile/desktop label divergence.** Desktop says "Hồ sơ chờ xem xét"; mobile still renders
   "Chờ phê duyệt" (`workbench-mobile-feed.tsx:378`). Not a rule breach (it does not say "Chờ bạn
   duyệt"), but the same set is named differently on the two surfaces, which T09's meaning-parity
   requirement does not allow.
2. **`npm run build` still `not_run`.** The repo guard blocks `next build` while a dev server holds
   `.next`, and the isolated-worktree workaround was denied by the permission layer. Production
   compilation is therefore **unverified**. `tsc --noEmit` and lint pass, which is not the same check.
3. Minor: the "Xem tất cả" link wraps mid-word at 768px.

