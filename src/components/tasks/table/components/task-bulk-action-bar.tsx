"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock,
  Send,
  FileSpreadsheet,
  X,
  ChevronDown,
  Calendar,
  Trash2,
  UserCheck,
} from "lucide-react";
import type { TaskStatus } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSystemReferenceDate } from "../utils/table-date-helpers";

/**
 * Tính ngày gia hạn hạn chót an toàn theo chuẩn UTC
 */
export function calculateExtendedDeadline(
  daysToAdd: number,
  baseDate: Date | string = getSystemReferenceDate()
): string {
  const d =
    typeof baseDate === "string" ? new Date(baseDate) : new Date(baseDate);
  d.setUTCDate(d.getUTCDate() + daysToAdd);
  return d.toISOString().slice(0, 10);
}

/**
 * Tạo payload cập nhật trạng thái hàng loạt
 */
export function getBatchStatusUpdatePayload(
  taskIds: string[],
  newStatus: TaskStatus
): { taskIds: string[]; status: TaskStatus } {
  return {
    taskIds,
    status: newStatus,
  };
}

/**
 * Tạo payload gia hạn hạn chót hàng loạt
 */
export function getBatchDeadlinePayload(
  taskIds: string[],
  newDueDate: string
): { taskIds: string[]; dueDate: string } {
  return {
    taskIds,
    dueDate: newDueDate,
  };
}

export interface TaskBulkActionBarProps {
  selectedCount: number;
  selectedIds: string[];
  totalCount?: number;
  onClearSelection: () => void;
  onBulkStatusChange?: (status: TaskStatus) => Promise<void> | void;
  onBulkExtendDeadline?: (newDueDate: string) => Promise<void> | void;
  onBulkReassign?: (newAssigneeId: string) => Promise<void> | void;
  onBulkDelete?: (taskIds: string[]) => Promise<void> | void;
  onExportExcel?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function TaskBulkActionBar({
  selectedCount,
  selectedIds,
  totalCount,
  onClearSelection,
  onBulkStatusChange,
  onBulkExtendDeadline,
  onBulkReassign,
  onBulkDelete,
  onExportExcel,
  isLoading = false,
  className,
}: TaskBulkActionBarProps) {
  // Lắng nghe phím Escape để hủy chọn toàn bộ
  React.useEffect(() => {
    if (selectedCount <= 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCount, onClearSelection]);

  if (selectedCount <= 0) {
    return null;
  }

  return (
    <aside
      role="region"
      aria-label="Thao tác hàng loạt"
      aria-live="polite"
      className={cn(
        "fixed bottom-6 inset-x-0 mx-auto w-fit z-40 max-w-[95vw] sm:max-w-max",
        "animate-in fade-in slide-in-from-bottom-4 duration-200",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 rounded-2xl border border-border/90 bg-card/95 backdrop-blur-md px-3.5 py-2 shadow-xl text-foreground">
        {/* Bộ đếm số lượng mục đã chọn */}
        <div className="flex items-center gap-2 pr-2.5 border-r border-border/80">
          <span className="inline-flex items-center justify-center size-5.5 rounded-full bg-primary text-primary-foreground text-xs font-mono font-bold">
            {selectedCount}
          </span>
          <span className="text-xs font-medium text-foreground whitespace-nowrap">
            Đã chọn{" "}
            <strong className="font-semibold font-mono tabular-nums">
              {selectedCount}
            </strong>
            {totalCount ? `/${totalCount}` : ""} công việc
          </span>
        </div>

        {/* Nút hành động nhanh: Đánh dấu Hoàn thành */}
        {onBulkStatusChange && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onBulkStatusChange("COMPLETED")}
            disabled={isLoading}
            className="h-8.5 px-2.5 text-xs font-medium border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 gap-1.5 cursor-pointer"
            title="Đánh dấu hoàn thành tất cả công việc đã chọn"
          >
            <CheckCircle2
              className="size-3.5 text-emerald-600"
              strokeWidth={1.5}
            />
            <span className="hidden sm:inline">Hoàn thành</span>
          </Button>
        )}

        {/* Dropdown cập nhật trạng thái khác */}
        {onBulkStatusChange && (
          <div className="relative inline-flex items-center">
            <select
              aria-label="Đổi trạng thái hàng loạt"
              defaultValue=""
              onChange={(e) => {
                const val = e.target.value as TaskStatus;
                if (val) {
                  onBulkStatusChange(val);
                  e.target.value = "";
                }
              }}
              disabled={isLoading}
              className="h-8.5 pl-3 pr-7 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors cursor-pointer appearance-none"
            >
              <option value="" disabled>
                Đổi trạng thái...
              </option>
              <option value="IN_PROGRESS">Đang thực hiện</option>
              <option value="WAITING_APPROVAL">Chờ phê duyệt</option>
              <option value="NEEDS_REVIEW">Cần chỉnh sửa</option>
              <option value="CANCELLED">Hủy nhiệm vụ</option>
            </select>
            <ChevronDown
              className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
              strokeWidth={1.5}
            />
          </div>
        )}

        {/* Dropdown gia hạn hạn chót */}
        {onBulkExtendDeadline && (
          <div className="relative inline-flex items-center">
            <Calendar
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
              strokeWidth={1.5}
            />
            <select
              aria-label="Gia hạn thời hạn hàng loạt"
              defaultValue=""
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  const days = parseInt(val, 10);
                  if (!isNaN(days)) {
                    const newDate = calculateExtendedDeadline(days);
                    onBulkExtendDeadline(newDate);
                  }
                  e.target.value = "";
                }
              }}
              disabled={isLoading}
              className="h-8.5 pl-8 pr-7 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors cursor-pointer appearance-none"
            >
              <option value="" disabled>
                Gia hạn hạn chót...
              </option>
              <option value="3">+3 ngày</option>
              <option value="7">+7 ngày (1 tuần)</option>
              <option value="14">+14 ngày (2 tuần)</option>
              <option value="30">+30 ngày (1 tháng)</option>
            </select>
            <ChevronDown
              className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
              strokeWidth={1.5}
            />
          </div>
        )}

        {/* Nút Xuất Excel các mục đã chọn */}
        {onExportExcel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExportExcel}
            disabled={isLoading}
            className="h-8.5 px-2.5 text-xs font-medium border-border hover:bg-muted/80 text-foreground gap-1.5 cursor-pointer"
            aria-label="Xuất file Excel các công việc đã chọn"
          >
            <FileSpreadsheet
              className="size-3.5 text-emerald-600"
              strokeWidth={1.5}
            />
            <span className="hidden sm:inline">Xuất Excel</span>
          </Button>
        )}

        {/* Nút Xóa hàng loạt (nếu có handler) */}
        {onBulkDelete && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onBulkDelete(selectedIds)}
            disabled={isLoading}
            className="h-8.5 px-2.5 text-xs font-medium gap-1.5 cursor-pointer"
            aria-label="Xóa các công việc đã chọn"
          >
            <Trash2 className="size-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Xóa</span>
          </Button>
        )}

        {/* Nút Bỏ chọn tất cả (Escape) */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          disabled={isLoading}
          className="h-8.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 gap-1 cursor-pointer"
          aria-label="Bỏ chọn tất cả công việc"
          title="Bỏ chọn (Esc)"
        >
          <X className="size-3.5" strokeWidth={1.5} />
          <span className="hidden sm:inline">Bỏ chọn</span>
          <kbd className="hidden md:inline-flex rounded border border-border bg-muted/60 px-1 font-mono text-xs text-muted-foreground">
            Esc
          </kbd>
        </Button>
      </div>
    </aside>
  );
}
