"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, Target } from "lucide-react";
import type {
  ExecutiveActionStats,
  ExecutiveFilter,
} from "@/lib/executive-matrix-aggregator";
import { cn } from "@/lib/utils";

export type { ExecutiveFilter };

export interface ExecutiveActionCenterProps {
  stats: ExecutiveActionStats;
  activeFilter: ExecutiveFilter;
  onFilterChange: (filter: ExecutiveFilter) => void;
}

interface ActionCardConfig {
  id: string;
  filterKey: Exclude<ExecutiveFilter, "ALL">;
  title: string;
  getValue: (stats: ExecutiveActionStats) => number;
  getSubtext: (stats: ExecutiveActionStats) => string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { strokeWidth?: number }>;
  accentColor: string;
  activeTopBar: string;
  activeAccent: string;
  activeBg: string;
  hoverBorder: string;
  dotColor: string;
}

const ACTION_CARDS: ActionCardConfig[] = [
  {
    id: "pending-approval",
    filterKey: "PENDING_APPROVAL",
    title: "Chờ BGH Phê duyệt",
    getValue: (s) => s.pendingSchoolApprovalCount,
    getSubtext: (s) =>
      s.pendingSchoolApprovalCount > 0
        ? "Tờ trình chờ thẩm định & phê duyệt"
        : "Không có tờ trình tồn đọng",
    icon: CheckCircle2,
    accentColor: "bg-indigo-500/40",
    activeTopBar: "bg-indigo-600 dark:bg-indigo-500",
    activeAccent: "border-indigo-500 ring-2 ring-indigo-500/20",
    activeBg: "bg-indigo-500/[0.04] dark:bg-indigo-500/[0.06]",
    hoverBorder: "hover:border-indigo-500/40 hover:bg-indigo-500/[0.02]",
    dotColor: "bg-indigo-500",
  },
  {
    id: "blocked-overdue",
    filterKey: "BLOCKED_OVERDUE",
    title: "Vướng mắc & Trễ hạn",
    getValue: (s) => s.blockedTasksCount + s.overdueTasksCount,
    getSubtext: (s) => {
      if (s.blockedTasksCount > 0 && s.overdueTasksCount > 0) {
        return `${s.blockedTasksCount} vướng mắc · ${s.overdueTasksCount} trễ hạn`;
      }
      if (s.overdueTasksCount > 0) return `${s.overdueTasksCount} nhiệm vụ trễ hạn`;
      if (s.blockedTasksCount > 0) return `${s.blockedTasksCount} nhiệm vụ vướng mắc`;
      return "Tiến độ thông suốt";
    },
    icon: AlertTriangle,
    accentColor: "bg-rose-500/40",
    activeTopBar: "bg-rose-600 dark:bg-rose-500",
    activeAccent: "border-rose-500 ring-2 ring-rose-500/20",
    activeBg: "bg-rose-500/[0.04] dark:bg-rose-500/[0.06]",
    hoverBorder: "hover:border-rose-500/40 hover:bg-rose-500/[0.02]",
    dotColor: "bg-rose-500",
  },
  {
    id: "strategic-active",
    filterKey: "STRATEGIC",
    title: "Nhiệm vụ Chiến lược",
    getValue: (s) => s.strategicActiveCount,
    getSubtext: (s) =>
      s.strategicActiveCount > 0
        ? "Nhiệm vụ trọng tâm năm học"
        : "Đã hoàn thành các mục tiêu",
    icon: Target,
    accentColor: "bg-emerald-500/40",
    activeTopBar: "bg-emerald-600 dark:bg-emerald-500",
    activeAccent: "border-emerald-500 ring-2 ring-emerald-500/20",
    activeBg: "bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06]",
    hoverBorder: "hover:border-emerald-500/40 hover:bg-emerald-500/[0.02]",
    dotColor: "bg-emerald-500",
  },
];

export function getActionCardData(stats: ExecutiveActionStats) {
  return ACTION_CARDS.map((card) => ({
    ...card,
    value: card.getValue(stats),
    subtext: card.getSubtext(stats),
  }));
}

export function ExecutiveActionCenter({
  stats,
  activeFilter,
  onFilterChange,
}: ExecutiveActionCenterProps) {
  const cards = getActionCardData(stats);

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-3 gap-4"
      data-slot="executive-action-center"
    >
      {cards.map((card) => {
        const IconComponent = card.icon;
        const isActive = activeFilter === card.filterKey;

        return (
          <div
            key={card.id}
            role="button"
            tabIndex={0}
            aria-pressed={isActive}
            onClick={() => {
              onFilterChange(isActive ? "ALL" : card.filterKey);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onFilterChange(isActive ? "ALL" : card.filterKey);
              }
            }}
            className={cn(
              "group relative flex flex-col justify-between gap-3 rounded-xl border bg-card p-4 sm:p-5 transition-all duration-200 cursor-pointer select-none overflow-hidden",
              "hover:-translate-y-0.5 hover:shadow-xs",
              isActive
                ? cn("shadow-xs z-10", card.activeAccent, card.activeBg)
                : cn("border-border/60 hover:bg-muted/15", card.hoverBorder),
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            )}
            data-slot="action-card"
            data-card-id={card.id}
            data-filter-key={card.filterKey}
            data-active={isActive ? "true" : "false"}
          >
            {/* Top accent line - clips cleanly within rounded-xl border */}
            <div
              className={cn(
                "absolute inset-x-0 top-0 transition-all duration-200",
                isActive
                  ? cn("h-[3px]", card.activeTopBar)
                  : cn("h-[2px] opacity-70 group-hover:opacity-100 group-hover:h-[3px]", card.accentColor)
              )}
            />

            {/* Icon + Title */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground">
                  <IconComponent className="size-4 shrink-0" strokeWidth={1.5} />
                </div>
                <span className="text-xs font-semibold text-muted-foreground tracking-tight truncate group-hover:text-foreground transition-colors">
                  {card.title}
                </span>
              </div>
              {isActive && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-foreground/10 text-foreground font-mono shrink-0">
                  Đang lọc
                </span>
              )}
            </div>

            {/* Metric Value */}
            <div className="flex items-baseline my-0.5">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                {card.value}
              </span>
            </div>

            {/* Status dot + Contextual Subtext */}
            <div className="flex items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
              <span className={cn("size-1.5 rounded-full shrink-0", card.dotColor)} />
              <span className="truncate">
                {card.subtext}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ExecutiveActionCenter;
