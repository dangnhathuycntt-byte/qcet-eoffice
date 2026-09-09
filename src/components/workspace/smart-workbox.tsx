"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock, FileCheck, AlertCircle } from "lucide-react";
import type { SchoolTask } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import type { WorkspaceScope } from "@/types/workspace";
import { getSystemReferenceDateStr, isTaskPastDue } from "@/lib/unified-task-hub";
import {
  isActiveTaskStatus,
  isTaskAssignedToUserOrUnit,
  isTaskOverdueOrHasOverdueSubtask,
  isTaskWaitingApproval,
} from "@/components/workspace/unified-adaptive-workspace";
import { matchesUser } from "@/lib/role-task-filter";
import { cn } from "@/lib/utils";

// ============================================================================
// Types & Contracts
// ============================================================================

export type SmartWorkboxFilterKey =
  | "my"
  | "waiting_approval"
  | "pending_submission"
  | "overdue";

export interface SmartWorkboxCounts {
  myCount: number;
  waitingApprovalCount: number;
  pendingSubmissionCount: number;
  overdueCount: number;
}

export interface SmartWorkboxItemConfig {
  key: SmartWorkboxFilterKey;
  label: string;
  description: string;
  count: number;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  colorVariant: "primary" | "amber" | "blue" | "rose";
}

export interface SmartWorkboxProps {
  tasks?: SchoolTask[];
  user?: AuthUser | null;
  roleScope?: WorkspaceScope;
  referenceDate?: string;
  activeFilter?: string;
  onFilterClick?: (filterKey: SmartWorkboxFilterKey, targetUrl: string) => void;
  className?: string;
}

// ============================================================================
// Pure Calculation Helpers
// ============================================================================

/**
 * Pure function computing canonical counts for the 4 Smart Workbox filters.
 * Adheres strictly to Rule 40 (Data Integrity) and Rule 50 (Testing Invariants).
 */
export function computeSmartWorkboxCounts({
  tasks = [],
  user,
  roleScope = "my",
  referenceDate = getSystemReferenceDateStr(),
}: {
  tasks?: SchoolTask[];
  user?: AuthUser | null;
  roleScope?: WorkspaceScope;
  referenceDate?: string;
}): SmartWorkboxCounts {
  const userDept = user?.departmentCode || user?.department || "";

  // 1. My tasks (or Unit active tasks if roleScope === 'unit', School if 'school')
  let myCount = 0;
  for (const t of tasks) {
    if (t.status === "COMPLETED") continue;
    if (roleScope === "my") {
      if (!user) {
        myCount++;
      } else {
        const isAssigned =
          t.leadAssigneeName === user.name ||
          t.assignedTo === user.name ||
          matchesUser(t.leadAssigneeName, user) ||
          matchesUser(t.assignedTo, user) ||
          t.subTasks?.some(
            (s) =>
              s.assigneeName === user.name ||
              (s as any).assignedTo === user.name ||
              matchesUser(s.assigneeName, user)
          );
        if (isAssigned) myCount++;
      }
    } else if (roleScope === "unit") {
      if (
        !userDept ||
        t.departmentCode === userDept ||
        t.department === userDept ||
        isTaskAssignedToUserOrUnit(t, user)
      ) {
        myCount++;
      }
    } else {
      // School scope
      myCount++;
    }
  }

  // 2. Waiting approval count
  let waitingApprovalCount = 0;
  for (const t of tasks) {
    if (t.status === "COMPLETED") continue;
    const taskWaiting =
      isTaskWaitingApproval(t.status) ||
      Boolean(t.subTasks?.some((s) => isTaskWaitingApproval(s.status)));

    if (!taskWaiting) continue;

    if (roleScope === "school") {
      // All institutional approvals
      waitingApprovalCount++;
    } else if (roleScope === "unit") {
      // Unit-level approvals (L1)
      if (
        !userDept ||
        t.departmentCode === userDept ||
        t.department === userDept ||
        isTaskAssignedToUserOrUnit(t, user)
      ) {
        waitingApprovalCount++;
      }
    } else {
      // My submissions awaiting review or tasks assigned to me requiring review
      if (!user) {
        waitingApprovalCount++;
      } else {
        const isAssigned =
          t.leadAssigneeName === user.name ||
          t.assignedTo === user.name ||
          matchesUser(t.leadAssigneeName, user) ||
          matchesUser(t.assignedTo, user) ||
          t.subTasks?.some(
            (s) =>
              (s.assigneeName === user.name || matchesUser(s.assigneeName, user)) &&
              isTaskWaitingApproval(s.status)
          );
        if (isAssigned) waitingApprovalCount++;
      }
    }
  }

  // 3. Pending submission count (active tasks in progress waiting for deliverable)
  let pendingSubmissionCount = 0;
  for (const t of tasks) {
    if (t.status === "COMPLETED" || isTaskWaitingApproval(t.status)) continue;
    const isActive =
      isActiveTaskStatus(t.status) ||
      Boolean(t.subTasks?.some((st) => isActiveTaskStatus(st.status)));

    if (!isActive) continue;

    if (roleScope === "my") {
      if (!user) {
        pendingSubmissionCount++;
      } else {
        const isAssigned =
          t.leadAssigneeName === user.name ||
          t.assignedTo === user.name ||
          matchesUser(t.leadAssigneeName, user) ||
          matchesUser(t.assignedTo, user) ||
          t.subTasks?.some(
            (s) =>
              s.assigneeName === user.name ||
              (s as any).assignedTo === user.name ||
              matchesUser(s.assigneeName, user)
          );
        if (isAssigned) pendingSubmissionCount++;
      }
    } else if (roleScope === "unit") {
      if (
        !userDept ||
        t.departmentCode === userDept ||
        t.department === userDept ||
        isTaskAssignedToUserOrUnit(t, user)
      ) {
        pendingSubmissionCount++;
      }
    } else {
      pendingSubmissionCount++;
    }
  }

  // 4. Overdue count
  let overdueCount = 0;
  for (const t of tasks) {
    if (t.status === "COMPLETED") continue;
    const isOverdue = isTaskOverdueOrHasOverdueSubtask(t, referenceDate);
    if (!isOverdue) continue;

    if (roleScope === "my") {
      if (!user) {
        overdueCount++;
      } else {
        const isAssigned =
          t.leadAssigneeName === user.name ||
          t.assignedTo === user.name ||
          matchesUser(t.leadAssigneeName, user) ||
          matchesUser(t.assignedTo, user) ||
          t.subTasks?.some(
            (s) =>
              s.assigneeName === user.name ||
              (s as any).assignedTo === user.name ||
              matchesUser(s.assigneeName, user)
          );
        if (isAssigned) overdueCount++;
      }
    } else if (roleScope === "unit") {
      if (
        !userDept ||
        t.departmentCode === userDept ||
        t.department === userDept ||
        isTaskAssignedToUserOrUnit(t, user)
      ) {
        overdueCount++;
      }
    } else {
      overdueCount++;
    }
  }

  return {
    myCount,
    waitingApprovalCount,
    pendingSubmissionCount,
    overdueCount,
  };
}

/**
 * Pure helper creating direct pre-filtered navigation URLs into /tasks.
 */
export function getSmartWorkboxNavigationUrl(
  filterKey: SmartWorkboxFilterKey,
  roleScope: WorkspaceScope = "my",
  departmentCode?: string
): string {
  const deptQuery =
    departmentCode && roleScope === "unit"
      ? `&dept=${encodeURIComponent(departmentCode)}`
      : "";

  switch (filterKey) {
    case "my":
      return `/tasks?scope=my&status=my`;
    case "waiting_approval":
      return `/tasks?scope=${roleScope}&status=waiting_approval&workbox=review${deptQuery}`;
    case "pending_submission":
      return `/tasks?scope=${roleScope}&status=pending_submission&workbox=pending_submission${deptQuery}`;
    case "overdue":
      return `/tasks?scope=${roleScope}&status=overdue&workbox=overdue${deptQuery}`;
  }
}

// ============================================================================
// React Component: SmartWorkbox
// ============================================================================

export function SmartWorkbox({
  tasks = [],
  user,
  roleScope = "my",
  referenceDate = getSystemReferenceDateStr(),
  activeFilter,
  onFilterClick,
  className,
}: SmartWorkboxProps) {
  const counts = computeSmartWorkboxCounts({
    tasks,
    user,
    roleScope,
    referenceDate,
  });

  const departmentCode = user?.departmentCode;

  const items: SmartWorkboxItemConfig[] = [
    {
      key: "my",
      label: "Của tôi",
      description: "Nhiệm vụ được giao",
      count: counts.myCount,
      href: getSmartWorkboxNavigationUrl("my", roleScope, departmentCode),
      icon: CheckCircle2,
      colorVariant: "primary",
    },
    {
      key: "waiting_approval",
      label: "Chờ tôi duyệt",
      description: "Cần thẩm định / ký duyệt",
      count: counts.waitingApprovalCount,
      href: getSmartWorkboxNavigationUrl("waiting_approval", roleScope, departmentCode),
      icon: FileCheck,
      colorVariant: "amber",
    },
    {
      key: "pending_submission",
      label: "Chờ nộp báo cáo",
      description: "Chờ gửi minh chứng",
      count: counts.pendingSubmissionCount,
      href: getSmartWorkboxNavigationUrl("pending_submission", roleScope, departmentCode),
      icon: Clock,
      colorVariant: "blue",
    },
    {
      key: "overdue",
      label: "Quá hạn",
      description: "Cần xử lý khẩn",
      count: counts.overdueCount,
      href: getSmartWorkboxNavigationUrl("overdue", roleScope, departmentCode),
      icon: AlertCircle,
      colorVariant: "rose",
    },
  ];

  return (
    <div
      data-slot="smart-workbox"
      className={cn("grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4", className)}
      aria-label="Hộp việc thông minh theo vai trò"
    >
      {items.map((item) => {
        const isSelected = activeFilter === item.key;
        const IconComponent = item.icon;

        // Semantic tint styling adhering to Light-only standard (no dark: classes)
        const activeStyles =
          item.colorVariant === "primary"
            ? "border-primary/40 bg-primary/5 text-primary"
            : item.colorVariant === "amber"
            ? item.count > 0
              ? "border-amber-500/40 bg-amber-500/10 text-amber-900"
              : "border-border/60 bg-card text-foreground"
            : item.colorVariant === "blue"
            ? item.count > 0
              ? "border-blue-500/40 bg-blue-500/10 text-blue-900"
              : "border-border/60 bg-card text-foreground"
            : item.count > 0
            ? "border-rose-500/40 bg-rose-500/10 text-rose-900"
            : "border-border/60 bg-card text-foreground";

        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={(e) => {
              if (onFilterClick) {
                e.preventDefault();
                onFilterClick(item.key, item.href);
              }
            }}
            data-slot="smart-workbox-card"
            data-filter={item.key}
            className={cn(
              "group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-xl border transition-all shadow-2xs hover:shadow-xs",
              "min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              isSelected
                ? "ring-2 ring-primary border-primary bg-primary/10"
                : activeStyles
            )}
          >
            {/* Header: Label + Arrow Icon */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-semibold text-foreground tracking-tight line-clamp-1">
                {item.label}
              </span>
              <span className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                <ArrowUpRight size={15} strokeWidth={1.5} />
              </span>
            </div>

            {/* Metric Count: Tabular-nums font-mono */}
            <div className="my-2 sm:my-2.5">
              <span
                className={cn(
                  "text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tight leading-none",
                  item.colorVariant === "rose" && item.count > 0
                    ? "text-rose-600"
                    : item.colorVariant === "amber" && item.count > 0
                    ? "text-amber-700"
                    : item.colorVariant === "blue" && item.count > 0
                    ? "text-blue-700"
                    : "text-foreground"
                )}
              >
                {item.count}
              </span>
            </div>

            {/* Footer: Description hint */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
              <IconComponent
                size={13}
                strokeWidth={1.5}
                className={cn(
                  "shrink-0",
                  item.colorVariant === "rose" && item.count > 0
                    ? "text-rose-500"
                    : item.colorVariant === "amber" && item.count > 0
                    ? "text-amber-600"
                    : item.colorVariant === "blue" && item.count > 0
                    ? "text-blue-600"
                    : "text-muted-foreground"
                )}
              />
              <span className="truncate">{item.description}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
