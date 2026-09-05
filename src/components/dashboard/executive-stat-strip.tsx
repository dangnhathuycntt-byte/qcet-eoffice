import * as React from "react";
import {
  Layers,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Building2,
  CheckSquare,
  TrendingUp,
} from "lucide-react";
import type { DashboardStats } from "@/types/dashboard";
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
  iconName:
    | "Layers"
    | "Clock"
    | "AlertTriangle"
    | "CheckCircle2"
    | "Building2"
    | "CheckSquare"
    | "TrendingUp";
}

export interface ExecutiveStatStripProps {
  stats: DashboardStats;
  className?: string;
}

const iconMap = {
  Layers,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Building2,
  CheckSquare,
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
      iconName: "Layers",
    },
    {
      id: "unit-tasks",
      title: "Công việc Đơn vị",
      value: formatNumber(stats.totalStaffTasks),
      subtext: `${formatNumber(stats.staffTasksInProgress)} đang làm · ${formatNumber(stats.staffTasksCompleted)} xong`,
      iconName: "Clock",
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
      iconName: "CheckCircle2",
    },
  ];
}

export function ExecutiveStatStrip({ stats, className }: ExecutiveStatStripProps) {
  const cards = getStatCardData(stats);

  return (
    <div
      className={cn(
        "grid grid-cols-2 lg:grid-cols-4 rounded-xl border border-border/50 bg-card shadow-card overflow-hidden divide-border/40 lg:divide-x",
        className
      )}
      data-slot="executive-stat-strip"
    >
      {cards.map((card, idx) => {
        const IconComponent = iconMap[card.iconName];
        const isUrgentCard = card.id === "urgent-tasks";
        const isOverdueAlert = isUrgentCard && (stats?.overdueTasksCount ?? 0) > 0;

        // Subtle accent line colors
        let accentLineColor = "bg-primary/40";
        let dotColor = "bg-primary/70";

        if (card.id === "school-tasks") {
          accentLineColor = "bg-blue-500/50";
          dotColor = "bg-blue-500";
        } else if (card.id === "unit-tasks") {
          accentLineColor = "bg-indigo-500/50";
          dotColor = "bg-indigo-500";
        } else if (card.id === "urgent-tasks") {
          accentLineColor = isOverdueAlert
            ? "bg-rose-500"
            : (stats?.needsReviewTasksCount ?? 0) > 0
              ? "bg-amber-500"
              : "bg-emerald-500/50";
          dotColor = isOverdueAlert
            ? "bg-rose-500"
            : (stats?.needsReviewTasksCount ?? 0) > 0
              ? "bg-amber-500"
              : "bg-emerald-500";
        } else if (card.id === "overall-progress") {
          accentLineColor = "bg-emerald-500/60";
          dotColor = "bg-emerald-500";
        }

        return (
          <div
            key={card.id}
            className={cn(
              "group relative flex flex-col justify-between p-4 sm:p-5 transition-colors duration-150 hover:bg-muted/15",
              // Responsive hairline dividers for 2-column mode on mobile/tablet
              idx % 2 === 0 ? "border-r border-border/40 lg:border-r-0" : "",
              idx < 2 ? "border-b border-border/40 lg:border-b-0" : "",
              // Subtle background tint only on active overdue alert
              isOverdueAlert && "bg-rose-500/[0.02]"
            )}
            data-slot="stat-card"
            data-card-id={card.id}
          >
            {/* Subtle top accent line */}
            <div className={cn("absolute inset-x-0 top-0 h-[2px]", accentLineColor)} />

            {/* Top row: Icon + Title + Micro-badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground transition-colors group-hover:text-foreground">
                  {IconComponent && (
                    <IconComponent className="size-4 shrink-0" strokeWidth={1.5} />
                  )}
                </div>
                <span className="text-xs font-medium text-muted-foreground tracking-tight truncate">
                  {card.title}
                </span>
              </div>

              {card.badge && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-medium font-mono shrink-0",
                    isOverdueAlert
                      ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                      : (stats?.needsReviewTasksCount ?? 0) > 0
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                  )}
                >
                  <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} />
                  <span>{card.badge.label}</span>
                </span>
              )}
            </div>

            {/* Metric Value */}
            <div className="my-2.5 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                {card.value}
              </span>
            </div>

            {/* Bottom section: Progress bar or Subtext with subtle status dot */}
            <div className="pt-0.5">
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
                    <span className="truncate">{card.subtext}</span>
                    <span className="font-mono font-semibold text-foreground tabular-nums ml-1 shrink-0">
                      {card.progress}%
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 leading-snug">
                  <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} />
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
