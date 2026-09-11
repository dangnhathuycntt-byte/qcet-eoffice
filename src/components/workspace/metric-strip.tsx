"use client";

import * as React from "react";
import {
  Layers,
  Clock,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface MetricTrend {
  value: string | number;
  direction: "up" | "down" | "neutral";
  label?: string;
}

export interface MetricCardData {
  id: string;
  title: string;
  value: number | string;
  subtitle?: string;
  statusFilterKey?: string;
  trend?: MetricTrend;
  icon?: LucideIcon;
  colorScheme?: "slate" | "blue" | "amber" | "rose" | "emerald";
  isInteractive?: boolean;
}

export interface StandardWorkspaceMetrics {
  totalTasks: number;
  inProgressCount?: number;
  waitingApprovalCount: number;
  urgentOverdueCount: number;
  completedCount?: number;
  completedRate?: number;
}

export interface MetricStripProps {
  cards?: MetricCardData[];
  metrics?: StandardWorkspaceMetrics;
  activeFilter?: string;
  onFilterChange?: (statusKey: string) => void;
  className?: string;
  isLoading?: boolean;
}

const colorSchemeStyles: Record<
  "slate" | "blue" | "amber" | "rose" | "emerald",
  {
    iconBg: string;
    iconColor: string;
    borderActive: string;
    ringActive: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  slate: {
    iconBg: "bg-slate-100",
    iconColor: "text-slate-700",
    borderActive: "border-slate-800",
    ringActive: "ring-slate-700",
    badgeBg: "bg-slate-100",
    badgeText: "text-slate-800",
  },
  blue: {
    iconBg: "bg-blue-50",
    iconColor: "text-blue-700",
    borderActive: "border-blue-600",
    ringActive: "ring-blue-600",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-800",
  },
  amber: {
    iconBg: "bg-amber-50",
    iconColor: "text-amber-700",
    borderActive: "border-amber-600",
    ringActive: "ring-amber-600",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-800",
  },
  rose: {
    iconBg: "bg-rose-50",
    iconColor: "text-rose-700",
    borderActive: "border-rose-600",
    ringActive: "ring-rose-600",
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-800",
  },
  emerald: {
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-700",
    borderActive: "border-emerald-600",
    ringActive: "ring-emerald-600",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-800",
  },
};

/**
 * MetricStrip - Canonical 5-card stat strip.
 * High-contrast numbers, change trends, explicit filter status to prevent toggling confusion.
 * Accessible, WCAG 2.2 AA compliant, 44px+ touch targets on interactive cards.
 * Light-Only with zero dark: classes and zero emojis.
 */
export function MetricStrip({
  cards,
  metrics,
  activeFilter,
  onFilterChange,
  className,
  isLoading = false,
}: MetricStripProps) {
  // Generate standard 5 cards if not custom provided
  const resolvedCards: MetricCardData[] = React.useMemo(() => {
    if (cards && cards.length > 0) return cards;
    if (!metrics) return [];

    const total = metrics.totalTasks ?? 0;
    const waiting = metrics.waitingApprovalCount ?? 0;
    const overdue = metrics.urgentOverdueCount ?? 0;
    const completed =
      metrics.completedCount ??
      Math.round(((metrics.completedRate ?? 0) / 100) * total);
    const inProgress =
      metrics.inProgressCount ??
      Math.max(0, total - completed - waiting - overdue);
    const completedRateStr =
      typeof metrics.completedRate === "number"
        ? `${Math.round(metrics.completedRate)}%`
        : total > 0
        ? `${Math.round((completed / total) * 100)}%`
        : "0%";

    return [
      {
        id: "total",
        title: "Khối lượng công việc",
        value: total,
        subtitle: "Tổng số nhiệm vụ",
        statusFilterKey: "ALL",
        icon: Layers,
        colorScheme: "blue",
        isInteractive: Boolean(onFilterChange),
      },
      {
        id: "in_progress",
        title: "Đang thực hiện",
        value: inProgress,
        subtitle: "Đang triển khai",
        statusFilterKey: "IN_PROGRESS",
        icon: Clock,
        colorScheme: "slate",
        isInteractive: Boolean(onFilterChange),
      },
      {
        id: "waiting",
        title: "Chờ phê duyệt",
        value: waiting,
        subtitle: waiting > 0 ? "Cần xem xét" : "Không có hồ sơ",
        statusFilterKey: "NEEDS_REVIEW",
        icon: FileCheck,
        colorScheme: "amber",
        isInteractive: Boolean(onFilterChange),
      },
      {
        id: "overdue",
        title: "Quá hạn",
        value: overdue,
        subtitle: overdue > 0 ? "Cần ưu tiên xử lý" : "Đúng tiến độ",
        statusFilterKey: "OVERDUE",
        icon: AlertCircle,
        colorScheme: "rose",
        isInteractive: Boolean(onFilterChange),
      },
      {
        id: "completed",
        title: "Tỷ lệ hoàn thành",
        value: completedRateStr,
        subtitle: `${completed} / ${total} nhiệm vụ`,
        statusFilterKey: "COMPLETED",
        icon: CheckCircle2,
        colorScheme: "emerald",
        isInteractive: Boolean(onFilterChange),
      },
    ];
  }, [cards, metrics, onFilterChange]);

  const handleCardClick = (card: MetricCardData) => {
    if (!onFilterChange || !card.statusFilterKey) return;
    // Clear toggle confusion: clicking active filter resets to ALL (or toggles predictably)
    if (activeFilter === card.statusFilterKey && card.statusFilterKey !== "ALL") {
      onFilterChange("ALL");
    } else {
      onFilterChange(card.statusFilterKey);
    }
  };

  return (
    <div
      role="region"
      aria-label="Thống kê chỉ số công việc"
      className={cn(
        "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4",
        className
      )}
    >
      {resolvedCards.map((card) => {
        const isClickable =
          Boolean(onFilterChange) &&
          Boolean(card.statusFilterKey) &&
          card.isInteractive !== false;
        const isActive =
          isClickable &&
          Boolean(card.statusFilterKey) &&
          activeFilter === card.statusFilterKey;
        const scheme = colorSchemeStyles[card.colorScheme || "slate"];
        const IconComponent = card.icon || Layers;

        const cardContent = (
          <>
            {/* Top row: Icon + Title + Active/Filter indicator */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={cn(
                    "size-8 rounded-lg flex items-center justify-center shrink-0 border border-slate-200/80 shadow-2xs",
                    scheme.iconBg
                  )}
                  aria-hidden="true"
                >
                  <IconComponent
                    className={cn("size-4", scheme.iconColor)}
                    strokeWidth={2}
                  />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-slate-700 truncate">
                  {card.title}
                </span>
              </div>

              {isActive && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-bold shrink-0 border shadow-2xs",
                    scheme.badgeBg,
                    scheme.badgeText
                  )}
                  aria-hidden="true"
                >
                  <Filter className="size-3" />
                  Đang lọc
                </span>
              )}
            </div>

            {/* Middle row: Large high-contrast metric value */}
            <div className="mt-2.5 sm:mt-3 flex items-baseline justify-between gap-2">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-slate-900">
                {isLoading ? "--" : card.value}
              </span>

              {card.trend && (
                <div
                  className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-semibold shrink-0 px-1.5 py-0.5 rounded-md",
                    card.trend.direction === "up"
                      ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                      : card.trend.direction === "down"
                      ? "text-rose-700 bg-rose-50 border border-rose-200"
                      : "text-slate-700 bg-slate-100 border border-slate-200"
                  )}
                  aria-label={`Xu hướng: ${card.trend.value} ${card.trend.label || ""}`}
                >
                  {card.trend.direction === "up" ? (
                    <TrendingUp className="size-3 text-emerald-600" aria-hidden="true" />
                  ) : card.trend.direction === "down" ? (
                    <TrendingDown className="size-3 text-rose-600" aria-hidden="true" />
                  ) : (
                    <Minus className="size-3 text-slate-500" aria-hidden="true" />
                  )}
                  <span>{card.trend.value}</span>
                </div>
              )}
            </div>

            {/* Bottom row: Subtitle or Trend Description */}
            <div className="mt-1 flex items-center justify-between text-xs text-slate-700">
              <span className="truncate">{card.subtitle}</span>
              {card.trend?.label && (
                <span className="text-xs text-slate-700 shrink-0 hidden sm:inline">
                  {card.trend.label}
                </span>
              )}
            </div>
          </>
        );

        if (isClickable) {
          return (
            <button
              key={card.id}
              type="button"
              role="button"
              aria-pressed={isActive}
              aria-label={`${card.title}: ${card.value}${card.subtitle ? ` (${card.subtitle})` : ""}. Nhấn để lọc.`}
              onClick={() => handleCardClick(card)}
              className={cn(
                "group relative text-left rounded-xl p-3.5 sm:p-4 bg-white border transition-all select-none min-h-[96px] w-full",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
                "cursor-pointer hover:shadow-sm hover:border-slate-300 active:scale-[0.99]",
                isActive
                  ? cn(
                      "border-2 shadow-xs ring-1 bg-slate-50/40",
                      scheme.borderActive,
                      scheme.ringActive
                    )
                  : "border-slate-200 shadow-2xs"
              )}
            >
              {cardContent}
            </button>
          );
        }

        return (
          <div
            key={card.id}
            role="region"
            aria-label={`${card.title}: ${card.value}`}
            className="relative rounded-xl p-3.5 sm:p-4 bg-white border border-slate-200 shadow-2xs min-h-[96px]"
          >
            {cardContent}
          </div>
        );
      })}
    </div>
  );
}
