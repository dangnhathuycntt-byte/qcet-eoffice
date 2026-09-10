/**
 * Canonical Workspace Semantic Contracts (Gate G0 Frozen Interface)
 *
 * Defines the 8 universal semantic dimensions:
 * 1. scope: 'school' | 'unit' | 'my'
 * 2. period: academic month (1..12, ALL) or date (YYYY-MM-DD)
 * 3. status: objective lifecycle progression
 * 4. attention: subjective user action backlog
 * 5. filters: multi-attribute predicates
 * 6. query: search needle (q)
 * 7. view: visual presentation mode
 * 8. selection: focused entity ID (taskId)
 */

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

export interface DetailedKanbanProjection {
  column: KanbanColumnId;
  isOverdue: boolean;
  isExcluded: boolean;
  exclusionReason?: 'CANCELLED' | 'ARCHIVED' | null;
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

/**
 * Normalized query parameters parsed from / written to window.location.search
 */
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
