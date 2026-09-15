"use client";

import * as React from "react";
import type { DashboardStats } from "@/types/dashboard";
import {
  summarizeDepartmentAttention,
  type ExecutiveActionStats,
  type DepartmentHealthSummary,
} from "@/lib/executive-matrix-aggregator";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, Sparkles, TrendingUp } from "lucide-react";

export interface DashboardSituationStripProps {
  stats: DashboardStats;
  executiveStats?: ExecutiveActionStats | null;
  departmentHealth?: DepartmentHealthSummary[];
  isExecutive?: boolean;
  user?: { name?: string; role?: string; title?: string } | null;
  userName?: string;
  todayCount?: number;
  variant?: "banner" | "compact";
  className?: string;
}

export type SituationState = "NO_DATA" | "HEALTHY" | "HAS_ISSUES";

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

/** Lời chào cá nhân hóa theo buổi trong ngày (Giờ ICT UTC+7) */
export function getTimeOfDayGreeting(): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "numeric",
      hour12: false,
    });
    const hour = parseInt(formatter.format(now), 10);
    if (hour >= 5 && hour < 12) return "Chào buổi sáng";
    if (hour >= 12 && hour < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  } catch {
    return "Xin chào";
  }
}

export function DashboardSituationStrip({
  stats,
  executiveStats,
  departmentHealth = [],
  isExecutive = false,
  user,
  userName,
  todayCount,
  variant = "banner",
  className,
}: DashboardSituationStripProps) {
  const situationState = deriveSituationState(stats, executiveStats);

  if (situationState === "NO_DATA") {
    return (
      <div
        data-slot="dashboard-situation-strip"
        data-situation-state="NO_DATA"
        className={cn(
          "px-3 py-2 text-xs text-muted-foreground rounded-xl bg-muted/20",
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

  const pendingCount = isExecutive
    ? (executiveStats?.pendingSchoolApprovalCount ?? stats.pendingApprovals ?? 0)
    : ((stats.schoolTasksWaitingApproval ?? 0) + (stats.staffTasksWaitingApproval ?? 0) + (stats.needsReviewTasksCount ?? 0));

  const blockedCount = isExecutive ? (executiveStats?.blockedTasksCount ?? 0) : 0;

  const unitsNeedingAttention =
    departmentHealth.length > 0
      ? summarizeDepartmentAttention(departmentHealth).attentionCount
      : null;

  // Xây dựng lời chào
  const greeting = getTimeOfDayGreeting();
  const rawName = userName || user?.name;
  const displayName = rawName ? ` ${rawName}` : "";
  const greetingText = `${greeting} Thầy/Cô${displayName}`;

  // Tóm lược 1 câu cốt lõi (5-second verdict)
  const resolvedTodayCount =
    todayCount ??
    (overdueCount + pendingCount > 0
      ? overdueCount + pendingCount
      : (stats.schoolTasksInProgress ?? stats.inProgressTasks ?? 0));

  let verdictSentence = "";
  if (overdueCount > 0 || pendingCount > 0 || blockedCount > 0) {
    const parts: string[] = [];
    if (overdueCount > 0) parts.push(`${overdueCount} việc trễ hạn`);
    if (pendingCount > 0) parts.push(`${pendingCount} hồ sơ chờ duyệt`);
    if (blockedCount > 0) parts.push(`${blockedCount} việc vướng mắc`);

    if (resolvedTodayCount > 0) {
      verdictSentence = `Hôm nay Thầy/Cô có ${parts.join(", ")}${
        parts.length > 0 ? " và " : ""
      }${resolvedTodayCount} việc cần xử lý hôm nay.`;
    } else {
      verdictSentence = `Hôm nay Thầy/Cô có ${parts.join(", ")} cần tập trung xử lý.`;
    }
  } else {
    verdictSentence = `Hôm nay toàn bộ công việc đang diễn ra đúng tiến độ, không có việc trễ hạn hay hồ sơ tồn đọng.`;
  }

  const ariaLabel = [
    greetingText,
    verdictSentence,
    `${progressPercent}% tiến độ`,
    `${totalTasks} nhiệm vụ`,
    overdueCount > 0 ? `${overdueCount} quá hạn` : null,
    blockedCount > 0 ? `${blockedCount} vướng mắc` : null,
    unitsNeedingAttention ? `${unitsNeedingAttention} đơn vị cần chú ý` : null,
  ]
    .filter(Boolean)
    .join(", ");

  // Nếu hiển thị chế độ Compact (ví dụ nằm gọn trong thanh Toolbar hẹp)
  if (variant === "compact") {
    return (
      <div
        data-slot="dashboard-situation-strip"
        data-situation-state={situationState}
        className={cn("flex flex-wrap items-center gap-1.5 py-0.5", className)}
        aria-label={`Tình hình: ${ariaLabel}`}
      >
        {situationState === "HEALTHY" ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-xs font-medium">
            <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Vận hành ổn định</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20 text-xs font-medium">
            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>Cần chú ý</span>
          </span>
        )}
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
      </div>
    );
  }

  // Chế độ Banner kết luận 5 giây (Smart Verdict Banner)
  return (
    <div
      data-slot="dashboard-situation-strip"
      data-situation-state={situationState}
      className={cn(
        "relative overflow-hidden rounded-2xl p-4 sm:p-5 transition-all",
        "bg-gradient-to-r from-card via-card/95 to-muted/20 border border-border/50 shadow-xs",
        situationState === "HAS_ISSUES" && "border-amber-500/25 bg-amber-500/[0.02]",
        className
      )}
      aria-label={`Tình hình: ${ariaLabel}`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        {/* Lời chào & Tóm lược 1 câu cốt lõi */}
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-heading font-bold text-base sm:text-lg text-foreground tracking-tight">
              {greetingText}
            </span>
            {situationState === "HEALTHY" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-xs font-medium">
                <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Vận hành ổn định</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/25 text-xs font-semibold">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span>Cần chú ý</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {verdictSentence}
          </p>
        </div>

        {/* Nhóm chỉ số vận hành tinh gọn */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0 pt-1 md:pt-0">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/10 text-primary text-xs font-medium"
            title={`Tiến độ trung bình: ${progressPercent}%`}
          >
            <TrendingUp className="size-3.5" strokeWidth={1.5} />
            <span className="font-mono font-semibold tabular-nums">{progressPercent}%</span>
            <span className="text-2xs opacity-80">tiến độ</span>
          </div>

          <div
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-muted/70 text-foreground/80 text-xs font-medium border border-border/40"
            title={`Tổng số nhiệm vụ kỳ này: ${totalTasks}`}
          >
            <span className="font-mono font-semibold tabular-nums">{totalTasks}</span>
            <span className="text-2xs text-muted-foreground">nhiệm vụ</span>
          </div>

          {overdueCount > 0 && (
            <div
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-700 text-xs font-semibold border border-rose-500/20"
              title={`${overdueCount} nhiệm vụ quá hạn`}
            >
              <AlertTriangle className="size-3" strokeWidth={1.5} />
              <span className="font-mono tabular-nums">{overdueCount}</span>
              <span className="text-2xs">trễ hạn</span>
            </div>
          )}

          {pendingCount > 0 && (
            <div
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 text-xs font-medium border border-amber-500/20"
              title={`${pendingCount} hồ sơ đang chờ xét duyệt`}
            >
              <span className="font-mono tabular-nums font-semibold">{pendingCount}</span>
              <span className="text-2xs">chờ duyệt</span>
            </div>
          )}

          {unitsNeedingAttention != null && unitsNeedingAttention > 0 && (
            <div
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 text-xs font-medium border border-amber-500/20"
              title={`${unitsNeedingAttention} đơn vị có nhiệm vụ quá hạn hoặc vướng mắc`}
            >
              <span className="font-mono tabular-nums font-semibold">{unitsNeedingAttention}</span>
              <span className="text-2xs">đơn vị lưu ý</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
