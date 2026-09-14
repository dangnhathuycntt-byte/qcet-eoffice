"use client";

import * as React from "react";
import type { DashboardStats } from "@/types/dashboard";
import {
  summarizeDepartmentAttention,
  type ExecutiveActionStats,
  type DepartmentHealthSummary,
} from "@/lib/executive-matrix-aggregator";
import { cn } from "@/lib/utils";

export interface DashboardSituationStripProps {
  stats: DashboardStats;
  executiveStats?: ExecutiveActionStats | null;
  departmentHealth?: DepartmentHealthSummary[];
  isExecutive?: boolean;
  className?: string;
}

type SituationState = "NO_DATA" | "HEALTHY" | "HAS_ISSUES";

export function deriveSituationState(
  stats: DashboardStats,
  executiveStats?: ExecutiveActionStats | null
): SituationState {
  const hasRealData =
    (stats.totalSchoolTasks ?? 0) > 0 ||
    (stats.totalStaffTasks ?? 0) > 0 ||
    executiveStats != null;
  if (!hasRealData) return "NO_DATA";
  const overdueCount =
    (stats.overdueTasksCount ?? 0) +
    (executiveStats?.overdueTasksCount ?? 0) +
    (executiveStats?.blockedTasksCount ?? 0);
  return overdueCount > 0 ? "HAS_ISSUES" : "HEALTHY";
}

export function DashboardSituationStrip({
  stats,
  executiveStats,
  departmentHealth = [],
  isExecutive = false,
  className,
}: DashboardSituationStripProps) {
  const situationState = deriveSituationState(stats, executiveStats);

  if (situationState === "NO_DATA") {
    return (
      <div
        data-slot="dashboard-situation-strip"
        data-situation-state="NO_DATA"
        className={cn(
          "px-1 py-2 text-xs text-muted-foreground",
          className
        )}
        aria-label="Tình hình: chưa có dữ liệu kỳ vận hành"
      >
        Chưa có dữ liệu kỳ vận hành.
      </div>
    );
  }

  const progressPercent = stats.averageSchoolProgressPercent ?? 0;
  const totalTasks = isExecutive
    ? (stats.totalSchoolTasks ?? 0)
    : (stats.totalSchoolTasks ?? 0) + (stats.totalStaffTasks ?? 0);
  const overdueCount = isExecutive
    ? (stats.overdueTasksCount ?? 0) + (executiveStats?.overdueTasksCount ?? 0)
    : (stats.overdueTasksCount ?? 0);
  const blockedCount = isExecutive ? (executiveStats?.blockedTasksCount ?? 0) : 0;
  // Overdue/blocked only — never a progress threshold (plan T05.1).
  const unitsNeedingAttention =
    departmentHealth.length > 0
      ? summarizeDepartmentAttention(departmentHealth).attentionCount
      : null;

  const ariaLabel = [
    `${progressPercent}% tiến độ`,
    `${totalTasks} nhiệm vụ`,
    overdueCount > 0 ? `${overdueCount} quá hạn` : null,
    blockedCount > 0 ? `${blockedCount} vướng mắc` : null,
    unitsNeedingAttention ? `${unitsNeedingAttention} đơn vị cần chú ý` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      data-slot="dashboard-situation-strip"
      data-situation-state={situationState}
      className={cn(
        "flex flex-wrap items-center gap-1.5 py-0.5",
        className
      )}
      aria-label={`Tình hình: ${ariaLabel}`}
    >
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-xs font-mono tabular-nums font-semibold text-primary">
        {progressPercent}%
      </span>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 border border-border/50 text-xs font-mono tabular-nums text-foreground/70">
        {totalTasks.toLocaleString("vi-VN")} nhiệm vụ
      </span>
      {overdueCount > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/25 text-xs font-mono tabular-nums font-semibold text-rose-700">
          {overdueCount} quá hạn
        </span>
      )}
      {blockedCount > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-xs font-mono tabular-nums font-semibold text-amber-700">
          {blockedCount} vướng mắc
        </span>
      )}
      {unitsNeedingAttention != null && unitsNeedingAttention > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-xs font-mono tabular-nums font-medium text-amber-700">
          {unitsNeedingAttention} đơn vị cần chú ý
        </span>
      )}
    </div>
  );
}
