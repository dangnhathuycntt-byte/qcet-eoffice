---
status: active
domain: ux
created: 2026-09-09
supersedes:
  - 2026-09-04-qcet-uiux-sync.md
  - 2026-09-04-twenty-style-dashboard.md
  - 2026-09-06-executive-header-redesign-plan.md
  - 2026-09-06-role-adaptive-cockpit-plan.md
  - 2026-09-06-role-based-ux-revamp-plan.md
  - 2026-09-06-scrollbar-modernization-plan.md
  - 2026-09-06-two-tier-sidebar-navigation-layout.md
  - 2026-09-06-ui-ux-anti-slop-redesign.md
  - 2026-09-07-dual-rail-navigation-architecture-plan.md
  - 2026-09-07-executive-cockpit-redesign-plan.md
  - 2026-09-07-mobile-first-pwa-plan.md
  - 2026-09-07-role-based-ux-simplification-plan.md
  - 2026-09-07-single-tier-sidebar-scope-switcher-plan.md
  - 2026-09-07-ui-ux-ergonomics-typography-redesign-plan.md
  - 2026-09-07-uiux-typography-ergonomics-plan.md
  - 2026-09-08-anti-slop-ui-quick-wins-plan.md
  - 2026-09-08-linear-grade-mobile-pwa-plan.md
  - 2026-09-08-login-ux-jargon-detox.md
  - 2026-09-08-mobile-uiux-antislop-remediation-plan.md
  - 2026-09-08-personal-workspace-anti-slop-plan.md
  - 2026-09-08-remove-dark-theme-plan.md
  - 2026-09-08-unified-adaptive-workspace-plan.md
  - 2026-09-08-unified-mobile-pwa-and-menu-architecture-plan.md
  - 2026-09-09-ban-lam-viec-uiux-antislop-plan.md
  - 2026-09-09-ban-lam-viec-workbench-2-plan.md
  - 2026-09-09-executive-dashboard-antislop-ux-plan.md
  - 2026-09-09-header-contextual-scoping-refactor.md
  - 2026-09-09-linear-plane-workspace-and-calendar-redesign.md
  - 2026-09-09-mobile-interaction-architecture-and-sprints-plan.md
  - 2026-09-09-navigation-ux-redesign-plan.md
  - 2026-09-09-role-scope-navigation-and-unassigned-department-plan.md
  - 2026-09-09-scope-filter-and-data-consistency-plan.md
  - 2026-09-09-single-dri-subtask-hierarchy-personal-view.md
  - 2026-09-09-task-management-workspace-plan.md
  - 2026-09-09-workspace-calendar-ux-redesign.md
---

# QCET E-Office — Master UI/UX Consolidation Plan

## Global Constraints
- **Next.js App Router**: Maintain client/server boundaries, server components compatibility, and clean hydration.
- **Tailwind CSS v4 & Light-Only Standard**: Strictly light mode (OKLCH color system), zero dark mode classes (`dark:`), no `.dark` selectors, no `ThemeProvider`.
- **Zero Breakage / Backward Compatibility**: Preserve existing business logic (DACUM competencies, Separation of Duties, Prisma schemas, RBAC permissions, document registries, calendar events).
- **Single Source of Truth**: One canonical route per major capability (`/` for Workbench, `/tasks` for Task Workspace, `/calendar`, `/documents`, `/org`, `/notifications`).
- **Separation of Concerns**: Role (staff, manager, executive) determines permissions & priorities; Scope (`school`, `unit`, `my`) determines visibility filter. Never conflate Role with Scope. Do not render unauthorized scope options.
- **Verification**: `npm run typecheck` and `npm test` must pass after each task without regressions.

---

## Task 1: Canonical Routes and IA Alignment (Phase 1)

### Objective
Enforce `/tasks` as the sole canonical Task Workspace reading `?scope=school|unit|my`, make `/` the role-aware Workbench ("Bàn làm việc"), and establish automatic canonical redirects for `/unit-tasks`, `/?zone=tasks`, and `/dashboard`.

### Scope & Files
- `src/app/page.tsx`
- `src/app/tasks/page.tsx`
- `src/app/unit-tasks/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/lib/navigation/canonical-navigation-registry.ts`
- `src/components/navigation.tsx`
- `src/components/app-sidebar.tsx`

### Requirements
1. In `src/app/page.tsx`:
   - If query parameter `zone=tasks` is detected, cleanly redirect or navigate to `/tasks` preserving remaining params (`scope`, `month`, `status`, etc.).
   - `/` serves strictly as the Workbench ("Bàn làm việc").
2. In `src/app/unit-tasks/page.tsx`:
   - Redirect to `/tasks?scope=unit`.
3. In `src/app/dashboard/page.tsx`:
   - Redirect to `/` (Workbench) to avoid competing dashboards.
4. In `src/app/tasks/page.tsx`:
   - Mount the canonical task workspace reading `scope` (`school` | `unit` | `my`) from URL search params.
5. In `src/lib/navigation/canonical-navigation-registry.ts` and sidebar navigation:
   - "Bàn làm việc" points to `/`.
   - "Nhiệm vụ" points to `/tasks`.
   - Remove legacy navigation pointers to `/unit-tasks` or `/?zone=tasks`.

### Verification
- `npm run typecheck`
- `npm test` verifying canonical routes and redirect behaviors.

---

## Task 2: Single Unified Task Workspace Engine (Phase 2)

### Objective
Consolidate `UnifiedAdaptiveWorkspace` and `TaskManagementWorkspace` into a single task workspace implementation that eliminates duplicate interaction models.

### Scope & Files
- `src/components/workspace/unified-adaptive-workspace.tsx`
- `src/components/tasks/task-management-workspace.tsx`
- `src/components/workspace/hooks/use-adaptive-workspace-data.ts`
- `src/components/tasks/table/modular-cascading-task-table.tsx`
- `src/components/tasks/cascading-task-table.tsx`
- `src/components/dashboard/cascading-task-table.tsx`

### Requirements
1. Unify the state and data pipeline into `UnifiedAdaptiveWorkspace`:
   - Integrate `useAdaptiveWorkspaceData` (handling data, SoD, approval authority, scope filtering).
   - Use `ModularCascadingTaskTable` as the single table engine.
2. Re-export or forward `TaskManagementWorkspace` to the unified implementation so `/tasks` and legacy consumers use the single unified engine.
3. Turn `components/dashboard/cascading-task-table.tsx` and `components/tasks/cascading-task-table.tsx` into thin compatibility shims forwarding to `ModularCascadingTaskTable`.
4. Ensure Table and Kanban view switching work seamlessly on the unified dataset.

### Verification
- `npm run typecheck`
- `npm test` verifying task workspace data flow and rendering.

---

## Task 3: Unified Task Toolbar & URL Synchronization (Phase 3 & Phase 5)

### Objective
Eliminate duplicate toolbars between workspace and table. Create a single `UnifiedTaskToolbar` combining Scope, Search, Smart Quick Filters, Advanced Filter Popover, and View Mode, with full URL parameter synchronization.

### Scope & Files
- `src/components/tasks/unified-task-toolbar.tsx`
- `src/components/tasks/table/components/task-table-toolbar.tsx`
- `src/components/tasks/table/modular-cascading-task-table.tsx`
- `src/components/workspace/unified-adaptive-workspace.tsx`
- `src/hooks/use-task-filters.ts`

### Requirements
1. Single Toolbar Surface:
   - Row 1:
     - Scope Switcher: `[Toàn trường] | [Đơn vị] | [Của tôi]`. Only render options authorized for current user's role (do NOT render disabled buttons for unauthorized scopes).
     - Search input: `[Tìm nhiệm vụ... /]` with `/` keyboard focus shortcut.
     - Primary action: single `[+ Giao việc]` or `[+ Tạo nhiệm vụ]` button.
   - Row 2:
     - Smart Filter Pills: `Tất cả (count)` | `Của tôi (count)` | `Chờ duyệt (count)` | `Quá hạn (count)` | `Hôm nay (count)`.
     - Controls: `[Bộ lọc (count)]` popover (combining Department, Category, Priority, Month), View Switcher `[Bảng | Kanban]`, Density selector `[Gọn | Chuẩn]`.
2. Delete inner duplicate toolbar in `ModularCascadingTaskTable`:
   - Remove redundant second search, category tabs, and department selectors from the table.
3. URL Parameter Sync:
   - Sync `scope`, `dept`, `status`, `month`, `q`, `view`, `taskId` to URL search params.
   - Refreshing or sharing URL preserves exact filter and selection state.

### Verification
- `npm run typecheck`
- `npm test` verifying URL synchronization and single toolbar rendering.

---

## Task 4: Full-Width Task Canvas and Adaptive Detail Surface (Phase 4)

### Objective
Eliminate the rigid 60/40 desktop split cockpit. Provide a full-width task canvas (100% width) and an adaptive detail surface that only appears when a task is selected.

### Scope & Files
- `src/components/workspace/unified-adaptive-workspace.tsx`
- `src/components/dashboard/task-detail-side-sheet.tsx`
- `src/components/tasks/table/modular-cascading-task-table.tsx`

### Requirements
1. Full-Width Task Canvas:
   - When no task is selected, the task list occupies 100% width of the canvas.
   - Remove the permanent 33–40% action queue column from the default workspace view.
2. Adaptive Detail Presentation:
   - Desktop ≥ 1440px: list-detail composition (Table ~65–70%, Detail pane ~30–35%) or side sheet.
   - Desktop/tablet 768–1439px: Side sheet overlay (520–560px) with backdrop.
   - Mobile < 768px: Full-screen detail surface or bottom sheet.
3. Selection and URL:
   - Selecting a task sets `?taskId=NV-...` in URL.
   - Closing detail (`Esc`, backdrop, or close button) clears `taskId` from URL.

### Verification
- `npm run typecheck`
- `npm test` testing selection, drawer opening, and keyboard Esc dismissal.

---

## Task 5: Task Row Simplification & Bulk Action Floating Bar (Phase 5 & Phase 7)

### Objective
Drastically reduce visual noise in table rows: clear hierarchy, maximum 1 contextual CTA per row, secondary actions in overflow menu (`...`), and floating bulk action bar that appears only when items are checked.

### Scope & Files
- `src/components/tasks/table/components/task-row.tsx`
- `src/components/tasks/table/modular-cascading-task-table.tsx`
- `src/components/tasks/table/components/batch-action-bar.tsx`

### Requirements
1. Prioritized Row Columns:
   - Selection Checkbox
   - Nhiệm vụ (Code & Title, clear subtask indicator)
   - Đơn vị (Department tag)
   - DRI (single clean avatar / initials + name)
   - Tiến độ (compact progress bar + percentage)
   - Hạn (SLA formatted date, highlighted if overdue)
   - Trạng thái (single clear scanning status badge)
   - Actions (contextual CTA if required + `...` dropdown menu)
2. Row Interaction Rules:
   - Entire row is clickable to open detail.
   - Remove clutter: no default inline buttons like `+Dựng việc con`, `Đôn đốc`, `Chỉnh sửa`, `Phân công` on every row.
   - Only tasks in `WAITING_APPROVAL` display an inline `[Duyệt]` action if the user holds approval authority.
3. Floating Bulk Actions:
   - Only appears when `selectedCount > 0`: `[☑ N nhiệm vụ được chọn] [Đổi trạng thái] [Giao lại] [Gia hạn] [Xuất] [Esc Bỏ chọn]`.
   - Disappears immediately upon unchecking all or pressing `Esc`.

### Verification
- `npm run typecheck`
- `npm test` verifying row actions, click-to-select, and bulk bar visibility.

---

## Task 6: Executive Dashboard Streamlining & Attention Queue (Phase 6)

### Objective
Streamline the executive dashboard to fit within 1–2 viewports: 5-KPI strip, top 5–7 attention queue, unit ranking list with progress, and direct click-throughs to `/tasks`.

### Scope & Files
- `src/components/dashboard/executive-stat-strip.tsx`
- `src/components/dashboard/department-progress-matrix.tsx`
- `src/components/dashboard/upcoming-deadlines-widget.tsx`
- `src/components/dashboard/activity-feed-widget.tsx`
- `src/components/dashboard/executive-cockpit-workspace.tsx`

### Requirements
1. Single 5-KPI Strip:
   - `Tổng nhiệm vụ`, `Chờ duyệt`, `Trễ / vướng`, `Trọng tâm`, `Tiến độ toàn trường`.
   - High data density, no repetitive decorative cards.
2. Attention Queue:
   - 5–7 critical items requiring executive decision/action.
   - Direct click-through to `/tasks?taskId=...` or quick approval action.
3. Unit Ranking:
   - High-density list of departments with progress bars, completed/overdue counts.
   - Clicking a department navigates directly to `/tasks?scope=school&dept=<deptId>`.
4. Compact Deadlines & Activity:
   - Top 5 upcoming deadlines with "Xem tất cả" link to `/tasks?filter=upcoming`.
   - Compact activity feed with link/drawer for detailed audit log.

### Verification
- `npm run typecheck`
- `npm test` verifying KPI calculations, department ranking, and navigation links.

---

## Task 7: Role-Aware Home Workbench ("What Needs My Attention?") (Phase 7)

### Objective
Standardize `/` as the personal "What needs my attention?" hub (aligned with Linear/Plane 'Your Work'), adapting content priorities cleanly by role without separate UI architectures.

### Scope & Files
- `src/app/page.tsx`
- `src/components/dashboard/personal-workbench.tsx`
- `src/components/workspace/smart-workbox.tsx`

### Requirements
1. Role-Adaptive Content:
   - **Staff**: Tasks today, upcoming deadlines, my submissions awaiting review, today's schedule, unread notifications.
   - **Manager**: Pending unit approvals, at-risk unit tasks, unit progress breakdown, staff workload distribution.
   - **Executive**: School-wide approvals, critical roadblocks, executive KPIs, unit ranking.
2. Smart Workbox Integration:
   - Quick filter counters: `[Của tôi (N)]`, `[Chờ tôi duyệt (N)]`, `[Chờ nộp báo cáo (N)]`, `[Quá hạn (N)]`.
   - Clicking any item navigates to `/tasks` with the pre-filtered scope/status.
3. Clean Height:
   - Fit within 1–2 viewports on desktop, eliminating infinite vertical scrolling.

### Verification
- `npm run typecheck`
- `npm test` testing Workbench rendering for Staff, Manager, and Executive users.

---

## Task 8: Mobile-First Composition, Task Cards & 44px Touch Targets (Phase 8)

### Objective
Implement mobile adaptive UX (< 768px): 4-tab bottom navigation, card-based task list instead of wide horizontal table, bottom sheet filters, and ≥ 44px touch targets.

### Scope & Files
- `src/components/navigation/mobile-bottom-nav.tsx`
- `src/components/tasks/mobile-task-card.tsx`
- `src/components/tasks/table/modular-cascading-task-table.tsx`
- `src/components/tasks/unified-task-toolbar.tsx`

### Requirements
1. 4-Tab Bottom Navigation:
   - Fixed at viewport bottom:
     - 1. Bàn làm việc (`/`)
     - 2. Nhiệm vụ (`/tasks`)
     - 3. Văn bản (`/documents`)
     - 4. Thêm (`/more` or slide-over drawer for Calendar, Org, Settings).
2. Mobile Task Cards:
   - On screens < 768px, render stacked `MobileTaskCard`:
     - Status badge & priority, task title & code, department, DRI name/avatar, deadline, progress bar.
     - Entire card tap opens full-screen or bottom-sheet detail.
3. Mobile Filters:
   - Filter button opens Bottom Sheet rather than overflowing horizontal toolbar.
4. Touch Ergonomics:
   - Interactive targets ≥ 44px × 44px (buttons, tabs, inputs, checkboxes).

### Verification
- `npm run typecheck`
- `npm test` verifying mobile viewport rendering, touch target dimensions, and 4-tab bottom nav.

---

## Task 9: Operations Calendar Unified Task Interaction (Phase 9)

### Objective
Align `/calendar` with the unified task interaction model: clicking calendar events linked to tasks opens `TaskDetailSideSheet` seamlessly, with desktop 7-column grid and mobile agenda view.

### Scope & Files
- `src/app/calendar/page.tsx`
- `src/components/calendar/calendar-workspace.tsx`
- `src/components/dashboard/task-detail-side-sheet.tsx`

### Requirements
1. Unified Detail Surface:
   - When a calendar event corresponds to a task (`taskId` present), clicking it opens `TaskDetailSideSheet` (updating URL `?taskId=...`).
   - Events without tasks open a lightweight event detail popup/sheet.
2. Responsive Layout:
   - Desktop (≥ 768px): Full-width 7-column calendar grid with month/week/day views.
   - Mobile (< 768px): Agenda list view prioritized over cramped 7-column grid.
3. URL and Context:
   - Navigating between calendar and task workspace preserves date and task selection.

### Verification
- `npm run typecheck`
- `npm test` verifying calendar task clicks and agenda mode on mobile.

---

## Task 10: Saved Views Infrastructure (Phase 10)

### Objective
Provide user-savable and role-preset task views (combining scope, filters, layout, and sorting) with localStorage / session persistence.

### Scope & Files
- `src/lib/saved-views/saved-views-store.ts` (or state hook)
- `src/components/tasks/saved-views-selector.tsx`
- `src/components/tasks/unified-task-toolbar.tsx`

### Requirements
1. Role Presets:
   - Executive: `★ Chờ BGH duyệt`, `★ Trễ hạn toàn trường`, `★ Nhiệm vụ trọng tâm`.
   - Manager: `★ Chờ tôi duyệt`, `★ Việc đơn vị`, `★ Quá hạn đơn vị`.
   - Staff: `★ Việc của tôi`, `★ Hạn tuần này`.
2. Custom Saved Views:
   - Allow users to save current active filter combination as a custom named view.
   - Store custom views in browser storage.
   - Selecting a view updates URL search params and toolbar state.

### Verification
- `npm run typecheck`
- `npm test` testing preset views and custom view creation/restoration.

---

## Task 11: Command Palette & Keyboard Ergonomics (Phase 11)

### Objective
Enhance command search into a full Command Palette (`Cmd+K` / `Ctrl+K`) and enable keyboard navigation (`/`, `J/K`, `Enter`, `Esc`).

### Scope & Files
- `src/components/command-search-modal.tsx`
- `src/components/tasks/table/modular-cascading-task-table.tsx`
- `src/hooks/use-keyboard-navigation.ts`

### Requirements
1. Command Palette (`Cmd+K` / `Ctrl+K`):
   - Fast search across tasks, documents, navigation routes, and quick actions (`Tạo nhiệm vụ`, `Xem việc chờ duyệt`, `Đổi sang Của tôi`).
2. Keyboard Shortcuts in Task Workspace:
   - `/`: Focus search input.
   - `J` / `K` or `↓` / `↑`: Move row selection up/down.
   - `Enter`: Open selected task detail.
   - `Esc`: Close detail sheet / clear search / deselect bulk items.
   - `X`: Toggle checkbox selection of focused row.
3. Discoverability:
   - Keyboard shortcuts displayed as subtle hints (e.g. `[ / ]`, `[ ⌘K ]`).

### Verification
- `npm run typecheck`
- `npm test` verifying keyboard navigation hooks and Command Palette triggers.

---

## Task 12: Legacy Portal Cleanup, Modal Hierarchy & Final QA Gate (Phase 12)

### Objective
Clean up deprecated portal workspaces, verify strict modal hierarchy (no nested modals), ensure unified feedback banner/toast, and verify 0 TypeScript errors & 100% test pass.

### Scope & Files
- `src/components/portal/executive-cockpit-workspace.tsx`
- `src/components/portal/department-manager-workspace.tsx`
- `src/components/portal/lecturer-focus-workspace.tsx`
- `src/components/ui/feedback-layer.tsx`
- `tests/*`

### Requirements
1. Legacy Workspace Cleanup:
   - Reduce or replace `executive-cockpit-workspace.tsx`, `department-manager-workspace.tsx`, and `lecturer-focus-workspace.tsx` with clean shims re-exporting the unified Workbench components.
2. Modal Hierarchy Enforcement:
   - SideSheet for Detail & Reviews; Modal for Creation & Destructive Confirmation; Popover for Filters; BottomSheet for Mobile.
   - Strictly no nested modal dialogs.
3. Unified Feedback:
   - Single unified feedback layer (Toast for transient notifications, inline banner for critical alerts, field summary for form errors).
4. Full QA Gate:
   - `npm run typecheck` passes with 0 errors.
   - `npm test` passes 100% with no regressions.
   - Verify UI acceptance criteria from plan document.

### Verification
- `npm run typecheck`
- `npm test`
- Final code review.
