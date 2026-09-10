# QCET E-Office: Workstream Ownership Matrix (Gate G0 Frozen Baseline)

**Date**: 2026-09-10  
**Status**: APPROVED, FROZEN & IMMUTABLE (Gate G0)  
**Concurrency Rule**: Strict disjoint file ownership across all 7 parallel lanes (F1-F4, P1-P3). No two lanes may edit the same file. Cross-lane file edits are strictly prohibited.

---

## 0. Integrator & Gate G0 Frozen Contracts (Immutable During Wave 1)

These contract and governance specifications are frozen at Gate G0 and may NOT be modified by any feature or foundation lane during Wave 1:
- `src/contracts/workspace-semantic.ts` (Canonical workspace semantic contract and public interface stubs)
- `docs/agent-work/UI_SEMANTIC_CONTRACT.md` (Formal semantic specification)
- `docs/agent-work/OWNERSHIP.md` (This file)
- `docs/agent-work/WORKSTREAMS.json` (Machine-readable lane definitions)

Any lane requiring a contract revision must record the request in its handoff document (`docs/agent-work/handoffs/<LANE>.md`) for integrator evaluation at Gate G1.

---

## 1. Disjoint Workstream File Boundaries

### F1 — Canonical Task Semantics & Attention Resolver
- **Primary Responsibility**: Domain types, canonical status mappers, attention resolution engine.
- **Owned Files**:
  - `src/domain/tasks/canonical-semantics.ts`
  - `src/domain/tasks/attention-resolver.ts`
  - `src/domain/tasks/mappers.ts`
  - `tests/domain-task-semantics.test.ts`

### F2 — Workspace URL/State & Query Engine
- **Primary Responsibility**: URL synchronization, searchParams normalization, browser history coordination.
- **Owned Files**:
  - `src/lib/workspace-query.ts`
  - `src/hooks/use-workspace-query.ts`
  - `tests/workspace-query.test.ts`

### F3 — Shared Workspace UI Primitives
- **Primary Responsibility**: Shared Carbon/WCAG-compliant UI primitives for toolbars, switchers, metric strips.
- **Owned Files**:
  - `src/components/workspace/scope-switcher.tsx`
  - `src/components/workspace/period-selector.tsx`
  - `src/components/workspace/workspace-toolbar.tsx`
  - `src/components/workspace/status-filter.tsx`
  - `src/components/workspace/view-switcher.tsx`
  - `src/components/workspace/metric-strip.tsx`
  - `src/components/workspace/attention-badge.tsx`
  - `src/components/workspace/action-queue-shell.tsx`
  - `tests/workspace-primitives.test.ts`

### F4 — Invariant & Cross-Domain Test Harness
- **Primary Responsibility**: Regression assertions, count invariants, URL stability, a11y checks.
- **Owned Files**:
  - `tests/workspace-semantic-invariants.test.ts`
  - `tests/workspace-count-invariants.test.ts`
  - `tests/workspace-ui-invariants.test.ts`

### P1 — Tasks Page Migration
- **Primary Responsibility**: `/tasks` page, single primary CTA, Kanban 85-task delta fix, Table/Kanban view switch, eliminating redundant "Của tôi".
- **Owned Files**:
  - `src/app/tasks/page.tsx`
  - `src/app/tasks/tasks-page-client.tsx`
  - `src/components/tasks/task-kanban-board.tsx`
  - `src/components/dashboard/unified-task-toolbar.tsx`
  - `src/components/workspace/unified-adaptive-workspace.tsx`

### P2 — Calendar Migration
- **Primary Responsibility**: `/calendar` page, density aggregation (max 3 + overflow), single global CTA, month/agenda view switch, day detail panel.
- **Owned Files**:
  - `src/app/calendar/page.tsx`
  - `src/components/calendar/calendar-month-grid.tsx`
  - `src/components/calendar/calendar-day-sheet.tsx`
  - `src/lib/academic-calendar.ts`

### P3 — Dashboard Migration
- **Primary Responsibility**: `/dashboard` & `/` page, eliminate duplicate KPI cards, fix denominator mixing in `computeDepartmentHealthMatrix`, fix naive strategic task counting, strip synthetic data in `workbench-mobile-feed.tsx`.
- **Owned Files**:
  - `src/app/dashboard/page.tsx`
  - `src/components/dashboard/executive-action-center.tsx`
  - `src/components/dashboard/executive-stat-strip.tsx`
  - `src/components/dashboard/workbench-mobile-feed.tsx`
  - `src/components/dashboard/smart-workbox.tsx`
  - `src/lib/executive-matrix-aggregator.ts`

---

## 2. Shared Invariant Rule
Any agent discovering that another agent's file needs adjustment must report the requirement via their handoff document instead of editing that file directly. Integrator will mediate.
