"use client";

import * as React from "react";
import { ChevronUp } from "lucide-react";
import {
  MenuRoot,
  MenuTrigger,
  MenuPortal,
  MenuPositioner,
  MenuPopup,
  MenuItem,
} from "@/components/ui/menu";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import {
  TaskIconChecklist,
  TaskIconComplete,
  TaskIconStatus,
  TaskIconDeadline,
  TaskIconAssignee,
  TaskIconExport,
  TaskIconTrash,
  TaskIconClose,
} from "@/lib/icons/task-icons";
import type { TaskStatus } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { getSystemReferenceDate } from "../utils/table-date-helpers";
import { CORE_STATUS_OPTIONS, STATUS_DISPLAY_CONFIG } from "@/domain/tasks/display-config";

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
const BULK_STATUS_OPTIONS: ReadonlyArray<{ value: TaskStatus; label: string }> =
  STATUS_DISPLAY_CONFIG.filter((c) =>
    (['IN_PROGRESS', 'WAITING_APPROVAL', 'NEEDS_REVIEW', 'COMPLETED', 'CANCELLED'] as string[]).includes(c.value),
  );

/** Các mức gia hạn hạn chót hàng loạt. */
export const BULK_DEADLINE_OPTIONS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 3, label: "+3 ngày" },
  { days: 7, label: "+7 ngày (1 tuần)" },
  { days: 14, label: "+14 ngày (2 tuần)" },
  { days: 30, label: "+30 ngày (1 tháng)" },
];

/**
 * P0-07: chỉ trả về các trạng thái mà TOÀN BỘ lựa chọn được phép chuyển tới.
 * Không có thông tin quyền thì chặn an toàn mọi trạng thái cần duyệt.
 */
export function getPermittedBulkStatusOptions(
  allowedLifecycleTargets?: TaskStatus[]
): ReadonlyArray<{ value: TaskStatus; label: string }> {
  return BULK_STATUS_OPTIONS.filter((option) =>
    allowedLifecycleTargets
      ? allowedLifecycleTargets.includes(option.value)
      : !APPROVAL_BEARING_TARGETS.has(option.value)
  );
}

/** 2026-10-08 → 08/10 */
function formatShortIso(iso: string): string {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

export type TaskBulkActionBarProps = BatchActionBarProps;

function BulkMenu({
  ariaLabel,
  icon,
  label,
  header,
  disabled,
  triggerClassName,
  onDigit,
  children,
}: {
  ariaLabel: string;
  icon: React.ReactNode;
  label: string;
  header: string;
  disabled?: boolean;
  triggerClassName: string;
  /** Phím số 1-9 chọn nhanh mục tương ứng; trả về true nếu đã xử lý. */
  onDigit?: (digit: number) => boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <MenuRoot open={open} onOpenChange={setOpen}>
      <MenuTrigger
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(triggerClassName, "data-[popup-open]:bg-muted")}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
        <ChevronUp className="size-3 text-muted-foreground shrink-0" strokeWidth={1.5} />
      </MenuTrigger>
      <MenuPortal>
        <MenuPositioner side="top" align="start" sideOffset={8} className="z-50">
          <MenuPopup
            className="min-w-48 rounded-lg border border-border bg-popover p-1 text-xs text-popover-foreground shadow-lg outline-none animate-in fade-in-0 zoom-in-95 duration-100"
            onKeyDown={(e) => {
              if (onDigit && /^[1-9]$/.test(e.key) && onDigit(Number(e.key))) {
                e.preventDefault();
                setOpen(false);
              }
            }}
          >
            <div className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground select-none">{header}</div>
            {children}
          </MenuPopup>
        </MenuPositioner>
      </MenuPortal>
    </MenuRoot>
  );
}

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

  const permittedStatusOptions = getPermittedBulkStatusOptions(allowedLifecycleTargets);

  const hasAnyAction = Boolean(
    (onBulkStatusChange && (isTargetAllowed("COMPLETED") || permittedStatusOptions.length > 0)) ||
    onBulkReassign ||
    onBulkExtendDeadline ||
    onExportExcel ||
    onBulkDelete
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

  if (selectedCount <= 0 || !hasAnyAction) {
    return null;
  }

  const btn =
    "h-7 px-2.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted active:bg-muted/70 inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
  const icon = "size-4 text-muted-foreground shrink-0";
  const divider = <div className="h-4 w-px bg-border mx-1 shrink-0" aria-hidden="true" />;

  const menuItemCls =
    "flex h-7 w-full items-center justify-between gap-6 rounded-md px-2 text-xs text-foreground cursor-pointer select-none outline-none transition-colors data-[highlighted]:bg-accent hover:bg-accent";

  return (
    <aside
      role="region"
      aria-label="Thao tác hàng loạt"
      aria-live="polite"
      aria-busy={isLoading}
      className={cn(
        "hidden sm:block fixed bottom-6 inset-x-0 mx-auto w-fit z-40 max-w-[95vw] sm:max-w-max",
        "animate-in fade-in slide-in-from-bottom-3 duration-200",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-card px-2 py-1.5 shadow-lg text-foreground">
        {/* Bộ đếm số lượng mục đã chọn */}
        <div className="flex items-center gap-2 pl-1.5 pr-2 text-xs font-medium text-foreground whitespace-nowrap">
          <TaskIconChecklist className="size-4 text-primary shrink-0" />
          <span>
            Đã chọn{" "}
            <strong className="font-semibold tabular-nums text-foreground">{selectedCount}</strong>
            {totalCount ? (
              <span className="text-muted-foreground font-normal">/{totalCount}</span>
            ) : (
              ""
            )}
            <span className="sr-only">nhiệm vụ được chọn</span>
          </span>
        </div>

        {divider}

        {/* Hoàn thành nhanh (P0-07: chỉ khi cả lựa chọn đủ quyền) */}
        {onBulkStatusChange && isTargetAllowed("COMPLETED") && (
          <button
            type="button"
            onClick={() => onBulkStatusChange("COMPLETED")}
            disabled={isLoading}
            className={btn}
            title="Đánh dấu hoàn thành tất cả công việc đã chọn"
          >
            <TaskIconComplete className={icon} />
            <span className="hidden sm:inline">Hoàn thành</span>
          </button>
        )}

        {/* Đổi trạng thái: chỉ các trạng thái hợp lệ cho TOÀN BỘ lựa chọn (P0-07) */}
        {onBulkStatusChange && permittedStatusOptions.length > 0 && (
          <BulkMenu
            ariaLabel="Đổi trạng thái hàng loạt"
            icon={<TaskIconStatus className={icon} />}
            label="Đổi trạng thái"
            header="Đổi trạng thái cho các mục đã chọn"
            disabled={isLoading}
            triggerClassName={btn}
            onDigit={(digit) => {
              const option = permittedStatusOptions[digit - 1];
              if (!option) return false;
              onBulkStatusChange(option.value);
              return true;
            }}
          >
            {permittedStatusOptions.map((option, index) => (
              <MenuItem
                key={option.value}
                className={menuItemCls}
                onClick={() => onBulkStatusChange(option.value)}
              >
                <span className="flex items-center gap-2">
                  <TaskStatusCircle status={option.value} />
                  <span>{option.label}</span>
                </span>
                <kbd className="font-sans text-xs tabular-nums text-muted-foreground">{index + 1}</kbd>
              </MenuItem>
            ))}
          </BulkMenu>
        )}

        {/* Giao lại */}
        {onBulkReassign && (
          <button
            type="button"
            onClick={() => onBulkReassign("")}
            disabled={isLoading}
            className={btn}
            aria-label="Phân công lại các công việc đã chọn"
            title="Giao lại nhiệm vụ"
          >
            <TaskIconAssignee className={icon} />
            <span className="hidden sm:inline">Giao lại</span>
            <span className="sr-only">Phân công lại</span>
          </button>
        )}

        {/* Gia hạn: hiển thị luôn ngày hạn mới để biết trước kết quả */}
        {onBulkExtendDeadline && (
          <BulkMenu
            ariaLabel="Gia hạn thời hạn hàng loạt"
            icon={<TaskIconDeadline className={icon} />}
            label="Gia hạn"
            header="Gia hạn hạn chót thêm…"
            disabled={isLoading}
            triggerClassName={btn}
            onDigit={(digit) => {
              const option = BULK_DEADLINE_OPTIONS[digit - 1];
              if (!option) return false;
              onBulkExtendDeadline(calculateExtendedDeadline(option.days));
              return true;
            }}
          >
            {BULK_DEADLINE_OPTIONS.map((option) => {
              const newDate = calculateExtendedDeadline(option.days);
              return (
                <MenuItem
                  key={option.days}
                  className={menuItemCls}
                  onClick={() => onBulkExtendDeadline(newDate)}
                >
                  <span>{option.label}</span>
                  <span className="flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
                    {formatShortIso(newDate)}
                    <kbd className="font-sans">{BULK_DEADLINE_OPTIONS.indexOf(option) + 1}</kbd>
                  </span>
                </MenuItem>
              );
            })}
          </BulkMenu>
        )}

        {/* Xuất */}
        {onExportExcel && (
          <>
            {divider}
            <button
              type="button"
              onClick={onExportExcel}
              disabled={isLoading}
              className={btn}
              aria-label="Xuất file Excel các công việc đã chọn"
            >
              <TaskIconExport className={icon} />
              <span className="hidden sm:inline">Xuất Excel</span>
            </button>
          </>
        )}

        {/* Xóa: tách riêng bằng đường phân cách, màu cảnh báo */}
        {onBulkDelete && (
          <>
            {divider}
            <button
              type="button"
              onClick={() => onBulkDelete(selectedIds)}
              disabled={isLoading}
              className="h-7 px-2.5 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 active:bg-destructive/20 inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
              aria-label="Xóa các công việc đã chọn"
            >
              <TaskIconTrash className="size-4 shrink-0" />
              <span className="hidden sm:inline">Xóa</span>
            </button>
          </>
        )}

        {divider}

        {/* Bỏ chọn (Esc) */}
        <button
          type="button"
          onClick={onClearSelection}
          disabled={isLoading}
          className="h-7 pl-2 pr-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted/70 inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Bỏ chọn tất cả công việc"
          title="Bỏ chọn (Esc)"
        >
          <TaskIconClose className="size-4 shrink-0" />
          <span className="hidden sm:inline">Bỏ chọn</span>
          <kbd className="inline-flex items-center rounded border border-border bg-muted px-1 py-0.5 font-sans text-xs text-muted-foreground leading-none">
            Esc
          </kbd>
        </button>
      </div>
    </aside>
  );
}

export const TaskBulkActionBar = BatchActionBar;
