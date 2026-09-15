"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  AlertTriangle,
  Target,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  selectExecutiveActionQueue,
  type ExecutiveActionStats,
  type ExecutiveFilter,
  type ExecutiveActionItem,
} from "@/lib/executive-matrix-aggregator";
import type { ApprovalActionPayload } from "@/types/workspace";
import {
  useOptionalDashboardData,
  useOptionalDashboardActions,
} from "@/components/dashboard/dashboard-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type { ExecutiveFilter, ExecutiveActionItem };

export const INITIAL_LIMIT = 5;

export interface ExecutiveActionCenterProps {
  stats: ExecutiveActionStats;
  activeFilter: ExecutiveFilter;
  onFilterChange: (filter: ExecutiveFilter) => void;
  items?: ExecutiveActionItem[];
  onAction?: (actionType: string, item: ExecutiveActionItem) => void;
  onReviewAction?: (payload: ApprovalActionPayload) => Promise<void> | void;
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
  { filter: "PENDING_APPROVAL", label: "Chờ duyệt" },
  { filter: "BLOCKED_OVERDUE", label: "Vướng mắc & Quá hạn" },
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
  onReviewAction,
  title = "Cần bạn xử lý",
  subtitle,
  hideCards = true,
  isLoading = false,
  errorMessage = null,
}: ExecutiveActionCenterProps) {
  const cards = getActionCardData(stats);
  const allItems = items ?? [];

  const dashboardData = useOptionalDashboardData();
  const dashboardActions = useOptionalDashboardActions();

  const [confirmApproveId, setConfirmApproveId] = React.useState<string | null>(null);
  const [revisionItemId, setRevisionItemId] = React.useState<string | null>(null);
  const [revisionComment, setRevisionComment] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = React.useState<Record<string, string>>({});

  // Filter + sort happen here; the preview is sliced AFTER them (plan T04.9).
  const selection = selectExecutiveActionQueue(allItems, activeFilter, INITIAL_LIMIT);
  const { filteredTotal, previewItems, counts } = selection;

  const lensCount = (filter: ExecutiveFilter): number =>
    filter === "ALL" ? allItems.length : counts[filter as Exclude<ExecutiveFilter, "ALL">];

  const notifyFeedback = (taskId: string, message: string) => {
    setActionFeedback((prev) => ({ ...prev, [taskId]: message }));
    setTimeout(() => {
      setActionFeedback((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }, 3500);
  };

  const handleApprove = async (item: ExecutiveActionItem) => {
    setIsSubmitting(item.taskId);
    try {
      const payload: ApprovalActionPayload = {
        taskId: item.taskId,
        decision: "approved",
        comment: "Ban Giám hiệu phê duyệt L2",
        reviewedByRole: "ADMIN",
        reviewedByName: dashboardData?.user?.name || "Ban Giám hiệu",
      };
      if (onReviewAction) {
        await onReviewAction(payload);
      } else if (dashboardActions?.handleReviewAction) {
        await dashboardActions.handleReviewAction(payload);
      }
      notifyFeedback(item.taskId, "Đã phê duyệt L2!");
    } catch {
      notifyFeedback(item.taskId, "Lỗi phê duyệt nhiệm vụ");
    } finally {
      setIsSubmitting(null);
      setConfirmApproveId(null);
    }
  };

  const handleRequestRevision = async (item: ExecutiveActionItem) => {
    setIsSubmitting(item.taskId);
    try {
      const payload: ApprovalActionPayload = {
        taskId: item.taskId,
        decision: "revision_requested",
        comment: revisionComment.trim() || "Yêu cầu đơn vị chỉnh sửa và bổ sung hồ sơ minh chứng",
        reviewedByRole: "ADMIN",
        reviewedByName: dashboardData?.user?.name || "Ban Giám hiệu",
      };
      if (onReviewAction) {
        await onReviewAction(payload);
      } else if (dashboardActions?.handleReviewAction) {
        await dashboardActions.handleReviewAction(payload);
      }
      notifyFeedback(item.taskId, "Đã gửi yêu cầu chỉnh sửa!");
    } catch {
      notifyFeedback(item.taskId, "Lỗi gửi yêu cầu");
    } finally {
      setIsSubmitting(null);
      setRevisionItemId(null);
      setRevisionComment("");
    }
  };

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
                  "group relative flex flex-col justify-between gap-3 rounded-xl border bg-card p-3.5 sm:p-4 text-left transition-all duration-200 cursor-pointer select-none overflow-hidden w-full",
                  "hover:-translate-y-0.5 hover:shadow-xs active:scale-[0.98] active:translate-y-0",
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
        className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 text-card-foreground shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <h2
              id="executive-action-queue-title"
              className="font-heading text-sm font-bold tracking-tight text-foreground flex items-center gap-2"
            >
              <span>{title}</span>
              <span className="sr-only">Hàng đợi điều hành</span>
            </h2>
            {filteredTotal > 0 && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-mono tabular-nums text-xs font-semibold text-primary">
                {filteredTotal} nhiệm vụ
              </span>
            )}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>

          {/* Three lenses with a correct accessible selected state and matching counts - only show when there are items to filter */}
          {allItems.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-1"
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
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isActive
                        ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
                    )}
                    data-slot="action-queue-lens"
                    data-filter={lens.filter}
                    data-active={isActive ? "true" : "false"}
                  >
                    <span>{lens.label}</span>
                    <span className="font-mono tabular-nums opacity-75">{lensCount(lens.filter)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {errorMessage ? (
          <div
            className="mx-1 mt-3 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3.5 py-3 text-xs text-rose-800"
            data-slot="action-queue-error"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : isLoading ? (
          <div
            className="mx-1 mt-3 space-y-2"
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
            className="flex items-center gap-3 px-1 py-3 text-xs text-muted-foreground"
            data-slot="action-center-empty-state"
          >
            <ShieldCheck className="size-4 text-emerald-600 shrink-0" strokeWidth={1.5} />
            <span>
              {allItems.length === 0
                ? "Không có nhiệm vụ cần xử lý trong phạm vi hiện tại."
                : "Không có nhiệm vụ nào phù hợp với bộ lọc đã chọn."}
            </span>
          </div>
        ) : (
          <>
            <ul className="mt-1 divide-y divide-border/40" data-slot="action-items-queue">
              {previewItems.map((item) => {
                const isReview = item.reasons.includes("REVIEW") || item.filterType === "PENDING_APPROVAL";
                const isConfirming = confirmApproveId === item.taskId;
                const isRevisionOpen = revisionItemId === item.taskId;
                const isItemSubmitting = isSubmitting === item.taskId;
                const feedback = actionFeedback[item.taskId];

                return (
                  <li
                    key={item.id}
                    className="group/item flex flex-col gap-2 py-3 rounded-xl px-2.5 -mx-1 transition-colors hover:bg-muted/40 cursor-pointer"
                    data-slot="action-item-row"
                    data-task-id={item.taskId}
                    data-has-review={item.reasons.includes("REVIEW") ? "true" : undefined}
                    data-has-overdue={item.reasons.includes("OVERDUE") || item.reasons.includes("BLOCKED") ? "true" : undefined}
                    onClick={() => onAction?.(item.actionType || item.filterType, item)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.reasons.map((reason) => (
                            <span
                              key={reason}
                              className={cn(
                                "rounded px-1.5 py-0.5 text-xs font-semibold shrink-0",
                                reason === "REVIEW"
                                  ? "bg-amber-500/15 text-amber-800"
                                  : "bg-rose-500/15 text-rose-800"
                              )}
                              data-reason={reason}
                            >
                              {reason === "REVIEW"
                                ? "Chờ duyệt"
                                : reason === "BLOCKED"
                                  ? "Vướng mắc"
                                  : "Quá hạn"}
                            </span>
                          ))}
                          <h4
                            className="line-clamp-1 text-sm font-semibold leading-snug text-foreground group-hover/item:text-primary transition-colors"
                            title={item.title}
                          >
                            {item.title}
                          </h4>
                          {feedback && (
                            <span className="text-xs text-emerald-800 bg-emerald-500/15 px-2 py-0.5 rounded-md font-medium">
                              {feedback}
                            </span>
                          )}
                        </div>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/80">
                            {item.departmentName || item.department}
                          </span>
                          {item.leadName || item.assignee ? (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Chủ trì: {item.leadName || item.assignee}</span>
                            </>
                          ) : null}
                          {item.dueDate ? (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">Hạn: {item.dueDate}</span>
                            </>
                          ) : null}
                        </p>
                      </div>

                      {/* Action Buttons Group */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {/* Executive Inline Approval Controls */}
                        {isReview && (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {isConfirming ? (
                              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs animate-fade-in">
                                <span className="text-emerald-900 font-medium px-1">Duyệt L2?</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isItemSubmitting}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprove(item);
                                  }}
                                  className="h-6 px-2 text-[11px] bg-emerald-700 hover:bg-emerald-800 text-white rounded"
                                >
                                  {isItemSubmitting ? "Đang gửi..." : "Đồng ý"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmApproveId(null);
                                  }}
                                  className="h-6 px-1.5 text-[11px] text-muted-foreground rounded"
                                >
                                  Hủy
                                </Button>
                              </div>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isItemSubmitting}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmApproveId(item.taskId);
                                    setRevisionItemId(null);
                                  }}
                                  className="h-7 px-2.5 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg gap-1 shadow-2xs"
                                >
                                  <Check size={13} strokeWidth={1.5} />
                                  <span>Duyệt L2</span>
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={isItemSubmitting}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRevisionItemId(isRevisionOpen ? null : item.taskId);
                                    setConfirmApproveId(null);
                                    setRevisionComment("");
                                  }}
                                  className={cn(
                                    "h-7 px-2.5 text-xs font-medium rounded-lg gap-1",
                                    isRevisionOpen
                                      ? "bg-amber-500/15 text-amber-900 border-amber-500/30"
                                      : "hover:bg-amber-500/10 hover:text-amber-900 text-muted-foreground"
                                  )}
                                >
                                  <RotateCcw size={12} strokeWidth={1.5} />
                                  <span>Yêu cầu sửa</span>
                                </Button>
                              </>
                            )}
                          </div>
                        )}

                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="min-h-[36px] sm:min-h-[32px] h-7 shrink-0 gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground group-hover/item:text-primary group-hover/item:bg-primary/10 transition-all"
                          aria-label={`${item.actionLabel || "Xem chi tiết"}: ${item.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAction?.(item.actionType || item.filterType, item);
                          }}
                        >
                          <span>{item.actionLabel || "Xem chi tiết"}</span>
                          <ArrowRight className="size-3.5 group-hover/item:translate-x-0.5 transition-transform" strokeWidth={1.5} />
                        </Button>
                      </div>
                    </div>

                    {/* Inline Revision Input Drawer */}
                    {isRevisionOpen && (
                      <div
                        className="w-full mt-2 p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.04] space-y-2 animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between text-xs text-amber-900 font-medium">
                          <span>Ghi chú yêu cầu đơn vị chỉnh sửa/bổ sung hồ sơ:</span>
                          <button
                            type="button"
                            onClick={() => setRevisionItemId(null)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X size={13} />
                          </button>
                        </div>
                        <Input
                          type="text"
                          value={revisionComment}
                          onChange={(e) => setRevisionComment(e.target.value)}
                          placeholder="Ví dụ: Bổ sung minh chứng hoặc làm rõ kết quả thực hiện..."
                          className="h-7 text-xs bg-card border-border/80 rounded-lg"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setRevisionItemId(null)}
                            className="h-6 px-2 text-xs"
                          >
                            Hủy
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isItemSubmitting}
                            onClick={() => handleRequestRevision(item)}
                            className="h-6 px-3 text-xs bg-amber-700 hover:bg-amber-800 text-white rounded-lg"
                          >
                            {isItemSubmitting ? "Đang gửi..." : "Gửi yêu cầu sửa"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
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
