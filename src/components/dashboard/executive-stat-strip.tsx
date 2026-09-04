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
  variant: "default" | "secondary" | "destructive" | "outline" | "ghost" | "success" | "progress" | "warning";
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
            ? "warning"
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
        "grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
      data-slot="executive-stat-strip"
    >
      {cards.map((card) => {
        const IconComponent = iconMap[card.iconName];

        return (
          <div
            key={card.id}
            className="group relative flex flex-col justify-between rounded-xl border border-border/75 bg-card p-4.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] transition-all duration-200 hover:border-border hover:shadow-[0_12px_28px_-6px_rgba(0,0,0,0.06)]"
            data-slot="stat-card"
            data-card-id={card.id}
          >
            {/* Top header row: Title & Badge/Icon */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground tracking-tight line-clamp-1">
                {card.title}
              </span>
              <div className="flex items-center gap-1.5">
                {card.badge && (
                  <Badge
                    variant={card.badge.variant}
                    className="h-5 px-1.5 text-[10px] font-medium leading-none"
                  >
                    {card.badge.label}
                  </Badge>
                )}
                {IconComponent && (
                  <IconComponent className="size-4 text-muted-foreground/60 shrink-0 transition-colors group-hover:text-foreground" />
                )}
              </div>
            </div>

            {/* Metric Value */}
            <div className="my-2.5 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                {card.value}
              </span>
            </div>

            {/* Bottom section: Progress bar or Subtext */}
            <div className="pt-1">
              {card.progress !== undefined ? (
                <div className="space-y-1.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.min(100, Math.max(0, card.progress))}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{card.subtext}</span>
                    <span className="font-medium text-foreground">{card.progress}%</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  {card.id === "urgent-tasks" && stats && stats.overdueTasksCount > 0 ? (
                    <span className="inline-block size-1.5 rounded-full bg-amber-500 shrink-0" />
                  ) : null}
                  <span>{card.subtext}</span>
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
