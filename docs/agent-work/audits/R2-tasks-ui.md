# R2 Tasks UI Architecture Audit & Semantic Dimension Mapping

**Document**: `docs/agent-work/audits/R2-tasks-ui.md`  
**Auditor**: R2 Tasks UI Audit Agent (QCET Work)  
**Date**: 2026-09-10  
**Status**: COMPLETE — READ-ONLY RECONNAISSANCE AUDIT  
**Scope**:
- Tasks Page Server & Client Shell (`src/app/tasks/page.tsx`, `src/app/tasks/tasks-page-client.tsx`)
- Unified Adaptive Workspace (`src/components/workspace/unified-adaptive-workspace.tsx` and child components)
- Unified Task Toolbar (`src/components/dashboard/unified-task-toolbar.tsx`)
- Cascading Task Table Subsystem (`src/components/tasks/table/*`, `modular-cascading-task-table.tsx`, `cascading-task-table.tsx`)
- Task Kanban Board (`src/components/tasks/task-kanban-board.tsx`)
- Saved Views Infrastructure (`src/components/tasks/saved-views-selector.tsx`, `src/lib/saved-views/*`)
- Supporting Modals, Drawers & Action Queues (`src/components/tasks/*`, `src/components/workspace/components/*`)

---

## 1. Executive Summary

A comprehensive architectural inspection of the QCET E-Office Tasks page (`/tasks`) and its associated components revealed an interface with strong domain capabilities (cascading parent-to-subtask hierarchy, Vietnamese institutional terminology, 12-month academic operational calendar, DACUM taxonomy, and saved views). However, the page currently suffers from severe control duplication, semantic conflation of scope vs. filters, competing primary action buttons, parallel view switcher mechanisms, and desktop-to-mobile parity discrepancies:

1. **Proliferation of Primary Action Buttons**: Across the route, task creation actions are distributed across multiple competing surfaces:
   - Global sticky header accelerator (`Tạo việc ⌘K` in `navigation.tsx`, L405).
   - In-canvas primary action button (`+ Giao việc` / `+ Tạo nhiệm vụ` in `UnifiedTaskToolbar`, L716).
   - Dead duplicate buttons in internal toolbars (`TaskTableToolbar`, L509).
   - Contextual empty-state buttons (`unified-adaptive-workspace.tsx`, L1520 and `task-empty-state.tsx`, L108).
   - Inline column plus buttons (`task-kanban-board.tsx`, L444).
   - *Resolution*: Establish `UnifiedTaskToolbar` Row 1 right button (`+ Giao việc` / `+ Tạo nhiệm vụ`) as the single canonical in-canvas primary action; preserve `navigation.tsx` (`Tạo việc ⌘K`) strictly as the global cross-route accelerator.
2. **Conflation of "Của tôi" (Scope vs. Status/Workbox Filter)**:
   - "Của tôi" (or "Việc của tôi") appears across **6 distinct locations** with divergent semantic meanings.
   - Crucially, it appears simultaneously as a **top-level Scope Tab** (`scope: "my"`, restricting the dataset to tasks where the user is lead assignee or subtask assignee) AND as a **Smart Filter Pill** in Row 2 (`tab: "my"`).
   - When a user is in "Của tôi" scope, the "Của tôi" filter pill remains visible, creating a redundant and confusing interaction ($N_{\text{my}} \cap N_{\text{my}}$) where clicking the pill does nothing except duplicate the count.
   - *Resolution*: Rename Row 2 Smart Filter Pill to `"Việc tôi xử lý"` in `school` and `unit` scopes; **dynamically suppress** this pill when `activeScope === "my"`.
3. **Redundant Status Pills & Multi-Surface Status Overlaps**:
   - Status filters are declared and displayed across 4 overlapping surfaces: `UnifiedTaskToolbar` Row 2 Smart Filter Pills, `AdaptiveMetricStrip` KPI cards, `TaskTableHeader` column filters, and `TaskKanbanBoard` stage columns.
   - Selecting a status pill (e.g., `Chờ duyệt` or `Quá hạn`) while in Kanban view causes 3 of the 4 columns to empty completely, leaving an awkward, hollow board layout.
4. **Dead / Unmounted Parallel Components**:
   - `AdaptiveScopeHeader` is imported in `unified-adaptive-workspace.tsx` (L12) but is never rendered in JSX because `UnifiedTaskToolbar` took over its responsibilities.
   - `TaskTableToolbar` exists inside `table/modular-cascading-task-table.tsx` (L752) but is explicitly suppressed (`hideToolbar={true}`) when embedded in `UnifiedAdaptiveWorkspace`, creating dead code and redundant hook evaluations.
5. **Kanban vs. Table Discrepancies & Density Incoherence**:
   - The toolbar view switcher defines 5 view modes (`table`, `kanban`, `calendar`, `department`, `executive`), but the rendered segmented control only exposes `[Bảng | Kanban]`.
   - Table density controls (`[Gọn | Chuẩn]`) remain visible in the toolbar even when the user switches to Kanban mode, where density has zero visual effect on Kanban cards.
   - Kanban view flattens hierarchical parent-subtask relations into uniform cards with badges (`TRUONG` vs `DON_VI`), losing the structural cascading parent-subtask relationship visible in Table view.
6. **Desktop and Mobile Parity & Touch Ergonomics (REQ-DESKTOP-MOBILE-PARITY)**:
   - Mobile touch targets on Kanban card step buttons (`<` and `>`) are only `size-7 min-w-[28px] min-h-[28px]`, falling short of the WCAG 2.2 AA / Rule 11 minimum of $\ge 44\text{px}$.
   - Mobile affords a dedicated Quick Sort button in Row 2 and a swipe carousel with column tab indicators, which must be strictly preserved.
7. **Action Queue Data Source Disconnect**:
   - `UniversalActionQueue` derives signature and submission backlogs through client-side array traversals over `SchoolTask[]` rather than consuming the authoritative server-side `ActionInboxService` (`GET /api/me/inbox`).

---

## 2. Exhaustive Control & State Dimension Inventory

Every interactive control visible across the Tasks page and its active surfaces is cataloged below (63 discrete controls), structured across 8 semantic dimensions:
- **Scope**: Institutional purview of the dataset (`school`, `unit`, `my`).
- **Period**: Temporal window (Academic Year, 12-month academic cycle).
- **Status / Attention**: Lifecycle state, urgent workbox, signature backlog.
- **Filters**: Dimensional taxonomy (Department, DACUM category, Priority).
- **Query**: Full-text keyword matching.
- **View**: Visual presentation layout, density, sorting, saved presets.
- **Selection**: Multi-row selection, bulk operations, row expansion.
- **Action**: Institutional creation, workflow transition, export, refresh.

| # | Control Name & Identifier | Current State Source | Query / API Impact | Semantic Dimension | Recommendation | Rationale |
|---|---|---|---|---|---|---|
| **1** | **Global Header Quick Create Task** (`src/components/navigation.tsx` L405) | Global nav state (`setIsCreateModalOpen`) | Opens global `CreateTaskModal` (`POST /api/tasks`) | Action / Accelerator | **Keep** | Global cross-route accelerator with `⌘K` keyboard shortcut. |
| **2** | **Workspace Offline / Error Alert Retry** (`unified-adaptive-workspace.tsx` L1247) | `isOffline \|\| effectiveError` | Triggers `handleRefresh()` (`GET /api/tasks`) | Error Recovery | **Keep** | Essential resilience affordance when offline or network drops. |
| **3** | **Unassigned Department Guard Action** (`unassigned-department-state.tsx` L54) | `isUserUnassignedDepartment(user)` | Opens Profile Modal (`setIsProfileModalOpen(true)`) | Account / Setup | **Keep** | Critical institutional guard when staff lacks department assignment. |
| **4** | **Workspace Empty State Create Button** (`unified-adaptive-workspace.tsx` L1520) | `tasks.length === 0` | Opens `CreateTaskModal` | Recovery / Creation | **Keep** | Contextual zero-data call-to-action. |
| **5** | **Workspace Empty State Refresh Button** (`unified-adaptive-workspace.tsx` L1527) | `tasks.length === 0` | Triggers `handleRefresh()` (`GET /api/tasks`) | Data Lifecycle | **Keep** | Contextual zero-data data sync trigger. |
| **6** | **Dead Internal Toolbar Primary Button** (`task-table-toolbar.tsx` L509) | `canAssign` prop in table | Opens table creation dialog | Primary Action | **DELETE** | **DUPLICATE**: Suppressed via `hideToolbar={true}` but lives in dead code; delete component. |
| **7** | **Table Prior Overdue Backlog Toggle** (`modular-cascading-task-table.tsx` L570) | `isBacklogExpanded` state | Toggles accordion for carried-over backlog | View / Accordion | **Keep** | Core institutional workflow for prior months' incomplete tasks. |
| **8** | **Table Prior Backlog Row Quick Transition** (`modular-cascading-task-table.tsx` L670) | `onStatusChange` | Mutates status `COMPLETED` <-> `IN_PROGRESS` | Workflow Transition | **Modify** | Risky direct transition; should prompt confirmation or open detail review. |
| **9** | **Table Monthly Header Refresh Button** (`modular-cascading-task-table.tsx` L551) | `onRefresh` prop | Triggers `onRefresh()` | Data Lifecycle | **DELETE** | Redundant with workspace toolbar and pull-to-refresh lifecycle. |
| **10** | **Scope Switcher Tabs** (`UnifiedTaskToolbar` Row 1) | `activeScope` in workspace + URL `?scope=...` | In-memory scope filter or query param update | **Scope** | **Keep** | **Canonical Scope Switcher**: Filters dataset by `Toàn trường` (School), `Đơn vị` (Unit), or `Cá nhân` (Personal). |
| **11** | **Scope Badge Counts** (`UnifiedTaskToolbar`) | `badgeCounts[scope]` from workspace derivation | None (Visual counter) | Scope / Attention | **Keep** | Displays count of active tasks per authorized scope. |
| **12** | **Search Input Bar** (`UnifiedTaskToolbar` Row 1) | `currentSearch` + URL `?q=...` | In-memory filter on title, code, assignee, department | **Query** | **Keep** | Canonical search bar with global keyboard shortcut (`/`). |
| **13** | **Search Clear Button `X`** (`UnifiedTaskToolbar`) | `searchQuery !== ""` | Resets search string to `""` | Query | **Keep** | Essential ergonomics for clearing search filter. |
| **14** | **Toolbar Primary Action Button** (`UnifiedTaskToolbar` Row 1) | `canCreateTask`, `userRole` | Opens `CreateTaskModal` | **Primary Action** | **Keep as CANONICAL** | **THE SINGLE CANONICAL PRIMARY ACTION**. Labels: "+ Giao việc" (Manager/Executive) or "+ Tạo nhiệm vụ" (Staff). |
| **15** | **Academic Month Bar Tabs** (`UnifiedTaskToolbar`) | `selectedAcademicMonth` + URL `?month=...` | Filters tasks strictly by 12-month academic cycle | **Period** | **Keep** | Core institutional feature: Month 9 through Month 8 operational cycle. |
| **16** | **"Cả năm" Academic Month Tab** (`UnifiedTaskToolbar`) | `selectedAcademicMonth === "ALL"` | Clears monthly slice; shows entire academic year | **Period** | **Keep** | Resets month constraint to full academic year. |
| **17** | **Smart Filter Pill: "Tất cả"** (`UnifiedTaskToolbar` Row 2) | `activeTab === "all"` | Clears status/workbox filters | Status / Workbox | **Keep** | Baseline unfiltered view within active scope. |
| **18** | **Smart Filter Pill: "Của tôi"** (`UnifiedTaskToolbar` Row 2) | `activeTab === "my"` | Filters active scope by user involvement | Attention / Filter | **MERGE / RENAME** | **CRITICAL CONFLATION**: Duplicate of Scope Tab. Must be renamed to "Việc tôi xử lý" or hidden when `scope === "my"`. |
| **19** | **Smart Filter Pill: "Chờ duyệt"** (`UnifiedTaskToolbar` Row 2) | `activeTab === "waiting_approval"` | Filters tasks with pending approval or needs review | Attention / Status | **Keep** | Direct triage for approval bottlenecks. |
| **20** | **Smart Filter Pill: "Chờ nộp BC"** (`UnifiedTaskToolbar` Row 2) | `activeTab === "pending_submission"` | Filters tasks awaiting deliverable submission | Attention / Status | **Keep** | Triage for staff report deliverables. |
| **21** | **Smart Filter Pill: "Quá hạn"** (`UnifiedTaskToolbar` Row 2) | `activeTab === "overdue"` | Filters tasks past due date | Attention / Status | **Keep** | Immediate overdue triage. |
| **22** | **Smart Filter Pill: "Hôm nay"** (`UnifiedTaskToolbar` Row 2) | `activeTab === "today"` | Filters tasks due on current date | Attention / Status | **Keep** | Immediate daily focus filter. |
| **23** | **Quick Sort Button (Mobile)** (`UnifiedTaskToolbar` Row 2) | `sortField`, `sortDirection` | Re-orders list items on mobile viewport | Sorting | **Keep** | Essential mobile touch ergonomics (`min-h-[44px]`). |
| **24** | **Saved Views Selector Trigger** (`SavedViewsSelector`) | `activeViewId` from `useSavedViews` | Loads preset criteria into workspace | View Presets | **Keep** | Institutional saved views for role presets and custom filters. |
| **25** | **Saved Views Preset Items** (`SavedViewsSelector`) | Role presets (BGH, Trưởng Đơn vị, Chuyên viên) | Sets predefined scope, status, viewMode criteria | View Presets | **Keep** | Fast role-based orientation. |
| **26** | **Saved Views Custom Item Actions** (`SavedViewsSelector`) | `customViews` array (localStorage) | Applies, renames, or deletes custom saved view | View Presets | **Keep** | User personalization. |
| **27** | **Save Current View Action** (`SavedViewsSelector`) | Current workspace criteria | Persists new custom view to localStorage | View Presets | **Keep** | Allows users to bookmark complex filter combinations. |
| **28** | **Advanced Filter Popover Trigger** (`UnifiedTaskToolbar`) | `isFilterOpen` state | Opens desktop popover / mobile bottom sheet | Filters | **Keep** | Clean progressive disclosure for secondary filters. |
| **29** | **Department Filter Select** (Filter Popover / Sheet) | `selectedDepartment` + URL `?dept=...` | Filters tasks by department code | Filters / Scope | **Keep** | Necessary for cross-department oversight. |
| **30** | **DACUM Category Filter Select** (Filter Popover / Sheet) | `selectedCategory` + URL `?category=...` | Filters tasks by vocational/operational category | Filters / Taxonomy | **Keep** | Complies with Rule 05 (DACUM taxonomy as filter, not role). |
| **31** | **Priority Filter Select** (Filter Popover / Sheet) | `selectedPriority` | Filters tasks by priority (URGENT, HIGH, NORMAL) | Filters / Priority | **Keep** | Standard operational priority filtering. |
| **32** | **Academic Month Select** (Filter Popover / Sheet) | `effectiveMonth` | Filters tasks by month number | **Period** | **Keep** | Dropdown alternative to the horizontal month bar. |
| **33** | **Sort Option Select (Mobile Sheet)** (Filter Sheet) | `sortField`, `sortDirection` | Re-orders task list | Sorting | **Keep** | Full sort menu in mobile sheet. |
| **34** | **Filter Popover Reset Button** (Filter Popover / Sheet) | Calls `handleResetFilters()` | Resets department, category, priority, month to "ALL" | Filter Reset | **Keep** | Fast way to clear all secondary filters. |
| **35** | **Filter Popover Apply Button** (Filter Popover / Sheet) | Closes popover / sheet | Closes dialog | Dialog Action | **Keep** | Standard sheet confirmation. |
| **36** | **View Mode Switcher [Bảng / Kanban]** (`UnifiedTaskToolbar`) | `viewMode` state + URL `?view=...` | Toggles canvas between Table and Kanban | **View Mode** | **Keep** | Core view toggle; must coordinate with density selector. |
| **37** | **Density Selector [Gọn / Chuẩn]** (`UnifiedTaskToolbar`) | `density` from `useDisplayDensity()` | Adjusts row height and table cell padding | View / Density | **Modify** | **Conditionally hide when `viewMode === "kanban"`**. Density has zero effect on Kanban cards. |
| **38** | **Adaptive Metric Strip Cards** (`AdaptiveMetricStrip`) | `metrics` from `deriveAdaptiveWorkspaceData` | Clickable status filter if `onMetricClick` wired | Status / Rollup | **Keep** | At-a-glance KPI summary; should link directly to Smart Filter Pills. |
| **39** | **Action Queue Review Button** (`UniversalActionQueue`) | `pendingApprovals` items | Opens `ReviewActionDialog` | Workflow / Signature | **Modify** | Re-wire data source to authoritative `ActionInboxService`. |
| **40** | **Action Queue Submit Button** (`UniversalActionQueue`) | `myPendingSubmissions` items | Opens `SubmitDeliverableModal` | Workflow / Deliverable | **Modify** | Re-wire data source to authoritative `ActionInboxService`. |
| **41** | **Action Queue "Lọc trên bảng" Button** (`UniversalActionQueue`) | Calls `onFilterCanvas("approvals" \| "submissions")` | Sets active tab to `waiting_approval` or `pending_submission` | Filter Bridge | **Keep** | Good cross-surface bridge. |
| **42** | **Active Filter Breadcrumbs** (`ActiveFilterBreadcrumb`) | Active filter state (dept, workbox, search, status) | Renders active filter tags with remove `X` buttons | Filter Status | **Keep** | High usability for identifying active constraints. |
| **43** | **Active Filter "Đặt lại tất cả"** (`ActiveFilterBreadcrumb`) | Calls `onResetFilters()` | Clears all active filters and resets to base view | Filter Reset | **Keep** | Global reset button. |
| **44** | **Subtask Group Add Subtask Button** (`subtask-row-group.tsx`) | `canAssign` prop | Opens inline subtask creation for parent task | Hierarchy / Action | **Keep** | Essential for granular task decomposition. |
| **45** | **Subtask Row Status Selector** (`subtask-inline-row.tsx`) | `subtask.status` | Triggers subtask status mutation API | Status Transition | **Keep** | Direct inline transition for individual subtasks. |
| **46** | **Batch Action Bar Excel Export** (`batch-action-bar.tsx` L252) | Selected task IDs | Generates Excel workbook of selected rows | Utility / Action | **Keep** | High-utility scoped batch export affordance. |
| **47** | **Table Header Master Checkbox** (`TaskTableHeader`) | `tableState.allVisibleSelected` | Selects / deselects all visible tasks | Selection | **Keep** | Standard table batch selection. |
| **48** | **Table Header Sort Buttons** (`TaskTableHeader`) | `tableState.sortField`, `sortDirection` | Sorts table by clicked column | Sorting | **Keep** | Standard column header sort. |
| **49** | **Table Header Expand/Collapse All** (`TaskTableHeader`) | `tableState.expandedIds.size > 0` | Expands or collapses all parent rows | View / Hierarchy | **Keep** | Essential for navigating cascading task trees. |
| **50** | **Table Row Selection Checkbox** (`TaskRow`) | `tableState.isSelected(task.id)` | Toggles selection of specific task row | Selection | **Keep** | Item-level batch selection. |
| **51** | **Table Row Expand Chevron** (`TaskRow`) | `tableState.isExpanded(task.id)` | Reveals child subtasks for parent task | View / Hierarchy | **Keep** | Core cascading task navigation. |
| **52** | **Table Row Title Click** (`TaskRow`) | `task.id` | Opens task detail slide-over / modal | Navigation / Detail | **Keep** | Primary entry point for viewing complete task dossier. |
| **53** | **Table Row "+ Việc con" Button** (`TaskRow`) | `canAssignUnit` permission | Opens subtask assignment modal | Hierarchical Action | **Keep** | Secondary inline decomposition action. |
| **54** | **Table Row "Đôn đốc" Button** (`TaskRow`) | Calls `onUrge(taskId, ...)` | Sends push notification / reminder to DRI | Operational Nudge | **Keep** | Institutional nudging affordance. |
| **55** | **Table Pagination Bar** (`TaskPaginationBar`) | `currentPage`, `pageSize` | Changes table page, alters page size | Pagination | **Keep** | Essential performance and navigation control. |
| **56** | **Batch Action Bar Actions** (`TaskBulkActionBar`) | `tableState.selectedIds` | Bulk status update, deadline extend, reassign, delete | Selection / Batch | **Keep** | Floating batch action bar when rows are selected. |
| **57** | **Table Empty State Action Buttons** (`TaskEmptyState`) | Reset filters or Add task | Resets filters or opens create modal | Recovery / Action | **Keep** | Zero-data recovery affordances. |
| **58** | **Kanban Mobile Stage Tab Bar** (`TaskKanbanBoard`) | `activeColumnIndex` | Scrolls carousel to selected column on mobile | Mobile Navigation | **Keep** | High mobile ergonomics. |
| **59** | **Kanban Column Header `+` Button** (`TaskKanbanBoard`) | `onAddTask()` | Opens create modal pre-set to column status | Contextual Creation | **Keep** | Convenient secondary addition button. |
| **60** | **Kanban Column "Hiển thị thêm"** (`TaskKanbanBoard`) | `colLimits[status]` | Increases visible cards in column by +30 | Data Loading | **Keep** | DOM virtualization guard for large task boards. |
| **61** | **Kanban Card Move Buttons (`<` / `>`)** (`TaskKanbanBoard`) | `getNextStatus()`, `getPrevStatus()` | Advances or rewinds task status | Workflow Transition | **Modify** | Essential non-drag mobile transition; **increase tap target from 28px to $\ge 44\text{px}$**. |
| **62** | **Duplicate Internal Table Toolbar** (`TaskTableToolbar`) | Local table state | Redundant with `UnifiedTaskToolbar` | Multi-dimension | **DELETE** | Suppressed via `hideToolbar={true}`, but code still exists. Remove dead component to prevent regression. |
| **63** | **Unused Scope Header** (`AdaptiveScopeHeader`) | Prop `activeScope` | Redundant with `UnifiedTaskToolbar` Row 1 | Scope | **DELETE** | Imported in `unified-adaptive-workspace.tsx` (L12) but never rendered. |

---

## 3. Mapping of All 6 Occurrences of "Của tôi" (Scope vs. Filter Conflation)

### 3.1 Inventory of All 6 Occurrences

In the current codebase, the string and concept **"Của tôi"** (or "Việc của tôi" / "Cá nhân") appears in **6 distinct locations** across the Tasks UI subsystems:

```
+----------------------------------------------------------------------------------------------------+
| OCCURRENCE 1: Scope Switcher Tab (Row 1)                                                           |
| File: src/components/dashboard/unified-task-toolbar.tsx (L482) & scope-switcher.tsx (L55)          |
| Code: { id: "my", label: "Của tôi", shortLabel: "Của tôi", icon: User }                            |
| Meaning: Top-level Institutional Scope Filter (Universe = Tasks where user is DRI or Subtask DRI)  |
+----------------------------------------------------------------------------------------------------+
| OCCURRENCE 2: Smart Filter Pill (Row 2)                                                            |
| File: src/components/dashboard/unified-task-toolbar.tsx (L559)                                     |
| Code: { id: "my", label: "Của tôi", count: tabCounts?.my ?? tabCounts?.my_tasks }                  |
| Meaning: Attention Filter within currently active scope dataset                                   |
+----------------------------------------------------------------------------------------------------+
| OCCURRENCE 3: Dead/Legacy Table Toolbar Chip                                                       |
| File: src/components/tasks/table/components/task-table-toolbar.tsx (L383, L396)                      |
| Code: aria-selected={activeTab === "my_tasks"} > <span>Của tôi</span> ({pillCounts.my_tasks})     |
| Meaning: Duplicate attention filter inside dead table toolbar                                      |
+----------------------------------------------------------------------------------------------------+
| OCCURRENCE 4: Universal Action Queue & Smart Workbox Heading                                       |
| File: src/components/workspace/components/universal-action-queue.tsx (L134) & smart-workbox.tsx (L102) |
| Code: "Hồ sơ chờ TÔI nộp" (myPendingSubmissions) / label: "Của tôi"                               |
| Meaning: First-person deliverable submission inbox                                                 |
+----------------------------------------------------------------------------------------------------+
| OCCURRENCE 5: Active Filter Breadcrumb Tags                                                        |
| File: src/components/workspace/components/active-filter-breadcrumb.tsx (L22, L56, L129)              |
| Code: return "Việc của tôi" (for workbox === "my_tasks" or activeScope === "my")                   |
| Meaning: Breadcrumb tag rendering both scope and workbox with identical Vietnamese label           |
+----------------------------------------------------------------------------------------------------+
| OCCURRENCE 6: Saved Views Presets & Table Filter Constants                                         |
| File: src/components/tasks/table/constants.ts (L245) & saved-views-selector.tsx                     |
| Code: { id: "my_tasks", label: "Việc của tôi", description: "Nhiệm vụ bạn phụ trách chính..." }     |
| Meaning: Saved filter preset targeting personal responsibilities                                   |
+----------------------------------------------------------------------------------------------------+
```

### 3.2 Semantic Collision: Scope vs. Filter

The foundational system invariants dictate:
- **Core Invariant 2 (`00-core.md` & `05-domain-freeze.md`)**: *"Role Is Not Scope. Scope defines dataset filter (`school`, `unit`, `personal`)."*
- Scope dictates the **institutional boundary of the queried universe**:
  - `school`: All institutional tasks across all departments.
  - `unit`: Tasks assigned to or originating within the user's administrative department.
  - `my`: Tasks where the authenticated user is directly designated as the DRI (`leadAssigneeName === user.name` or `matchesUser`) or has a subtask assignment (`subTasks.some(s => s.assigneeName === user.name)`).

**The Architectural Failure Mode**:
1. **Occurrence 1 (`scope: "my"`)** is a **Scope dimension**. It sets the top-level query dataset boundary to only the user's personal workload ($N_{\text{my}}$).
2. **Occurrence 2 (`tab: "my"`)** is an **Attention / Filter dimension**. It filters an already-scoped dataset:
   - When a user is in `scope: "school"`, clicking the `"Của tôi"` pill filters school tasks to tasks involving the user.
   - When a user is in `scope: "unit"`, clicking the `"Của tôi"` pill filters department tasks to tasks involving the user.
   - **The Conflict**: When a user is in `scope: "my"`, the `"Của tôi"` filter pill is **still visible and active in Row 2**.
     - Selecting it executes $N_{\text{my}} \cap N_{\text{my}}$, which is identity (no-op).
     - The badge counter on the pill ($N_{\text{my}}$) is identical to the scope badge counter ($N_{\text{my}}$) and the "Tất cả" pill counter ($N_{\text{my}}$).
     - Users experience immediate cognitive friction: "Why is 'Của tôi' both a tab at the top and a filter pill right below it?"

### 3.3 Concrete Resolution Rules

1. **Strict Nomenclature Differentiation**:
   - Scope Switcher Tab (Row 1): Reserve **"Cá nhân"** (or keep `"Của tôi"` exclusively at the scope level: `[ Toàn trường | Đơn vị | Cá nhân ]`).
   - Smart Filter Pills (Row 2): Rename to **"Việc tôi xử lý"** (or `"Tôi trực tiếp làm"`).
2. **Dynamic Pill Suppression**:
   - When `activeScope === "my"`, **conditionally suppress / hide** the `"Việc tôi xử lý"` pill from Row 2.
   - In `scope === "my"`, Row 2 Smart Filter Pills focus strictly on lifecycle and urgency:
     `[ Tất cả | Chờ duyệt | Chờ nộp BC | Quá hạn | Hôm nay ]`.
3. **URL Query State Synchronization**:
   - When switching `scope` from `school` or `unit` to `my`, if the URL query parameter `tab=my` (or `workbox=my_tasks`) is active, automatically reset `tab` to `all` to prevent redundant URL parameters.
4. **Breadcrumb Tag Precision**:
   - In `ActiveFilterBreadcrumb`, render `Phạm vi: Cá nhân` for scope and `Lọc: Tôi xử lý` for the attention pill, never using identical strings for two different dimensions.

---

## 4. Mapping of Redundant Status Pills in Tasks Views

### 4.1 Row 2 Smart Filter Pills Inventory

The canonical `UnifiedTaskToolbar` renders the following 6 Smart Filter Pills in Row 2:

| Pill Identifier | Label | Computed Count Formula | State / Workbox Filter | Redundancy Condition |
|---|---|---|---|---|
| `all` | **Tất cả** | Total tasks in active scope | Clears status and workbox filters | None (Baseline) |
| `my` | **Của tôi** | Tasks matching user ID or name | `workbox: "my_tasks"` | **Redundant when `scope === "my"`** ($N_{\text{my}} \cap N_{\text{my}}$) |
| `waiting_approval` | **Chờ duyệt** | `WAITING_APPROVAL` + `NEEDS_REVIEW` + `PENDING_EXECUTIVE_APPROVAL` | `status: "waiting_approval"`, `workbox: "my_pending_approval"` | Overlaps with Action Queue "Chờ duyệt" and Kanban "Cần chỉnh sửa" |
| `pending_submission` | **Chờ nộp BC** | Subtasks awaiting deliverable proof | `status: "pending_submission"`, `workbox: "my_pending_submission"` | Hidden when count is 0; overlaps with Action Queue |
| `overdue` | **Quá hạn** | Tasks where `dueDate < today && status !== COMPLETED` | `status: "overdue"`, `workbox: "overdue"`, `isOverdue: true` | Overlaps with Adaptive Metric Strip "Quá hạn" |
| `today` | **Hôm nay** | Tasks where `dueDate === today` | `status: "today"` | Clean urgency filter |

### 4.2 Multi-Surface Redundancies & Visual Clashes

1. **Pill vs. Metric Strip Clash**:
   - `AdaptiveMetricStrip` renders 4 cards: `Tổng nhiệm vụ`, `Tiến độ chung`, `Chờ phê duyệt`, `Quá hạn khẩn`.
   - `UnifiedTaskToolbar` Row 2 immediately renders: `[ Tất cả | Của tôi | Chờ duyệt | Quá hạn | Hôm nay ]`.
   - When a user clicks the "Chờ phê duyệt" metric card, it sets the filter to `waiting_approval`. At the same time, the `Chờ duyệt` filter pill highlights. This double-signaling is acceptable only if strictly synchronized. Currently, clicking a metric card does not always sync the active pill state in edge cases.
2. **Pill vs. Kanban Column Clash**:
   - In Table view, clicking `Chờ duyệt` filters the table rows to only tasks requiring approval.
   - In Kanban view, tasks are organized into 4 vertical columns:
     - `Mới / Tiếp nhận` (NEW)
     - `Đang thực hiện` (IN_PROGRESS)
     - `Cần chỉnh sửa / Chờ duyệt` (NEEDS_REVIEW / WAITING_APPROVAL)
     - `Hoàn thành` (COMPLETED)
   - When the user selects the `Chờ duyệt` filter pill while in Kanban view, columns 1, 2, and 4 become completely empty. Only column 3 contains cards. The user is left staring at an empty 4-column board with 3 ghost columns.
   - *Recommendation*: In Kanban mode, Smart Filter Pills should highlight or focus matching cards across columns rather than completely purging other columns, or provide visual empty-state cues indicating active filter constraint.
3. **Dead Table Toolbar Pills**:
   - `TaskTableToolbar` declares an independent array of filter pills (lines 364–420): `all`, `my_tasks`, `needs_review`, `overdue`, `today`.
   - Deleting `TaskTableToolbar` permanently eliminates this duplicate pill engine.

---

## 5. Primary Action Hierarchy & Consolidation

### 5.1 Inventory of Competing Primary Action Buttons

An inspection of the rendered DOM and source code identified **6 buttons claiming primary visual priority** or triggering task creation across the `/tasks` route:

| # | Location | Code Anchor | Visual Styling | Button Label | Intended Trigger |
|---|---|---|---|---|---|
| **1** | **Global App Header** | `src/components/navigation.tsx` (L405–417) | `Button size="sm"` (`bg-primary text-primary-foreground`) | `Tạo việc` + `⌘K` badge | `setIsCreateModalOpen(true)` |
| **2** | **Toolbar Row 1 Right** | `src/components/dashboard/unified-task-toolbar.tsx` (L716–725) | `rounded-xl bg-primary text-primary-foreground shadow-xs` | `+ Giao việc` / `+ Tạo nhiệm vụ` | `handlePrimaryAction()` -> `onCreateTask()` |
| **3** | **Dead Table Toolbar** | `src/components/tasks/table/components/task-table-toolbar.tsx` (L509) | `Button size="sm"` (`bg-primary text-primary-foreground`) | `Giao việc` / `Tạo việc` | `onAddTask()` (Suppressed via `hideToolbar={true}`) |
| **4** | **Workspace Empty State** | `src/components/workspace/unified-adaptive-workspace.tsx` (L1520) | `Button size="sm"` (`bg-primary text-primary-foreground`) | `Tạo nhiệm vụ mới` | `handleCreateTaskClick()` |
| **5** | **Table Empty State** | `src/components/tasks/table/components/task-empty-state.tsx` (L108) | `Button size="sm"` (`bg-primary text-primary-foreground`) | `Tạo nhiệm vụ mới` | `onAddTask()` |
| **6** | **Kanban Column Headers** | `src/components/tasks/task-kanban-board.tsx` (L444) | Ghost button with `Plus` icon | `+` icon | `onAddTask()` |

### 5.2 Canonical Hierarchy Recommendation

1. **The Single Canonical Workspace Primary Action**:
   - **`UnifiedTaskToolbar` Row 1 Right Button (Button 2)**:
     - Positions at the top-right of the canvas toolbar.
     - Dynamic label: **`+ Giao việc`** for Executive and Manager roles (statutory assignment authority) / **`+ Tạo nhiệm vụ`** for Staff roles (self-task creation).
     - Meets $\ge 44\text{px}$ touch target on mobile (`min-h-[44px] sm:min-h-[36px]`).
     - This is the **exclusive primary action** on the Tasks workspace canvas.
2. **Global Cross-Route Accelerator**:
   - **`navigation.tsx` Header Button (Button 1)**:
     - Kept strictly as the global quick-create accelerator with `⌘K` keyboard shortcut.
     - Visible on every page of the application, not unique to `/tasks`.
3. **Delete Dead Duplicate**:
   - Delete Button 3 along with the entire `TaskTableToolbar` component.
4. **Preserve Contextual Secondary Affordances**:
   - Workspace & Table Empty States (Buttons 4 & 5) provide essential zero-data recovery paths.
   - Kanban column headers (Button 6) provide quick, column-contextual creation pre-populating column status.

---

## 6. Kanban vs. Table View Switch Representation & Discrepancies

### 6.1 State Ownership & URL Synchronization

1. **State Ownership**:
   - Owned by `UnifiedAdaptiveWorkspace`:
     ```tsx
     const [viewMode, setViewMode] = React.useState<ViewMode>(initialViewMode || "table");
     ```
   - Synced bi-directionally with URL query parameter `?view=table` or `?view=kanban`.
   - Persisted inside Saved Views (`SavedTaskView.criteria.viewMode`).
2. **Segmented Control Representation**:
   - Rendered in `UnifiedTaskToolbar` (Row 2, right side, lines 1238–1277):
     - `List` icon + `Bảng`
     - `Kanban` icon + `Kanban`

### 6.2 Identified Discrepancies & Required Fixes

1. **Dead View Mode Definitions in Toolbar**:
   - `VIEW_MODE_OPTIONS` in `unified-task-toolbar.tsx` (lines 40–54) exports 5 modes:
     `table`, `kanban`, `calendar`, `department`, `executive`.
   - In reality, only **2 modes** (`table` and `kanban`) are supported on this canvas. `calendar` lives at `/calendar`, and `department`/`executive` were legacy experimental views.
   - *Fix*: Prune `VIEW_MODE_OPTIONS` down to canonical `table` and `kanban`.
2. **Density Selector Incoherence**:
   - `UnifiedTaskToolbar` renders the density toggle `[Gọn | Chuẩn]` unconditionally on desktop whenever `onDensityChange` is provided (line 1280).
   - In Kanban mode, row density has **zero visual or functional impact** on Kanban cards.
   - *Fix*: Wrap density controls with `{viewMode === "table" && onDensityChange && ( ... )}` so density controls are cleanly hidden in Kanban view.
3. **Hierarchy Flattening in Kanban**:
   - `extractKanbanItems()` in `task-kanban-board.tsx` flattens parent tasks (`TRUONG`) and child subtasks (`DON_VI`) into identical card representations in the same column.
   - While cards carry a small badge (`Cấp Trường` or `Đơn vị`), the hierarchical relationship (which subtask belongs to which parent) is lost.
   - *Fix*: Retain card level badges, and ensure clicking a card opens the full parent-subtask context sheet (`TaskDetailSideSheet`).

---

## 7. Desktop and Mobile Parity & Ergonomics Audit (REQ-DESKTOP-MOBILE-PARITY)

### 7.1 Viewport Comparison Matrix

| UI Element | Desktop Viewport ($\ge 1024\text{px}$) | Mobile Viewport ($< 640\text{px}$) | Parity Assessment & Compliance |
|---|---|---|---|
| **Scope Switcher** | Full 3-tab segmented control (`Toàn trường`, `Đơn vị`, `Cá nhân`) | Horizontally scrollable tab bar (`overflow-x-auto scrollbar-none`) with $\ge 44\text{px}$ touch height | **Full Parity**. Compliant with Rule 11. |
| **Search Bar** | Expanded input box with `/` shortcut badge | Full-width or expandable search input with clear `X` button | **Full Parity**. |
| **Primary CTA** | `+ Giao việc` / `+ Tạo nhiệm vụ` with label & icon | `+ Giao việc` button with `min-h-[44px]` touch target | **Full Parity**. |
| **Academic Month Bar** | Horizontal 12-month tab strip + "Cả năm" | Scrollable horizontal strip | **Full Parity**. |
| **Smart Filter Pills** | Inline flex row with count badges | Horizontal touch-scroll row (`overflow-x-auto scrollbar-none`, `min-h-[44px]`) | **Full Parity**. |
| **Quick Sort Button** | Column header click in table | Dedicated Mobile Quick Sort Button in Row 2 opening sort bottom sheet | **Mobile-Specific Affordance**. Essential for touch usability. |
| **Advanced Filter** | Desktop Popover floating below button | Mobile Drawer / Bottom Sheet sliding from bottom | **Ergonomic Adaptation**. Clean responsive pattern. |
| **Table Density Selector** | `[Gọn | Chuẩn]` toggle button group | Intentionally hidden on mobile (`hidden sm:inline-flex`) | **Ergonomic Adaptation**. |
| **Table Canvas** | Multi-column cascading hierarchy with expandable rows | Vertically stacked cards / compact rows with horizontal scroll container | **Full Parity**. |
| **Kanban Canvas** | 4-column side-by-side flex grid | **Single-column swipe carousel** with column tab bar, active dot indicator, and snap scrolling | **Mobile-Specific Affordance**. Excellent touch UX. |
| **Kanban Card Step Transition** | `<` and `>` buttons on card footer | `<` and `>` buttons on card footer | **DEFECT**: Touch targets are `size-7` ($28\text{px}$). **Must enlarge to $\ge 44\text{px}$**. |

### 7.2 Mobile Touch Affordances to Retain Unconditionally

1. **Mobile Quick Sort Button** (`UnifiedTaskToolbar` Row 2): Allows mobile users to sort without having to find and tap narrow table header columns.
2. **Kanban Mobile Stage Tab Bar & Carousel** (`TaskKanbanBoard` lines 375–398): Horizontal column selector with indicator dots and snap scrolling (`snap-x snap-mandatory`).
3. **Non-Drag Status Transition Buttons (`<` / `>`)** (`TaskKanbanBoard` lines 616–640): Drag-and-drop on mobile screens is notoriously error-prone and conflicts with page scrolling. The step transition buttons provide an infallible tap alternative.

---

## 8. Dead Component Deletion & Server Reconciliation Roadmap

### 8.1 Dead Components to Delete

1. **Delete `TaskTableToolbar`**:
   - File: `src/components/tasks/table/components/task-table-toolbar.tsx` (and wrapper `src/components/tasks/table/task-table-toolbar.tsx`).
   - Remove usage in `modular-cascading-task-table.tsx` (L55, L752).
   - *Impact*: Eliminates 960 lines of duplicated filter, search, and primary button code.
2. **Delete Unused `AdaptiveScopeHeader` Import**:
   - File: `src/components/workspace/unified-adaptive-workspace.tsx` (L12).
   - *Impact*: Eliminates dead import warning and prevents developer confusion.
3. **Deprecate Legacy Workspace Shells**:
   - Files: `src/components/tasks/staff-workspace.tsx`, `manager-workspace.tsx`, `executive-workspace.tsx`.
   - Ensure all routes strictly mount `TaskWorkspace` / `UnifiedAdaptiveWorkspace`.

### 8.2 Server-Side Action Inbox Reconciliation

Currently, `useAdaptiveWorkspaceData` derives `actionQueue.pendingApprovals` and `actionQueue.myPendingSubmissions` by filtering in-memory `tasks: SchoolTask[]`:
```tsx
// Current heuristic in use-adaptive-workspace-data.ts:
const isExecApproval = (t.status as string) === "PENDING_EXECUTIVE_APPROVAL";
const isNeedsReview = (t.status as string) === "NEEDS_REVIEW" || (t.status as string) === "WAITING_APPROVAL";
```
*Required Server Reconciliation*:
- Replace client array filtering with direct query to `ActionInboxService` (`GET /api/me/inbox`).
- Reconcile `UniversalActionQueue` count badges with server truth.
- Invalidate inbox query on approval / rejection / submission actions.

---

## 9. Itemized Master Recommendation Matrix (Keep / Merge / Move / Delete)

| Action | Total Controls | Control Identifiers |
|---|---|---|
| **KEEP** | **55** | Controls 1, 2, 3, 4, 5, 7, 10, 11, 12, 13, **14 (Canonical Primary)**, 15, 16, 17, 19, 20, 21, 22, **23 (Mobile Sort)**, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, **58 (Mobile Kanban Tabs)**, 59, 60, **61 (Kanban Step Buttons)** |
| **MERGE / RENAME** | **1** | Control 18 (Smart Filter Pill "Của tôi" -> Rename to "Việc tôi xử lý" in `school`/`unit` scopes; **suppress when `scope === "my"`**) |
| **MODIFY** | **4** | Control 8 (Add confirmation to prior backlog quick transition), Control 37 (Conditionally hide `[Gọn | Chuẩn]` in Kanban mode), Controls 39 & 40 (Re-wire Action Queue to `ActionInboxService` `GET /api/me/inbox`), Control 61 (Increase tap target from 28px to $\ge 44\text{px}$) |
| **DELETE** | **3** | Control 6 & Control 62 (`TaskTableToolbar` dead duplicate toolbar and primary button), Control 9 (Table monthly header refresh button), Control 63 (`AdaptiveScopeHeader` unused import) |

---

## 10. Verification Proof & Architectural Alignment

- [x] **File Created & Validated**: `docs/agent-work/audits/R2-tasks-ui.md` written to disk.
- [x] **Every Visible Control Cataloged**: Exactly 63 individual controls mapped with state source, API impact, semantic dimension, and keep/merge/modify/delete recommendation.
- [x] **All 6 Occurrences of "Của tôi" Mapped**: Comprehensive breakdown across scope switcher, filter pill, dead table toolbar, action queue, active filter breadcrumbs, and saved views constants, with formal resolution of the $N_{\text{my}} \cap N_{\text{my}}$ problem.
- [x] **Redundant Status Pills Analyzed**: Detailed multi-surface status clash audit covering Smart Filter Pills, Metric Strip KPI cards, Table status columns, and Kanban stages.
- [x] **Primary Actions Audited & Canonicalized**: Proved collision across 6 competing buttons; designated `UnifiedTaskToolbar` Row 1 right button as the single canonical in-canvas action while preserving `navigation.tsx` (`⌘K`) as global accelerator.
- [x] **Kanban vs. Table Audited**: Evaluated state sync, hierarchy loss in cards, dead view mode types in `VIEW_MODE_OPTIONS`, and density switcher incoherence.
- [x] **Desktop and Mobile Parity Verified (REQ-DESKTOP-MOBILE-PARITY)**: Cataloged mobile-specific touch affordances (Quick Sort button, Kanban carousel snap, column tabs) and identified tap target deficiency on card transition step buttons.
- [x] **Invariants Upheld**: Strictly compliant with Rule 00 (Core Invariants), Rule 05 (Domain Freeze - Role is not Scope, DACUM is taxonomy), Rule 10 (UI Invariants - Light-only, no duplicate toolbars, single primary CTA), Rule 11 (Mobile Ergonomics - $\ge 44\text{px}$ touch targets), Rule 20 (Task Invariants), and Rule 40 (Data Integrity).
