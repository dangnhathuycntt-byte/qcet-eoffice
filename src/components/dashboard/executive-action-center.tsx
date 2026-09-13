"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  Target,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import {
  selectExecutiveActionQueue,
  type ExecutiveActionStats,
  type ExecutiveFilter,
  type ExecutiveActionItem,
} from "@/lib/executive-matrix-aggregator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type { ExecutiveFilter, ExecutiveActionItem };

export const INITIAL_LIMIT = 5;

export interface ExecutiveActionCenterProps {
  stats: ExecutiveActionStats;
  activeFilter: ExecutiveFilter;
  onFilterChange: (filter: ExecutiveFilter) => void;
  items?: ExecutiveActionItem[];
  onAction?: (actionType: string, item: ExecutiveActionItem) => void;
  /** Tab title, e.g. "Hồ sơ chờ xem xét". Falls back to a generic label. */
  title?: string;
  subtitle?: string;
  /** Dashboard hides the large KPI cards; the compact lens chips still render. */
  hideCards?: boolean;
  isLoading?: boolean;
  errorMessage?: string | null;
}

interface ActionCardConfig {
  id: string;
  filterKey: Exclude<ExecutiveFilter, "ALL">;
  title: string;
  getValue: (stats: ExecutiveActionStats) => number;
  getSubtext: (stats: ExecutiveActionStats) => string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { strokeWidth?: number }>;
  activeAccent: string;
  activeBg: string;
  hoverBorder: string;
  dotColor: string;
}

const ACTION_CARDS: ActionCardConfig[] = [
  {
    id: "pending-approval",
    filterKey: "PENDING_APPROVAL",
    title: "Hồ sơ chờ xem xét",
    getValue: (s) => s.pendingSchoolApprovalCount,
    getSubtext: (s) =>
      s.pendingSchoolApprovalCount > 0 ? "Hồ sơ đang chờ thẩm định" : "Không có hồ sơ tồn đọng",
    icon: CheckCircle2,
    activeAccent: "border-indigo-500 ring-2 ring-indigo-500/20",
    activeBg: "bg-indigo-500/[0.04]",
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
      return "Không có việc vướng hoặc trễ";
    },
    icon: AlertTriangle,
    activeAccent: "border-rose-500 ring-2 ring-rose-500/20",
    activeBg: "bg-rose-500/[0.04]",
    hoverBorder: "hover:border-rose-500/40 hover:bg-rose-500/[0.02]",
    dotColor: "bg-rose-500",
  },
  {
    id: "strategic-active",
    filterKey: "STRATEGIC",
    title: "Nhiệm vụ Chiến lược",
    getValue: (s) => s.strategicActiveCount,
    getSubtext: (s) =>
      s.strategicActiveCount > 0 ? "Nhiệm vụ trọng tâm năm học" : "Đã hoàn thành các mục tiêu",
    icon: Target,
    activeAccent: "border-emerald-500 ring-2 ring-emerald-500/20",
    activeBg: "bg-emerald-500/[0.04]",
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

/** Workbench queue lenses. Each is a predicate over the SAME item set. */
const QUEUE_LENSES: { filter: ExecutiveFilter; label: string }[] = [
  { filter: "ALL", label: "Tất cả" },
  { filter: "PENDING_APPROVAL", label: "Hồ sơ chờ xem xét" },
  { filter: "BLOCKED_OVERDUE", label: "Vướng mắc & Trễ hạn" },
];

/** Drill-down target that each parser really consumes (plan T08.1). */
export function queueDrillDownHref(filter: ExecutiveFilter): string {
  if (filter === "PENDING_APPROVAL") return "/tasks?status=PENDING_EXECUTIVE_APPROVAL";
  if (filter === "BLOCKED_OVERDUE") return "/tasks?attention=overdue";
  return "/tasks?view=table";
}

export function ExecutiveActionCenter({
  stats,
  activeFilter,
  onFilterChange,
  items,
  onAction,
  title = "Hàng đợi điều hành",
  subtitle,
  hideCards = true,
  isLoading = false,
  errorMessage = null,
}: ExecutiveActionCenterProps) {
  const cards = getActionCardData(stats);
  const allItems = items ?? [];

  // Filter + sort happen here; the preview is sliced AFTER them (plan T04.9).
  const selection = selectExecutiveActionQueue(allItems, activeFilter, INITIAL_LIMIT);
  const { filteredTotal, previewItems, counts } = selection;

  const lensCount = (filter: ExecutiveFilter): number =>
    filter === "ALL" ? allItems.length : counts[filter as Exclude<ExecutiveFilter, "ALL">];

  return (
    <div className="space-y-3" data-slot="executive-action-center">
      {!hideCards && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cards.map((card) => {
            const IconComponent = card.icon;
            const isActive = activeFilter === card.filterKey;
            return (
              <button
                type="button"
                key={card.id}
                aria-pressed={isActive}
                aria-label={`Lọc theo ${card.title}: ${card.value} ${card.subtext}`}
                onClick={() => onFilterChange(isActive ? "ALL" : card.filterKey)}
                className={cn(
                  "group relative flex flex-col justify-between gap-3 rounded-xl border bg-card p-4 sm:p-5 text-left transition-all duration-200 cursor-pointer select-none overflow-hidden w-full",
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
                <div className="flex items-center gap-2 min-w-0">
                  <IconComponent className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-xs sm:text-sm font-semibold text-foreground/90 tracking-tight truncate">
                    {card.title}
                  </span>
                </div>
                <span className="font-mono tabular-nums text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {card.value}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("size-1.5 rounded-full shrink-0", card.dotColor)} />
                  <span className="truncate">{card.subtext}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <section
        aria-labelledby="executive-action-queue-title"
        className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2
              id="executive-action-queue-title"
              className="font-heading text-sm font-bold tracking-tight text-foreground"
            >
              {title}
            </h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {filteredTotal > 0 && (
            <span className="font-mono tabular-nums text-xs text-muted-foreground">
              {filteredTotal} nhiệm vụ
            </span>
          )}
        </div>

        {/* Three lenses with a correct accessible selected state and matching counts */}
        <div
          className="mt-2 flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Lọc hàng đợi theo lý do"
        >
          {QUEUE_LENSES.map((lens) => {
            const isActive = activeFilter === lens.filter;
            return (
              <button
                key={lens.filter}
                type="button"
                aria-pressed={isActive}
                onClick={() => onFilterChange(lens.filter)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 min-h-[44px] sm:min-h-[36px] text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isActive
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
                data-slot="action-queue-lens"
                data-filter={lens.filter}
                data-active={isActive ? "true" : "false"}
              >
                <span>{lens.label}</span>
                <span className="font-mono tabular-nums">{lensCount(lens.filter)}</span>
              </button>
            );
          })}
        </div>

        {errorMessage ? (
          <div
            className="mx-1 mt-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3.5 py-3 text-xs text-rose-800"
            data-slot="action-queue-error"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : isLoading ? (
          <div
            className="mx-1 mt-2 space-y-2"
            data-slot="action-queue-loading"
            aria-busy="true"
            aria-live="polite"
          >
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/40" />
            ))}
            <span className="sr-only">Đang tải hàng đợi nhiệm vụ</span>
          </div>
        ) : filteredTotal === 0 ? (
          <div
            className="flex items-center gap-3.5 rounded-xl border border-border/70 bg-card/60 px-3.5 py-3 min-h-[64px]"
            data-slot="action-center-empty-state"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground border border-border/60">
              <ShieldCheck className="size-5" strokeWidth={1.5} />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-foreground leading-snug">
                Không có nhiệm vụ cần xử lý
              </h4>
              <p className="text-xs text-muted-foreground">
                Không có hồ sơ chờ xem xét, việc quá hạn hoặc vướng mắc trong phạm vi hiện tại.
              </p>
            </div>
          </div>
        ) : (
          <>
            <ul className="mx-1 mt-1 divide-y divide-border/50" data-slot="action-items-queue">
              {previewItems.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  data-slot="action-item-row"
                  data-task-id={item.taskId}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <h4
                      className="line-clamp-2 text-sm font-semibold leading-snug text-foreground"
                      title={item.title}
                    >
                      {item.title}
                    </h4>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">
                        {item.departmentName || item.department}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Chủ trì: {item.leadName || item.assignee}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">Hạn: {item.dueDate}</span>
                      {item.reasons.map((reason) => (
                        <span
                          key={reason}
                          className={cn(
                            "rounded px-1.5 py-0.5 font-medium",
                            reason === "REVIEW"
                              ? "bg-amber-500/10 text-amber-800"
                              : "bg-rose-500/10 text-rose-800"
                          )}
                          data-reason={reason}
                        >
                          {reason === "REVIEW"
                            ? "Hồ sơ chờ xem xét"
                            : reason === "BLOCKED"
                              ? "Tắc nghẽn"
                              : "Trễ hạn"}
                        </span>
                      ))}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] sm:min-h-[36px] h-9 shrink-0 gap-1.5 rounded-lg px-3 text-xs font-semibold"
                    aria-label={`${item.actionLabel || "Xem chi tiết"}: ${item.title}`}
                    onClick={() => onAction?.(item.actionType || item.filterType, item)}
                  >
                    <span>{item.actionLabel || "Xem chi tiết"}</span>
                    <ArrowRight className="size-3.5" strokeWidth={1.5} />
                  </Button>
                </li>
              ))}
            </ul>

            {filteredTotal > previewItems.length && (
              <div className="px-1 pt-2">
                <Link
                  href={queueDrillDownHref(activeFilter)}
                  className="text-xs font-medium text-primary hover:underline"
                  data-slot="action-queue-view-all"
                >
                  Xem tất cả {filteredTotal} nhiệm vụ
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default ExecutiveActionCenter;
