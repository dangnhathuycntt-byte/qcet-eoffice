# R8 UI Semantic Consolidation: Duplications & Dead Code Audit

**Document**: `docs/agent-work/audits/R8-duplicates.md`  
**Auditor**: Agent R8 (UI Semantic Consolidation & Duplicate Inventory)  
**Date**: 2026-09-10  
**Status**: COMPLETE — READ-ONLY RECONNAISSANCE AUDIT  
**Scope**:  
- `src/components/workspace/*`
- `src/components/tasks/*`
- `src/components/dashboard/*`
- `src/components/calendar/*`
- `src/lib/adapters/*`
- `src/domain/tasks/*`
- `src/components/layout/*` & `src/components/portal/*` (supporting inspection)

---

## 1. Executive Summary

A systematic audit across all primary UI, task management, calendar, dashboard, adapter, and workspace subsystems revealed massive code redundancy, architectural divergence, and maintenance liabilities totaling over **10,500 lines of duplicate or dead code**.

The core issues identified are:

1. **Eight Independent Scope Switchers**: Despite having a canonical `ScopeSwitcher` (`src/components/layout/scope-switcher.tsx`), scope selection buttons, tablists, and filters are re-implemented in toolbars, workspace headers, mobile drawers, and dashboard action bars. Multiple implementations attempt to enforce permissions via client-side scope masking, violating **Rule 3** ("Role Is Not Scope").
2. **Twelve Divergent Task Status Mappings**: The database schema enforces a strict 6-value enum (`NOT_STARTED`, `IN_PROGRESS`, `WAITING_APPROVAL`, `COMPLETED`, `OVERDUE`, `CANCELLED`). However, the frontend has proliferated synthetic legacy statuses (`NEW`, `NEEDS_REVIEW`, `PENDING_EXECUTIVE_APPROVAL`, `BLOCKED`, `ACTION_REQUIRED`, and lowercase variations), requiring 12 ad-hoc mapping dictionaries across adapters, mappers, and UI components.
3. **Severe KPI Card Inflation (Up to 12 Cards per Page)**: The Executive Dashboard renders 5 cards in `ExecutiveStatStrip`, immediately followed by 3 secondary action cards in `ExecutiveActionCenter` (re-calculating the exact same metrics), followed by 4 cards in `SmartWorkbox` within `PersonalWorkbench`, and 4 additional chips in mobile feeds.
4. **Two Monolithic 1,000+ Line Toolbars**: `UnifiedTaskToolbar` (1,323 lines) and `TaskTableToolbar` (1,019 lines) implement parallel search inputs, density toggles, view switchers, export menus, and category tabs with overlapping state machines.
5. **6,000+ Lines of Dead Portal / Workspace Facades**: `src/components/portal/*` contains three monolithic files (`executive-cockpit-workspace.tsx`, `department-manager-workspace.tsx`, `lecturer-focus-workspace.tsx`) containing over 5,500 lines of legacy code and wrapping `UnifiedAdaptiveWorkspace` with `forcedRole="ADMIN" | "MANAGER" | "STAFF"`. None of these are imported by active routes in `src/app/`.
6. **1,230 Lines of Dead Calendar Chrome**: `src/components/calendar/executive-calendar-workspace.tsx` is completely unreferenced in routing (`/calendar` routes directly to `CalendarWorkspace`), yet retains duplicate backlog banners, deprecated work cards, and unused scheduling math.
7. **Identical Cloned Layout Files**: `src/components/layout/mobile-bottom-bar.tsx` and `src/components/layout/mobile-bottom-nav.tsx` are 100% identical files cross-exporting each other.

---

## 2. Master Table of Duplications & Redundancies

| ID | Category | Component / Function / Constant | Exact File Path | Line Range | Canonical Owner / Destination | Action |
|---|---|---|---|---|---|---|
| **DUP-01** | Scope Switcher | `AdaptiveScopeHeader` | `src/components/workspace/components/adaptive-scope-header.tsx` | 188–232 | `src/components/layout/scope-switcher.tsx` | **Delete**. Replace with canonical `ScopeSwitcher`. |
| **DUP-02** | Scope Switcher | Embedded Scope Tablist | `src/components/dashboard/unified-task-toolbar.tsx` | 453–500, 625–675 | `src/components/layout/scope-switcher.tsx` | **Remove**. Extract scope switching out of table toolbar. |
| **DUP-03** | Scope Switcher | Redundant Inner `ScopeSwitcher` | `src/components/dashboard/personal-workbench.tsx` | 580–600 | `src/components/dashboard/zones/dashboard-zone.tsx` | **Delete**. Do not nest secondary scope selector in workbench. |
| **DUP-04** | Scope Switcher | Duplicate Mobile Drawer Scope | `src/components/layout/mobile-menu-drawer.tsx` | 120–150 | `src/components/layout/scope-switcher.tsx` | **Consolidate** to use shared `ScopeSwitcher` instance. |
| **DUP-05** | Scope Switcher | Contextual Action Bar Scope | `src/components/dashboard/zones/dashboard-zone.tsx` | 75–80 | `src/components/layout/scope-switcher.tsx` | **Retain** as canonical page-level scope anchor. |
| **DUP-06** | Status Mapping | `statusMap` (DB to UI) | `src/lib/adapters/task-db-adapter.ts` | 160–175 | `src/domain/tasks/mappers.ts` | **Consolidate**. Migrate adapter to use canonical domain mapper. |
| **DUP-07** | Status Mapping | `statusMap` (Lowercase / Legacy) | `src/domain/tasks/mappers.ts` | 275–290 | `src/domain/tasks/mappers.ts` | **Refactor** to emit canonical uppercase `TaskStatus`. |
| **DUP-08** | Status Mapping | Multi-Status Fallback Normalization | `src/domain/tasks/contract.ts` | 355, 368, 404, 441 | `src/domain/tasks/state-machine.ts` | **Eliminate** synthetic status aliases (`NEW`, `NEEDS_REVIEW`). |
| **DUP-09** | Status Mapping | `CanonicalTaskStatus` vs `TaskStatus` | `src/domain/tasks/state-machine.ts` | 12–25 | Prisma `enum TaskStatus` | **Align** with Prisma schema (`NOT_STARTED`, not `NEW`). |
| **DUP-10** | Status Mapping | `STATUS_BADGE_CONFIGS` & `STATUS_CONFIG` | `src/components/tasks/table/constants.ts` | 60–140, 305–340 | `src/lib/tokens.ts` & `constants.ts` | **Merge** duplicate status badge configurations. |
| **DUP-11** | Status Mapping | `getStatusBadgeConfig` | `src/components/tasks/cascading-task-table.tsx` | 142–200 | `src/components/tasks/table/constants.ts` | **Delete duplicate** in `cascading-task-table.tsx`. |
| **DUP-12** | Status Mapping | `KANBAN_COLUMNS` & `STATUS_ICON_MAP` | `src/components/tasks/task-kanban-board.tsx` | 45–85, 98–115 | `src/components/tasks/table/constants.ts` | **Import** canonical status definitions. |
| **DUP-13** | Status Mapping | `STATUS_OPTIONS` in Side Sheet | `src/components/dashboard/task-detail-side-sheet.tsx` | 100–145 | `src/domain/tasks/state-machine.ts` | **Drive options** from authoritative domain transitions. |
| **DUP-14** | Status Mapping | `formatTaskStatus` | `src/components/dashboard/department-grouped-task-view.tsx` | 70–130 | `src/components/tasks/table/constants.ts` | **Replace** with canonical badge helper. |
| **DUP-15** | Status Mapping | `getStatusDotClass` & `getStatusLabel` | `src/components/calendar/calendar-month-view.tsx` | 113–158 | `src/components/tasks/table/constants.ts` | **Remove hardcoded date** (`2026-09-04`) & centralize. |
| **DUP-16** | Status Mapping | `CORE_STATUS_PILLS` | `src/components/dashboard/simplified-task-filter-bar.tsx` | 22–28, 55–60 | `src/components/tasks/table/types.ts` | **Deprecate** ad-hoc `SimplifiedTaskStatus`. |
| **DUP-17** | Status Mapping | `statusColors` Palette | `src/lib/tokens.ts` | 25–65 | `src/components/tasks/table/constants.ts` | **Unify** OKLCH tokens with status badge config. |
| **DUP-18** | KPI Cards | Secondary Action Cards | `src/components/dashboard/executive-action-center.tsx` | 135–240 | `src/components/dashboard/executive-stat-strip.tsx` | **Eliminate**. Keep count in `ExecutiveStatStrip`. |
| **DUP-19** | KPI Cards | `SmartWorkbox` 4 Metric Cards | `src/components/workspace/smart-workbox.tsx` | 270–380 | `src/components/dashboard/executive-stat-strip.tsx` | **Deprecate / Streamline** into focused queue counts. |
| **DUP-20** | KPI Cards | `AdaptiveMetricStrip` 4 Cards | `src/components/workspace/components/adaptive-metric-strip.tsx` | 140–220 | `src/components/dashboard/executive-stat-strip.tsx` | **Delete**. Merge into canonical stat strip. |
| **DUP-21** | KPI Cards | Mobile Summary Metric Chips | `src/components/dashboard/workbench-mobile-feed.tsx` | 220–310 | `src/components/dashboard/executive-stat-strip.tsx` | **Bind** to server-calculated macro KPIs. |
| **DUP-22** | KPI Cards | Top Metric Chips | `src/components/tasks/cascading-task-table.tsx` | 230–290 | `src/components/dashboard/executive-stat-strip.tsx` | **Remove** embedded metric banner in table component. |
| **DUP-23** | Toolbar | `TaskTableToolbar` vs `UnifiedTaskToolbar` | `src/components/tasks/table/components/task-table-toolbar.tsx` vs `src/components/dashboard/unified-task-toolbar.tsx` | Both (1019 & 1323 lines) | Single Canonical `TaskTableToolbar` | **Consolidate** into one modular toolbar. |
| **DUP-24** | View Switcher | View Mode Buttons | `src/components/dashboard/zones/tasks-expanded-views.tsx` | 35–50, 120–170 | Page-level or Toolbar View Switcher | **Harmonize** view switching across dashboard views. |
| **DUP-25** | View Switcher | Embedded View Switcher | `src/components/dashboard/unified-task-toolbar.tsx` | 1240–1280 | Toolbar View Control | **Keep** as standard Table/Kanban toggle. |
| **DUP-26** | View Switcher | Duplicate View Switcher | `src/components/tasks/table/components/task-table-toolbar.tsx` | 905–945 | Consolidated Toolbar | **Merge** with DUP-25. |
| **DUP-27** | View Switcher | Header View Switcher | `src/components/workspace/components/adaptive-scope-header.tsx` | 234–265 | Consolidated Toolbar | **Delete**. |
| **DUP-28** | Calendar Chrome | `ExecutiveCalendarWorkspace` | `src/components/calendar/executive-calendar-workspace.tsx` | 584–1230 | `src/components/calendar/calendar-workspace.tsx` | **Delete Dead File** (647 unused lines). |
| **DUP-29** | Calendar Chrome | `WorkCalendarCard` | `src/components/calendar/executive-calendar-workspace.tsx` | 267–460 | `src/components/calendar/calendar-month-view.tsx` | **Delete**. Obsolete card abstraction. |
| **DUP-30** | Calendar Chrome | Duplicate `PriorOverdueBacklogBanner` | `src/components/calendar/executive-calendar-workspace.tsx` | 463–582 | `src/components/dashboard/prior-overdue-backlog-banner.tsx` | **Delete duplicate**. Import from dashboard. |
| **DUP-31** | Portal Workspace | `ExecutiveCockpitWorkspace` | `src/components/portal/executive-cockpit-workspace.tsx` | 1–2427 | Active `/dashboard` & `/tasks` pages | **Delete Dead File** (2,427 lines, unrouted). |
| **DUP-32** | Portal Workspace | `DepartmentManagerWorkspace` | `src/components/portal/department-manager-workspace.tsx` | 1–1476 | Active `/unit-tasks` & `/dashboard` | **Delete Dead File** (1,476 lines, unrouted). |
| **DUP-33** | Portal Workspace | `LecturerFocusWorkspace` | `src/components/portal/lecturer-focus-workspace.tsx` | 1–1617 | Active `/tasks` (personal scope) | **Delete Dead File** (1,617 lines, unrouted). |
| **DUP-34** | Portal Workspace | `ExecutiveCockpitWorkspace` (Dashboard) | `src/components/dashboard/executive-cockpit-workspace.tsx` | 1–560 | `src/app/dashboard/page.tsx` | **Delete Dead Facade** (560 lines). |
| **DUP-35** | Workspace Hubs | `AttentionHubs` (`forcedRole`) | `src/components/workspace/components/attention-hubs.tsx` | 1–135 | Canonical Domain Authority Engine | **Delete**. Violates Domain Freeze Rules 1 & 2. |
| **DUP-36** | Workspace Re-exports | 6 Workspace Facades | `src/components/workspace/{executive,manager,staff}-workspace.tsx` | All | Direct Component Imports | **Delete 6 forwarding stubs**. |
| **DUP-37** | Layout Clone | `mobile-bottom-bar.tsx` vs `mobile-bottom-nav.tsx` | `src/components/layout/mobile-bottom-bar.tsx` & `mobile-bottom-nav.tsx` | All (32–91) | Single Canonical `mobile-bottom-nav.tsx` | **Delete clone** `mobile-bottom-bar.tsx`. |
| **DUP-38** | Constants | Hardcoded `DEPARTMENT_OPTIONS` | `src/components/tasks/cascading-task-table.tsx` & `src/components/tasks/table/constants.ts` | 72–88 & 225–240 | Server API `/api/organization/departments` | **Eliminate hardcoding**. Fetch from server truth. |
| **DUP-39** | Constants | Hardcoded `CATEGORY_TABS` | `src/components/tasks/cascading-task-table.tsx` & `src/components/tasks/table/constants.ts` | 55–70 & 205–215 | `src/components/tasks/table/constants.ts` | **Consolidate** to single source of truth. |
| **DUP-40** | Obsolete Role View | `StaffFocusView` | `src/components/dashboard/roles/staff-focus-view.tsx` | 1–680 | `UnifiedAdaptiveWorkspace` (personal scope) | **Deprecate / Shim**. Obsolete role-specific view (680 lines) with zero runtime route imports. |
| **DUP-41** | Portal Re-exports | 3 Portal Workspace Stubs | `src/components/portal/{executive,manager,staff}-workspace.tsx` | All (1–6 each) | `UnifiedAdaptiveWorkspace` | **Delete 3 forwarding stubs** in `src/components/portal/`. |
| **DUP-42** | Modal Forwarders | 2 Workspace Modal Stubs | `src/components/workspace/{submit-deliverable-modal,review-action-dialog}.tsx` | All (1–5 each) | Canonical Workspace Modals | **Consolidate** with portal modal implementations into canonical location. |

---

## 3. Detailed Categorization & Architectural Analysis

### 3.1 Duplicated Scope Switchers

#### The Canonical Owner
`src/components/layout/scope-switcher.tsx` (lines 28–210)
- Single source of truth for changing the display dataset scope (`school` | `unit` | `personal`).
- Synchronizes with URL query parameters (`?scope=...`) and dispatches `qcet:scope-change` CustomEvent.
- Respects statutory user authority without masquerading.

#### Duplicated Instances
1. **`src/components/workspace/components/adaptive-scope-header.tsx` (lines 188–232)**:
   - Renders 3 tab buttons (`my`, `unit`, `school`) with badge counters.
   - Embeds its own search input (lines 142–184), view toggle (lines 234–265), and task creation button (lines 268–285).
   - Operates inside `UnifiedAdaptiveWorkspace`, isolating its scope state from the canonical layout bar.
2. **`src/components/dashboard/unified-task-toolbar.tsx` (lines 453–500, 625–675)**:
   - Embeds a full tablist marked with `data-slot="adaptive-scope-header"`.
   - Filters scopes with ad-hoc `opt.isAuthorized` logic (lines 470–488) that substitutes role checks (`user?.role === "ADMIN"`) for statutory permissions.
   - Renders duplicate tabs inside the table filter bar directly below the page-level scope switcher.
3. **`src/components/dashboard/personal-workbench.tsx` (lines 580–600)**:
   - Injects `<ScopeSwitcher />` into its local Action Bar alongside `<GlobalMonthSelector />`.
   - Because `dashboard-zone.tsx` (line 75) already renders `<ScopeSwitcher />`, the user is presented with two identical `ScopeSwitcher` controls stacked vertically.
4. **`src/components/layout/mobile-menu-drawer.tsx` (lines 120–150)**:
   - Re-renders `<ScopeSwitcher />` inside the mobile navigation drawer without two-way binding with the active page toolbar.

#### Violation of Invariants
- **Rule 3 ("Role Is Not Scope")**: Multiple toolbars check `user.role === 'ADMIN'` to decide whether the `school` scope tab is clickable, rather than checking whether the user holds school-level viewing permissions.
- **Rule 1 ("One Capability, One Implementation")**: Four different UI surfaces manage the active scope variable, resulting in desynchronized URL states when navigating between `/dashboard`, `/tasks`, and `/unit-tasks`.

---

### 3.2 Duplicated & Divergent Task Status Mappings

#### The Canonical Definition
Database schema (`prisma/schema.prisma` lines 52–59):
```prisma
enum TaskStatus {
  NOT_STARTED
  IN_PROGRESS
  WAITING_APPROVAL
  COMPLETED
  OVERDUE
  CANCELLED
}
```

#### Divergent Status Implementations & Mapping Fragmentation

```
+-----------------------------------------------------------------------------------+
|                           PRISMA DATABASE ENUM                                    |
|   NOT_STARTED | IN_PROGRESS | WAITING_APPROVAL | COMPLETED | OVERDUE | CANCELLED       |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                         DOMAIN & STATE MACHINE                                    |
|   src/domain/tasks/types.ts:         DomainTaskStatus (matches Prisma)             |
|   src/domain/tasks/state-machine.ts: CanonicalTaskStatus = 'NEW' | 'IN_PROGRESS' ...  |
|                                      TaskStatus = Canonical | 'TODO' | 'DONE' ... |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                         ADAPTERS & CLIENT MAPPERS                                 |
|   task-db-adapter.ts:  NOT_STARTED -> NEW, WAITING_APPROVAL -> NEEDS_REVIEW       |
|   mappers.ts:          Maps to lowercase ('not_started', 'in_progress', ...)      |
|   dashboard.d.ts:      TaskStatus = NEW | IN_PROGRESS | COMPLETED | NEEDS_REVIEW |    |
|                                     WAITING_APPROVAL | PENDING_EXECUTIVE_APPROVAL | |
|                                     BLOCKED | CANCELLED                           |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                         UI PRESENTATION COMPONENTS                                |
|   constants.ts:           STATUS_BADGE_CONFIGS (NEW, NEEDS_REVIEW, OVERDUE...)    |
|   cascading-task-table:   Duplicate getStatusBadgeConfig with 13 variant colors   |
|   task-kanban-board:      KANBAN_COLUMNS (NEW, IN_PROGRESS, NEEDS_REVIEW...)      |
|   task-detail-side-sheet: STATUS_OPTIONS (8 ad-hoc status strings)                |
|   calendar-month-view:    getStatusDotClass (hardcoded '2026-09-04' overdue rule) |
|   simplified-filter-bar:  SimplifiedTaskStatus = ALL | ACTION_REQUIRED | ...       |
+-----------------------------------------------------------------------------------+
```

#### Breakdown of Inconsistencies:
1. **The `NOT_STARTED` vs `NEW` Fracture**:
   - The database stores `NOT_STARTED`.
   - `task-db-adapter.ts` (line 161) converts `NOT_STARTED` to `NEW`.
   - `state-machine.ts` defines `CanonicalTaskStatus` with `'NEW'` instead of `'NOT_STARTED'`.
   - `contract.ts` (lines 355, 441) is forced to write dual checks: `normStatus === 'NOT_STARTED' || normStatus === 'NEW'`.
2. **The `WAITING_APPROVAL` vs `NEEDS_REVIEW` vs `PENDING_EXECUTIVE_APPROVAL` Fracture**:
   - Database has only `WAITING_APPROVAL`.
   - Adapters and UI invent `NEEDS_REVIEW` and `PENDING_EXECUTIVE_APPROVAL`.
   - `contract.ts` (lines 368, 404) writes `normStatus !== 'WAITING_APPROVAL' && normStatus !== 'NEEDS_REVIEW'`.
3. **Hardcoded Reference Date in Calendar**:
   - `src/components/calendar/calendar-month-view.tsx` (line 124) hardcodes:
     ```ts
     if (cleanDue < "2026-09-04") return "bg-rose-500"; // Quá hạn
     ```
     This violates Rule 4 ("Never Invent Operational Data") and ignores `systemReferenceDate` provided by the server context.

---

### 3.3 Redundant & Obsolete KPI Cards

On the Executive Dashboard (`/dashboard`), the user encounters severe card fatigue caused by uncoordinated component composition:

```
+---------------------------------------------------------------------------------------+
| 1. ExecutiveStatStrip (src/components/dashboard/executive-stat-strip.tsx)             |
|    [Tổng nhiệm vụ]  [Chờ BGH duyệt]  [Trễ hạn / vướng]  [Trọng tâm]  [Tiến độ toàn...] |
+---------------------------------------------------------------------------------------+
                                           │
                                           ▼ (Immediately followed by)
+---------------------------------------------------------------------------------------+
| 2. ExecutiveActionCenter (src/components/dashboard/executive-action-center.tsx)       |
|    [Chờ BGH Phê duyệt]       [Vướng mắc & Trễ hạn]       [Nhiệm vụ Chiến lược]       |
|    (Duplicate Count #1)      (Duplicate Count #2)        (Duplicate Count #3)         |
+---------------------------------------------------------------------------------------+
                                           │
                                           ▼ (Followed in PersonalWorkbench by)
+---------------------------------------------------------------------------------------+
| 3. SmartWorkbox (src/components/workspace/smart-workbox.tsx)                          |
|    [Việc của tôi]            [Chờ phê duyệt]             [Quá hạn]                    |
|    (Overlapping Count #4)    (Overlapping Count #5)      (Overlapping Count #6)       |
+---------------------------------------------------------------------------------------+
```

#### Flaws Identified:
- **Card-Level Redundancy**: Cards 1, 2, and 3 of `ExecutiveActionCenter` display the exact same numbers as Cards 2, 3, and 4 of `ExecutiveStatStrip`.
- **Denominator Conflation**: In `computeDepartmentHealthMatrix` and `SmartWorkbox`, parent tasks (`SchoolTask`) and subtasks (`StaffTask`) are summed into a single denominator, distorting completion percentages.
- **Metric Confusion**: Macro KPIs ("What is the institution's progress?") are visually indistinguishable from Personal Action Affordances ("What documents must I sign today?").

---

### 3.4 Parallel Monolithic Toolbars & View Switchers

#### The Toolbar Duality
Two complete, monolithic toolbars coexist in `src/components/`:
1. `src/components/dashboard/unified-task-toolbar.tsx` (1,323 lines)
2. `src/components/tasks/table/components/task-table-toolbar.tsx` (1,019 lines)

Both toolbars implement:
- Search input with `/` shortcut and debounce
- Density toggle (`compact` vs `comfortable`)
- Custom columns popover (visibility checkboxes)
- Export to Excel / CSV / JSON
- Saved views dropdown
- Smart filter tabs (`all`, `overdue`, `in_progress`, `completed`)
- Department filter selector
- Month / Semester picker
- Table vs Kanban view switcher

#### The View Switcher Proliferation
View switching controls are duplicated across 6 distinct files:
1. `src/components/dashboard/zones/tasks-expanded-views.tsx` (5 view buttons: Executive, Table, Kanban, Calendar, Department)
2. `src/components/dashboard/unified-task-toolbar.tsx` (Table vs Kanban buttons, lines 1240–1280)
3. `src/components/tasks/table/components/task-table-toolbar.tsx` (Table vs Kanban buttons, lines 905–945)
4. `src/components/workspace/components/adaptive-scope-header.tsx` (Table vs Kanban buttons, lines 234–265)
5. `src/components/calendar/calendar-workspace.tsx` (4 calendar view buttons: Month, Week, Day, Agenda, lines 650–715)
6. `src/components/calendar/executive-calendar-workspace.tsx` (2 view buttons: Week vs Agenda, lines 825–860)

---

### 3.5 Dead Calendar Chrome & Dead Portal Workspaces

#### Dead Calendar File & Test Harness Dependencies
- **File**: `src/components/calendar/executive-calendar-workspace.tsx` (1,230 lines)
- **Status**: 100% DEAD in runtime routing (`src/app/calendar/page.tsx` routes directly to `CalendarWorkspace` in `src/components/calendar/calendar-workspace.tsx`).
- **Contains**:
  - `ExecutiveCalendarWorkspace` component (647 lines)
  - `WorkCalendarCard` component (193 lines)
  - Duplicate `PriorOverdueBacklogBanner` component (119 lines, duplicating `src/components/dashboard/prior-overdue-backlog-banner.tsx`)
  - Duplicate week calculation helpers (`getWeekDays`, `formatWeekSpan`, `calculateEventLayout`, lines 115–265)
- **CRITICAL TEST DEPENDENCY WARNING**:
  - `tests/calendar-route.test.ts` line 86 explicitly asserts: `assert.ok(fs.existsSync(calendarWorkspacePath), "executive-calendar-workspace.tsx must exist");`
  - `tests/calendar-route-integration.test.ts` asserts zero `dark:` classes in this file.
  - `tests/executive-calendar-workspace.test.ts` imports `ExecutiveCalendarWorkspace`, `calculateEventLayout`, `getWeekDays`, etc.
  - `tests/mobile-calendar-documents.test.ts` asserts zero emojis and zero dark classes in this file.
  - `src/components/calendar/calendar-workspace.tsx` imports helper functions (`calculateEventLayout`, `getWeekDays`, `PriorOverdueBacklogBanner`) from this file.
  - **Remediation Requirement**: Cannot be deleted abruptly in Wave 1 without breaking these 4 test suites. It must either be converted to a lightweight shim exporting the canonical functions or test assertions must be updated in a coordinated wave.

#### Dead Portal Workspaces (6,000+ Lines) & Test Harness Dependencies
- `src/components/portal/executive-cockpit-workspace.tsx` (2,427 lines)
- `src/components/portal/department-manager-workspace.tsx` (1,476 lines)
- `src/components/portal/lecturer-focus-workspace.tsx` (1,617 lines)
- `src/components/dashboard/executive-cockpit-workspace.tsx` (560 lines)
- `src/components/workspace/components/attention-hubs.tsx` (135 lines)
- **Status**: Completely bypassed by modern routes in `src/app/` (`/dashboard`, `/tasks`, `/unit-tasks`).
- These files contain legacy implementations of `LegacyExecutiveCockpitWorkspace`, `LegacyDepartmentManagerWorkspace`, and `LegacyLecturerFocusWorkspace`.
- Their primary exports delegate to `UnifiedAdaptiveWorkspace` with `forcedRole="ADMIN"`, `forcedRole="MANAGER"`, and `forcedRole="STAFF"`, directly violating **Domain Freeze Rule 1 & Rule 2**.
- **CRITICAL TEST DEPENDENCY WARNING**:
  - `tests/role-based-workspace-workflow.test.ts`, `tests/legacy-cleanup-modal-hierarchy.test.ts`, `tests/role-landing-integration.test.ts`, `tests/executive-single-header.test.ts`, and `tests/executive-cockpit-workspace.test.ts` contain explicit `assert.ok(fs.existsSync(fullPath), ...)` checks and import these files for backward compatibility.
  - **Remediation Requirement**: Replace implementation guts with clean shims or remove alongside test updates during coordinated cleanup (Wave 3).

#### Layout Clones: `mobile-bottom-bar.tsx` vs `mobile-bottom-nav.tsx`
- `src/components/layout/mobile-bottom-bar.tsx` (92 lines)
- `src/components/layout/mobile-bottom-nav.tsx` (92 lines)
- **Status**: Identical code, mutual cross-export aliases (`export const MobileBottomBar = MobileBottomNav` vs `export const MobileBottomNav = MobileBottomBar`).
- **CRITICAL TEST FINDING**:
  - `tests/mobile-bottom-nav.test.ts` line 16 explicitly asserts: `assert.strictEqual(fs.existsSync(navPath), true, "mobile-bottom-nav.tsx must exist");`
  - `tests/mobile-navigation-sync.test.ts` line 32 explicitly asserts: `assert.ok(fs.existsSync(bottomNavPath), "mobile-bottom-nav.tsx must exist");`
  - `tests/navigation-drawer-sync.test.ts` and `src/components/layout/app-shell.tsx` import `mobile-bottom-nav`.
  - In contrast, `src/components/layout/mobile-bottom-bar.tsx` has **ZERO** external imports and **ZERO** test assertions across the entire repository.
  - **Resolution**: Retain `src/components/layout/mobile-bottom-nav.tsx` as the canonical file. Designate `src/components/layout/mobile-bottom-bar.tsx` for deletion.

---

## 4. Legacy Deletion & Consolidation Action Plan

This checklist outlines the sequential operations required to eliminate all identified duplications and restore compliance with the system invariants.

### Phase 1: Scope Switcher & Toolbar Consolidation
- [ ] **DEL-01**: Retain `src/components/layout/scope-switcher.tsx` as the single canonical scope controller.
- [ ] **DEL-02**: Remove embedded scope tablist (`data-slot="adaptive-scope-header"`) from `src/components/dashboard/unified-task-toolbar.tsx` (lines 453–500, 625–675).
- [ ] **DEL-03**: Delete redundant `<ScopeSwitcher />` in `src/components/dashboard/personal-workbench.tsx` (lines 580–600).
- [ ] **DEL-04**: Consolidate `TaskTableToolbar` and `UnifiedTaskToolbar` into a single canonical `TaskTableToolbar` under `src/components/tasks/table/components/task-table-toolbar.tsx`.
- [ ] **DEL-05**: Delete `src/components/tasks/unified-task-toolbar.tsx` re-export stub.

### Phase 2: Task Status Canonicalization
- [ ] **DEL-06**: Align `state-machine.ts` `CanonicalTaskStatus` with Prisma `enum TaskStatus` (replace `NEW` with `NOT_STARTED`).
- [ ] **DEL-07**: Refactor `src/lib/adapters/task-db-adapter.ts` to output canonical `DomainTaskStatus` without synthetic `NEW` or `NEEDS_REVIEW` mappings.
- [ ] **DEL-08**: Update `src/domain/tasks/mappers.ts` `toTaskViewModel` to output uppercase canonical statuses (`NOT_STARTED`, `IN_PROGRESS`, `WAITING_APPROVAL`, `COMPLETED`, `OVERDUE`, `CANCELLED`).
- [ ] **DEL-09**: Clean up `contract.ts` transition checks, removing duplicate checks for `normStatus === 'NEW'` and `normStatus === 'NEEDS_REVIEW'`.
- [ ] **DEL-10**: Consolidate status badge configurations: retain `src/components/tasks/table/constants.ts` `STATUS_BADGE_CONFIGS`, delete duplicate `getStatusBadgeConfig` in `src/components/tasks/cascading-task-table.tsx`.
- [ ] **DEL-11**: Remove hardcoded date `2026-09-04` from `src/components/calendar/calendar-month-view.tsx` and bind overdue evaluation to `isTaskPastDue(dueDate, referenceDate)`.
- [ ] **DEL-12**: Deprecate `SimplifiedTaskStatus` in `src/components/dashboard/simplified-task-filter-bar.tsx`.

### Phase 3: Dashboard & KPI Card Streamlining
- [ ] **DEL-13**: Retain `src/components/dashboard/executive-stat-strip.tsx` as the sole canonical macro indicator strip.
- [ ] **DEL-14**: Remove the 3 secondary metric cards from `src/components/dashboard/executive-action-center.tsx` (lines 135–240), converting the component strictly into an action item list.
- [ ] **DEL-15**: Refactor `SmartWorkbox` inside `PersonalWorkbench` to display personal signature and review backlogs rather than duplicating school-wide macro counts.
- [ ] **DEL-16**: Remove duplicate metric chips in `src/components/tasks/cascading-task-table.tsx` (lines 230–290).

### Phase 4: Dead Calendar Chrome Removal
- [ ] **DEL-17**: Delete dead file `src/components/calendar/executive-calendar-workspace.tsx` (1,230 lines).
- [ ] **DEL-18**: Update `src/components/calendar/calendar-workspace.tsx` to import `PriorOverdueBacklogBanner` directly from `@/components/dashboard/prior-overdue-backlog-banner`.
- [ ] **DEL-19**: Remove unused `WorkCalendarCard` and duplicate week layout calculation functions.

### Phase 5: Dead Portal Facades & Legacy Workspaces Deletion
- [ ] **DEL-20**: Delete `src/components/portal/executive-cockpit-workspace.tsx` (2,427 lines).
- [ ] **DEL-21**: Delete `src/components/portal/department-manager-workspace.tsx` (1,476 lines).
- [ ] **DEL-22**: Delete `src/components/portal/lecturer-focus-workspace.tsx` (1,617 lines).
- [ ] **DEL-23**: Delete `src/components/dashboard/executive-cockpit-workspace.tsx` (560 lines).
- [ ] **DEL-24**: Delete `src/components/workspace/components/attention-hubs.tsx` (135 lines) and remove `forcedRole` usages.
- [ ] **DEL-25**: Delete the 6 forwarding facade files in `src/components/workspace/`:
  - `executive-cockpit-workspace.tsx`
  - `executive-workspace.tsx`
  - `manager-workspace.tsx`
  - `department-manager-workspace.tsx`
  - `staff-workspace.tsx`
  - `lecturer-focus-workspace.tsx`

### Phase 6: Dead Layout & Constants Pruning
- [ ] **DEL-26**: Delete unreferenced clone `src/components/layout/mobile-bottom-bar.tsx` (92 lines) while retaining the canonical, test-verified `src/components/layout/mobile-bottom-nav.tsx`.
- [ ] **DEL-27**: Remove hardcoded `DEPARTMENT_OPTIONS` arrays in `src/components/tasks/cascading-task-table.tsx` and `src/components/tasks/table/constants.ts`, binding department dropdowns to server-fetched departments.
- [ ] **DEL-28**: Deduplicate `CATEGORY_TABS` between `cascading-task-table.tsx` and `constants.ts`.

---

## 5. Explicit Inventory of Target Files Designated for Deletion vs. Conversion

To ensure safe refactoring without breaking test suites asserting file existence, target files are categorized into two explicit tiers:

### Tier 1: Safe Immediate Deletion (Zero External Imports & Zero Test Assertions)
| Target File Path | Line Count | Current Role | Deletion Rationale |
|---|---|---|---|
| `src/components/layout/mobile-bottom-bar.tsx` | 92 lines | Clone of `mobile-bottom-nav.tsx` | 0 imports in `src/`, 0 assertions in `tests/`. `mobile-bottom-nav.tsx` is canonical. |
| `src/components/tasks/unified-task-toolbar.tsx` | 5 lines | Re-export stub to dashboard toolbar | Dead re-export stub once canonical toolbar imports are unified. |
| `src/components/dashboard/cascading-task-table.tsx` | 10 lines | Re-export stub to tasks table | Redundant forwarder once callers import `@/components/tasks/cascading-task-table`. |
| `src/components/dashboard/active-filter-breadcrumb.tsx` | 1 line | Re-export stub to workspace | 1-line re-export stub. Callers can import directly from workspace. |
| `src/components/tasks/table/task-table-toolbar.tsx` | 4 lines | Re-export stub to components/ | Redundant file level re-export stub. |

### Tier 2: Protected Files Designated for Shim Conversion or Coordinated Deletion
*Note: These files contain legacy code and duplicate JSX, but are currently protected by automated test suites using `fs.existsSync` or direct helper imports. They must NOT be abruptly removed without migrating test assertions.*

| Target File Path | Line Count | Test Harness Protection / Imports | Recommended Action |
|---|---|---|---|
| `src/components/calendar/executive-calendar-workspace.tsx` | 1,230 lines | `tests/calendar-route.test.ts` (line 86 `existsSync`), `tests/executive-calendar-workspace.test.ts`, `tests/calendar-route-integration.test.ts` | Convert to thin export shim delegating to canonical `calendar-workspace.tsx` and shared adapters until test suites are updated. |
| `src/components/portal/executive-cockpit-workspace.tsx` | 2,427 lines | `tests/role-based-workspace-workflow.test.ts`, `tests/legacy-cleanup-modal-hierarchy.test.ts`, `tests/role-landing-integration.test.ts` | Strip 2,400+ lines of dead legacy JSX; convert to minimal adapter delegating to canonical `UnifiedAdaptiveWorkspace` without `forcedRole`. |
| `src/components/portal/department-manager-workspace.tsx` | 1,476 lines | `tests/role-based-workspace-workflow.test.ts`, `tests/legacy-cleanup-modal-hierarchy.test.ts` | Strip 1,400+ lines of dead legacy JSX; convert to minimal adapter. |
| `src/components/portal/lecturer-focus-workspace.tsx` | 1,617 lines | `tests/role-based-workspace-workflow.test.ts`, `tests/legacy-cleanup-modal-hierarchy.test.ts` | Strip 1,600+ lines of dead legacy JSX; keep pure calculation helpers (`getDaysRemaining`, `sortStaffTasks`, etc.) or delegate. |
| `src/components/dashboard/executive-cockpit-workspace.tsx` | 560 lines | `tests/executive-dashboard-streamlining.test.ts` imports `buildExecutiveAttentionQueue` | Extract pure domain function `buildExecutiveAttentionQueue` to canonical domain module; replace file with forwarding shim or retire after test update. |
| `src/components/dashboard/roles/staff-focus-view.tsx` | 680 lines | `tests/staff-focus-view.test.ts`, `tests/role-landing-integration.test.ts` | Deprecate role-specific view (680 lines); retain minimal shim for test harness until migrated to canonical personal-scope workspace. |
| `src/components/workspace/components/attention-hubs.tsx` | 135 lines | `tests/legacy-cleanup-modal-hierarchy.test.ts` (lines 230–240 asserts `data-slot`) | Remove `forcedRole` violations; delegate cleanly into canonical attention resolver (`F1`). |
| `src/components/portal/executive-workspace.tsx` | 6 lines | `tests/role-based-workspace-workflow.test.ts` (line 1975 asserts existence) | Retain 6-line forwarding shim or delete in lockstep with test suite refactor. |
| `src/components/portal/manager-workspace.tsx` | 6 lines | `tests/role-based-workspace-workflow.test.ts` (line 1409 asserts existence) | Retain 6-line forwarding shim or delete in lockstep with test suite refactor. |
| `src/components/portal/staff-workspace.tsx` | 6 lines | `tests/role-based-workspace-workflow.test.ts` (line 935 asserts existence) | Retain 6-line forwarding shim or delete in lockstep with test suite refactor. |
| `src/components/workspace/executive-cockpit-workspace.tsx` | 4 lines | `tests/role-based-workspace-workflow.test.ts` asserts existence | Retain 4-line forwarding shim or delete in lockstep with test suite refactor. |
| `src/components/workspace/executive-workspace.tsx` | 4 lines | `tests/role-based-workspace-workflow.test.ts` asserts existence | Retain 4-line forwarding shim or delete in lockstep with test suite refactor. |
| `src/components/workspace/manager-workspace.tsx` | 4 lines | `tests/role-based-workspace-workflow.test.ts` asserts existence | Retain 4-line forwarding shim or delete in lockstep with test suite refactor. |
| `src/components/workspace/department-manager-workspace.tsx` | 4 lines | `tests/role-based-workspace-workflow.test.ts` asserts existence | Retain 4-line forwarding shim or delete in lockstep with test suite refactor. |
| `src/components/workspace/staff-workspace.tsx` | 4 lines | `tests/role-based-workspace-workflow.test.ts` asserts existence | Retain 4-line forwarding shim or delete in lockstep with test suite refactor. |
| `src/components/workspace/lecturer-focus-workspace.tsx` | 4 lines | `tests/role-based-workspace-workflow.test.ts` asserts existence | Retain 4-line forwarding shim or delete in lockstep with test suite refactor. |
| `src/components/workspace/submit-deliverable-modal.tsx` | 5 lines | `tests/role-based-workspace-workflow.test.ts` (line 234 asserts existence) | Retain 5-line forwarder to canonical submit deliverable modal until test suite refactor. |
| `src/components/workspace/review-action-dialog.tsx` | 5 lines | `tests/role-based-workspace-workflow.test.ts` asserts existence | Retain 5-line forwarder to canonical review action dialog until test suite refactor. |

---

## 6. Quantitative Impact Summary

| Subsystem / Metric | Pre-Consolidation | Post-Consolidation Target | Net Reduction |
|---|---|---|---|
| **Scope Switcher Implementations** | 8 distinct locations | 1 canonical component (`ScopeSwitcher`) | -7 redundant controls |
| **Task Status Enum Variants** | 12 fragmented mappings (8+ synthetic names) | 1 canonical enum (6 DB values) | -6 synthetic statuses |
| **Total Lines of Dead / Duplicate Code** | 10,642 lines | 0 lines | **-10,642 lines deleted** |
| **Monolithic Toolbars** | 2 toolbars (2,342 lines) | 1 unified toolbar (~900 lines) | -1,442 lines |
| **Dead Portal Workspaces** | 4 files (6,080 lines) | 0 files | -6,080 lines |
| **Dead Calendar Chrome** | 1 file (1,230 lines) | 0 files | -1,230 lines |
| **Concurrent KPI Cards on Dashboard** | 12 overlapping cards | 5 canonical macro KPI cards | -7 duplicate cards |

---
*Audit completed by Agent R8 for QCET Work UI Semantic Consolidation.*
