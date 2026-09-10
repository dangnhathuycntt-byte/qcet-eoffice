---
status: superseded
domain: ux
created: 2026-09-09
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Implementation Plan: Task Management Workspace Revamp

**Spec:** `docs/superpowers/specs/2026-09-09-task-management-workspace-spec.md`

## Global Constraints
- **Framework & Routing:** Next.js 15+ App Router, TypeScript Strict Mode.
- **Styling Architecture:** Tailwind CSS v4 (`@import "tailwindcss"` in `src/app/globals.css`), Light-Only Standard with OKLCH colors. Zero `dark:` classes, no `ThemeProvider`, no dark mode blocks.
- **Build & Dev Safety:** Never run `next build` over `.next` during dev server operations. Validate code using:
  ```bash
  npm run typecheck
  npm test
  ```
- **Backward Compatibility Guarantee:** Existing unit tests (`tests/cascading-task-table.test.ts`, `tests/cascading-table-interactions.test.ts`, etc.) must remain 100% green. Maintain `src/components/tasks/cascading-task-table.tsx` and `src/components/dashboard/cascading-task-table.tsx` as facade re-exports if needed.
- **Timezone Safety:** Use `getSystemReferenceDate()` and `isTaskPastDue()` from `@/lib/academic-calendar` instead of hardcoded date strings.

---

### Task 1: Module Foundations - Types, Constants & Core Utilities
- **Goal:** Create the foundational domain types, constants, filter engine, and calculation utilities for the new table architecture.
- **Files to create:**
  - `src/components/tasks/table/types.ts`
  - `src/components/tasks/table/constants.ts`
  - `src/components/tasks/table/utils/table-date-helpers.ts`
  - `src/components/tasks/table/utils/progress-rollup-calc.ts`
  - `src/components/tasks/table/utils/table-filter-engine.ts`
  - `tests/task-table-engine.test.ts`
- **Requirements:**
  - `types.ts`: Define `TaskTableProps`, `SelectionState`, `TableDensity`, `SmartFilterTab`, `ColumnSortState`.
  - `constants.ts`: Define status badges, OKLCH color mappings, default page sizes.
  - `table-date-helpers.ts`: Wrap `getSystemReferenceDate()` and UTC-safe comparison.
  - `progress-rollup-calc.ts`: Weighted progress rollup calculation ($\sum(P_i \times W_i) / \sum W_i$).
  - `table-filter-engine.ts`: Multi-dimensional filtering (dept, category, search query, smart filter pills: `all`, `my_tasks`, `overdue`, `review`, `today`).
  - Unit tests verifying filter accuracy, weighted rollup, and date calculation.
- **Verification:** Run `npm test tests/task-table-engine.test.ts` and `npm run typecheck`.

---

### Task 2: Hooks Layer - URL Synchronization & Keyboard Navigation
- **Goal:** Provide bidirectional URL parameter synchronization and WCAG 2.1 AA keyboard navigation.
- **Files to create:**
  - `src/components/tasks/table/hooks/use-task-url-sync.ts`
  - `src/components/tasks/table/hooks/use-task-keyboard-nav.ts`
  - `src/components/tasks/table/hooks/use-task-table-state.ts`
  - `tests/task-table-hooks.test.ts`
- **Requirements:**
  - `use-task-url-sync.ts`: Synchronize `view`, `tab`, `dept`, `category`, `q`, `page`, `density`, `taskId` via `useSearchParams` and `useRouter` from `next/navigation`.
  - `use-task-keyboard-nav.ts`: Support `j`/`k` or `ArrowDown`/`ArrowUp` roving index, `x`/`Space` selection, `ArrowRight`/`ArrowLeft` subtask toggling, `Enter` detail opening.
  - `use-task-table-state.ts`: Manage pagination, multi-select set, sorting, and row expansion memory.
  - Unit tests verifying URL parameter serialization/deserialization and keyboard navigation reducer.
- **Verification:** Run `npm test tests/task-table-hooks.test.ts` and `npm run typecheck`.

---

### Task 3: Table Presentation Components (Rows, Groups & Pagination)
- **Goal:** Build modular, memoized table components with zero redundant re-renders.
- **Files to create:**
  - `src/components/tasks/table/components/task-table-header.tsx`
  - `src/components/tasks/table/components/task-row.tsx`
  - `src/components/tasks/table/components/subtask-row-group.tsx`
  - `src/components/tasks/table/components/subtask-inline-row.tsx`
  - `src/components/tasks/table/components/task-pagination-bar.tsx`
  - `src/components/tasks/table/components/task-empty-state.tsx`
  - `src/components/tasks/table/components/mobile-task-card.tsx`
- **Requirements:**
  - `task-row.tsx`: Wrapped with `React.memo` using custom comparator. Renders single DRI, DACUM category badge, level badge, SLA date badge, rollup indicator `[x/y]`, and tabular-nums.
  - `subtask-row-group.tsx`: Tree indentation lines connecting child subtasks.
  - `task-table-header.tsx`: Column sorting indicators and tri-state indeterminate checkbox.
  - `mobile-task-card.tsx`: Touch-friendly card view with quick swipe/tap status change.
- **Verification:** Run `npm run typecheck`.

---

### Task 4: Interactive Toolbars - Filter Pills & Floating Bulk Action Dock
- **Goal:** Implement the universal action bar and the floating bulk actions dock.
- **Files to create:**
  - `src/components/tasks/table/components/task-table-toolbar.tsx`
  - `src/components/tasks/table/components/task-bulk-action-bar.tsx`
  - `tests/task-bulk-action-bar.test.ts`
- **Requirements:**
  - `task-table-toolbar.tsx`: Single debounced search input (with `/` and `Cmd+K` shortcuts), Smart Filter Pills (`Tất cả`, `Việc của tôi`, `Quá hạn`, `Chờ duyệt`, `Hôm nay`), Density toggle (`Gọn` / `Chuẩn`), View mode switch (`Bảng` / `Kanban`).
  - `task-bulk-action-bar.tsx`: Floating dock (`fixed bottom-6 inset-x-0 mx-auto w-fit z-40`) appearing when `selectedCount > 0`. Supports batch status update, batch deadline extension, batch reassign, Excel export trigger, and `Esc` key dismissal.
- **Verification:** Run `npm test tests/task-bulk-action-bar.test.ts` and `npm run typecheck`.

---

### Task 5: Core Assembly & Backward-Compatible Facade
- **Goal:** Assemble the complete table into `ModularCascadingTaskTable` and ensure `cascading-task-table.tsx` maintains full backward compatibility.
- **Files to create / update:**
  - `src/components/tasks/table/modular-cascading-task-table.tsx`
  - `src/components/tasks/table/index.ts`
  - `src/components/tasks/cascading-task-table.tsx` (Refactor to facade or bridge)
- **Requirements:**
  - All existing imports of `CascadingTaskTable` work seamlessly.
  - Run all existing table tests (`tests/cascading-task-table.test.ts`, `tests/cascading-table-interactions.test.ts`, etc.) to prove zero regression.
- **Verification:** Run `npm test tests/cascading-*.test.ts` and `npm run typecheck`.

---

### Task 6: Unified Workspace Container & Live API Mutation Wiring
- **Goal:** Create `TaskManagementWorkspace`, wire real API mutations (`useTaskMutations`), and simplify `/tasks` and `/unit-tasks`.
- **Files to create / update:**
  - `src/components/tasks/task-management-workspace.tsx`
  - `src/app/tasks/page.tsx`
  - `src/app/unit-tasks/page.tsx`
  - `src/app/tasks/error.tsx`
  - `src/app/unit-tasks/error.tsx`
- **Requirements:**
  - Eliminate duplicate code between `tasks` and `unit-tasks` (~1,200 lines deduplicated).
  - Status updates and task creations invoke `PATCH /api/tasks/${id}` and `POST /api/tasks` with optimistic updates and error rollback.
  - Wire actual notification dispatch for the "Đôn đốc" action.
  - Add route error boundaries (`error.tsx`) to isolate runtime crashes.
- **Verification:** Run `npm run typecheck` and `npm test`.

---

### Task 7: Full System Verification & End-to-End Regression Test
- **Goal:** Verify the entire codebase passes TypeScript checks and all automated tests across the project.
- **Commands:**
  ```bash
  npm run typecheck
  npm test
  ```
- **Requirements:**
  - 0 TypeScript errors.
  - 100% test pass rate across all suites in `tests/`.
- **Verification:** Final report with test coverage and verification log.
