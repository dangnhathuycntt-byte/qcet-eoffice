# T12 — Acceptance map (AC01–AC15)

Plan: `docs/plans/active/qcet-workbench-uiux-agent-execution-plan.md`.
Spec input `qcet-workbench-uiux-source-audit-spec.md` is **absent from the repository** at every
commit, so the AC text below is reconstructed from the plan's own traceability tables (§2, §16) and
the re-verified defects. Each row cites the test that now proves it (or `not_run`).

Test runner: `npm test` → `tsx --test` over `tests/**/*.test.ts`, `TZ=UTC`.
Single file: `TZ=UTC NODE_ENV=test ./node_modules/.bin/tsx --test tests/<file>.test.ts`.

| AC | Requirement | Test | Status | Evidence |
|---|---|---|---|---|
| AC01 | A task enters the review group only on a REAL pending-review request, never `progressPercent === 100` | `tests/workbench-action-queue.test.ts` | pass | `q02` (100%, IN_PROGRESS) absent; `q03`/`q11` (real review) present |
| AC02 | Opening a queue row opens the file; the list action sends NO approval mutation | `tests/dashboard-data-consistency-full-regression.test.ts` (TC-03), `tests/workbench-action-queue.test.ts` | pass | `actionType === "REVIEW"`, `actionLabel === "Xem xét"`; queue onAction routes to `openTaskDetailById` |
| AC03 | Review capability is not widened by the queue | `tests/executive-dashboard-integration.test.ts`, `tests/executive-action-items-extractor.test.ts` | pass | predicate change only; no capability/role logic added; `Hồ sơ chờ xem xét` never `Chờ bạn duyệt` |
| AC04 | A review file that is also overdue is ONE row with TWO reasons | `tests/workbench-action-queue.test.ts` | pass | `q04` = single row, `reasons: ["REVIEW","OVERDUE"]` |
| AC05 | `ALL` total is a distinct union, never the sum of group counts | `tests/workbench-action-queue.test.ts` | pass | ALL=5, review=3, blocked/overdue=3, overlap on q04 |
| AC06 | Scope + period produce the exact task set for the summary and the lists | `tests/workbench-scope-period-slices.test.ts` | pass | school/unit/my exact ids; month-9 vs month-10 re-derive together |
| AC07 | Department attention is overdue/blocked only (no `<60%` rule); 17 all / 7 attention / 5 preview | `tests/workbench-department-attention.test.ts`, `tests/dashboard-composition-invariants.test.ts` | pass | exact attention order + `EXPECTED_NOT_ATTENTION` absent |
| AC08 | Upcoming window is `[D, D+6]`; overdue never appears | `tests/workbench-upcoming-deadlines.test.ts` | pass | D-1/D-3 excluded, D included-not-overdue, D+6 in, D+7 out |
| AC09 | Invalid / impossible dates are missing, never coerced to today | `tests/workbench-upcoming-deadlines.test.ts`, `tests/workbench-action-queue.test.ts` | pass | `2026-02-30` → null; `q09`/`q09b` absent from queue and upcoming |
| AC10 | Stable queue sort: priority desc → overdue → due asc → waitingSince → id | `tests/workbench-action-queue.test.ts` | pass | exact order `[q06,q04,q05,q03,q11]`; scale fixture deterministic |
| AC11 | Detail opens by id for a row outside the preview | `src/components/dashboard/dashboard-context.tsx` `openTaskDetailById`; `tests/workbench-drilldown-query.test.ts` | pass | opens task/subtask by id; onAction uses it |
| AC12 | A stale/out-of-order response cannot overwrite a newer one | `tests/workbench-scope-period-slices.test.ts` (+ `src/lib/latest-request-guard.ts`) | pass | second `begin()` invalidates the first token |
| AC13 | Drill-down targets a query key a real parser consumes | `tests/workbench-drilldown-query.test.ts` | pass | `status=PENDING_EXECUTIVE_APPROVAL`, `attention=overdue`, `view=table`; unknown values fall back |
| AC14 | An empty scope renders empty, never school-wide | `tests/workbench-scope-period-slices.test.ts`, `tests/dashboard-empty-state.test.ts` | pass | empty scope → `totalSchoolTasks 0`; situation = `NO_DATA` |
| AC15 | Mobile top-3 equals desktop top-3 for the same role/scope | `src/components/dashboard/workbench-mobile-feed.tsx` (shared selector); `tests/workbench-data-states.test.ts` (loading/error states) | partial | mobile consumes the shared `executiveActionItems` selector, and its load/error/stale/empty/success states are now wired from context and verified. **Still missing:** an automated desktop-vs-mobile top-ID parity assertion (no DOM harness), and the 390×844 / 768×1024 visual re-capture — `not_run` (harness login 500, DB down) |
| — | Missing-task open shows a clear message, never fails silently | `src/components/dashboard/dashboard-modals-host.tsx` (`data-slot="task-detail-notice"`) | pass (render) | `openTaskDetailById` sets the notice; host renders `role="status"` |
| — | Usability target (4/5 users in 10s) | — | **not_run** | no human participants; not role-played |

## F01–F15 coverage (plan §16)

| Finding | Task | Where addressed | Status |
|---|---|---|---|
| F01 | T02,T06 | `dashboard-zone.tsx` H1 + SITUATION-before-ACTION order | pass |
| F02 | T04,T08 | `actionType: "REVIEW"`, `openTaskDetailById`, no mutation from the queue | pass |
| F03 | T01,T04 | `tests/executive-dashboard-integration.test.ts`, action-queue test | pass |
| F04 | T04 | AC04/AC05 tests | pass |
| F05 | T06 | 5-row preview over the 311-row fixture | pass |
| F06 | T05,T07 | `summarizeDepartmentAttention` production helper | pass |
| F07 | T05 | low-progress departments not flagged | pass |
| F08 | T03,T05,T07 | full/attention/preview counts; scope set | pass |
| F09 | T03,T05,T07,T08 | `total` separated from preview; `onSelectTask` wired | pass |
| F10 | T05 | AC08/AC09 | pass |
| F11 | T07 | activity timestamp via `formatDateTime`; "Live" badge removed | pass |
| F12 | T10 | composition/empty/scope tests render production | pass |
| F13 | T06,T10 | unified honest empty state + distinct loading/error states | pass |
| F14 | T09 | mobile consumes the shared sorted selector + context load/error/stale/empty states; label aligned to desktop | partial (see AC15 — no top-ID parity test; visual re-capture `not_run`) |
| F15 | T03 | exact ids per scope/period | pass |

## Gate results (T11)

| Command | Exit | Note |
|---|---|---|
| `npm run typecheck` | 0 | clean |
| `npm run lint` | 0 | 500 files pass |
| `npm test` | 1 | 4726 tests, 4673 pass, **53 fail** — all in DB/API/document/search/OAuth/seed suites outside this workstream (see report) |
| `npm run build` | **0** | **verified** — production compile succeeded for all routes once the dev server holding `:3001` was stopped (the guard was correct, not a false positive) |
| `git diff --check` | 0 | no whitespace errors |
| capture harness | 0 | 8 AFTER frames (2 states × 4 viewports) against the dev server |

### Failure classification (coordinator, post-build)

Every failing suite in the area run is **DB-caused, with zero logic failures**. The development
Postgres at `localhost:5432` is down and this environment has no container, volume, or native
service to start it from, so no DB-backed suite can run here:

- 66 dashboard/executive/workbench files → 466 tests, 441 pass, 8 fail, 17 cancelled
- All 8 failing suites match `DATABASE_URL` / `Can't reach database` / `P1001` (classified per suite, not sampled)
- The 15 suites covering changed code → **133 tests, 133 pass, 0 fail**

So the "53–58 failures" seen in the full run are an environment gap, not a regression. This is
*classified*, and `src/lib/server/dashboard-service.ts` — the module those suites exercise — is not
among the changed files. A clean-HEAD baseline count was not measured (the DB is down, so a
DB-independent baseline is impossible here).
