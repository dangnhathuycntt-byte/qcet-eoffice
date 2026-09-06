import type { SchoolTask, TaskCategory, TaskStatus } from "@/types/dashboard";
import type { AuthUser, UserRole } from "@/types/auth";
import {
  type TaskScope,
  type TaskViewMode,
  filterTasksByScope,
} from "@/components/dashboard/unified-task-toolbar";
import type { WorkboxFilter } from "@/components/dashboard/executive-stat-strip";
import { matchesUser } from "@/lib/role-task-filter";
import { filterTasksForTable } from "@/components/dashboard/cascading-task-table";

export const TODAY_ISO = "2026-09-04";

/**
 * Checks if a date string is strictly past due.
 */
export function isTaskPastDue(dateStr?: string, referenceDate: string = TODAY_ISO): boolean {
  if (!dateStr) return false;
  const clean = dateStr.length > 10 ? dateStr.slice(0, 10) : dateStr;
  return clean < referenceDate;
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
 * Parse URL ?scope= parameter into validated TaskScope.
 * Accepts shorthand ("my", "school", "unit") or full keys.
 */
export function parseScopeParam(
  param: string | null | undefined,
  defaultScope: TaskScope = "MY_TASKS"
): TaskScope {
  if (!param) return defaultScope;
  const normalized = param.trim().toLowerCase();

  if (normalized === "my" || normalized === "my_tasks") return "MY_TASKS";
  if (normalized === "school" || normalized === "school_tasks") return "SCHOOL_TASKS";
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
 * Parse URL ?view= parameter into validated TaskViewMode ("table" | "kanban" | "calendar" | "department").
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

  return defaultMode;
}

/**
 * Filter tasks by interactive WorkboxFilter from ExecutiveStatStrip.
 */
export function filterTasksByWorkbox(
  tasks: SchoolTask[],
  filter: WorkboxFilter,
  user?: AuthUser,
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

  return tasks;
}

export interface FilterTasksHubOptions {
  tasks: SchoolTask[];
  scope: TaskScope;
  workboxFilter?: WorkboxFilter;
  category?: string; // "ALL" or TaskCategory
  priority?: string; // "ALL" | "URGENT" | "HIGH" | "NORMAL"
  department?: string; // "ALL" or department code
  searchQuery?: string;
  user?: AuthUser;
  referenceDate?: string;
}

/**
 * Orchestrates multi-dimensional filtering across scope, workbox, category, department, priority, and search.
 */
export function filterTasksHub({
  tasks,
  scope,
  workboxFilter = "ALL",
  category = "ALL",
  priority = "ALL",
  department = "ALL",
  searchQuery = "",
  user,
  referenceDate = TODAY_ISO,
}: FilterTasksHubOptions): SchoolTask[] {
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

  return result;
}
