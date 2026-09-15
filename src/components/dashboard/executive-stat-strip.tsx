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
import type {
  ExecutiveActionStats,
  ExecutiveFilter,
} from "@/lib/executive-matrix-aggregator";
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
  executiveFilterKey?: ExecutiveFilter;
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
  executiveStats?: ExecutiveActionStats | null;
  activeFilter?: WorkboxFilter;
  activeExecutiveFilter?: ExecutiveFilter;
  onFilterChange?: (filter: WorkboxFilter) => void;
  onExecutiveFilterChange?: (filter: ExecutiveFilter) => void;
  className?: string;
  isExecutive?: boolean;
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
  schoolTasksNotStarted: 0,
  totalStaffTasks: 0,
  staffTasksInProgress: 0,
  staffTasksCompleted: 0,
  staffTasksNotStarted: 0,
  needsReviewTasksCount: 0,
  overdueTasksCount: 0,
  averageSchoolProgressPercent: 0,
  completionRate: 0,
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
    `${formatNumber(needsReviewCount)} cần duyệt`,
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

  const schoolNotStarted = stats.schoolTasksNotStarted ?? 0;
  const staffNotStarted = stats.staffTasksNotStarted ?? 0;
  const completionRateVal =
    stats.completionRate ??
    Math.round((stats.schoolTasksCompleted / (stats.totalSchoolTasks || 1)) * 100);

  return [
    {
      id: "school-tasks",
      title: "Nhiệm vụ cấp Trường",
      value: formatNumber(stats.totalSchoolTasks),
      subtext: `${formatNumber(stats.schoolTasksInProgress)} đang làm · ${formatNumber(schoolNotStarted)} chưa làm · ${formatNumber(stats.schoolTasksCompleted)} hoàn thành`,
      filterKey: "ALL",
      iconName: "Layers",
    },
    {
      id: "unit-tasks",
      title: "Công việc Đơn vị",
      value: formatNumber(stats.totalStaffTasks),
      subtext: `${formatNumber(stats.staffTasksInProgress)} đang làm · ${formatNumber(staffNotStarted)} chưa làm · ${formatNumber(stats.staffTasksCompleted)} hoàn thành`,
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
      title: "Tiến độ trung bình toàn trường",
      value: `${stats.averageSchoolProgressPercent}%`,
      subtext: `Hoàn tất ${formatNumber(stats.schoolTasksCompleted)}/${formatNumber(stats.totalSchoolTasks)} (${completionRateVal}%)`,
      filterKey: "COMPLETED",
      progress: stats.averageSchoolProgressPercent,
      iconName: "CheckCircle2",
    },
  ];
}

export function getExecutiveStatCardData(
  statsInput: DashboardStats,
  executiveStats?: ExecutiveActionStats | null
): StatCardData[] {
  const stats = statsInput || defaultStats;
  const schoolNotStarted = stats.schoolTasksNotStarted ?? 0;
  const completionRateVal =
    stats.completionRate ??
    Math.round((stats.schoolTasksCompleted / (stats.totalSchoolTasks || 1)) * 100);

  const pendingApprovalCount =
    executiveStats?.pendingSchoolApprovalCount ?? stats.needsReviewTasksCount;
  const overdueCount =
    executiveStats?.overdueTasksCount ?? stats.overdueTasksCount;
  const blockedCount = executiveStats?.blockedTasksCount ?? 0;
  const totalIssueCount = blockedCount + overdueCount;
  const strategicCount = executiveStats?.strategicActiveCount ?? 0;

  let urgentSubtext = "Tiến độ thông suốt";
  if (blockedCount > 0 && overdueCount > 0) {
    urgentSubtext = `${blockedCount} vướng mắc · ${overdueCount} trễ hạn`;
  } else if (overdueCount > 0) {
    urgentSubtext = `${overdueCount} nhiệm vụ trễ hạn`;
  } else if (blockedCount > 0) {
    urgentSubtext = `${blockedCount} nhiệm vụ vướng mắc`;
  }

  return [
    {
      id: "school-tasks",
      title: "Tổng nhiệm vụ",
      value: formatNumber(stats.totalSchoolTasks),
      subtext: `${formatNumber(stats.schoolTasksInProgress)} đang làm · ${formatNumber(schoolNotStarted)} chưa làm · ${formatNumber(stats.schoolTasksCompleted)} hoàn thành`,
      filterKey: "ALL",
      iconName: "Layers",
    },
    {
      id: "pending-approval",
      title: "Chờ duyệt",
      value: formatNumber(pendingApprovalCount),
      subtext:
        pendingApprovalCount > 0
          ? "Tờ trình chờ thẩm định & phê duyệt"
          : "Không có tờ trình tồn đọng",
      filterKey: "NEEDS_REVIEW",
      executiveFilterKey: "PENDING_APPROVAL",
      badge: {
        label: pendingApprovalCount > 0 ? "Cần duyệt" : "Ổn định",
        variant: pendingApprovalCount > 0 ? "warning" : "success",
      },
      iconName: "CheckCircle2",
    },
    {
      id: "blocked-overdue",
      title: "Trễ / vướng",
      value: formatNumber(totalIssueCount),
      subtext: urgentSubtext,
      filterKey: "URGENT_OVERDUE",
      executiveFilterKey: "BLOCKED_OVERDUE",
      badge: {
        label: totalIssueCount > 0 ? `${formatNumber(totalIssueCount)} vướng mắc` : "Thông suốt",
        variant: totalIssueCount > 0 ? "rose" : "success",
      },
      iconName: "AlertTriangle",
    },
    {
      id: "strategic-active",
      title: "Trọng tâm",
      value: formatNumber(strategicCount),
      subtext:
        strategicCount > 0
          ? "Nhiệm vụ trọng tâm năm học"
          : "Đã hoàn thành mục tiêu",
      filterKey: "ASSIGNED_BY_ME",
      executiveFilterKey: "STRATEGIC",
      iconName: "CheckSquare",
    },
    {
      id: "overall-progress",
      title: "Tiến độ toàn trường",
      value: `${stats.averageSchoolProgressPercent}%`,
      subtext: `Hoàn tất ${formatNumber(stats.schoolTasksCompleted)}/${formatNumber(stats.totalSchoolTasks)} (${completionRateVal}%)`,
      filterKey: "COMPLETED",
      progress: stats.averageSchoolProgressPercent,
      iconName: "TrendingUp",
    },
  ];
}

export function getStatCardsForView(
  stats: DashboardStats,
  isExecutive?: boolean,
  executiveStats?: ExecutiveActionStats | null
): StatCardData[] {
  const isExecutiveView = Boolean(isExecutive || executiveStats);
  return isExecutiveView
    ? getExecutiveStatCardData(stats, executiveStats)
    : getStatCardData(stats);
}

export function ExecutiveStatStrip({
  stats,
  executiveStats,
  activeFilter,
  activeExecutiveFilter,
  onFilterChange,
  onExecutiveFilterChange,
  className,
  isExecutive,
}: ExecutiveStatStripProps) {
  const isExecutiveView = Boolean(isExecutive || executiveStats);
  const cards = isExecutiveView
    ? getExecutiveStatCardData(stats, executiveStats)
    : getStatCardData(stats);

  const gridColsClass = isExecutiveView
    ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
    : "grid-cols-2 lg:grid-cols-4";

  return (
    <div
      className={cn(
        "grid divide-x divide-border rounded-xl border border-border bg-card shadow-subtle overflow-hidden",
        gridColsClass,
        className
      )}
      data-slot="executive-stat-strip"
    >
      {cards.map((card, idx) => {
        const IconComponent = iconMap[card.iconName];
        const isUrgentCard = card.id === "urgent-tasks" || card.id === "blocked-overdue";
        const isOverdueAlert =
          isUrgentCard &&
          ((stats?.overdueTasksCount ?? 0) > 0 ||
            (stats?.escalatedReviewCount ?? 0) > 0 ||
            (executiveStats &&
              ((executiveStats.overdueTasksCount ?? 0) > 0 ||
                (executiveStats.blockedTasksCount ?? 0) > 0)));

        const isActive = isExecutiveView
          ? Boolean(
              (card.executiveFilterKey &&
                activeExecutiveFilter === card.executiveFilterKey) ||
                (card.filterKey &&
                  activeFilter === card.filterKey &&
                  activeExecutiveFilter === "ALL")
            )
          : Boolean(card.filterKey && activeFilter === card.filterKey);

        const isClickable = Boolean(
          (onExecutiveFilterChange && card.executiveFilterKey) ||
            (onFilterChange && card.filterKey)
        );

        let dotColor = "bg-primary/70";

        if (card.id === "school-tasks") {
          dotColor = "bg-blue-500";
        } else if (card.id === "unit-tasks") {
          dotColor = "bg-indigo-500";
        } else if (card.id === "pending-approval") {
          const pendingCount =
            executiveStats?.pendingSchoolApprovalCount ??
            stats?.needsReviewTasksCount ??
            0;
          dotColor = pendingCount > 0 ? "bg-amber-500" : "bg-emerald-500";
        } else if (card.id === "urgent-tasks" || card.id === "blocked-overdue") {
          dotColor = isOverdueAlert
            ? "bg-rose-500"
            : (stats?.needsReviewTasksCount ?? 0) > 0 ||
              (stats?.pendingTriageCount ?? 0) > 0
              ? "bg-amber-500"
              : "bg-emerald-500";
        } else if (card.id === "overall-progress") {
          dotColor = "bg-emerald-500";
        } else if (card.id === "strategic-active") {
          dotColor = "bg-emerald-600";
        }

        const ariaLabel = card.badge
          ? `${card.title}: ${card.value} (${card.badge.label}), ${card.subtext}`
          : `${card.title}: ${card.value}, ${card.subtext}`;

        return (
          <button
            key={card.id}
            type="button"
            disabled={!isClickable}
            aria-pressed={isClickable ? isActive : undefined}
            aria-label={ariaLabel}
            onClick={() => {
              if (card.executiveFilterKey && onExecutiveFilterChange) {
                const nextExecFilter =
                  activeExecutiveFilter === card.executiveFilterKey
                    ? "ALL"
                    : card.executiveFilterKey;
                onExecutiveFilterChange(nextExecFilter);
              } else if (card.filterKey && onFilterChange) {
                const nextFilter =
                  activeFilter === card.filterKey ? "ALL" : card.filterKey;
                onFilterChange(nextFilter);
              }
            }}
            className={cn(
              "group relative flex flex-col justify-between p-4 sm:p-5 transition-all duration-200 text-left w-full disabled:cursor-default",
              isClickable &&
                "cursor-pointer select-none hover:bg-muted/30 active:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset focus-visible:z-20",
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
            {/* Top row: Icon + Title + Micro-badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {IconComponent && (
                  <IconComponent className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                )}
                <span className="text-xs sm:text-sm font-semibold text-foreground/90 tracking-tight truncate">
                  {card.title}
                </span>
              </div>

              {card.badge && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0",
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
              <span className="font-heading tabular-nums text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {card.value}
              </span>
            </div>

            {/* Bottom section: Progress bar or Subtext with subtle status dot */}
            <div className="pt-0.5">
              {card.progress !== undefined ? (
                <div className="space-y-1.5" title="Tiến độ bình quân" aria-hidden="true">
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
                    aria-hidden="true"
                    title="Tiến độ bình quân"
                  >
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.min(100, Math.max(0, card.progress))}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-[13px] font-medium text-muted-foreground">
                    <span className="truncate">{card.subtext}</span>
                    <span
                      className="font-heading font-semibold text-foreground tabular-nums ml-1 shrink-0"
                      title="Tiến độ bình quân"
                    >
                      Bình quân {card.progress}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs sm:text-[13px] font-medium text-muted-foreground flex items-center gap-1.5 leading-snug">
                  <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} />
                  <span className="truncate">{card.subtext}</span>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default ExecutiveStatStrip;
