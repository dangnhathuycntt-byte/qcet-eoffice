# T12 — Implementation report (workbench UI/UX remediation)

Plan: `docs/plans/active/qcet-workbench-uiux-agent-execution-plan.md`.
Branch `feat/workbench-uiux-remediation`. Everything below is **uncommitted**.

## Decisions (user-overridable)

| # | Decision | Rationale |
|---|---|---|
| D1 | **Unified the system reference date onto `2026-09-09`** (the canonical `src/lib/academic-calendar.ts` value) and made `src/lib/unified-task-hub.ts#getSystemReferenceDate` delegate to it. Previously `unified-task-hub` pinned a second, drifting `2026-09-06`. | The canonical date module (rules 22/40) is the single source; the app already renders 09/09/2026. This is a **real semantic change** to overdue boundaries. `tests/system-reference-date-unification.test.ts` was rewritten to assert the new behaviour (not deleted). Revert instructions: if production intends `2026-09-06`, set `NEXT_PUBLIC_REFERENCE_DATE` and re-point the two helpers. |
| D2 | Queue labels are "Xem xét" / "Xem chi tiết" and "Hồ sơ chờ xem xét"; never "Phê duyệt"/"Chờ bạn duyệt". | The dashboard payload cannot prove the actor is the designated approver (contract-map §Review divergence). No server authorization changed. |
| D3 | Dropped the ActionQueueShell from the dashboard queue and render a plain section. | The shell showed a false "Hoàn thành" badge at zero and swallowed the loading/error/empty distinctions behind `totalCount > 0`. |
| D4 | Hid the activity "Nhật ký" audit link instead of repointing it. | No audit route exists under `src/app` and `view=audit` is not a valid view mode. Recorded as a gap (plan T07.7). |

## Files changed

Engine / data:
- `src/lib/executive-matrix-aggregator.ts` — new `extractExecutiveActionItems` (one row per task, reasons accumulated, real review predicate, strict-overdue, no BGH fallback), `selectExecutiveActionQueue`, `compareExecutiveActionItems`, `matchesExecutiveFilter`, `summarizeDepartmentAttention`; removed `progressPercent === 100` from the review predicate in `computeExecutiveActionStats` and `filterTasksByExecutive`.
- `src/lib/latest-request-guard.ts` (new) — latest-request-wins guard.
- `src/hooks/use-task-filters.ts` — `computeDashboardSlices` (one scope+period set for stats/queue/health), normalized `referenceDate`, removed the raw-`tasks` widening fallback.
- `src/hooks/use-dashboard-state.ts` — threads `referenceDate` into the filter hook.
- `src/hooks/use-task-mutations.ts` — stale-response guard on overview fetches.
- `src/hooks/use-modal-state.ts`, `src/components/dashboard/dashboard-context.tsx` — `openTaskDetailById` + `taskDetailNotice`; `DashboardDataContextValue` exposes `isLoading` + `errorMessage` from the existing `useTaskMutations` result (no new store or fetch).
- `src/lib/unified-task-hub.ts` — delegates the reference date to the canonical module.

UI:
- `src/components/dashboard/zones/dashboard-zone.tsx` — single H1 "Bàn làm việc", no role badge/subtitle/hardcoded unit count; SUMMARY before ACTION; department preview; full upcoming/activity lists; forwards the context `isLoading`/`errorMessage` into `ExecutiveActionCenter` so its error/loading branches are reachable in the real app.
- `src/components/dashboard/executive-action-center.tsx` — rewrote the queue: three lens chips with predicate counts, 5-row preview, no expand-all, no nested scroll, neutral row buttons, distinct loading/error/empty states, working drill-down.
- `src/components/dashboard/department-attention-preview.tsx` (new) — compact top-5 attention preview + exact empty sentence.
- `src/components/dashboard/dashboard-situation-strip.tsx` — attention uses the production helper (no `<60%`).
- `src/components/dashboard/dashboard-modals-host.tsx` — renders the not-found notice.
- `src/components/dashboard/upcoming-deadlines-widget.tsx` — `total` separated from preview; dead `filter=upcoming` link removed.
- `src/components/dashboard/activity-feed-widget.tsx` — shared `formatDateTime`, "Live" badge removed, audit link hidden, "thời gian thực" copy fixed.
- `src/components/dashboard/executive-cockpit-workspace.tsx` — `filter=pending` → `status=PENDING_EXECUTIVE_APPROVAL`; `strokeWidth`.
- `src/components/dashboard/workbench-mobile-feed.tsx` — executive urgent list consumes the shared sorted selector; consumes the context loading / error / stale / empty / success states (never renders `0` or a health claim before a successful load); quick-stat label aligned to the desktop "Hồ sơ chờ xem xét".

Tests (new): `workbench-upcoming-deadlines`, `workbench-action-queue`, `workbench-department-attention`, `workbench-scope-period-slices`, `workbench-drilldown-query`, `workbench-data-states`.
Tests (replaced, not deleted): `dashboard-empty-state`, `dashboard-scope-invariants`, `dashboard-composition-invariants`, `executive-action-center-ui`, `executive-cockpit-ergonomics`, `system-reference-date-unification`, `role-aware-workbench`, `dashboard-zone-dynamic-units`, `dashboard-zone-monthly`, `dashboard-prior-backlog-banner`, `mobile-workbench-feed`, `dashboard-zone-reactivity`, `executive-components`, `dashboard-zone`, `ux-accessibility-gates`, `dashboard-data-consistency-full-regression`, `executive-action-items-extractor`, `executive-dashboard-integration`.

Docs / artifacts:
- `docs/agent-work/workbench-uiux/{acceptance.md,implementation-report.md,progress.md}`
- `artifacts/workbench-uiux/after/**` (8 frames; baseline dir untouched).

## Behaviour changes

- Review queue is driven by real pending-review status, not progress 100.
- One row per task with all reasons; `ALL` is a union.
- Plain `IN_PROGRESS` tasks are no longer in the dashboard queue (STRATEGIC rule dropped from the queue only; the type member remains for other consumers).
- Unresolvable department shows "Chưa xác định đơn vị" (no BGH fallback).
- Department attention = overdue/blocked only.
- Dashboard summary/queue/health derive from one scope+period set; empty scope stays empty.
- One system reference date.

## Gate output

| Command | Exit | Result |
|---|---|---|
| `npm run typecheck` | 0 | clean |
| `npm run lint` | 0 | 500 files clean |
| `npm test` | 1 | 4726 tests · 4673 pass · **53 fail** |
| `npm run build` | blocked | repo guard: dev server holds `.next`; **not_run** |
| `git diff --check` | 0 | clean |

The 53 failures are all in DB/API/document/search/OAuth/seed suites (`Search API`, `Document Registry`,
`Google OAuth`, `Phase 6 documents`, `FTS`, `BOLA/IDOR`, `Seed Data`, document/file/task API hardening,
`Task Code Generator`, `Single DRI`, etc.). None import a file changed by this workstream; running them
directly shows `Environment variable not found: DATABASE_URL` / missing `qcet_test` provisioning. This
workstream took the count from 64 → 53 by repairing every failure it caused. These 53 were **not**
compared against a pre-change baseline (baseline.md did not run the full suite).

## Visual evidence

`artifacts/workbench-uiux/after/dashboard/home/baseline.{1440x900,1280x800,768x1024,390x844}.png`
plus `tasks/table/*` (8 frames). The harness must target the **dev server** (`QCET_BASE_URL=http://127.0.0.1:3001`);
`127.0.0.1:3000` is a stale long-running production `next start` and still serves the pre-change UI.

What I saw at 1440×900 (vs baseline):
- Single H1 "Bàn làm việc" — the role badge, duplicated subtitle and "16 đơn vị trực thuộc" are gone.
- The compact summary ("30% tiến độ · 142 nhiệm vụ") now sits **above** the queue.
- Queue shows three lens chips with counts ("Tất cả 1 / Hồ sơ chờ xem xét 1 / Vướng mắc & Trễ hạn 0"),
  one real row with a reason badge and a neutral "Xem xét" button.
- "Đơn vị cần chú ý" reads exactly "Không có đơn vị có việc quá hạn hoặc bị chặn trong phạm vi này".
- "Hạn chót 7 ngày tới" separates total from preview ("Top 5 / 20", badge 20).
- No medals, no long colour bars, no 3-mode toolbar, no nested scroll region on the dashboard.

At 390×844 the mobile feed consumes the same queue (row "NV-2026-09-002" from the executive set).

## Final pass (W-A…W-E, last open task)

| Item | Result | Evidence |
|---|---|---|
| W-A load/error wiring | done | `DashboardDataContextValue` gained `isLoading`/`errorMessage` from `useTaskMutations`; `dashboard-zone.tsx` forwards them; mobile gates its body. `tests/workbench-data-states.test.ts` renders the real `DashboardZone` (inside the Next router contexts, like `tests/workspace-query.test.ts`) and the real `WorkbenchMobileFeed`, and fails if the forwarding is removed. 7/7 pass |
| W-B label divergence | done | mobile "Chờ phê duyệt" → "Hồ sơ chờ xem xét"; `tests/mobile-workbench-feed.test.ts` 8/8 pass |
| W-C duplicate-tree audit | clean | neither tree has an effect/fetch/listener; no duplicate DOM `id`/`aria-controls`; one shared context. Residual: the CSS-hidden tree still mounts on every render (pre-existing; left as-is) |
| W-D visual 390×844 / 768×1024 | **not_run** | fresh `next dev -p 3001` started; `capture-baseline.mjs` login → `HTTP 500`, server log `Can't reach database server at localhost:5432`. No frame captured; none synthesized. Server stopped |
| W-E records | done | this file, `progress.md`, `acceptance.md` |

Commands this session: `npm run typecheck` → 0; `npm run lint` → 0 (500 files);
`tsx --test tests/workbench-data-states.test.ts` → 0 (7 pass);
`tsx --test tests/mobile-workbench-feed.test.ts` → 0 (8 pass);
targeted 7-file set → 0 (49 pass); broader dashboard/workbench/mobile set → 1
(192 pass, 7 fail, all `Environment variable not found: DATABASE_URL`);
`capture-baseline.mjs --only=dashboard/home` → 2 (login HTTP 500).

## Remaining blockers / not done

- **W7 mobile is partial**: shared selector, context load/error/stale/empty/success states, duplicate-tree
  audit and label alignment are done. Missing: an automated desktop/mobile top-ID parity test (AC15) and
  fresh 390×844 / 768×1024 frames (harness login 500, DB down).
- **Visual re-capture (`W-D`) not_run** — the CDP harness cannot authenticate without the database.
- **`npm run build` not_run at the time of first report** (dev-server guard); it was later verified green
  by the coordinator. Visual acceptance does not depend on it.
- **T11 performance check not_run** (no profiler baseline captured).
- **T12 usability not_run** (no human participants).
- `tasks/table` first capture attempt hit a CDP timeout on one viewport; re-captured cleanly.
