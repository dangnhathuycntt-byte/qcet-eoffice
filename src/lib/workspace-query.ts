import type {
  WorkspaceFilterState as BaseWorkspaceFilterState,
  WorkspaceScopeType,
  TaskLifecycleStatus,
  UserAttentionType,
  TaskViewMode,
  CalendarViewMode,
} from "@/contracts/workspace-semantic";

export type {
  WorkspaceScopeType,
  TaskLifecycleStatus,
  UserAttentionType,
  TaskViewMode,
  CalendarViewMode,
};

/**
 * Canonical Workspace Filter State
 *
 * Fully typed representation of workspace dimensions:
 * - scope: 'school' | 'unit' | 'my'
 * - unitId / dept / unit: department or organizational unit identifier
 * - month: academic month (1..12) or 'ALL'
 * - date: ISO date string (YYYY-MM-DD)
 * - status: objective task lifecycle progression or 'ALL'
 * - attention: subjective user action backlog
 * - view: presentation mode ('table' | 'kanban' | 'month' | 'agenda')
 * - q / query: search needle
 * - taskId / selectedTaskId: selected task identifier for side sheet / modal deep-linking
 */
export interface WorkspaceFilterState extends BaseWorkspaceFilterState {
  dept?: string;
  unit?: string;
  q?: string;
  taskId?: string;
  month: number | "ALL";
  status: TaskLifecycleStatus | "ALL";
  priority?: string;
  category?: string;
  deadline?: string;
  _unitParamKey?: "dept" | "unit";
}

export type RawQueryParams =
  | URLSearchParams
  | string
  | Record<string, unknown>
  | null
  | undefined;

export interface ParseWorkspaceQueryOptions {
  isCalendar?: boolean;
  defaultView?: TaskViewMode | CalendarViewMode;
  defaultScope?: WorkspaceScopeType;
}

export interface SerializeWorkspaceQueryOptions {
  isCalendar?: boolean;
  omitDefaultScope?: boolean;
  preserveParams?: URLSearchParams | string | Record<string, unknown>;
  unitParamKey?: "dept" | "unit";
}

export const DEFAULT_WORKSPACE_FILTER_STATE: Readonly<WorkspaceFilterState> = Object.freeze({
  scope: "school",
  month: "ALL",
  status: "ALL",
  view: "table",
});

const VALID_LIFECYCLE_STATUSES: Set<TaskLifecycleStatus> = new Set([
  "NOT_STARTED",
  "IN_PROGRESS",
  "WAITING_APPROVAL",
  "PENDING_EXECUTIVE_APPROVAL",
  "COMPLETED",
  "OVERDUE",
  "CANCELLED",
]);

const VALID_ATTENTION_TYPES: Set<UserAttentionType> = new Set([
  "requires_my_approval",
  "requires_my_action",
  "blocked",
  "overdue",
  "due_soon",
]);

const VALID_VIEW_MODES: Set<TaskViewMode | CalendarViewMode> = new Set([
  "table",
  "kanban",
  "month",
  "agenda",
]);

const WORKSPACE_QUERY_KEYS = [
  "scope",
  "scopeType",
  "s",
  "dept",
  "unitId",
  "unit",
  "departmentId",
  "department",
  "month",
  "academicMonth",
  "period",
  "date",
  "d",
  "status",
  "tab",
  "priority",
  "prio",
  "category",
  "cat",
  "deadline",
  "view",
  "viewMode",
  "v",
  "q",
  "query",
  "search",
  "taskId",
  "selectedTaskId",
  "task_id",
  "attention",
  "viewId",
  "view_id",
  "savedView",
];

/**
 * Extract a single string parameter from any supported query input format.
 */
function extractParam(params: RawQueryParams, key: string): string | undefined {
  if (!params) return undefined;

  if (params instanceof URLSearchParams) {
    const val = params.get(key);
    return val !== null ? val.trim() : undefined;
  }

  if (typeof params === "string") {
    let queryPart = params;
    const qIndex = params.indexOf("?");
    if (qIndex !== -1) {
      queryPart = params.slice(qIndex + 1);
    }
    const search = new URLSearchParams(queryPart);
    const val = search.get(key);
    return val !== null ? val.trim() : undefined;
  }

  if (typeof params === "object") {
    const record = params as Record<string, unknown>;
    const val = record[key];
    if (Array.isArray(val)) {
      if (val.length === 0) return undefined;
      const first = val[0];
      if (typeof first === "string") return first.trim();
      if (typeof first === "number" || typeof first === "boolean") return String(first);
      return undefined;
    }
    if (typeof val === "string") {
      return val.trim();
    }
    if (typeof val === "number" || typeof val === "boolean") {
      return String(val);
    }
  }

  return undefined;
}

/**
 * Parse raw URL parameters into a normalized WorkspaceFilterState.
 *
 * Implements legacy parameter migrations:
 * - scope: maps 'personal' -> 'my', 'all' -> 'school', 'SCHOOL_TASKS' -> 'school', 'MY_TASKS' -> 'my', 'UNIT_TASKS' -> 'unit'
 * - status: migrates legacy 'tab' parameter ('review' -> 'WAITING_APPROVAL', 'in_progress' -> 'IN_PROGRESS', etc.)
 * - dept / unit: aliases 'dept', 'unitId', 'unit', 'departmentId', 'department'
 * - month / period: aliases 'month', 'academicMonth', 'm', 'period', 'p' (supports YYYY-MM)
 * - date: aliases 'date', 'd', or ISO date from 'period'
 * - q / query: aliases 'q', 'query', 'search'
 * - taskId / selectedTaskId: aliases 'taskId', 'selectedTaskId', 'task_id'
 */
export function parseWorkspaceQuery(
  params?: RawQueryParams,
  options?: ParseWorkspaceQueryOptions
): WorkspaceFilterState {
  // 1. Scope resolution
  const rawScope =
    extractParam(params, "scope") ||
    extractParam(params, "scopeType") ||
    extractParam(params, "s");

  let scope: WorkspaceScopeType = options?.defaultScope || "school";
  if (rawScope) {
    const normalized = rawScope.toLowerCase();
    if (
      normalized === "school" ||
      normalized === "all" ||
      normalized === "school_tasks" ||
      normalized === "toan_truong"
    ) {
      scope = "school";
    } else if (
      normalized === "unit" ||
      normalized === "unit_tasks" ||
      normalized === "department" ||
      normalized === "dept" ||
      normalized === "don_vi"
    ) {
      scope = "unit";
    } else if (
      normalized === "my" ||
      normalized === "personal" ||
      normalized === "my_tasks" ||
      normalized === "individual" ||
      normalized === "cua_toi"
    ) {
      scope = "my";
    }
  }

  // 2. Department / Unit resolution
  const rawUnitExplicit = extractParam(params, "unit");
  const rawDeptExplicit = extractParam(params, "dept");
  const rawDept =
    rawDeptExplicit ||
    rawUnitExplicit ||
    extractParam(params, "unitId") ||
    extractParam(params, "departmentId") ||
    extractParam(params, "department");

  let unitId: string | undefined = undefined;
  if (rawDept && rawDept !== "ALL" && rawDept !== "all" && rawDept.length > 0) {
    unitId = rawDept;
  }

  const unitParamKey: "dept" | "unit" = rawUnitExplicit && !rawDeptExplicit ? "unit" : "dept";

  // 3. Academic Month & Period resolution
  const rawPeriod = extractParam(params, "period");
  const rawMonth =
    extractParam(params, "month") ||
    extractParam(params, "academicMonth") ||
    rawPeriod;

  let month: number | "ALL" = "ALL";
  if (rawMonth && rawMonth !== "ALL" && rawMonth !== "all") {
    // Check YYYY-MM format (e.g. 2026-09)
    const ymMatch = rawMonth.match(/^\d{4}-(\d{1,2})$/);
    if (ymMatch) {
      const parsed = parseInt(ymMatch[1], 10);
      if (parsed >= 1 && parsed <= 12) {
        month = parsed;
      }
    } else {
      const parsed = parseInt(rawMonth, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
        month = parsed;
      }
    }
  }

  // 4. Date resolution (YYYY-MM-DD)
  const rawDateParam = extractParam(params, "date") || extractParam(params, "d");
  let date: string | undefined = undefined;
  if (rawDateParam && /^\d{4}-\d{2}-\d{2}$/.test(rawDateParam)) {
    date = rawDateParam;
  } else if (rawPeriod && /^\d{4}-\d{2}-\d{2}$/.test(rawPeriod)) {
    date = rawPeriod;
  }

  // 5. Status resolution (with legacy 'tab' migration)
  const rawStatus = extractParam(params, "status") || extractParam(params, "tab");
  let status: TaskLifecycleStatus | "ALL" = "ALL";
  if (rawStatus && rawStatus !== "ALL" && rawStatus !== "all" && rawStatus !== "*") {
    const normalizedStatus = rawStatus.toUpperCase();
    if (VALID_LIFECYCLE_STATUSES.has(normalizedStatus as TaskLifecycleStatus)) {
      status = normalizedStatus as TaskLifecycleStatus;
    } else {
      const lower = rawStatus.toLowerCase();
      if (lower === "todo" || lower === "not_started" || lower === "new") {
        status = "NOT_STARTED";
      } else if (lower === "in_progress" || lower === "doing" || lower === "progress") {
        status = "IN_PROGRESS";
      } else if (
        lower === "review" ||
        lower === "needs_review" ||
        lower === "waiting_approval" ||
        lower === "pending" ||
        lower === "approval"
      ) {
        status = "WAITING_APPROVAL";
      } else if (
        lower === "executive" ||
        lower === "executive_approval" ||
        lower === "pending_executive_approval"
      ) {
        status = "PENDING_EXECUTIVE_APPROVAL";
      } else if (lower === "completed" || lower === "done") {
        status = "COMPLETED";
      } else if (lower === "overdue") {
        status = "OVERDUE";
      } else if (lower === "cancelled" || lower === "canceled") {
        status = "CANCELLED";
      }
    }
  }

  // 6. View Mode resolution
  const rawView =
    extractParam(params, "view") ||
    extractParam(params, "viewMode") ||
    extractParam(params, "v");

  let view: TaskViewMode | CalendarViewMode = options?.defaultView
    ? options.defaultView
    : options?.isCalendar
    ? "month"
    : "table";

  if (rawView && VALID_VIEW_MODES.has(rawView as TaskViewMode | CalendarViewMode)) {
    view = rawView as TaskViewMode | CalendarViewMode;
  }

  // 7. Search Query resolution
  const rawQ =
    extractParam(params, "q") ||
    extractParam(params, "query") ||
    extractParam(params, "search");

  const q = rawQ && rawQ.length > 0 ? rawQ : undefined;

  // 8. Task ID selection resolution
  const rawTaskId =
    extractParam(params, "taskId") ||
    extractParam(params, "selectedTaskId") ||
    extractParam(params, "task_id");

  const taskId = rawTaskId && rawTaskId.length > 0 ? rawTaskId : undefined;

  // 9. User Attention resolution
  const rawAttention = extractParam(params, "attention");
  let attention: UserAttentionType | "ALL" | undefined = undefined;
  if (rawAttention) {
    if (rawAttention === "ALL" || rawAttention === "all") {
      attention = "ALL";
    } else if (VALID_ATTENTION_TYPES.has(rawAttention as UserAttentionType)) {
      attention = rawAttention as UserAttentionType;
    }
  }

  // 10. Priority resolution
  const rawPriority = extractParam(params, "priority") || extractParam(params, "prio");
  const priority = rawPriority && rawPriority !== "ALL" && rawPriority !== "all" ? rawPriority : undefined;

  // 11. Category resolution
  const rawCategory = extractParam(params, "category") || extractParam(params, "cat");
  const category = rawCategory && rawCategory !== "ALL" && rawCategory !== "all" ? rawCategory : undefined;

  // 12. Deadline resolution
  const rawDeadline = extractParam(params, "deadline");
  const deadline = rawDeadline && rawDeadline !== "ALL" && rawDeadline !== "all" ? rawDeadline : undefined;

  return {
    scope,
    unitId,
    dept: unitId,
    unit: unitId,
    month,
    date,
    status,
    priority,
    category,
    deadline,
    attention,
    view,
    q,
    query: q,
    taskId,
    selectedTaskId: taskId,
    _unitParamKey: unitParamKey,
  };
}

/**
 * Serialize workspace filter state into URLSearchParams.
 *
 * Produces clean, minimal query strings by omitting default values:
 * - view='table' on tasks (or view='month' on calendar)
 * - month='ALL'
 * - status='ALL'
 * - scope='school' (when omitDefaultScope is true)
 * - empty/undefined search queries, dates, departments/units, and selected tasks
 *
 * Cleans up legacy parameters (e.g. 'tab') when serializing.
 */
export function serializeWorkspaceQuery(
  state: Partial<WorkspaceFilterState>,
  options?: SerializeWorkspaceQueryOptions
): URLSearchParams {
  const params = new URLSearchParams();

  // If preserving existing query parameters, copy them first and strip workspace keys
  if (options?.preserveParams) {
    let source: URLSearchParams;
    if (options.preserveParams instanceof URLSearchParams) {
      source = options.preserveParams;
    } else if (typeof options.preserveParams === "string") {
      let raw = options.preserveParams;
      const qIndex = raw.indexOf("?");
      if (qIndex !== -1) {
        raw = raw.slice(qIndex + 1);
      }
      source = new URLSearchParams(raw);
    } else {
      source = new URLSearchParams();
      for (const [k, v] of Object.entries(options.preserveParams)) {
        if (Array.isArray(v)) {
          v.forEach((item) => {
            if (typeof item === "string") source.append(k, item);
            else if (typeof item === "number" || typeof item === "boolean") source.append(k, String(item));
          });
        } else if (typeof v === "string") {
          source.set(k, v);
        } else if (typeof v === "number" || typeof v === "boolean") {
          source.set(k, String(v));
        }
      }
    }

    // Retain all non-workspace parameters
    for (const [k, v] of source.entries()) {
      params.append(k, v);
    }

    // Clean up all workspace and legacy keys
    for (const key of WORKSPACE_QUERY_KEYS) {
      params.delete(key);
    }
  }

  // 1. Scope
  if (state.scope) {
    if (options?.omitDefaultScope && state.scope === "school") {
      params.delete("scope");
    } else {
      params.set("scope", state.scope);
    }
  }

  // 2. Department / Unit
  let deptVal: string | undefined;
  if (state.dept && state.unit && state.dept !== state.unit) {
    deptVal =
      (options?.unitParamKey === "unit" || state._unitParamKey === "unit")
        ? state.unit
        : state.dept;
  } else {
    deptVal = state.dept || state.unit || state.unitId;
  }
  if (deptVal && deptVal !== "ALL" && deptVal !== "all" && deptVal.trim().length > 0) {
    const trimmed = deptVal.trim();
    if (options?.unitParamKey) {
      params.set(options.unitParamKey, trimmed);
    } else if (state.unit && !state.dept && !state.unitId) {
      params.set("unit", trimmed);
    } else if (state._unitParamKey === "unit") {
      params.set("unit", trimmed);
    } else {
      params.set("dept", trimmed);
    }
  }

  // 3. Academic Month (omit 'ALL')
  if (state.month !== undefined && state.month !== "ALL" && state.month !== null) {
    params.set("month", String(state.month));
  }

  // 4. Date (YYYY-MM-DD)
  if (state.date && /^\d{4}-\d{2}-\d{2}$/.test(state.date)) {
    params.set("date", state.date);
  }

  // 5. Status (omit 'ALL')
  if (state.status && state.status !== "ALL") {
    params.set("status", state.status);
  }

  // 6. View Mode (omit default: 'table' on tasks, 'month' on calendar)
  const isCalendar = options?.isCalendar ?? false;
  if (state.view) {
    if (isCalendar) {
      if (state.view !== "month") {
        params.set("view", state.view);
      }
    } else {
      if (state.view !== "table") {
        params.set("view", state.view);
      }
    }
  }

  // 7. Search Query
  const qVal = state.q ?? state.query;
  if (qVal && qVal.trim().length > 0) {
    params.set("q", qVal.trim());
  }

  // 8. Task ID
  const taskIdVal = state.taskId ?? state.selectedTaskId;
  if (taskIdVal && taskIdVal.trim().length > 0) {
    params.set("taskId", taskIdVal.trim());
  }

  // 9. User Attention (omit 'ALL')
  if (state.attention && state.attention !== "ALL") {
    params.set("attention", state.attention);
  }

  // 10. Priority (omit 'ALL')
  if (state.priority && state.priority !== "ALL") {
    params.set("priority", state.priority);
  }

  // 11. Category (omit 'ALL')
  if (state.category && state.category !== "ALL") {
    params.set("category", state.category);
  }

  // 12. Deadline (omit 'ALL')
  if (state.deadline && state.deadline !== "ALL") {
    params.set("deadline", state.deadline);
  }

  return params;
}

/**
 * Compare two WorkspaceFilterState objects for semantic equality.
 *
 * Normalizes implicit defaults (e.g. month: 'ALL' vs month: undefined)
 * and field aliases (dept vs unit vs unitId, q vs query, taskId vs selectedTaskId).
 */
export function isWorkspaceQueryEqual(
  a: WorkspaceFilterState,
  b: WorkspaceFilterState
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  const aScope = a.scope || "school";
  const bScope = b.scope || "school";
  if (aScope !== bScope) return false;

  const aDept = a.unit || a.unitId || a.dept || undefined;
  const bDept = b.unit || b.unitId || b.dept || undefined;
  if (aDept !== bDept) return false;

  const aMonth = a.month ?? "ALL";
  const bMonth = b.month ?? "ALL";
  if (aMonth !== bMonth) return false;

  const aDate = a.date || undefined;
  const bDate = b.date || undefined;
  if (aDate !== bDate) return false;

  const aStatus = a.status ?? "ALL";
  const bStatus = b.status ?? "ALL";
  if (aStatus !== bStatus) return false;

  const aView = a.view || "table";
  const bView = b.view || "table";
  if (aView !== bView) return false;

  const aQ = (a.q ?? a.query ?? "").trim() || undefined;
  const bQ = (b.q ?? b.query ?? "").trim() || undefined;
  if (aQ !== bQ) return false;

  const aTaskId = (a.taskId ?? a.selectedTaskId ?? "").trim() || undefined;
  const bTaskId = (b.taskId ?? b.selectedTaskId ?? "").trim() || undefined;
  if (aTaskId !== bTaskId) return false;

  const aAttention = (!a.attention || a.attention === "ALL") ? undefined : a.attention;
  const bAttention = (!b.attention || b.attention === "ALL") ? undefined : b.attention;
  if (aAttention !== bAttention) return false;

  return true;
}

/**
 * Construct a clean URL string with pathname and serialized workspace parameters.
 */
export function buildWorkspaceUrl(
  pathname: string,
  state: Partial<WorkspaceFilterState>,
  options?: SerializeWorkspaceQueryOptions
): string {
  const params = serializeWorkspaceQuery(state, options);
  const queryStr = params.toString();
  return queryStr ? `${pathname}?${queryStr}` : pathname;
}
