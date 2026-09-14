"use client";

import * as React from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SchoolTask } from "@/types/dashboard";
import type { AcademicMonthInfo } from "@/lib/academic-calendar";
import {
  useOptionalDashboardData,
  useOptionalDashboardActions,
  DashboardNavContext,
  DashboardModalContext,
} from "@/components/dashboard/dashboard-context";

export interface PriorOverdueBacklogBannerProps {
  tasks?: SchoolTask[];
  selectedMonth?: number | "ALL";
  monthPeriod?: AcademicMonthInfo | null;
  onSelectTask?: (task: SchoolTask) => void;
  onViewBacklog?: () => void;
  className?: string;
}

export function PriorOverdueBacklogBanner({
  tasks: propTasks,
  selectedMonth: propSelectedMonth,
  monthPeriod: propMonthPeriod,
  onSelectTask,
  onViewBacklog,
  className,
}: PriorOverdueBacklogBannerProps) {
  const dataContext = useOptionalDashboardData();
  const actionsContext = useOptionalDashboardActions();
  const navContext = React.useContext(DashboardNavContext);
  const modalContext = React.useContext(DashboardModalContext);

  const [isExpanded, setIsExpanded] = React.useState(false);

  const tasks = propTasks ?? dataContext?.priorOverdueBacklog ?? [];
  const selectedMonth = propSelectedMonth ?? dataContext?.selectedAcademicMonth ?? "ALL";
  const monthPeriod = propMonthPeriod ?? dataContext?.selectedMonthPeriod ?? null;

  // Render guard: only show when scoped to a specific month and backlog exists
  if (selectedMonth === "ALL" || tasks.length === 0) {
    return null;
  }

  const handleTaskClick = (task: SchoolTask) => {
    if (onSelectTask) {
      onSelectTask(task);
      return;
    }
    if (modalContext?.openTaskDetail) {
      modalContext.openTaskDetail(task);
    }
  };

  const handleViewAndResolve = () => {
    if (onViewBacklog) {
      onViewBacklog();
      return;
    }
    if (actionsContext?.setActiveWorkbox) {
      actionsContext.setActiveWorkbox("URGENT_OVERDUE");
    }
    if (navContext?.handleZoneChange) {
      navContext.handleZoneChange("tasks");
    }
  };

  const count = tasks.length;
  const monthLabel = monthPeriod?.label || `Tháng ${selectedMonth}`;

  return (
    <div
      data-slot="prior-overdue-backlog-banner"
      role="region"
      aria-label="Cảnh báo nhiệm vụ tồn đọng kỳ trước"
      className={cn(
        "rounded-2xl border border-amber-300/90 bg-amber-50/70 p-4 shadow-xs transition-all",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="rounded-xl p-2 bg-amber-100/90 text-amber-800 shrink-0 border border-amber-200">
            <AlertTriangle className="size-4 sm:size-5" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-amber-950">
                Có {count} nhiệm vụ tồn đọng/trễ hạn từ các kỳ trước cần xử lý
              </span>
              <Badge variant="rose" className="font-mono text-xs px-2 py-0.5 font-bold">
                {count} Quá hạn chuyển tiếp
              </Badge>
            </div>
            <p className="text-xs text-amber-900/80">
              Các nhiệm vụ này phát sinh từ các kỳ trước nhưng chưa hoàn thành khi bước vào{" "}
              <span className="font-semibold text-amber-950">{monthLabel}</span>. Cần chỉ đạo giải quyết dứt điểm để không ảnh hưởng đến KPI.
            </p>
          </div>
        </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-semibold text-amber-900 hover:text-amber-950 hover:bg-amber-100/60 active:bg-amber-200/60 gap-1.5 h-8 px-3 rounded-xl transition-colors"
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? "Ẩn danh sách" : "Xem danh sách"}</span>
            {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleViewAndResolve}
            className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 active:scale-[0.97] text-white text-xs font-semibold gap-1.5 h-8 px-3 rounded-xl shadow-xs transition-all"
          >
            <Clock className="size-3.5" strokeWidth={1.5} />
            <span>Xem & xử lý</span>
            <ArrowRight className="size-3.5" strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3.5 pt-3.5 border-t border-amber-200/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-amber-900/90">
            <span>Danh sách chi tiết nhiệm vụ chuyển tiếp ({count}):</span>
            <span className="text-xs text-amber-800/70">Bấm vào nhiệm vụ để xem chi tiết</span>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => handleTaskClick(task)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleTaskClick(task);
                  }
                }}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/95 border border-amber-200/70 hover:border-amber-400 hover:bg-white hover:shadow-xs transition-all cursor-pointer group text-left"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground group-hover:text-amber-900 line-clamp-1">
                      {task.title}
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium bg-secondary text-secondary-foreground border border-border">
                      {task.department}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>Hạn chót: {task.dueDate || "Chưa xác định"}</span>
                    <span className="text-rose-600 font-semibold font-mono text-xs">
                      Quá hạn
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1 text-xs text-amber-700 font-medium group-hover:text-amber-900">
                  <span className="hidden sm:inline">Chi tiết</span>
                  <ExternalLink className="size-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
