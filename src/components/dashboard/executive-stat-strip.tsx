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

export type WorkboxFilter =
  | "ALL"
  | "URGENT_OVERDUE"
  | "MY_ACTION"
  | "ASSIGNED_BY_ME"
  | "COMPLETED"
  | "NEEDS_REVIEW";

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
  filterKey?: WorkboxFilter;
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
  activeFilter?: WorkboxFilter;
  onFilterChange?: (filter: WorkboxFilter) => void;
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
  const triageCount = stats.pendingTriageCount ?? 0;
  const escalatedCount = stats.escalatedReviewCount ?? 0;
  const overdueCount = stats.overdueTasksCount ?? 0;
  const needsReviewCount = stats.needsReviewTasksCount ?? 0;
  const urgentCount = needsReviewCount + overdueCount + triageCount + escalatedCount;

  // Build intelligent subtext for urgent card
  const urgentSubtextParts: string[] = [
    `${formatNumber(needsReviewCount)} cần xử lý`,
    `${formatNumber(overdueCount)} trễ hạn`,
  ];
  if (triageCount > 0) {
    urgentSubtextParts.push(`${formatNumber(triageCount)} chờ tiếp nhận`);
  }
  if (escalatedCount > 0) {
    urgentSubtextParts.push(`${formatNumber(escalatedCount)} quá hạn`);
  }
  const urgentSubtext = urgentSubtextParts.join(" · ");

  // Build intelligent badge for urgent card
  let urgentBadge: StatCardBadge;
  if (escalatedCount > 0 || overdueCount > 0) {
    const totalOverdue = overdueCount + escalatedCount;
    urgentBadge = {
      label: escalatedCount > 0 ? `${formatNumber(totalOverdue)} quá hạn` : `${formatNumber(overdueCount)} trễ hạn`,
      variant: "rose",
    };
  } else if (needsReviewCount > 0) {
    urgentBadge = {
      label: triageCount > 0 ? `${formatNumber(needsReviewCount + triageCount)} cần xử lý` : "Cần duyệt",
      variant: "warning",
    };
  } else if (triageCount > 0) {
    urgentBadge = {
      label: `${formatNumber(triageCount)} chờ tiếp nhận`,
      variant: "warning",
    };
  } else {
    urgentBadge = {
      label: "Ổn định",
      variant: "success",
    };
  }

  return [
    {
      id: "school-tasks",
      title: "Nhiệm vụ cấp Trường",
      value: formatNumber(stats.totalSchoolTasks),
      subtext: `${formatNumber(stats.schoolTasksInProgress)} đang làm · ${formatNumber(stats.schoolTasksCompleted)} hoàn thiện`,
      filterKey: "ALL",
      iconName: "Layers",
    },
    {
      id: "unit-tasks",
      title: "Công việc Đơn vị",
      value: formatNumber(stats.totalStaffTasks),
      subtext: `${formatNumber(stats.staffTasksInProgress)} đang làm · ${formatNumber(stats.staffTasksCompleted)} hoàn thiện`,
      filterKey: "MY_ACTION",
      iconName: "Clock",
    },
    {
      id: "urgent-tasks",
      title: "Cần xử lý & Trễ hạn",
      value: formatNumber(urgentCount),
      subtext: urgentSubtext,
      filterKey: "URGENT_OVERDUE",
      badge: urgentBadge,
      iconName: "AlertTriangle",
    },
    {
      id: "overall-progress",
      title: "Tỷ lệ hoàn thành toàn trường",
      value: `${stats.averageSchoolProgressPercent}%`,
      subtext: "Tiến độ trung bình",
      filterKey: "COMPLETED",
      progress: stats.averageSchoolProgressPercent,
      iconName: "CheckCircle2",
    },
  ];
}

export function ExecutiveStatStrip({
  stats,
  activeFilter,
  onFilterChange,
  className,
}: ExecutiveStatStripProps) {
  const cards = getStatCardData(stats);

  return (
    <div
      className={cn(
        "grid grid-cols-2 lg:grid-cols-4 divide-x divide-border rounded-xl border border-border bg-card shadow-subtle overflow-hidden",
        className
      )}
      data-slot="executive-stat-strip"
    >
      {cards.map((card, idx) => {
        const IconComponent = iconMap[card.iconName];
        const isUrgentCard = card.id === "urgent-tasks";
        const isOverdueAlert =
          isUrgentCard &&
          ((stats?.overdueTasksCount ?? 0) > 0 || (stats?.escalatedReviewCount ?? 0) > 0);
        const isActive = Boolean(card.filterKey && activeFilter === card.filterKey);
        const isClickable = Boolean(onFilterChange && card.filterKey);

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
            : (stats?.needsReviewTasksCount ?? 0) > 0 || (stats?.pendingTriageCount ?? 0) > 0
              ? "bg-amber-500"
              : "bg-emerald-500/50";
          dotColor = isOverdueAlert
            ? "bg-rose-500"
            : (stats?.needsReviewTasksCount ?? 0) > 0 || (stats?.pendingTriageCount ?? 0) > 0
              ? "bg-amber-500"
              : "bg-emerald-500";
        } else if (card.id === "overall-progress") {
          accentLineColor = "bg-emerald-500/60";
          dotColor = "bg-emerald-500";
        }

        return (
          <div
            key={card.id}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            aria-pressed={isClickable ? isActive : undefined}
            onClick={() => {
              if (card.filterKey) {
                onFilterChange?.(activeFilter === card.filterKey ? "ALL" : card.filterKey);
              }
            }}
            onKeyDown={(e) => {
              if (isClickable && card.filterKey && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onFilterChange?.(activeFilter === card.filterKey ? "ALL" : card.filterKey);
              }
            }}
            className={cn(
              "group relative flex flex-col justify-between p-4 sm:p-5 transition-all duration-200 text-left",
              isClickable &&
                "cursor-pointer select-none hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
              !isClickable && "hover:bg-muted/15",
              isActive && (
                isOverdueAlert
                  ? "ring-2 ring-rose-500 ring-inset bg-rose-500/[0.04] shadow-xs z-10"
                  : "ring-2 ring-primary ring-inset bg-primary/[0.04] shadow-xs z-10"
              ),
              // Responsive hairline dividers for 2-column mode on mobile/tablet
              idx < 2 ? "border-b border-border lg:border-b-0" : "",
              // Subtle background tint only on active overdue alert when not active
              isOverdueAlert && !isActive && "bg-rose-500/[0.02]"
            )}
            data-slot="stat-card"
            data-card-id={card.id}
            data-filter-key={card.filterKey}
            data-active={isActive ? "true" : "false"}
          >
            {/* Subtle top accent line */}
            <div
              className={cn(
                "absolute inset-x-0 top-0 transition-all duration-200",
                isActive
                  ? cn("h-[3px]", isOverdueAlert ? "bg-rose-500" : "bg-primary")
                  : cn("h-[2px] opacity-70 group-hover:opacity-100 group-hover:h-[3px]", accentLineColor)
              )}
            />

            {/* Top row: Icon + Title + Micro-badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground transition-colors group-hover:text-foreground">
                  {IconComponent && (
                    <IconComponent className="size-4 shrink-0" strokeWidth={1.5} />
                  )}
                </div>
                <span className="text-xs sm:text-sm font-semibold text-foreground/90 tracking-tight truncate">
                  {card.title}
                </span>
              </div>

              {card.badge && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono shrink-0",
                    isOverdueAlert
                      ? "bg-rose-500/10 text-rose-700 border border-rose-500/20"
                      : (stats?.needsReviewTasksCount ?? 0) > 0 || (stats?.pendingTriageCount ?? 0) > 0
                        ? "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                  )}
                >
                  <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} />
                  <span>{card.badge.label}</span>
                </span>
              )}
            </div>

            {/* Metric Value */}
            <div className="my-2.5 flex items-baseline justify-between">
              <span className="font-mono tabular-nums text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
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
                  <div className="flex items-center justify-between text-xs sm:text-[13px] font-medium text-muted-foreground">
                    <span className="truncate">{card.subtext}</span>
                    <span className="font-mono font-semibold text-foreground tabular-nums ml-1 shrink-0">
                      {card.progress}%
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-[13px] font-medium text-muted-foreground flex items-center gap-1.5 leading-snug">
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
