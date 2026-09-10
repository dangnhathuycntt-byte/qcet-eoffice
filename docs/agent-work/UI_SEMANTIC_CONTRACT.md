# QCET E-Office: Canonical UI Semantic Contract (Gate G0)

**Status**: FROZEN / IMMUTABLE v1  
**Date**: 2026-09-10  
**Authority**: Institutional Architecture & Master Re-architecture Steering (Gate G0)

---

## 1. Universal Semantic Dimensions

The 8 canonical dimensions below represent orthogonal, non-interchangeable concepts across all workspaces (Tasks, Calendar, Dashboard). A UI control or URL parameter must NEVER represent more than one dimension simultaneously.

```text
┌───────────┬───────────────────────────────────┬──────────────────────────────────────────┐
│ Dimension │ Definition                        │ Allowed Values / Type                    │
├───────────┼───────────────────────────────────┼──────────────────────────────────────────┤
│ 1. scope  │ Dataset boundary / tenant domain  │ 'school' | 'unit' | 'my'                 │
│ 2. period │ Temporal horizon                  │ Academic Month (1..12, ALL) / ISO date   │
│ 3. status │ Entity lifecycle progression      │ NOT_STARTED, IN_PROGRESS, WAITING_APP... │
│ 4. attent.│ Subjective user action backlog    │ requires_my_approval, requires_my_action │
│ 5. filters│ Multi-attribute narrowing         │ deptId, priority, category, isStrategic  │
│ 6. query  │ Text search needle                │ string (q)                               │
│ 7. view   │ Data visual representation        │ Tasks: 'table'|'kanban'; Cal: 'month'|'agenda'
│ 8. select.│ Entity focus / deep-link          │ taskId, documentId                       │
└───────────┴───────────────────────────────────┴──────────────────────────────────────────┘
```

### Invariant Prohibitions:
1. **Scope != Status**: `Của tôi` (`my`) is strictly a **Scope** (dataset filter). It must NEVER appear as a lifecycle status, a status tab, or a kanban column.
2. **Attention != Status**: `Chờ duyệt` (Task in `WAITING_APPROVAL`) is an objective entity lifecycle status. `Cần tôi xử lý` / `Cần tôi duyệt` is a subjective attention state computed by evaluating whether the authenticated user holds statutory approval authority for that task and does not violate Segregation of Duties.
3. **Period != Status**: `Hôm nay` (Today) or `Đến hạn trong tuần` is a temporal filter predicate, NOT a lifecycle status.
4. **View != Filter**: Switching between Table and Kanban (or Month and Agenda) must preserve identical underlying data and active filters. It must never alter the dataset.

---

## 2. Canonical Conceptual Model & Frozen Public Interfaces (`src/contracts/workspace-semantic.ts`)

All consuming workstreams (F1–F4, P1–P3) must implement and consume these exact signatures:

```typescript
export type WorkspaceScopeType = 'school' | 'unit' | 'my';

export interface WorkspaceScope {
  type: WorkspaceScopeType;
  unitId?: string;
}

export interface ScopeSwitcherProps {
  activeScope: WorkspaceScopeType;
  onScopeChange: (scope: WorkspaceScopeType) => void;
  counts?: Partial<Record<WorkspaceScopeType, number>>;
  disabledScopes?: WorkspaceScopeType[];
  selectedUnitId?: string;
  onUnitChange?: (unitId: string) => void;
  units?: Array<{ id: string; name: string; shortName?: string }>;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
  fullWidth?: boolean;
  syncUrl?: boolean;
}

export type TaskLifecycleStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'WAITING_APPROVAL'
  | 'PENDING_EXECUTIVE_APPROVAL'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'CANCELLED';

export type KanbanColumnId = 'NEW' | 'IN_PROGRESS' | 'NEEDS_REVIEW' | 'COMPLETED';

export interface KanbanColumnMapping {
  column: KanbanColumnId;
  isOverdue: boolean;
}

export type TaskStatusMapperFn = (dbStatus: string) => TaskLifecycleStatus;

export type TaskKanbanMapperFn = (lifecycleStatus: TaskLifecycleStatus) => KanbanColumnMapping;

export type UserAttentionType =
  | 'requires_my_approval'
  | 'requires_my_action'
  | 'blocked'
  | 'overdue'
  | 'due_soon';

export interface UserAttentionContext {
  userId: string;
  role?: string;
  positionCode?: string;
  departmentId?: string | null;
  isAdmin?: boolean;
  isExecutive?: boolean;
  isUnitHead?: boolean;
  canApprove?: boolean;
  now?: Date | string | number;
}

export type AttentionResolverFn = (
  task: {
    id: string;
    createdById?: string | null;
    assigneeId?: string | null;
    coAssigneeIds?: string[];
    departmentId?: string | null;
    status: string;
    progressPercent?: number;
    dueDate?: string | Date | null;
    isStrategic?: boolean;
    priority?: string;
  },
  user: UserAttentionContext
) => UserAttentionType[];

export type PeriodFilterValue = number | 'ALL';

export interface WorkspacePeriod {
  year?: number;
  month?: PeriodFilterValue;
  date?: string; // YYYY-MM-DD
}

export interface PeriodSelectorProps {
  selectedMonth: PeriodFilterValue;
  onMonthChange: (month: PeriodFilterValue) => void;
  academicYear?: string;
  disabled?: boolean;
  showSemesterPresets?: boolean;
  className?: string;
}

export interface StatusFilterOption {
  id: string;
  label: string;
  shortLabel?: string;
  count?: number;
  badgeClass?: string;
}

export interface StatusFilterProps {
  activeStatus: string;
  onStatusChange: (status: string) => void;
  options?: StatusFilterOption[];
  counts?: Record<string, number>;
  showAllOption?: boolean;
  className?: string;
}

export type TaskViewMode = 'table' | 'kanban';
export type CalendarViewMode = 'month' | 'agenda';

export interface ViewOption<T extends string = string> {
  id: T;
  label: string;
  ariaLabel?: string;
}

export interface ViewSwitcherProps<T extends string = string> {
  activeView: T;
  onViewChange: (view: T) => void;
  options?: ViewOption<T>[];
  variant?: 'tasks' | 'calendar' | 'custom';
  className?: string;
}

export interface MetricCardData {
  id: string;
  title: string;
  value: number | string;
  subtitle?: string;
  statusFilterKey?: string;
  isInteractive?: boolean;
}

export interface StandardWorkspaceMetrics {
  totalTasks: number;
  inProgressCount?: number;
  waitingApprovalCount: number;
  urgentOverdueCount: number;
  completedCount?: number;
  completedRate?: number;
}

export interface MetricStripProps {
  cards?: MetricCardData[];
  metrics?: StandardWorkspaceMetrics;
  activeFilter?: string;
  onFilterChange?: (statusKey: string) => void;
  className?: string;
}

export interface ActionQueueTabItem {
  id: string;
  label: string;
  count: number;
  variant?: 'urgent' | 'warning' | 'info' | 'neutral';
}

export interface ActionQueueShellProps {
  title?: string;
  subtitle?: string;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  tabs?: ActionQueueTabItem[];
  totalCount?: number;
  children?: unknown;
  headerRight?: unknown;
  footerSlot?: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}

export interface WorkspaceToolbarAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export interface WorkspaceToolbarProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  leftSlot?: unknown;
  centerSlot?: unknown;
  rightSlot?: unknown;
  viewSlot?: unknown;
  periodSlot?: unknown;
  primaryAction?: WorkspaceToolbarAction;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
  filterCount?: number;
  className?: string;
  children?: unknown;
}

export interface WorkspaceFilterState {
  scope: WorkspaceScopeType;
  unitId?: string;
  month?: PeriodFilterValue;
  date?: string;
  status?: TaskLifecycleStatus | 'ALL';
  attention?: UserAttentionType | 'ALL';
  view: TaskViewMode | CalendarViewMode;
  query?: string;
  selectedTaskId?: string;
}

export interface WorkspaceQueryParams {
  scope?: WorkspaceScopeType;
  dept?: string;
  month?: string;
  date?: string;
  status?: string;
  attention?: string;
  view?: string;
  q?: string;
  taskId?: string;
  viewId?: string;
}
```

---

## 3. Resolution of the 395 vs. 310 Discrepancy (The 85-Task Delta)

From audit R1, the observed discrepancy on the Kanban board is formally resolved:
- **Total Valid Tasks in Period**: 404 (or 395 in specific month filters).
- **Visible Kanban Cards**: 319 (or 310).
- **Missing Delta (85 tasks)**:
  - 75 tasks in `NOT_STARTED`
  - 9 tasks in `WAITING_APPROVAL`
  - 1 task in `OVERDUE`
- **Root Cause**: The legacy Kanban board defined columns `['NEW', 'IN_PROGRESS', 'NEEDS_REVIEW', 'COMPLETED']`. Tasks grouped under database keys `NOT_STARTED`, `WAITING_APPROVAL`, and `OVERDUE` failed key matching and were silently dropped from the render tree.
- **Mandatory Kanban Mapping Contract**:
  - `NOT_STARTED` maps to column `'NEW'` (Header: "Chưa thực hiện" / "Mới")
  - `IN_PROGRESS` maps to column `'IN_PROGRESS'` (Header: "Đang thực hiện")
  - `WAITING_APPROVAL` & `PENDING_EXECUTIVE_APPROVAL` map to column `'NEEDS_REVIEW'` (Header: "Chờ duyệt")
  - `COMPLETED` maps to column `'COMPLETED'` (Header: "Hoàn thành")
  - `OVERDUE` tasks remain in their operational column (`IN_PROGRESS`) with `isOverdue: true` (prominent Overdue badge), OR are rendered with an explicit filter/toggle.
  - Invariant Equation: `mapped_tasks + intentionally_excluded_tasks = total_tasks`. Zero silent dropping.

---

## 4. Single Global Primary Action Invariant

Every primary workspace page must have **exactly ONE global page-level primary CTA**:
- **/tasks**: `+ Giao việc` (Single button in toolbar; redundant header button deleted).
- **/calendar**: `+ Tạo` (Dropdown menu: "Tạo công việc" | "Tạo sự kiện"; side sheet button "+ Thêm việc ngày này" is contextual, not a second global CTA).
- **/dashboard**: Executive Cockpit does not have competing create buttons; actions are contextual to items in the Action Queue.

---

## 5. Dashboard Cockpit Consolidation Contract

1. **Macro Metric Strip (Band 1)**:
   - Contains exactly 5 primary KPI cards:
     1. `Tổng nhiệm vụ` (Cấp trường)
     2. `Chờ duyệt` (Toàn trường)
     3. `Điểm nghẽn & Trễ hạn`
     4. `Nhiệm vụ Trọng tâm` (isStrategic === true OR priority === 'URGENT')
     5. `Tiến độ & Hoàn thành`
   - Metric cards answer: *"What is the overall institutional situation?"*
2. **Action Queue / Cockpit (Band 2)**:
   - Secondary metric cards ("Chờ BGH Phê duyệt", "Vướng mắc & Trễ hạn", "Nhiệm vụ Chiến lược") in `ExecutiveActionCenter` are **DELETED**.
   - Directly renders the actionable signature queue (`ActionInboxService` / `GET /api/me/inbox`).
   - Action items answer: *"What must I act on right now?"*
3. **Zero Synthetic Operational Data**:
   - Hardcoded arrays (`DEFAULT_SCHEDULE_ITEMS`, `DEFAULT_NOTICES` in `workbench-mobile-feed.tsx`) are **DELETED**.
   - If no events or notices exist, render authentic empty states.

---

## 6. Canonical URL Parameters Contract

| Parameter | Type / Values | Description |
|---|---|---|
| `scope` | `'school'` \| `'unit'` \| `'my'` | Display scope (Default: user viewScope) |
| `unit` / `dept` | string | Unit identifier when `scope=unit` |
| `month` | `'1'..'12'` \| `'ALL'` | Academic month |
| `date` | `'YYYY-MM-DD'` | Selected date on Calendar |
| `status` | `TaskLifecycleStatus` \| `'ALL'` | Lifecycle status filter |
| `view` | Tasks: `'table'`\|`'kanban'`; Cal: `'month'`\|`'agenda'` | Visual layout representation |
| `q` | string | Search needle (omitted when empty) |
| `taskId` | string | Deep-link to task details side sheet |
