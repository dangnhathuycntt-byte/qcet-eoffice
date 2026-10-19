import * as React from "react";
import { cn } from "@/lib/utils";
import type { TaskPriority } from "@qcet/contracts/types/dashboard";
import {
  TaskIconPriorityUrgent,
  TaskIconPriorityHigh,
  TaskIconPriorityNormal,
  TaskIconPriorityLow,
  TaskIconPriorityNone,
} from "@qcet/shared/lib/icons/task-icons";

export interface PrioritySignalBarsProps {
  priority?: TaskPriority | string;
  className?: string;
  showLabel?: boolean;
  /** Ghi đè nhãn truy cập (title và aria-label); mặc định "Độ ưu tiên: …". */
  ariaLabel?: string;
}

/**
 * Chỉ báo mức độ ưu tiên dùng bộ icon chuẩn của dự án:
 * - Khẩn cấp: ô có dấu chấm than (đỏ)
 * - Cao: 3 cột sáng (đậm)
 * - Bình thường: 2 cột sáng, 1 cột mờ
 * - Thấp: 1 cột sáng, 2 cột mờ
 * - Không ưu tiên: ba gạch ngang
 */
export function PrioritySignalBars({
  priority = "NORMAL",
  className,
  showLabel = false,
  ariaLabel,
}: PrioritySignalBarsProps) {
  const p = (priority || "NORMAL").toUpperCase();
  const isUrgent = p === "URGENT";
  const isHigh = p === "HIGH";
  const isNormal = p === "NORMAL";
  const isNone = p === "NONE";

  const label = isUrgent
    ? "Khẩn cấp"
    : isHigh
    ? "Cao"
    : isNormal
    ? "Bình thường"
    : isNone
    ? "Không ưu tiên"
    : "Thấp";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 shrink-0 select-none",
        isUrgent ? "text-destructive" : isHigh ? "text-foreground/70" : "text-muted-foreground",
        className
      )}
      title={ariaLabel ?? `Độ ưu tiên: ${label}`}
      role="img"
      aria-label={ariaLabel ?? `Độ ưu tiên: ${label}`}
    >
      {isUrgent ? (
        <TaskIconPriorityUrgent className="size-4" />
      ) : isHigh ? (
        <TaskIconPriorityHigh className="size-4" />
      ) : isNormal ? (
        <TaskIconPriorityNormal className="size-4" />
      ) : isNone ? (
        <TaskIconPriorityNone className="size-4" />
      ) : (
        <TaskIconPriorityLow className="size-4" />
      )}
      {showLabel && (
        <span
          className={cn(
            "text-xs font-medium ml-1",
            isUrgent ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
