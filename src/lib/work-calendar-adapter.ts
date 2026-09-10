import type { SchoolTask, StaffTask, Deliverable } from "@/types/dashboard";
import { getSystemReferenceDate, isTaskPastDue } from "@/lib/academic-calendar";

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
  progressPercent: number;
  departmentId: string;
  departmentName: string;
  assigneeName: string;
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

export type WorkCalendarFilterState = WorkCalendarFilters;
export const transformSchoolTasksToCalendarItems = transformTasksToCalendarOperations;
export const extractPriorOverdueTasks = getPriorOverdueWorkItems;

export function extractDateString(isoString?: string | null): string {
  if (!isoString) return "";
  return isoString.split("T")[0];
}

export function calculateDaysOverdue(dueDateStr: string, refDateStr?: string): number {
  const refDate = refDateStr ? new Date(refDateStr) : new Date(getSystemReferenceDate());
  const due = new Date(dueDateStr);
  const diffTime = refDate.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
    const isOverdue =
      task.status !== "COMPLETED" &&
      (isTaskPastDue(task.dueDate, cleanRefDate) || calculateDaysOverdue(task.dueDate, refDate) > 0);
    const daysOverdue = isOverdue ? calculateDaysOverdue(task.dueDate, refDate) : 0;

    // 1. Mốc nhiệm vụ trường
    items.push({
      id: `milestone-${task.id}`,
      sourceTaskId: task.id,
      title: task.title,
      code: task.code,
      dueDate: taskDueDate,
      dueTime: "17:00",
      type: isOverdue ? "urgent_overdue" : "school_milestone",
      originType: "school_milestone",
      priority: (task.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") || "HIGH",
      status: task.status === "COMPLETED" ? "COMPLETED" : isOverdue ? "OVERDUE" : "IN_PROGRESS",
      progressPercent: task.progressPercent || 0,
      departmentId: task.departmentId || "BGH",
      departmentName: task.departmentName || task.department || "Ban Giám hiệu",
      assigneeName: task.leadAssigneeName || "Lãnh đạo phụ trách",
      isOverdue,
      daysOverdue,
    });

    // 2. Tiểu nhiệm vụ đơn vị (Subtasks)
    if (Array.isArray(task.subTasks)) {
      for (const sub of task.subTasks) {
        if (!sub.dueDate) continue;
        const subDueDate = extractDateString(sub.dueDate);
        const subOverdue =
          sub.status !== "COMPLETED" &&
          (isTaskPastDue(sub.dueDate, cleanRefDate) || calculateDaysOverdue(sub.dueDate, refDate) > 0);
        const subDaysOverdue = subOverdue ? calculateDaysOverdue(sub.dueDate, refDate) : 0;

        items.push({
          id: `subtask-${sub.id}`,
          sourceTaskId: sub.id,
          parentSchoolTaskId: task.id,
          title: sub.title,
          dueDate: subDueDate,
          dueTime: "16:30",
          type: subOverdue ? "urgent_overdue" : "subtask",
          originType: "subtask",
          priority: (task.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") || "MEDIUM",
          status: sub.status === "COMPLETED" ? "COMPLETED" : subOverdue ? "OVERDUE" : "IN_PROGRESS",
          progressPercent: sub.status === "COMPLETED" ? 100 : 50,
          departmentId: sub.assignedToDepartmentId || task.departmentId || "BGH",
          departmentName: sub.assignedToDepartmentName || sub.department || task.departmentName || task.department || "Đơn vị",
          assigneeName: sub.assigneeName || "Chuyên viên",
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
        const delivOverdue = deliv.status !== "APPROVED" && calculateDaysOverdue(deliv.dueDate, refDate) > 0;
        const delivDaysOverdue = delivOverdue ? calculateDaysOverdue(deliv.dueDate, refDate) : 0;

        items.push({
          id: `deliverable-${deliv.id}`,
          sourceTaskId: task.id,
          parentSchoolTaskId: task.id,
          title: `[Sản phẩm] ${deliv.title}`,
          dueDate: delivDueDate,
          dueTime: "11:30",
          type: delivOverdue ? "urgent_overdue" : "deliverable",
          originType: "deliverable",
          priority: "URGENT",
          status: deliv.status === "APPROVED" ? "COMPLETED" : delivOverdue ? "OVERDUE" : "WAITING_APPROVAL",
          progressPercent: deliv.status === "APPROVED" ? 100 : 0,
          departmentId: task.departmentId || "BGH",
          departmentName: task.departmentName || task.department || "Đơn vị nộp",
          assigneeName: task.leadAssigneeName || "Người phụ trách",
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
      if (!item.assigneeName.toLowerCase().includes(filters.assigneeName.toLowerCase())) {
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
      const matchDept = item.departmentName.toLowerCase().includes(q);
      const matchAssignee = item.assigneeName.toLowerCase().includes(q);
      if (!matchTitle && !matchDept && !matchAssignee) return false;
    }
    return true;
  });
}
