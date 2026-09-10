"use client";

import * as React from "react";
import { Layers, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import type { AdaptiveWorkspaceMetrics, WorkspaceScope } from "../types";
import { cn } from "@/lib/utils";

export interface AdaptiveMetricStripProps {
  metrics: AdaptiveWorkspaceMetrics;
  scope: WorkspaceScope;
  className?: string;
  onMetricClick?: (status: string) => void;
}

interface MetricCardConfig {
  id: string;
  status: string;
  title: string;
  value: string | number;
  subtitle: string;
  icon: typeof Layers;
  iconColor: string;
}

export function AdaptiveMetricStrip({
  metrics,
  scope,
  className,
  onMetricClick,
}: AdaptiveMetricStripProps) {
  const safeMetrics: AdaptiveWorkspaceMetrics = {
    totalTasks: metrics?.totalTasks ?? 0,
    urgentOverdueCount: metrics?.urgentOverdueCount ?? 0,
    waitingApprovalCount: metrics?.waitingApprovalCount ?? 0,
    completedRate: metrics?.completedRate ?? 0,
    labelScope:
      metrics?.labelScope ??
      (scope === "school" ? "Toàn trường" : scope === "unit" ? "Đơn vị" : "Cá nhân"),
  };

  const formatRate = (rate: number | undefined) =>
    typeof rate === "number" && Number.isFinite(rate) ? `${rate}%` : "0%";

  const getCards = (currentScope: WorkspaceScope): MetricCardConfig[] => {
    switch (currentScope) {
      case "school":
        return [
          {
            id: "total",
            status: "ALL",
            title: "Khối lượng công việc",
            value: safeMetrics.totalTasks,
            subtitle: "Nhiệm vụ toàn trường",
            icon: Layers,
            iconColor: "text-blue-700 bg-blue-500/10 border-blue-500/20",
          },
          {
            id: "urgent",
            status: "OVERDUE",
            title: "Quá hạn",
            value: safeMetrics.urgentOverdueCount,
            subtitle:
              safeMetrics.urgentOverdueCount > 0
                ? "Cần ưu tiên xử lý"
                : "Tiến độ đúng hạn",
            icon: AlertCircle,
            iconColor:
              safeMetrics.urgentOverdueCount > 0
                ? "text-rose-700 bg-rose-500/10 border-rose-500/20"
                : "text-muted-foreground bg-muted/30 border-border/40",
          },
          {
            id: "waiting",
            status: "NEEDS_REVIEW",
            title: "Đang chờ duyệt",
            value: safeMetrics.waitingApprovalCount,
            subtitle:
              safeMetrics.waitingApprovalCount > 0
                ? "Hồ sơ chờ BGH phê duyệt"
                : "Không có hồ sơ chờ",
            icon: Clock,
            iconColor:
              safeMetrics.waitingApprovalCount > 0
                ? "text-amber-700 bg-amber-500/10 border-amber-500/20"
                : "text-muted-foreground bg-muted/30 border-border/40",
          },
          {
            id: "completed",
            status: "COMPLETED",
            title: "Tiến độ chung",
            value: formatRate(safeMetrics.completedRate),
            subtitle: "Tỷ lệ hoàn thành",
            icon: CheckCircle2,
            iconColor: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20",
          },
        ];

      case "unit":
        return [
          {
            id: "total",
            status: "ALL",
            title: "Khối lượng công việc",
            value: safeMetrics.totalTasks,
            subtitle: `Nhiệm vụ đơn vị (${safeMetrics.labelScope})`,
            icon: Layers,
            iconColor: "text-blue-700 bg-blue-500/10 border-blue-500/20",
          },
          {
            id: "urgent",
            status: "OVERDUE",
            title: "Quá hạn đơn vị",
            value: safeMetrics.urgentOverdueCount,
            subtitle:
              safeMetrics.urgentOverdueCount > 0
                ? "Cần ưu tiên xử lý"
                : "Tiến độ đúng hạn",
            icon: AlertCircle,
            iconColor:
              safeMetrics.urgentOverdueCount > 0
                ? "text-rose-700 bg-rose-500/10 border-rose-500/20"
                : "text-muted-foreground bg-muted/30 border-border/40",
          },
          {
            id: "waiting",
            status: "NEEDS_REVIEW",
            title: "Chờ phân công/duyệt",
            value: safeMetrics.waitingApprovalCount,
            subtitle:
              safeMetrics.waitingApprovalCount > 0
                ? "Hồ sơ chờ Thầy/Cô phê duyệt"
                : "Không có việc tồn đọng",
            icon: Clock,
            iconColor:
              safeMetrics.waitingApprovalCount > 0
                ? "text-amber-700 bg-amber-500/10 border-amber-500/20"
                : "text-muted-foreground bg-muted/30 border-border/40",
          },
          {
            id: "completed",
            status: "COMPLETED",
            title: "Tiến độ đơn vị",
            value: formatRate(safeMetrics.completedRate),
            subtitle: "Đã nghiệm thu",
            icon: CheckCircle2,
            iconColor: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20",
          },
        ];

      case "my":
      default:
        return [
          {
            id: "total",
            status: "ALL",
            title: "Việc cần làm ngay",
            value: safeMetrics.totalTasks,
            subtitle: "Nhiệm vụ cá nhân",
            icon: Layers,
            iconColor: "text-blue-700 bg-blue-500/10 border-blue-500/20",
          },
          {
            id: "urgent",
            status: "OVERDUE",
            title: "Đang thực hiện",
            value: safeMetrics.urgentOverdueCount,
            subtitle:
              safeMetrics.urgentOverdueCount > 0
                ? "Hạn gấp & Quá hạn"
                : "Tiến độ đúng hạn",
            icon: AlertCircle,
            iconColor:
              safeMetrics.urgentOverdueCount > 0
                ? "text-rose-700 bg-rose-500/10 border-rose-500/20"
                : "text-muted-foreground bg-muted/30 border-border/40",
          },
          {
            id: "waiting",
            status: "NEEDS_REVIEW",
            title: "Chờ phản hồi",
            value: safeMetrics.waitingApprovalCount,
            subtitle:
              safeMetrics.waitingApprovalCount > 0
                ? "Đã nộp chờ thẩm định"
                : "Không có hồ sơ chờ",
            icon: Clock,
            iconColor:
              safeMetrics.waitingApprovalCount > 0
                ? "text-amber-700 bg-amber-500/10 border-amber-500/20"
                : "text-muted-foreground bg-muted/30 border-border/40",
          },
          {
            id: "completed",
            status: "COMPLETED",
            title: "Hoàn tất kỳ này",
            value: formatRate(safeMetrics.completedRate),
            subtitle: "Tỷ lệ hoàn thành",
            icon: CheckCircle2,
            iconColor: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20",
          },
        ];
    }
  };

  const cards = getCards(scope);
  const isInteractive = typeof onMetricClick === "function";

  // 2x2 Bento grid layout (refactored from hairline divide-border for split-cockpit resilience)
  return (
    <div
      data-slot="adaptive-metric-strip"
      className={cn(
        "grid grid-cols-2 gap-2.5 p-1.5 rounded-xl bg-muted/40 border border-border/70 shadow-2xs",
        className
      )}
    >
      {cards.map((card) => {
        const Icon = card.icon;
        const cardAriaLabel = isInteractive
          ? `Lọc theo: ${card.title}, ${card.value}`
          : `${card.title}: ${card.value}`;

        return (
          <div
            key={card.id}
            data-slot={`metric-card-${card.id}`}
            data-metric-status={card.status}
            role={isInteractive ? "button" : "region"}
            aria-label={cardAriaLabel}
            tabIndex={isInteractive ? 0 : undefined}
            onClick={isInteractive ? () => onMetricClick(card.status) : undefined}
            onKeyDown={
              isInteractive
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onMetricClick(card.status);
                    }
                  }
                : undefined
            }
            className={cn(
              "p-3 rounded-lg bg-card border border-border/70 flex flex-col justify-between space-y-1.5 shadow-2xs transition-colors",
              isInteractive &&
                "cursor-pointer hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
            )}
          >
            <div className="flex items-start justify-between gap-1.5">
              <span className="text-xs font-medium text-muted-foreground leading-snug">
                {card.title}
              </span>
              <div
                className={cn(
                  "p-1 rounded-md border flex items-center justify-center shrink-0 select-none",
                  card.iconColor
                )}
              >
                <Icon
                  className="size-3.5"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </div>
            </div>
            <div>
              <div className="text-base sm:text-xl font-bold font-mono tabular-nums text-foreground select-text">
                {card.value}
              </div>
              <p className="text-xs text-muted-foreground truncate leading-snug mt-0.5">
                {card.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
