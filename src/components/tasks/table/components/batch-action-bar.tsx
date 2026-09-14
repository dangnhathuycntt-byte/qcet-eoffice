"use client";

import * as React from "react";
import {
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  FileSpreadsheet,
  Trash2,
  UserCheck,
  X,
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

/**
 * Tạo payload phân công lại người thực hiện hàng loạt
 */
export function getBatchReassignPayload(
  taskIds: string[],
  newAssigneeId: string
): { taskIds: string[]; assigneeId: string } {
  return {
    taskIds,
    assigneeId: newAssigneeId,
  };
}

export interface BatchActionBarProps {
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
  /**
   * Lifecycle targets valid for the ENTIRE selection, computed by the caller
   * from the canonical bulk gate (src/domain/tasks/bulk-lifecycle-capability.ts).
   *
   * P0-07 / R-T07-bulk: the bar must expose only capabilities valid for every
   * selected task. When this is omitted no capability information is available,
   * so the bar FAILS SAFE and withholds every approval-bearing action rather
   * than offering an authority-laundering bulk approval.
   */
  allowedLifecycleTargets?: TaskStatus[];
}

/**
 * Targets that change who holds lifecycle authority. Mirrors
 * APPROVAL_TARGETS in src/domain/tasks/bulk-lifecycle-capability.ts; kept in
 * sync there so the bar cannot offer an approval the domain gate would refuse.
 */
const APPROVAL_BEARING_TARGETS: ReadonlySet<TaskStatus> = new Set<TaskStatus>([
  "COMPLETED",
  "WAITING_APPROVAL",
  "NEEDS_REVIEW",
  "PENDING_EXECUTIVE_APPROVAL",
]);

/** Lifecycle targets the status dropdown may offer, in display order. */
const BULK_STATUS_OPTIONS: ReadonlyArray<{ value: TaskStatus; label: string }> = [
  { value: "IN_PROGRESS", label: "Đang thực hiện" },
  { value: "WAITING_APPROVAL", label: "Chờ phê duyệt" },
  { value: "NEEDS_REVIEW", label: "Cần chỉnh sửa" },
  { value: "COMPLETED", label: "Hoàn thành" },
  { value: "CANCELLED", label: "Hủy nhiệm vụ" },
];

export type TaskBulkActionBarProps = BatchActionBarProps;

export function BatchActionBar({
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
  allowedLifecycleTargets,
}: BatchActionBarProps) {
  /**
   * P0-07: only offer a transition the WHOLE selection permits. With no
   * capability information supplied, fail safe — withhold approval-bearing
   * targets rather than expose an authority-laundering bulk approval.
   */
  const isTargetAllowed = React.useCallback(
    (target: TaskStatus): boolean =>
      allowedLifecycleTargets
        ? allowedLifecycleTargets.includes(target)
        : !APPROVAL_BEARING_TARGETS.has(target),
    [allowedLifecycleTargets]
  );

  const permittedStatusOptions = BULK_STATUS_OPTIONS.filter((option) =>
    isTargetAllowed(option.value)
  );
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
        "hidden sm:block fixed bottom-6 inset-x-0 mx-auto w-fit z-40 max-w-[95vw] sm:max-w-max",
        "animate-in fade-in slide-in-from-bottom-4 duration-200",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md px-3.5 py-2 shadow-xl text-foreground">
        {/* Bộ đếm số lượng mục đã chọn */}
        <div className="flex items-center gap-2 pr-2.5 border-r border-border">
          <CheckSquare className="size-4 text-primary shrink-0" strokeWidth={1.5} />
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Đã chọn{" "}
            <strong className="font-semibold font-mono tabular-nums text-foreground">
              {selectedCount}
            </strong>
            {totalCount ? `/${totalCount}` : ""} nhiệm vụ được chọn
          </span>
        </div>

        {/* Nút hành động nhanh: Đánh dấu Hoàn thành (P0-07: chỉ khi cả lựa chọn đủ quyền) */}
        {onBulkStatusChange && isTargetAllowed("COMPLETED") && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onBulkStatusChange("COMPLETED")}
            disabled={isLoading}
            className="h-8.5 px-2.5 text-xs font-medium border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 gap-1.5 cursor-pointer shadow-2xs"
            title="Đánh dấu hoàn thành tất cả công việc đã chọn"
          >
            <CheckCircle2
              className="size-3.5 text-emerald-600"
              strokeWidth={1.5}
            />
            <span className="hidden sm:inline">Hoàn thành</span>
          </Button>
        )}

        {/* [Đổi trạng thái]: chỉ hiện các trạng thái hợp lệ cho TOÀN BỘ lựa chọn (P0-07) */}
        {onBulkStatusChange && permittedStatusOptions.length > 0 && (
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
              className="h-8.5 pl-3 pr-7 rounded-lg border border-border bg-background text-xs font-medium text-foreground hover:bg-muted/60 focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors cursor-pointer appearance-none shadow-2xs"
            >
              <option value="" disabled>
                Đổi trạng thái...
              </option>
              {permittedStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
              strokeWidth={1.5}
            />
          </div>
        )}

        {/* [Giao lại]: Nút Phân công lại hàng loạt */}
        {onBulkReassign && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onBulkReassign("")}
            disabled={isLoading}
            className="h-8.5 px-2.5 text-xs font-medium border-border bg-background hover:bg-muted/60 text-foreground gap-1.5 cursor-pointer shadow-2xs"
            aria-label="Phân công lại các công việc đã chọn"
            title="Giao lại nhiệm vụ"
          >
            <UserCheck className="size-3.5 text-primary" strokeWidth={1.5} />
            <span className="hidden sm:inline">Giao lại</span>
            <span className="sr-only">Phân công lại</span>
          </Button>
        )}

        {/* [Gia hạn]: Dropdown gia hạn hạn chót */}
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
              className="h-8.5 pl-8 pr-7 rounded-lg border border-border bg-background text-xs font-medium text-foreground hover:bg-muted/60 focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors cursor-pointer appearance-none shadow-2xs"
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

        {/* [Xuất]: Nút Xuất Excel các mục đã chọn */}
        {onExportExcel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExportExcel}
            disabled={isLoading}
            className="h-8.5 px-2.5 text-xs font-medium border-border bg-background hover:bg-muted/60 text-foreground gap-1.5 cursor-pointer shadow-2xs"
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
            className="h-8.5 px-2.5 text-xs font-medium gap-1.5 cursor-pointer shadow-2xs"
            aria-label="Xóa các công việc đã chọn"
          >
            <Trash2 className="size-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Xóa</span>
          </Button>
        )}

        {/* [Esc Bỏ chọn]: Nút Bỏ chọn tất cả (Escape) */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          disabled={isLoading}
          className="h-8.5 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 gap-1.5 cursor-pointer"
          aria-label="Bỏ chọn tất cả công việc"
          title="Bỏ chọn (Esc)"
        >
          <X className="size-3.5" strokeWidth={1.5} />
          <span className="hidden sm:inline">Bỏ chọn</span>
          <kbd className="inline-flex items-center rounded border border-border bg-muted px-1 font-mono text-xs text-muted-foreground">
            Esc
          </kbd>
        </Button>
      </div>
    </aside>
  );
}

export const TaskBulkActionBar = BatchActionBar;
