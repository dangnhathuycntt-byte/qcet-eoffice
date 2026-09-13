import type { SchoolTask, TaskCategory, TaskStatus } from "@/types/dashboard";
import type { AuthUser, UserRole } from "@/types/auth";
import type { WorkspaceScope } from "@/types/workspace";
import {
  type TaskScope,
  type TaskViewMode,
  filterTasksByScope,
} from "@/components/dashboard/unified-task-toolbar";
export type { TaskScope, TaskViewMode };
import type { WorkboxFilter } from "@/components/dashboard/executive-stat-strip";
import { matchesUser } from "@/lib/role-task-filter";
import { filterTasksForTable } from "@/components/tasks/cascading-task-table";
import {
  isDateInAcademicMonth,
  getSystemReferenceDate as getCanonicalReferenceDateStr,
} from "@/lib/academic-calendar";

// One reference-date source for the whole app: delegate to the canonical date
// module instead of keeping a second drifting constant (plan T03.5, contract-map D4).
export const TODAY_ISO = getCanonicalReferenceDateStr();

/**
 * Converts TaskScope ("SCHOOL_TASKS" | "UNIT_TASKS" | "MY_TASKS") to WorkspaceScope ("school" | "unit" | "my").
 */
export function scopeToWorkspaceScope(scope: TaskScope): WorkspaceScope {
  switch (scope) {
    case "SCHOOL_TASKS":
      return "school";
    case "UNIT_TASKS":
      return "unit";
    case "MY_TASKS":
    default:
      return "my";
  }
}

/**
 * Converts WorkspaceScope ("school" | "unit" | "my") to TaskScope ("SCHOOL_TASKS" | "UNIT_TASKS" | "MY_TASKS").
 */
export function workspaceScopeToTaskScope(scope: WorkspaceScope): TaskScope {
  switch (scope) {
    case "school":
      return "SCHOOL_TASKS";
    case "unit":
      return "UNIT_TASKS";
    case "my":
    default:
      return "MY_TASKS";
  }
}

/**
 * Converts WorkspaceScope to URL parameter representation ("all" | "unit" | "personal").
 */
export function workspaceScopeToUrlParam(scope: WorkspaceScope): string {
  switch (scope) {
    case "school":
      return "all";
    case "unit":
      return "unit";
    case "my":
    default:
      return "personal";
  }
}

/**
 * Parses URL scope parameter into WorkspaceScope, supporting both legacy and modern values.
 */
export function urlParamToWorkspaceScope(
  param: string | null | undefined,
  fallback: WorkspaceScope = "school"
): WorkspaceScope {
  if (!param) return fallback;
  const p = param.trim().toLowerCase();
  if (p === "all" || p === "school") return "school";
  if (p === "unit") return "unit";
  if (p === "personal" || p === "my") return "my";
  return fallback;
}

/**
 * Returns system reference date as a local Date object.
 *
 * Delegates to the canonical date module so this helper can never drift to a
 * second "today" (plan T03.5).
 */
export function getSystemReferenceDate(): Date {
  const raw = getCanonicalReferenceDateStr();
  const [y, m, d] = raw.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Returns system reference date as YYYY-MM-DD string.
 */
export function getSystemReferenceDateStr(): string {
  const d = getSystemReferenceDate();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a date string is strictly past due.
 */
export function isTaskPastDue(
  dateStr?: string,
  referenceDate?: string | Date
): boolean {
  if (!dateStr) return false;
  const clean = dateStr.length > 10 ? dateStr.slice(0, 10) : dateStr;
  let ref: string;
  if (!referenceDate) {
    ref = getSystemReferenceDateStr();
  } else if (referenceDate instanceof Date) {
    const y = referenceDate.getFullYear();
    const m = String(referenceDate.getMonth() + 1).padStart(2, "0");
    const d = String(referenceDate.getDate()).padStart(2, "0");
    ref = `${y}-${m}-${d}`;
  } else {
    ref = referenceDate.length > 10 ? referenceDate.slice(0, 10) : referenceDate;
  }
  return clean < ref;
}

/**
 * Role-based default scopes:
 * - ADMIN (Ban Giám hiệu) -> SCHOOL_TASKS
 * - MANAGER (Trưởng Đơn vị) -> UNIT_TASKS
 * - STAFF (Giảng viên / Chuyên viên) -> MY_TASKS
 */
export function getDefaultScopeForRole(role?: UserRole): TaskScope {
  if (role === "ADMIN") return "SCHOOL_TASKS";
  if (role === "MANAGER") return "UNIT_TASKS";
  return "MY_TASKS";
}

/**
 * Role-based default view modes:
 * - ADMIN (Ban Giám hiệu) -> executive (Trung tâm điều hành BGH 12 đơn vị)
 * - All other roles -> table (Bảng phân cấp)
 */
export function getDefaultViewModeForRole(role?: UserRole): TaskViewMode {
  if (role === "ADMIN") return "executive";
  return "table";
}

/**
 * Resolves whether a user in zone=tasks should display the Staff focus view or the advanced view.
 * - If role !== "STAFF", returns "ADVANCED"
 * - If role === "STAFF":
 *   - If isExpanded is true -> "ADVANCED"
 *   - If viewQuery is explicitly provided and not "focus" -> "ADVANCED"
 *   - Otherwise -> "STAFF_FOCUS"
 */
export function resolveStaffLandingMode({
  role,
  isExpanded = false,
  viewQuery,
}: {
  role?: UserRole;
  isExpanded?: boolean;
  viewQuery?: string | null;
}): "STAFF_FOCUS" | "ADVANCED" {
  if (role !== "STAFF") return "ADVANCED";
  if (isExpanded) return "ADVANCED";
  if (viewQuery && viewQuery !== "focus") return "ADVANCED";
  return "STAFF_FOCUS";
}

/**
 * Parse URL ?scope= parameter into validated TaskScope.
 * Accepts shorthand ("my", "school", "unit") or full keys.
 * Guards against non-executive users accessing school-level scope.
 */
export function parseScopeParam(
  param: string | null | undefined,
  defaultScope: TaskScope = "MY_TASKS",
  userRole?: string | { role?: string } | null
): TaskScope {
  if (!param) return defaultScope;
  const normalized = param.trim().toLowerCase();

  if (normalized === "my" || normalized === "my_tasks" || normalized === "personal") return "MY_TASKS";
  if (normalized === "school" || normalized === "school_tasks" || normalized === "all") {
    if (userRole !== undefined && userRole !== null) {
      const rawRole = typeof userRole === "object" ? userRole.role : userRole;
      const role = String(rawRole || "").toUpperCase();
      const isExec =
        role === "ADMIN" ||
        role === "BGH" ||
        role === "BAN_GIAM_HIEU" ||
        role === "HIEU_TRUONG" ||
        role === "PHO_HIEU_TRUONG";
      if (!isExec) {
        return defaultScope;
      }
    }
    return "SCHOOL_TASKS";
  }
  if (normalized === "unit" || normalized === "unit_tasks") return "UNIT_TASKS";

  return defaultScope;
}

/**
 * Convert TaskScope to URL shorthand query value ("my", "school", "unit").
 */
export function scopeToParam(scope: TaskScope): string {
  switch (scope) {
    case "MY_TASKS":
      return "my";
    case "SCHOOL_TASKS":
      return "school";
    case "UNIT_TASKS":
      return "unit";
    default:
      return "my";
  }
}

/**
 * Parse URL ?view= parameter into validated TaskViewMode ("table" | "kanban" | "calendar" | "department" | "executive").
 */
export function parseViewModeParam(
  param: string | null | undefined,
  defaultMode: TaskViewMode = "table"
): TaskViewMode {
  if (!param) return defaultMode;
  const normalized = param.trim().toLowerCase();

  if (normalized === "table") return "table";
  if (normalized === "kanban" || normalized === "board") return "kanban";
  if (normalized === "calendar" || normalized === "month") return "calendar";
  if (normalized === "department" || normalized === "don-vi" || normalized === "unit") return "department";
  if (normalized === "executive" || normalized === "chi-huy" || normalized === "bgh" || normalized === "command") return "executive";

  return defaultMode;
}

/**
 * Filter tasks by interactive WorkboxFilter from ExecutiveStatStrip.
 */
export function filterTasksByWorkbox(
  tasks: SchoolTask[],
  filter: WorkboxFilter,
  user?: AuthUser | null,
  referenceDate: string = TODAY_ISO
): SchoolTask[] {
  if (filter === "ALL") {
    return tasks;
  }

  const userName = user?.name?.toLowerCase() || "";
  const isAdmin = user?.role === "ADMIN";

  if (filter === "URGENT_OVERDUE") {
    return tasks.filter((t) => {
      const isPastDue = isTaskPastDue(t.dueDate, referenceDate) && t.status !== "COMPLETED";
      const hasSubUrgent = t.subTasks?.some(
        (s) =>
          (isTaskPastDue(s.dueDate, referenceDate) && s.status !== "COMPLETED") ||
          s.status === "NEEDS_REVIEW"
      );
      return isPastDue || hasSubUrgent;
    });
  }

  if (filter === "MY_ACTION") {
    if (isAdmin) return tasks;
    return tasks.filter((t) => {
      const isLead =
        matchesUser(t.leadAssigneeName, user) ||
        (userName && t.leadAssigneeName.toLowerCase().includes(userName));
      const hasSub = t.subTasks?.some(
        (s) =>
          (matchesUser(s.assigneeName, user) ||
            (userName && s.assigneeName.toLowerCase().includes(userName))) &&
          s.status !== "COMPLETED"
      );
      return isLead || hasSub;
    });
  }

  if (filter === "ASSIGNED_BY_ME") {
    if (isAdmin) return tasks;
    return tasks.filter((t) => {
      const isLead =
        matchesUser(t.leadAssigneeName, user) ||
        (userName && t.leadAssigneeName.toLowerCase().includes(userName));
      return isLead;
    });
  }

  if (filter === "COMPLETED") {
    return tasks.filter((t) => t.status === "COMPLETED" || t.progressPercent === 100);
  }

  if (filter === "NEEDS_REVIEW") {
    return tasks.filter((t) => {
      const isNeedsReview = t.status === "PENDING_EXECUTIVE_APPROVAL";
      const hasSubNeedsReview = t.subTasks?.some((s) => s.status === "NEEDS_REVIEW");
      return isNeedsReview || hasSubNeedsReview;
    });
  }

  return tasks;
}

/**
 * Filter tasks by academic month period.
 * A task matches an academic month if:
 * 1. academicMonth is "ALL" or undefined -> all tasks pass
 * 2. The task's dueDate falls in the academic month window, OR
 * 3. Any of the task's subtasks has a dueDate falling in the academic month window.
 */
export function filterTasksByAcademicMonth(
  tasks: SchoolTask[],
  academicMonth?: number | "ALL",
  academicYear?: string
): SchoolTask[] {
  if (!academicMonth || academicMonth === "ALL") {
    return tasks;
  }
  return tasks.filter((t) => {
    const parentMatches = isDateInAcademicMonth(t.dueDate, academicMonth, academicYear);
    const subMatches = t.subTasks?.some((s) =>
      isDateInAcademicMonth(s.dueDate, academicMonth, academicYear)
    );
    return parentMatches || subMatches;
  });
}

/**
 * Computes task counts for each of the 12 academic months (1 to 12).
 * For each month, counts tasks whose dueDate or subtask dueDate falls in that month.
 */
export function computeMonthlyTaskCounts(
  tasks: SchoolTask[],
  academicYear: string = "2026-2027"
): Record<number, number> {
  const counts: Record<number, number> = {
    9: 0, 10: 0, 11: 0, 12: 0,
    1: 0, 2: 0, 3: 0, 4: 0,
    5: 0, 6: 0, 7: 0, 8: 0,
  };

  for (const task of tasks) {
    const matchedMonths = new Set<number>();
    for (let m = 1; m <= 12; m++) {
      if (
        isDateInAcademicMonth(task.dueDate, m, academicYear) ||
        task.subTasks?.some((s) => isDateInAcademicMonth(s.dueDate, m, academicYear))
      ) {
        matchedMonths.add(m);
      }
    }
    for (const m of matchedMonths) {
      counts[m] = (counts[m] || 0) + 1;
    }
  }

  return counts;
}

export interface FilterTasksHubOptions {
  tasks?: SchoolTask[];
  scope?: TaskScope;
  workboxFilter?: WorkboxFilter;
  workbox?: WorkboxFilter;
  category?: string; // "ALL" or TaskCategory
  priority?: string; // "ALL" | "URGENT" | "HIGH" | "NORMAL"
  department?: string; // "ALL" or department code
  searchQuery?: string;
  user?: AuthUser | null;
  referenceDate?: string;
  academicMonth?: number | "ALL";
  academicYear?: string;
}

/**
 * Orchestrates multi-dimensional filtering across scope, workbox, category, department, priority, and search.
 */
export function filterTasksHub(
  optionsOrTasks: FilterTasksHubOptions | SchoolTask[],
  legacyOptions?: Partial<FilterTasksHubOptions> & { workbox?: WorkboxFilter }
): SchoolTask[] {
  let tasks: SchoolTask[];
  let opts: Partial<FilterTasksHubOptions> & { workbox?: WorkboxFilter };

  if (Array.isArray(optionsOrTasks)) {
    tasks = optionsOrTasks;
    opts = legacyOptions || {};
  } else {
    tasks = optionsOrTasks.tasks || [];
    opts = optionsOrTasks;
  }

  const scope = opts.scope ?? "SCHOOL_TASKS";
  const workboxFilter = opts.workboxFilter ?? opts.workbox ?? "ALL";
  const category = opts.category ?? "ALL";
  const priority = opts.priority ?? "ALL";
  const department = opts.department ?? "ALL";
  const searchQuery = opts.searchQuery ?? "";
  const user = opts.user;
  const referenceDate = opts.referenceDate ?? TODAY_ISO;
  const academicMonth = opts.academicMonth ?? "ALL";
  const academicYear = opts.academicYear ?? "2026-2027";
  // 1. Filter by Scope
  let result = filterTasksByScope(tasks, scope, user, department);

  // 2. Filter by Executive Workbox
  if (workboxFilter !== "ALL") {
    result = filterTasksByWorkbox(result, workboxFilter, user, referenceDate);
  }

  // 3. Filter by Category
  if (category && category !== "ALL") {
    result = result.filter((t) => t.category === category);
  }

  // 4. Filter by Priority
  if (priority && priority !== "ALL") {
    result = result.filter((t) => {
      const isUrgent =
        (isTaskPastDue(t.dueDate, referenceDate) && t.status !== "COMPLETED") ||
        t.subTasks?.some(
          (s) =>
            (isTaskPastDue(s.dueDate, referenceDate) && s.status !== "COMPLETED") ||
            s.status === "NEEDS_REVIEW"
        );
      if (priority === "URGENT") return isUrgent;
      if (priority === "HIGH") {
        return !isUrgent && t.status !== "COMPLETED" && (t.progressPercent ?? 0) < 50;
      }
      if (priority === "NORMAL") {
        return !isUrgent && (t.status === "COMPLETED" || (t.progressPercent ?? 0) >= 50);
      }
      return true;
    });
  }

  // 5. Filter by Department (if not already handled in UNIT_TASKS scope)
  if (department && department !== "ALL" && scope !== "UNIT_TASKS") {
    result = filterTasksForTable(result, "ALL", "", department);
  }

  // 6. Filter by Search Query
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    result = result.filter((t) => {
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc =
        ((t as any).description as string | undefined)?.toLowerCase().includes(q) ?? false;
      const matchLead = t.leadAssigneeName.toLowerCase().includes(q);
      const matchDept = Boolean(
        (t.leadDepartment && t.leadDepartment.toLowerCase().includes(q)) ||
        (t.leadDepartmentCode && t.leadDepartmentCode.toLowerCase().includes(q)) ||
        (t.leadDepartmentId && t.leadDepartmentId.toLowerCase().includes(q))
      );
      const matchSub = t.subTasks?.some(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.assigneeName.toLowerCase().includes(q) ||
          Boolean(s.departmentCode && s.departmentCode.toLowerCase().includes(q)) ||
          Boolean(s.departmentId && s.departmentId.toLowerCase().includes(q))
      );
      return matchTitle || matchDesc || matchLead || matchDept || matchSub;
    });
  }

  // 7. Filter by Academic Month
  if (academicMonth && academicMonth !== "ALL") {
    result = filterTasksByAcademicMonth(result, academicMonth, academicYear);
  }

  return result;
}
