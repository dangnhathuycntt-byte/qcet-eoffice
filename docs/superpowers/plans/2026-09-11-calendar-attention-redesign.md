# Calendar Attention-First Redesign — Implementation Plan

> Execute with test-first checkpoints. Keep changes on `feat/calendar-attention-redesign`; do not merge to `main` until verification is green.

**Goal:** Make `/calendar` an attention-first operations calendar while preserving QCET academic-cycle semantics, canonical task detail, scope filtering, and server-side authority.

**Architecture:** Extract pure calendar presentation functions for deterministic ranking/summaries. Reuse them in Month Grid and Day Sheet. Persist calendar events through the existing Meeting domain/API instead of introducing a parallel event model. Keep mobile agenda-first and eliminate incomplete ARIA-grid semantics.

**Tech:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4, Prisma/PostgreSQL, Node test runner via `tsx --test`.

---

## Task 1 — Calendar presentation model (TDD)

**Files**
- Create: `src/lib/calendar/calendar-presentation.ts`
- Create: `tests/calendar-presentation.test.ts`

**Steps**
1. Write tests for overdue/waiting/due-today/in-progress/completed ranking, stable tie order, summary counts, and a 161-item density fixture.
2. Confirm the new test is red before implementation.
3. Implement pure ranking/state/summary helpers.
4. Confirm focused/full tests are green.

## Task 2 — Month grid attention surface

**Files**
- Modify: `src/components/calendar/calendar-month-grid.tsx`
- Add regression tests where practical under `tests/`

**Steps**
1. Reuse the presentation helpers for every date bucket.
2. Replace source-order `slice(0, 3)` previews with ranked summaries and max two previews.
3. Show overdue/review counts and explicit `Xem tất cả` drill-down for dense days.
4. Sort agenda items with the same ranking.
5. Replace color-only status dots with text/icon semantics.
6. Remove incomplete ARIA grid roles unless full grid keyboard navigation is implemented.
7. Keep mobile agenda-first.

## Task 3 — Day Sheet action center

**Files**
- Modify: `src/components/calendar/calendar-day-sheet.tsx`

**Steps**
1. Compute summary with canonical helpers.
2. Add quick filters: Attention / Overdue / Waiting / All.
3. Add local search only for high-density days.
4. Sort all lists by attention ranking.
5. Preserve canonical task-detail opening and add-task action.
6. Ensure keyboard/focus and non-color status semantics remain intact.

## Task 4 — Persistent meetings/events through canonical API

**Files**
- Modify: `src/app/calendar/page.tsx`
- Reuse: `src/app/api/meetings/route.ts`
- Reuse: `src/contracts/meeting.ts`
- Reuse: `src/server/services/meeting-service.ts`

**Steps**
1. Fetch meetings for the active academic period from authenticated `/api/meetings` using ISO `from`/`to` bounds.
2. Adapt meeting records to `DayTaskItem` event projections.
3. Replace client-only custom event creation with POST `/api/meetings`.
4. Refetch/reconcile from server after creation; do not treat local state as authority.
5. Do not invent `unitId` from a free-text department name; persist such text only as meeting agenda/context unless a canonical unit id is available.

## Task 5 — Calendar route chrome and terminology

**Files**
- Modify: `src/app/calendar/page.tsx`

**Steps**
1. Remove redundant current-period duplication around the page heading.
2. Rename user-facing `Nghị sự` to `Danh sách` while preserving compatible URL parsing for existing `agenda` values.
3. Keep scope (`Toàn trường / Đơn vị / Của tôi`) separate from query filters.
4. Surface active filters clearly and preserve URL state.

## Task 6 — Verification and review

**Commands / CI gates**
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

**Review checks**
- no unrelated refactors
- no parallel calendar/event engine
- no weakened authorization
- no color-only status
- no partial ARIA grid contract
- high-density day remains summary-first
- new meeting survives reload through server persistence

**Completion:** inspect branch diff against `main`, inspect CI output, then request code review. Do not merge automatically.
