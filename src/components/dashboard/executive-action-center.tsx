"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, Target, ArrowRight } from "lucide-react";
import type {
  ExecutiveActionStats,
  ExecutiveFilter,
} from "@/lib/executive-matrix-aggregator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type { ExecutiveFilter };

export interface ExecutiveActionItem {
  id: string;
  title: string;
  department: string;
  assignee: string;
  dueDate: string;
  filterType: Exclude<ExecutiveFilter, "ALL">;
  priority?: "KHAN_CAP" | "CAO" | "TRUNG_BINH";
  actionLabel?: string;
}

export interface ExecutiveActionCenterProps {
  stats: ExecutiveActionStats;
  activeFilter: ExecutiveFilter;
  onFilterChange: (filter: ExecutiveFilter) => void;
  items?: ExecutiveActionItem[];
  onAction?: (item: ExecutiveActionItem) => void;
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

export const DEFAULT_ACTION_ITEMS: ExecutiveActionItem[] = [
  {
    id: "action-pending-1",
    title: "Phê duyệt kế hoạch kiểm định chất lượng CTĐT Khoa CNTT",
    department: "Khoa CNTT",
    assignee: "TS. Nguyễn Ngọc Vinh",
    dueDate: "10/09/2026",
    filterType: "PENDING_APPROVAL",
    actionLabel: "Phê duyệt ngay",
  },
  {
    id: "action-pending-2",
    title: "Tờ trình kinh phí mua sắm thiết bị phòng máy thực hành số 2",
    department: "Phòng QTTB",
    assignee: "ThS. Hoàng Anh Tuấn",
    dueDate: "12/09/2026",
    filterType: "PENDING_APPROVAL",
    actionLabel: "Phê duyệt ngay",
  },
  {
    id: "action-blocked-1",
    title: "Tắc nghẽn tiến độ số hóa hồ sơ tuyển sinh năm 2026",
    department: "Phòng Đào tạo",
    assignee: "ThS. Đỗ Quang Trung",
    dueDate: "05/09/2026",
    filterType: "BLOCKED_OVERDUE",
    priority: "KHAN_CAP",
    actionLabel: "Đôn đốc",
  },
  {
    id: "action-blocked-2",
    title: "Quá hạn nộp báo cáo kiểm kê tài sản phục vụ năm học mới",
    department: "Phòng HC-QT",
    assignee: "ThS. Phan Văn Thanh",
    dueDate: "04/09/2026",
    filterType: "BLOCKED_OVERDUE",
    priority: "CAO",
    actionLabel: "Đôn đốc",
  },
  {
    id: "action-strategic-1",
    title: "Triển khai đề án chuyển đổi số toàn diện QCET 2026-2030",
    department: "TT Truyền thông",
    assignee: "ThS. Mai Đinh Thị Xuân",
    dueDate: "30/09/2026",
    filterType: "STRATEGIC",
    actionLabel: "Chỉ đạo",
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
  items,
  onAction,
}: ExecutiveActionCenterProps) {
  const cards = getActionCardData(stats);

  const activeItems = React.useMemo(() => {
    const pool = items && items.length > 0 ? items : DEFAULT_ACTION_ITEMS;
    if (activeFilter === "ALL") return pool.slice(0, 3);
    return pool.filter((item) => item.filterType === activeFilter);
  }, [items, activeFilter]);

  return (
    <div className="space-y-4" data-slot="executive-action-center">
      {/* 3 Metric Action Filter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              {/* Top accent line */}
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
                  <span className="text-xs sm:text-sm font-semibold text-foreground/90 tracking-tight truncate group-hover:text-foreground transition-colors">
                    {card.title}
                  </span>
                </div>
                {isActive && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-foreground/10 text-foreground font-mono shrink-0">
                    Đang lọc
                  </span>
                )}
              </div>

              {/* Metric Value */}
              <div className="flex items-baseline my-0.5">
                <span className="font-mono tabular-nums text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {card.value}
                </span>
              </div>

              {/* Status dot + Contextual Subtext */}
              <div className="flex items-center gap-1.5 pt-0.5 text-xs sm:text-[13px] text-muted-foreground">
                <span className={cn("size-1.5 rounded-full shrink-0", card.dotColor)} />
                <span className="truncate">
                  {card.subtext}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Items List Queue (min-h-[64px] p-3.5 with accessible buttons) */}
      {activeItems.length > 0 && (
        <div className="space-y-2.5 pt-1" data-slot="action-items-queue">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs sm:text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
              {activeFilter === "ALL"
                ? "Nhiệm vụ trọng tâm cần chỉ đạo trực tiếp"
                : `Hàng đợi: ${
                    activeFilter === "PENDING_APPROVAL"
                      ? "Hồ sơ chờ phê duyệt"
                      : activeFilter === "BLOCKED_OVERDUE"
                        ? "Vướng mắc & Quá hạn cần đôn đốc"
                        : "Nhiệm vụ chiến lược năm học"
                  }`}
            </span>
            <span className="text-xs font-mono text-muted-foreground tabular-nums">
              {activeItems.length} nhiệm vụ
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {activeItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3.5 min-h-[64px] transition-all hover:bg-muted/20"
                data-slot="action-item-card"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-foreground leading-snug truncate">
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-xs sm:text-[13px] text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground/80">{item.department}</span>
                    <span>·</span>
                    <span>Chủ trì: {item.assignee}</span>
                    <span>·</span>
                    <span className="font-mono tabular-nums">Hạn: {item.dueDate}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant={item.filterType === "BLOCKED_OVERDUE" ? "destructive" : "default"}
                    className="h-8.5 sm:h-9 px-3 text-xs font-semibold rounded-lg shadow-2xs gap-1.5"
                    onClick={() => onAction?.(item)}
                  >
                    <span>{item.actionLabel || "Xử lý ngay"}</span>
                    <ArrowRight className="size-3.5" strokeWidth={1.5} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ExecutiveActionCenter;
