import * as React from "react";
import {
  Building2,
  CheckSquare,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import type { DashboardStats } from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface StatCardBadge {
  label: string;
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

export interface StatCardData {
  id: string;
  title: string;
  value: string;
  subtext: string;
  badge?: StatCardBadge;
  progress?: number;
  iconName: "Building2" | "CheckSquare" | "AlertTriangle" | "TrendingUp";
}

export interface ExecutiveStatStripProps {
  stats: DashboardStats;
  className?: string;
}

const iconMap = {
  Building2,
  CheckSquare,
  AlertTriangle,
  TrendingUp,
};

export function formatNumber(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return "0";
  return new Intl.NumberFormat("vi-VN").format(value);
}

const defaultStats: DashboardStats = {
  totalSchoolTasks: 0,
  schoolTasksInProgress: 0,
  schoolTasksCompleted: 0,
  totalStaffTasks: 0,
  staffTasksInProgress: 0,
  staffTasksCompleted: 0,
  needsReviewTasksCount: 0,
  overdueTasksCount: 0,
  averageSchoolProgressPercent: 0,
};

export function getStatCardData(statsInput: DashboardStats): StatCardData[] {
  const stats = statsInput || defaultStats;
  const urgentCount = stats.needsReviewTasksCount + stats.overdueTasksCount;

  return [
    {
      id: "school-tasks",
      title: "Nhiệm vụ cấp Trường",
      value: formatNumber(stats.totalSchoolTasks),
      subtext: `${formatNumber(stats.schoolTasksInProgress)} đang làm · ${formatNumber(stats.schoolTasksCompleted)} xong`,
      iconName: "Building2",
    },
    {
      id: "unit-tasks",
      title: "Công việc Đơn vị",
      value: formatNumber(stats.totalStaffTasks),
      subtext: `${formatNumber(stats.staffTasksInProgress)} đang làm · ${formatNumber(stats.staffTasksCompleted)} xong`,
      iconName: "CheckSquare",
    },
    {
      id: "urgent-tasks",
      title: "Cần xử lý & Trễ hạn",
      value: formatNumber(urgentCount),
      subtext: `${formatNumber(stats.needsReviewTasksCount)} cần xử lý · ${formatNumber(stats.overdueTasksCount)} trễ hạn`,
      badge: {
        label:
          stats.overdueTasksCount > 0
            ? `${stats.overdueTasksCount} trễ hạn`
            : stats.needsReviewTasksCount > 0
              ? "Cần duyệt"
              : "Ổn định",
        variant:
          stats.overdueTasksCount > 0
            ? "rose"
            : stats.needsReviewTasksCount > 0
              ? "warning"
              : "success",
      },
      iconName: "AlertTriangle",
    },
    {
      id: "overall-progress",
      title: "Tỷ lệ hoàn thành toàn trường",
      value: `${stats.averageSchoolProgressPercent}%`,
      subtext: "Tiến độ trung bình",
      progress: stats.averageSchoolProgressPercent,
      iconName: "TrendingUp",
    },
  ];
}

export function ExecutiveStatStrip({ stats, className }: ExecutiveStatStripProps) {
  const cards = getStatCardData(stats);

  return (
    <div
      className={cn(
        "grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4",
        className
      )}
      data-slot="executive-stat-strip"
    >
      {cards.map((card) => {
        const IconComponent = iconMap[card.iconName];
        const isUrgentCard = card.id === "urgent-tasks";
        const isOverdueAlert = isUrgentCard && (stats?.overdueTasksCount ?? 0) > 0;

        // Accent container styles for the soft rounded icon box
        let iconContainerClass = "bg-primary/10 text-primary";
        if (card.id === "school-tasks") {
          iconContainerClass = "bg-blue-500/10 text-blue-600 dark:text-blue-400";
        } else if (card.id === "unit-tasks") {
          iconContainerClass = "bg-violet-500/10 text-violet-600 dark:text-violet-400";
        } else if (card.id === "urgent-tasks") {
          iconContainerClass = isOverdueAlert
            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-400";
        } else if (card.id === "overall-progress") {
          iconContainerClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
        }

        return (
          <div
            key={card.id}
            className={cn(
              "group relative flex flex-col justify-between rounded-2xl border border-border/50 bg-card p-4 sm:p-5 shadow-card hover:shadow-card-hover transition-all duration-300",
              isOverdueAlert && "border-rose-500/40 bg-rose-500/[0.03] shadow-rose-500/5 hover:border-rose-500/60"
            )}
            data-slot="stat-card"
            data-card-id={card.id}
          >
            {/* Top header row: Icon in soft rounded container & Title + Badge */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {IconComponent && (
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl p-2.5 transition-transform duration-300 group-hover:scale-105",
                      iconContainerClass
                    )}
                  >
                    <IconComponent className="size-5 shrink-0" />
                  </div>
                )}
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-muted-foreground tracking-tight line-clamp-1">
                    {card.title}
                  </span>
                </div>
              </div>

              {card.badge && (
                <Badge
                  variant={card.badge.variant}
                  className={cn(
                    "h-5 px-1.5 text-[10px] font-medium leading-none shrink-0",
                    isOverdueAlert && "gap-1 font-semibold"
                  )}
                >
                  {isOverdueAlert && (
                    <span className="relative flex size-1.5 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-rose-500" />
                    </span>
                  )}
                  {card.badge.label}
                </Badge>
              )}
            </div>

            {/* Metric Value */}
            <div className="my-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono tabular-nums">
                {card.value}
              </span>
            </div>

            {/* Bottom section: Progress bar or Subtext */}
            <div className="pt-0.5">
              {card.progress !== undefined ? (
                <div className="space-y-1.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/80">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.min(100, Math.max(0, card.progress))}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{card.subtext}</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {card.progress}%
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 leading-snug">
                  {isUrgentCard && isOverdueAlert ? (
                    <span className="inline-block size-1.5 rounded-full bg-rose-500 shrink-0" />
                  ) : null}
                  <span className="truncate">{card.subtext}</span>
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ExecutiveStatStrip;
