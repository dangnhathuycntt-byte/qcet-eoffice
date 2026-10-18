/**
 * Canonical Workspace Semantic Contracts (Gate G0 Frozen Interface)
 *
 * FROZEN CONTRACT — single-writer (shard-contracts-freeze owns src/contracts/**).
 * Authority: Master Plan §5 (C1–C16) + §38–§41 (C17–C20); see
 * .claude/rules/core.md. Consumers must not rename or widen
 * these interfaces without domain proof and an explicit contract revision.
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

export type TaskLifecycleStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'WAITING_APPROVAL'
  | 'PENDING_EXECUTIVE_APPROVAL'
  | 'COMPLETED'
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

export type TaskViewMode = 'table' | 'kanban';
export type CalendarViewMode = 'month' | 'agenda';

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
