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
  const getCards = (currentScope: WorkspaceScope): MetricCardConfig[] => {
    switch (currentScope) {
      case "school":
        return [
          {
            id: "total",
            status: "ALL",
            title: "Khối lượng công việc",
            value: metrics.totalTasks,
            subtitle: "Nhiệm vụ toàn trường",
            icon: Layers,
            iconColor: "text-blue-700 bg-blue-500/10 border-blue-500/20",
          },
          {
            id: "urgent",
            status: "OVERDUE",
            title: "Quá hạn",
            value: metrics.urgentOverdueCount,
            subtitle:
              metrics.urgentOverdueCount > 0
                ? "Cần ưu tiên xử lý"
                : "Tiến độ đúng hạn",
            icon: AlertCircle,
            iconColor:
              metrics.urgentOverdueCount > 0
                ? "text-rose-700 bg-rose-500/10 border-rose-500/20"
                : "text-muted-foreground bg-muted/30 border-border/40",
          },
          {
            id: "waiting",
            status: "NEEDS_REVIEW",
            title: "Đang chờ duyệt",
            value: metrics.waitingApprovalCount,
            subtitle:
              metrics.waitingApprovalCount > 0
                ? "Hồ sơ chờ BGH phê duyệt"
                : "Không có hồ sơ chờ",
            icon: Clock,
            iconColor:
              metrics.waitingApprovalCount > 0
                ? "text-amber-700 bg-amber-500/10 border-amber-500/20"
                : "text-muted-foreground bg-muted/30 border-border/40",
          },
          {
            id: "completed",
            status: "COMPLETED",
            title: "Tiến độ chung",
            value: `${metrics.completedRate}%`,
            subtitle: "Tỷ lệ hoàn thành (DACUM)",
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
            value: metrics.totalTasks,
            subtitle: `Nhiệm vụ đơn vị (${metrics.labelScope})`,
            icon: Layers,
            iconColor: "text-blue-700 bg-blue-500/10 border-blue-500/20",
          },
          {
            id: "urgent",
            status: "OVERDUE",
            title: "Quá hạn đơn vị",
            value: metrics.urgentOverdueCount,
            subtitle:
              metrics.urgentOverdueCount > 0
                ? "Cần ưu tiên xử lý"
                : "Tiến độ đúng hạn",
            icon: AlertCircle,
            iconColor:
              metrics.urgentOverdueCount > 0
                ? "text-rose-700 bg-rose-500/10 border-rose-500/20"
                : "text-muted-foreground bg-muted/30 border-border/40",
          },
          {
            id: "waiting",
            status: "NEEDS_REVIEW",
            title: "Chờ phân công/duyệt",
            value: metrics.waitingApprovalCount,
            subtitle:
              metrics.waitingApprovalCount > 0
                ? "Hồ sơ chờ bạn phê duyệt"
                : "Không có việc tồn đọng",
            icon: Clock,
            iconColor:
              metrics.waitingApprovalCount > 0
                ? "text-amber-700 bg-amber-500/10 border-amber-500/20"
                : "text-muted-foreground bg-muted/30 border-border/40",
          },
          {
            id: "completed",
            status: "COMPLETED",
            title: "Tiến độ khoa",
            value: `${metrics.completedRate}%`,
            subtitle: "Đã nghiệm thu (DACUM)",
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
            value: metrics.totalTasks,
            subtitle: "Nhiệm vụ cá nhân",
            icon: Layers,
            iconColor: "text-blue-700 bg-blue-500/10 border-blue-500/20",
          },
          {
            id: "urgent",
            status: "OVERDUE",
            title: "Đang thực hiện",
            value: metrics.urgentOverdueCount,
            subtitle:
              metrics.urgentOverdueCount > 0
                ? "Hạn gấp & Quá hạn"
                : "Tiến độ đúng hạn",
            icon: AlertCircle,
            iconColor:
              metrics.urgentOverdueCount > 0
                ? "text-rose-700 bg-rose-500/10 border-rose-500/20"
                : "text-muted-foreground bg-muted/30 border-border/40",
          },
          {
            id: "waiting",
            status: "NEEDS_REVIEW",
            title: "Chờ phản hồi",
            value: metrics.waitingApprovalCount,
            subtitle:
              metrics.waitingApprovalCount > 0
                ? "Đã nộp chờ thẩm định"
                : "Không có hồ sơ chờ",
            icon: Clock,
            iconColor:
              metrics.waitingApprovalCount > 0
                ? "text-amber-700 bg-amber-500/10 border-amber-500/20"
                : "text-muted-foreground bg-muted/30 border-border/40",
          },
          {
            id: "completed",
            status: "COMPLETED",
            title: "Hoàn tất kỳ này",
            value: `${metrics.completedRate}%`,
            subtitle: "Tỷ lệ hoàn thành (DACUM)",
            icon: CheckCircle2,
            iconColor: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20",
          },
        ];
    }
  };

  const cards = getCards(scope);
  const isInteractive = typeof onMetricClick === "function";

  return (
    <div
      data-slot="adaptive-metric-strip"
      className={cn("grid grid-cols-2 lg:grid-cols-4 gap-3", className)}
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            data-slot={`metric-card-${card.id}`}
            data-metric-status={card.status}
            role={isInteractive ? "button" : undefined}
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
              "p-3.5 rounded-xl border border-border/70 bg-card/80 backdrop-blur-xs flex flex-col justify-between space-y-2 shadow-2xs select-none",
              isInteractive &&
                "cursor-pointer transition-all hover:border-border hover:shadow-xs active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground truncate">
                {card.title}
              </span>
              <div
                className={cn(
                  "p-1.5 rounded-lg border flex items-center justify-center shrink-0",
                  card.iconColor
                )}
              >
                <Icon
                  className="size-3.5 select-none"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-foreground">
                {card.value}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {card.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
