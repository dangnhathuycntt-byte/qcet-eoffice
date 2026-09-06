"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, Target } from "lucide-react";
import type { ExecutiveActionStats } from "@/lib/executive-matrix-aggregator";
import { cn } from "@/lib/utils";

export type ExecutiveFilter =
  | "ALL"
  | "PENDING_APPROVAL"
  | "BLOCKED_OVERDUE"
  | "STRATEGIC";

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
  icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { strokeWidth?: number }>;
  accentColor: string;
  activeAccent: string;
  dotColor: string;
}

const ACTION_CARDS: ActionCardConfig[] = [
  {
    id: "pending-approval",
    filterKey: "PENDING_APPROVAL",
    title: "Cho BGH Phe duyet",
    getValue: (s) => s.pendingSchoolApprovalCount,
    icon: CheckCircle2,
    accentColor: "bg-indigo-500/50",
    activeAccent: "border-indigo-500 ring-indigo-500/30",
    dotColor: "bg-indigo-500",
  },
  {
    id: "blocked-overdue",
    filterKey: "BLOCKED_OVERDUE",
    title: "Vuong mac & Tre han",
    getValue: (s) => s.blockedTasksCount + s.overdueTasksCount,
    icon: AlertTriangle,
    accentColor: "bg-rose-500/50",
    activeAccent: "border-rose-500 ring-rose-500/30",
    dotColor: "bg-rose-500",
  },
  {
    id: "strategic-active",
    filterKey: "STRATEGIC",
    title: "Nhiem vu Chien luoc",
    getValue: (s) => s.strategicActiveCount,
    icon: Target,
    accentColor: "bg-emerald-500/50",
    activeAccent: "border-emerald-500 ring-emerald-500/30",
    dotColor: "bg-emerald-500",
  },
];

export function getActionCardData(stats: ExecutiveActionStats) {
  return ACTION_CARDS.map((card) => ({
    ...card,
    value: card.getValue(stats),
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
              "group relative flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5 transition-all duration-150 cursor-pointer select-none",
              "hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
              isActive
                ? cn("ring-2 ring-inset bg-primary/[0.04] shadow-sm z-10", card.activeAccent)
                : "border-border/50"
            )}
            data-slot="action-card"
            data-card-id={card.id}
            data-filter-key={card.filterKey}
            data-active={isActive ? "true" : "false"}
          >
            {/* Top accent line */}
            <div
              className={cn(
                "absolute inset-x-0 top-0 rounded-t-xl transition-all",
                isActive ? "h-[3px] bg-primary" : cn("h-[2px]", card.accentColor)
              )}
            />

            {/* Icon + Title */}
            <div className="flex items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground transition-colors group-hover:text-foreground">
                <IconComponent className="size-4 shrink-0" strokeWidth={1.5} />
              </div>
              <span className="text-xs font-medium text-muted-foreground tracking-tight truncate">
                {card.title}
              </span>
            </div>

            {/* Metric Value */}
            <div className="flex items-baseline">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                {card.value}
              </span>
            </div>

            {/* Status dot */}
            <div className="flex items-center gap-1.5">
              <span className={cn("size-1.5 rounded-full shrink-0", card.dotColor)} />
              <span className="text-xs text-muted-foreground">
                {card.title}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ExecutiveActionCenter;
