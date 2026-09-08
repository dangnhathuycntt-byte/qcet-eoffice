# Personal Workspace Anti-Slop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `LecturerFocusWorkspace` in `src/components/portal/lecturer-focus-workspace.tsx` to eliminate redundant buttons, consolidate duplicate KPI cards and pill filters into a single-tier interactive toolbar, suppress zero-count noise, and introduce an empathetic Inbox Zero empty state.

**Architecture:** Replace the 5 stacked visual tiers with 2 clean rows: Row 1 holds the personal identity and manual refresh button in the header; Row 2 holds the unified filter toolbar (segmented ownership tabs, embedded compact search input, bulk expand/collapse, and task counter); Row 3 holds the interactive status pills with contract-preserving labels ("Hôm nay cần làm", "Trong tuần này", "Chờ lãnh đạo duyệt", "Cần chỉnh sửa", "Đã hoàn thành"). When zero tasks exist in a state, suppress the `(0)` badge; when all tasks are cleared, display an encouraging Inbox Zero view.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, Lucide Icons, Node.js test runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-09-08-personal-workspace-anti-slop-design.md`

## Global Constraints

- Never run `next build` over `.next` while `next dev` is running (Build rule from CLAUDE.md).
- Strict light-only theme: OKLCH color space, no `dark:` classes or ThemeProvider (Theme rule from CLAUDE.md).
- Preserve contract strings in `src/components/portal/lecturer-focus-workspace.tsx`:
  - User identity tokens: `user.name`, `user.department` (or `user.departmentCode`), and `cleanRoleLabel` / role title.
  - Metric filter labels: `"Hôm nay cần làm"`, `"Trong tuần này"`, `"Chờ lãnh đạo duyệt"`, `"Cần chỉnh sửa"`, `"Đã hoàn thành"`.
  - Filter prefix: `"Lọc trạng thái:"`.
  - Tree connector classes: `"border-l-2 border-primary/20 pl-3 sm:pl-4 ml-1 sm:ml-2 space-y-2.5"`.
  - Bulk toggle labels: `"Thu gọn tất cả"` / `"Mở rộng tất cả"`.

---

### Task 1: Refactor LecturerFocusWorkspace Header and Remove Duplicate Action Buttons

**Files:**
- Modify: `src/components/portal/lecturer-focus-workspace.tsx:730-802`
- Test: `tests/role-based-workspace-workflow.test.ts:862-875`

**Interfaces:**
- Consumes: `user` (AuthUser), `cleanRoleLabel` (string), `onRefresh` (() => void), `isRefreshing` (boolean).
- Produces: Clean, single-tier header without duplicate `+ Tạo việc mới` or `Kho nhiệm vụ ->` buttons.

- [ ] **Step 1: Check existing header test**

Run: `npx tsx --test tests/role-based-workspace-workflow.test.ts`
Expected: PASS

- [ ] **Step 2: Remove redundant buttons and streamline subtitle in header**

In `src/components/portal/lecturer-focus-workspace.tsx`:
- Remove the blue button `Tạo việc mới` (redundant with Topbar's `+ Tạo việc`).
- Remove the outline button `Kho nhiệm vụ` (redundant with Sidebar's `Kho nhiệm vụ`).
- Keep `onRefresh` button (`Làm mới (↻)`).
- Ensure subtitle retains `{cleanRoleLabel}`, `{user.name}`, and `{user.department || user.departmentCode || "Bộ môn"}` separated by `·` dots.

- [ ] **Step 3: Run test to verify compatibility**

Run: `npx tsx --test tests/role-based-workspace-workflow.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/lecturer-focus-workspace.tsx
git commit -m "refactor(workspace): remove redundant header actions and streamline profile banner"
```

---

### Task 2: Consolidate KPI Cards and Pill Filters into a Unified Interactive Status Strip with Zero-Count Suppression

**Files:**
- Modify: `src/components/portal/lecturer-focus-workspace.tsx:803-1205`
- Test: `tests/task-ownership-model.test.ts:684-725`
- Test: `tests/role-based-workspace-workflow.test.ts:876-891`

**Interfaces:**
- Consumes: `summary` (TaskSummaryMetrics), `activeFilter` (TaskFilterType), `handleStatCardClick` / `handlePillClick`, `ownershipFilter`, `setOwnershipFilter`, `searchTerm`, `setSearchTerm`, `allVisibleCollapsed`, `handleToggleAllVisible`.
- Produces: Integrated 2-tier toolbar preserving metric strings ("Hôm nay cần làm", "Trong tuần này", "Chờ lãnh đạo duyệt", "Cần chỉnh sửa", "Đã hoàn thành", "Lọc trạng thái:", "Thu gọn tất cả") with zero-count suppression (`count > 0 ? (count) : null`).

- [ ] **Step 1: Inspect test expectations for status strip and filters**

Verify that tests require:
- `"Hôm nay cần làm"`, `"Trong tuần này"`, `"Chờ lãnh đạo duyệt"`, `"Cần chỉnh sửa"`, `"Đã hoàn thành"`
- `"Lọc trạng thái:"`
- `"Thu gọn tất cả"` / `"Mở rộng tất cả"`

- [ ] **Step 2: Replace the dual KPI-card + Pill block with unified toolbar**

In `src/components/portal/lecturer-focus-workspace.tsx`:
- Replace the huge 5 KPI grid cards and separate redundant pill bar with:
  1. A unified toolbar top row containing:
     - Ownership segmented buttons (`Tất cả`, `Tôi chủ trì (DRI)`, `Tôi tham gia (Phối hợp)`). If count > 0, show count; if 0, suppress count badge.
     - An integrated compact search bar (`w-56 sm:w-64`) with clear button.
     - Bulk collapse toggle button (`Thu gọn tất cả` / `Mở rộng tất cả`).
     - Counter text: `Hiển thị {filteredGroupedTasks.length} / {groupedTasks.length} nhiệm vụ`.
  2. An interactive status filter row:
     - Label: `Lọc trạng thái:`
     - Filter buttons for each category:
       - `Hôm nay cần làm` (mapped to `TODAY`)
       - `Trong tuần này` (mapped to `THIS_WEEK`)
       - `Đang làm` (mapped to `IN_PROGRESS`)
       - `Chờ lãnh đạo duyệt` (mapped to `NEEDS_REVIEW`)
       - `Cần chỉnh sửa` (mapped to `REVISION`)
       - `Đã hoàn thành` (mapped to `COMPLETED`)
     - If count > 0, show `({count})`; if 0, show text only (no zero noise).
     - Show `[Xóa lọc]` button when `activeFilter !== "ALL"`.

- [ ] **Step 3: Run unit tests**

Run: `npx tsx --test tests/task-ownership-model.test.ts tests/role-based-workspace-workflow.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/lecturer-focus-workspace.tsx
git commit -m "refactor(workspace): consolidate KPI cards into unified toolbar with zero-count suppression"
```

---

### Task 3: Implement Empathetic Dual Empty State (Inbox Zero vs Filter Empty) and Run Full QA

**Files:**
- Modify: `src/components/portal/lecturer-focus-workspace.tsx:1206-1240`
- Test: `tests/task-ownership-model.test.ts`
- Test: `tests/role-based-workspace-workflow.test.ts`

**Interfaces:**
- Consumes: `filteredGroupedTasks`, `groupedTasks`, `searchTerm`, `activeFilter`, `ownershipFilter`.
- Produces: Rewarding "Inbox Zero" display when `groupedTasks.length === 0` vs descriptive filter empty state when filtering.

- [ ] **Step 1: Update empty state logic in LecturerFocusWorkspace**

In `src/components/portal/lecturer-focus-workspace.tsx`:
- When `groupedTasks.length === 0 && !searchTerm && activeFilter === "ALL" && ownershipFilter === "ALL"`:
  - Render an "Inbox Zero" card with `CheckCircle2` icon, title "Tuyệt vời! Bạn không có công việc nào tồn đọng", subtitle "Tất cả nhiệm vụ được giao đã hoàn thành hoặc đang chờ phân công mới."
- When `filteredGroupedTasks.length === 0` (due to active search or filter):
  - Render "Không tìm thấy nhiệm vụ nào", descriptive message, and a clean "Xóa bộ lọc & tìm kiếm" button.

- [ ] **Step 2: Run full test suite & TypeScript typecheck**

Run: `npm run typecheck && npm test`
Expected: 0 errors, 100% tests passing.

- [ ] **Step 3: Commit**

```bash
git add src/components/portal/lecturer-focus-workspace.tsx
git commit -m "feat(workspace): implement empathetic inbox zero state and verify full QA"
```
