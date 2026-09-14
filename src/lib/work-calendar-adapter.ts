import type { SchoolTask } from "@/types/dashboard";
import { getSystemReferenceDate, isTaskOverdue } from "@/lib/academic-calendar";

export type WorkItemType = "school_milestone" | "subtask" | "deliverable" | "urgent_overdue";

export interface WorkCalendarItem {
  id: string;
  sourceTaskId: string;
  parentSchoolTaskId?: string;
  title: string;
  code?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  type: WorkItemType;
  originType?: WorkItemType;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "TODO" | "IN_PROGRESS" | "WAITING_APPROVAL" | "COMPLETED" | "OVERDUE";
  progressPercent?: number;
  departmentId?: string;
  departmentName?: string;
  assigneeId?: string;
  assigneeName?: string;
  isOverdue: boolean;
  daysOverdue?: number;
  deliverableSummary?: string;
}

export interface WorkCalendarFilters {
  departmentId?: string | "ALL";
  assigneeName?: string | "ALL";
  itemType?: WorkItemType | "ALL";
  statusFilter?: "ALL" | "ACTIVE" | "OVERDUE" | "COMPLETED";
  searchQuery?: string;
  status?: string | "ALL";
  priority?: string | "ALL";
  search?: string;
}

export interface WorkCalendarScopeUser {
  id?: string;
  departmentId?: string;
}

export interface WorkCalendarScopeEntry {
  departmentId?: string;
  unitId?: string;
  assigneeId?: string;
  organizerId?: string;
  assigneeName?: string;
}

export type WorkCalendarScope = "school" | "unit" | "personal" | "my";

export function matchesWorkCalendarScope(
  entry: WorkCalendarScopeEntry,
  scope: WorkCalendarScope,
  user?: WorkCalendarScopeUser
): boolean {
  if (scope === "school") {
    // Dataset permitted for school scope by server authority.
    // The adapter never narrows school scope client-side.
    return true;
  }
  if (scope === "unit") {
    // Unit scope is strictly the authenticated user's canonical department.
    // Persisted meeting projections carry unitId; task projections carry departmentId.
    // No display-name fallback when an ID exists, no broadening when IDs are absent.
    if (!user?.departmentId) return false;
    const entryUnit = entry.departmentId ?? entry.unitId;
    if (!entryUnit) return false;
    return entryUnit === user.departmentId;
  }
  // "my" / "personal": strictly the authenticated user's canonical identity.
  // Tasks use assigneeId; persisted meeting projections use organizerId.
  // Participant display names are never used as identity proof.
  if (scope === "my" || scope === "personal") {
    if (!user?.id) return false;
    const candidateId = entry.assigneeId ?? entry.organizerId;
    if (!candidateId) return false;
    return candidateId === user.id;
  }
  return true;
}

export function filterWorkCalendarEntriesByScope<T extends WorkCalendarScopeEntry>(
  entries: T[],
  scope: WorkCalendarScope,
  user?: WorkCalendarScopeUser
): T[] {
  if (!Array.isArray(entries)) return [];
  return entries.filter((entry) => matchesWorkCalendarScope(entry, scope, user));
}

export type WorkCalendarFilterState = WorkCalendarFilters;
export const transformSchoolTasksToCalendarItems = transformTasksToCalendarOperations;
export const extractPriorOverdueTasks = getPriorOverdueWorkItems;

export function extractDateString(isoString?: string | Date | null): string {
  if (!isoString) return "";
  if (typeof isoString === "string") {
    const trimmed = isoString.trim();
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    }
    return "";
  }
  if (isoString instanceof Date && !isNaN(isoString.getTime())) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(isoString);
  }
  return "";
}

export function extractDueTime(val?: string | Date | null): string | undefined {
  if (!val) return undefined;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.includes("T")) {
      const timePart = trimmed.split("T")[1];
      const match = timePart.match(/^(\d{2}):(\d{2})/);
      if (match) {
        const [_, hh, mm] = match;
        if (hh === "00" && mm === "00") {
          return undefined;
        }
        return `${hh}:${mm}`;
      }
    }
    if (/^\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }
  return undefined;
}

export function calculateDaysOverdue(dueDateStr: string, refDateStr?: string): number {
  const refClean = extractDateString(refDateStr || getSystemReferenceDate());
  const dueClean = extractDateString(dueDateStr);
  if (!dueClean || !refClean || dueClean >= refClean) {
    return 0;
  }
  const [ry, rm, rd] = refClean.split("-").map(Number);
  const [dy, dm, dd] = dueClean.split("-").map(Number);
  const refUtc = Date.UTC(ry, rm - 1, rd);
  const dueUtc = Date.UTC(dy, dm - 1, dd);
  const diffDays = Math.round((refUtc - dueUtc) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

export function transformTasksToCalendarOperations(
  tasks: SchoolTask[],
  options?: { academicMonth?: number | "ALL"; referenceDate?: string }
): WorkCalendarItem[] {
  if (!Array.isArray(tasks) || tasks.length === 0) return [];
  const refDate = options?.referenceDate || getSystemReferenceDate();
  const cleanRefDate = extractDateString(refDate);
  const items: WorkCalendarItem[] = [];

  for (const task of tasks) {
    if (options?.academicMonth && options.academicMonth !== "ALL" && task.academicMonth) {
      if (task.academicMonth !== options.academicMonth) continue;
    }
    if (!task.dueDate) continue;
    const taskDueDate = extractDateString(task.dueDate);
    const isCompleted = (task.status || "").toUpperCase() === "COMPLETED" || (task.status || "").toUpperCase() === "CANCELLED";
    const isOverdue = !isCompleted && (isTaskOverdue(task.status, task.dueDate, cleanRefDate) || calculateDaysOverdue(task.dueDate, refDate) > 0);
    const daysOverdue = isOverdue ? Math.max(1, calculateDaysOverdue(task.dueDate, refDate)) : 0;
    const taskDueTime = (task as any).dueTime || extractDueTime(task.dueDate);

    // 1. Mốc nhiệm vụ trường
    items.push({
      id: `milestone-${task.id}`,
      sourceTaskId: task.id,
      title: task.title,
      code: task.code,
      dueDate: taskDueDate,
      dueTime: taskDueTime,
      type: isOverdue ? "urgent_overdue" : "school_milestone",
      originType: "school_milestone",
      priority: (task.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") || "HIGH",
      status: isCompleted ? "COMPLETED" : isOverdue ? "OVERDUE" : (task.status as any) || "IN_PROGRESS",
      progressPercent: typeof task.progressPercent === "number" ? task.progressPercent : (typeof (task as any).progress === "number" ? (task as any).progress : undefined),
      departmentId: task.departmentId || task.leadDepartmentId || undefined,
      departmentName: task.departmentName || task.department || task.leadDepartment || undefined,
      assigneeId: task.leadAssigneeId || undefined,
      assigneeName: task.leadAssigneeName || undefined,
      isOverdue,
      daysOverdue,
    });

    // 2. Tiểu nhiệm vụ đơn vị (Subtasks)
    if (Array.isArray(task.subTasks)) {
      for (const sub of task.subTasks) {
        if (!sub.dueDate) continue;
        const subDueDate = extractDateString(sub.dueDate);
        const isSubCompleted = (sub.status || "").toUpperCase() === "COMPLETED" || (sub.status || "").toUpperCase() === "CANCELLED";
        const subOverdue = !isSubCompleted && (isTaskOverdue(sub.status, sub.dueDate, cleanRefDate) || calculateDaysOverdue(sub.dueDate, refDate) > 0);
        const subDaysOverdue = subOverdue ? Math.max(1, calculateDaysOverdue(sub.dueDate, refDate)) : 0;
        const subDueTime = (sub as any).dueTime || extractDueTime(sub.dueDate);

        items.push({
          id: `subtask-${sub.id}`,
          sourceTaskId: sub.id,
          parentSchoolTaskId: task.id,
          title: sub.title,
          dueDate: subDueDate,
          dueTime: subDueTime,
          type: subOverdue ? "urgent_overdue" : "subtask",
          originType: "subtask",
          priority: (task.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") || "MEDIUM",
          status: isSubCompleted ? "COMPLETED" : subOverdue ? "OVERDUE" : (sub.status as any) || "IN_PROGRESS",
          progressPercent: typeof sub.progressPercent === "number" ? sub.progressPercent : undefined,
          departmentId: sub.assignedToDepartmentId || sub.departmentId || undefined,
          departmentName: sub.assignedToDepartmentName || sub.department || undefined,
          assigneeId: sub.assigneeId || undefined,
          assigneeName: sub.assigneeName || undefined,
          isOverdue: subOverdue,
          daysOverdue: subDaysOverdue,
        });
      }
    }

    // 3. Sản phẩm nghiệm thu (Deliverables)
    if (Array.isArray(task.deliverables)) {
      for (const deliv of task.deliverables) {
        if (!deliv.dueDate) continue;
        const delivDueDate = extractDateString(deliv.dueDate);
        const isDelivCompleted = (deliv.status || "").toUpperCase() === "APPROVED" || (deliv.status || "").toUpperCase() === "COMPLETED";
        const delivOverdue = !isDelivCompleted && calculateDaysOverdue(deliv.dueDate, refDate) > 0;
        const delivDaysOverdue = delivOverdue ? Math.max(1, calculateDaysOverdue(deliv.dueDate, refDate)) : 0;
        const delivDueTime = (deliv as any).dueTime || extractDueTime(deliv.dueDate);

        items.push({
          id: `deliverable-${deliv.id}`,
          sourceTaskId: task.id,
          parentSchoolTaskId: task.id,
          title: `[Sản phẩm] ${deliv.title}`,
          dueDate: delivDueDate,
          dueTime: delivDueTime,
          type: delivOverdue ? "urgent_overdue" : "deliverable",
          originType: "deliverable",
          priority: "URGENT",
          status: isDelivCompleted ? "COMPLETED" : delivOverdue ? "OVERDUE" : "WAITING_APPROVAL",
          progressPercent: typeof (deliv as any).progressPercent === "number" ? (deliv as any).progressPercent : undefined,
          departmentId: (deliv as any).departmentId || undefined,
          departmentName: (deliv as any).departmentName || undefined,
          assigneeId: (deliv as any).assigneeId || undefined,
          assigneeName: (deliv as any).assigneeName || undefined,
          isOverdue: delivOverdue,
          daysOverdue: delivDaysOverdue,
          deliverableSummary: deliv.title,
        });
      }
    }
  }

  return items;
}

export function getPriorOverdueWorkItems(
  tasks: SchoolTask[],
  referenceDate?: string
): WorkCalendarItem[] {
  const allItems = transformTasksToCalendarOperations(tasks, { referenceDate });
  return allItems
    .filter((item) => item.isOverdue && item.status !== "COMPLETED")
    .sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
}

export function filterWorkCalendarItems(
  items: WorkCalendarItem[],
  filters: WorkCalendarFilters
): WorkCalendarItem[] {
  if (!Array.isArray(items)) return [];

  return items.filter((item) => {
    if (filters.departmentId && filters.departmentId !== "ALL") {
      if (item.departmentId !== filters.departmentId) return false;
    }
    if (filters.assigneeName && filters.assigneeName !== "ALL") {
      if (!item.assigneeName || !item.assigneeName.toLowerCase().includes(filters.assigneeName.toLowerCase())) {
        return false;
      }
    }
    if (filters.itemType && filters.itemType !== "ALL") {
      const matchesType =
        item.type === filters.itemType ||
        item.originType === filters.itemType ||
        (filters.itemType === "urgent_overdue" && item.isOverdue);
      if (!matchesType) return false;
    }
    if (filters.statusFilter && filters.statusFilter !== "ALL") {
      if (filters.statusFilter === "OVERDUE" && !item.isOverdue) return false;
      if (filters.statusFilter === "COMPLETED" && item.status !== "COMPLETED") return false;
      if (filters.statusFilter === "ACTIVE" && item.status === "COMPLETED") return false;
    }
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDept = item.departmentName ? item.departmentName.toLowerCase().includes(q) : false;
      const matchAssignee = item.assigneeName ? item.assigneeName.toLowerCase().includes(q) : false;
      if (!matchTitle && !matchDept && !matchAssignee) return false;
    }
    return true;
  });
}
