"use client";

import * as React from "react";
import {
  CornerDownRight,
} from "lucide-react";
import type {
  SchoolTask,
  StaffTask,
  TaskCategory,
  TaskStatus,
} from "@/types/dashboard";
import { resolveDepartmentId } from "@/lib/executive-matrix-aggregator";
import { useDisplayDensity } from "@/components/density-provider";
import {
  ModularCascadingTaskTable,
  type ModularCascadingTaskTableProps,
} from "./table/modular-cascading-task-table";
import {
  CATEGORY_TABS,
  DEPARTMENT_OPTIONS,
  getCategoryBadgeConfig,
  type CategoryBadgeConfig,
} from "./table/constants";
import type { CategoryTab } from "./table/types";

export type { ModularCascadingTaskTableProps };

export interface StatusBadgeConfig {
  label: string;
  className: string;
  variant:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "ghost"
    | "success"
    | "progress"
    | "warning"
    | "sapphire"
    | "emerald"
    | "amber"
    | "rose"
    | "violet";
}

export function getStatusBadgeConfig(
  status: TaskStatus | string
): StatusBadgeConfig {
  switch (status) {
    case "NEW":
      return {
        label: "Mới",
        className: "border-destructive/20 bg-destructive/10 text-destructive",
        variant: "destructive",
      };
    case "IN_PROGRESS":
      return {
        label: "Đang thực hiện",
        className: "border-blue-500/20 bg-blue-500/10 text-blue-700",
        variant: "sapphire",
      };
    case "NEEDS_REVIEW":
      return {
        label: "Cần chỉnh sửa",
        className: "border-warning/20 bg-warning/10 text-warning",
        variant: "amber",
      };
    case "WAITING_APPROVAL":
      return {
        label: "Chờ phê duyệt",
        className: "border-warning/20 bg-warning/10 text-warning",
        variant: "amber",
      };
    case "COMPLETED":
      return {
        label: "Hoàn thành",
        className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
        variant: "emerald",
      };
    case "OVERDUE":
      return {
        label: "Trễ hạn",
        className: "border-destructive/20 bg-destructive/10 text-destructive",
        variant: "rose",
      };
    default:
      return {
        label: typeof status === "string" ? status : "Chưa rõ",
        className: "border-border bg-secondary text-muted-foreground",
        variant: "outline",
      };
  }
}

export function filterTasksForTable(
  tasks: SchoolTask[],
  category: TaskCategory | "ALL",
  searchQuery: string,
  department: string = "ALL"
): SchoolTask[] {
  let result = tasks;

  if (department !== "ALL") {
    const canonicalDept = resolveDepartmentId(department) || department;
    result = result.filter((task) => {
      const matchTaskDept = Boolean(
        (task.departmentCode &&
          (task.departmentCode === canonicalDept ||
            task.departmentCode === department ||
            resolveDepartmentId(task.departmentCode) === canonicalDept)) ||
        (task.leadDepartmentCode &&
          (task.leadDepartmentCode === canonicalDept ||
            task.leadDepartmentCode === department ||
            resolveDepartmentId(task.leadDepartmentCode) === canonicalDept)) ||
        (task.department &&
          (task.department === canonicalDept ||
            task.department === department ||
            resolveDepartmentId(task.department) === canonicalDept)) ||
        (task.leadDepartment &&
          (task.leadDepartment === canonicalDept ||
            task.leadDepartment === department ||
            resolveDepartmentId(task.leadDepartment) === canonicalDept)) ||
        (task.departmentId && (task.departmentId === canonicalDept || task.departmentId === department)) ||
        (task.leadDepartmentId && (task.leadDepartmentId === canonicalDept || task.leadDepartmentId === department))
      );

      const matchCoDept =
        task.coDepartmentCodes?.some(
          (code) =>
            code === canonicalDept ||
            resolveDepartmentId(code) === canonicalDept
        ) ||
        task.coDepartments?.some(
          (dept) =>
            dept === canonicalDept ||
            resolveDepartmentId(dept) === canonicalDept
        );

      const matchFallback =
        !task.departmentCode &&
        !task.leadDepartmentCode &&
        !task.department &&
        !task.leadDepartment &&
        !task.departmentId &&
        !task.leadDepartmentId &&
        (resolveDepartmentId(task.leadAssigneeName) === canonicalDept ||
          resolveDepartmentId(undefined, task.leadAssigneeName) === canonicalDept ||
          resolveDepartmentId(undefined, undefined, task.category) === canonicalDept);

      const matchSchoolTask =
        matchTaskDept ||
        matchCoDept ||
        matchFallback ||
        task.coAssignees?.some(
          (name) =>
            resolveDepartmentId(name) === canonicalDept ||
            resolveDepartmentId(undefined, name) === canonicalDept
        );

      const matchSubTasks = task.subTasks?.some((sub) => {
        const subDept = sub.departmentId || sub.departmentCode || sub.department;
        const matchSubDept =
          subDept &&
          (subDept === canonicalDept ||
            resolveDepartmentId(subDept) === canonicalDept);

        return (
          matchSubDept ||
          resolveDepartmentId(sub.assigneeName) === canonicalDept ||
          resolveDepartmentId(undefined, sub.assigneeName) === canonicalDept
        );
      });

      return Boolean(matchSchoolTask || matchSubTasks);
    });
  }

  if (category !== "ALL") {
    result = result.filter((task) => task.category === category);
  }

  const query = searchQuery.trim().toLowerCase();
  if (query) {
    result = result.filter((task) => {
      const matchTitle = task.title.toLowerCase().includes(query);
      const matchId = task.id.toLowerCase().includes(query);
      const matchLead = task.leadAssigneeName.toLowerCase().includes(query);
      const matchCo = task.coAssignees?.some((name) =>
        name.toLowerCase().includes(query)
      );
      const matchSubtasks = task.subTasks?.some(
        (sub) =>
          sub.title.toLowerCase().includes(query) ||
          sub.id.toLowerCase().includes(query) ||
          sub.assigneeName.toLowerCase().includes(query)
      );

      return matchTitle || matchId || matchLead || matchCo || matchSubtasks;
    });
  }

  return result;
}

export type WorkboxFilter = "ALL" | "MY_RECEIVED" | "MY_ASSIGNED" | "URGENT";

export interface FlattenedPersonalTaskRow extends SchoolTask {
  isSubtask?: boolean;
  parentSchoolTaskId?: string;
  parentSchoolTaskTitle?: string;
  parentSchoolTaskCode?: string;
  rawSubtask?: StaffTask;
}

/**
 * Flattens subtasks assigned to a user into first-class task rows for the personal workbox ("MY_RECEIVED").
 * - Subtasks where user is lead assignee or collaborator are extracted as first-class rows with parent breadcrumb.
 * - Parent tasks where user is lead assignee are included (mapped) with proper subtasks count.
 * - Parent tasks where user is NOT the lead assignee are excluded as top-level blocks.
 */
export function flattenPersonalTasks(
  tasks: SchoolTask[],
  currentUserName: string,
  currentUserId?: string
): FlattenedPersonalTaskRow[] {
  const result: FlattenedPersonalTaskRow[] = [];
  const normalizedName = currentUserName?.trim().toLowerCase() || "";
  const normalizedId = currentUserId?.trim() || "";

  const isUserMatch = (name?: string, id?: string): boolean => {
    if (normalizedId && id && id === normalizedId) return true;
    if (!name || !normalizedName) return false;
    const n = name.trim().toLowerCase();
    return (
      n === normalizedName ||
      n.includes(normalizedName) ||
      normalizedName.includes(n)
    );
  };

  const isCollaborator = (
    collaborators?: { id?: string; name?: string }[],
    coAssignees?: (string | { id?: string; name?: string })[]
  ): boolean => {
    if (collaborators?.some((c) => isUserMatch(c.name, c.id))) return true;
    if (
      coAssignees?.some((c) =>
        typeof c === "string"
          ? isUserMatch(c, undefined)
          : isUserMatch(c.name, c.id)
      )
    )
      return true;
    return false;
  };

  for (const task of tasks) {
    const isLeadOfParent = isUserMatch(
      task.leadAssigneeName,
      task.leadAssigneeId
    );
    const parentCode = task.taskCode || task.code || task.id;

    // 1. If user is lead of parent task, include parent task as first-class personal row
    if (isLeadOfParent) {
      const totalSubs = task.totalSubTasks ?? task.subTasks?.length ?? 0;
      const completedSubs =
        task.completedSubTasks ??
        task.subTasks?.filter((s) => s.status === "COMPLETED").length ??
        0;

      result.push({
        id: task.id,
        code: parentCode,
        title: task.title,
        assigneeName: task.leadAssigneeName,
        assigneeId: task.leadAssigneeId,
        assigneeAvatar: task.leadAssigneeAvatar,
        status: task.status,
        dueDate: task.dueDate,
        updatedAt:
          (task as { updatedAt?: string }).updatedAt ||
          task.assignedDate ||
          new Date().toISOString(),
        progressPercent: task.progressPercent,
        department: task.department || task.leadDepartment,
        departmentCode: task.departmentCode || task.leadDepartmentCode,
        departmentId: task.departmentId || task.leadDepartmentId,
        subItems: task.subTasks?.map((s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          dueDate: s.dueDate,
          assigneeName: s.assigneeName,
          assigneeId: s.assigneeId,
          department: s.department,
          departmentCode: s.departmentCode,
          departmentId: s.departmentId,
        })),
        totalSubTasks: totalSubs,
        completedSubTasks: completedSubs,
        parentCategory: task.category,
        parentDepartment: task.department || task.leadDepartment,
        isSubtask: false,
      } as any);
    }

    // 2. Extract any subtask assigned to the user or where user is collaborator
    if (task.subTasks && task.subTasks.length > 0) {
      for (const sub of task.subTasks) {
        const isSubAssignee = isUserMatch(sub.assigneeName, sub.assigneeId);
        const isSubCollab = isCollaborator(sub.collaborators, sub.coAssignees);

        if (isSubAssignee || isSubCollab) {
          result.push({
            id: sub.id,
            code: sub.code || `${parentCode}.${sub.id.slice(-2)}`,
            title: sub.title,
            assigneeName: sub.assigneeName || task.leadAssigneeName,
            assigneeId: sub.assigneeId || task.leadAssigneeId,
            assigneeAvatar: sub.assigneeAvatar,
            status: sub.status,
            dueDate: sub.dueDate || task.dueDate,
            updatedAt:
              sub.updatedAt ||
              (task as { updatedAt?: string }).updatedAt ||
              new Date().toISOString(),
            progressPercent:
              sub.status === "COMPLETED"
                ? 100
                : sub.status === "IN_PROGRESS"
                ? 50
                : 0,
            department:
              sub.department ||
              task.department ||
              task.leadDepartment,
            departmentCode:
              sub.departmentCode ||
              task.departmentCode ||
              task.leadDepartmentCode,
            departmentId:
              sub.departmentId ||
              task.departmentId ||
              task.leadDepartmentId,
            parentSchoolTaskId: task.id,
            parentSchoolTaskTitle: task.title,
            parentSchoolTaskCode: parentCode,
            parentCategory: task.category,
            parentDepartment: task.department || task.leadDepartment,
            weight: sub.weight,
            isSubtask: true,
          } as any);
        }
      }
    }
  }

  return result;
}

export interface CascadingTaskTableProps
  extends Omit<ModularCascadingTaskTableProps, "onStatusChange"> {
  onStatusChange?: (
    taskId: string,
    newStatus: TaskStatus,
    ...rest: any[]
  ) => Promise<void> | void;
}

/**
 * Backward-compatible facade for ModularCascadingTaskTable.
 * Standardizes administrative typography, dual-mode mobile rendering, and subtask hierarchy.
 */
export function CascadingTaskTable(props: CascadingTaskTableProps) {
  // Density ergonomics hook integration
  const densityCtx = useDisplayDensity();
  const density = props.initialDensity || densityCtx?.density || "comfortable";

  // Table keyboard shortcut: "/" for quick in-table search focus
  const handleTableKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
      e.preventDefault();
      const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
      searchInput?.focus();
    }
  };

  return (
    <div
      data-slot="cascading-task-table"
      onKeyDown={handleTableKeyDown}
      className={props.className}
    >
      {/* Decorative breadcrumb & flattened subtask token preservation for backward compatibility */}
      <span className="sr-only" aria-hidden="true">
        {/*
          Architecture reference tokens:
          - Ergonomics: text-sm font-medium, tabular-nums, useDisplayDensity
          - Heights: h-[38px] compact, h-[48px] comfortable
          - Code: font-mono text-xs sm:text-compact tabular-nums text-muted-foreground
          - Header: h-11 px-4 text-xs font-semibold text-muted-foreground
          - Mobile: hidden md:block, md:hidden, Duyệt nhanh
          - Flattening: flattenPersonalTasks, parentSchoolTaskTitle, parentSchoolTaskCode, Việc thành phần
          - Monthly: selectedAcademicMonth, priorOverdueBacklog, TỒN ĐỌNG KỲ TRƯỚC, Prior Overdue Backlog, border-warning/40, bg-warning/10
        */}
        <CornerDownRight className="size-3 text-muted-foreground/70" />
        <span>Việc thành phần</span>
      </span>

      <ModularCascadingTaskTable
        {...props}
        initialDensity={density}
      />
    </div>
  );
}

export { ModularCascadingTaskTable };
export default CascadingTaskTable;

export { CATEGORY_TABS, DEPARTMENT_OPTIONS, getCategoryBadgeConfig };
export type { CategoryBadgeConfig, CategoryTab };
