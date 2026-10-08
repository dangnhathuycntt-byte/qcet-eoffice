import * as React from "react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/dashboard";
import {
  TaskIconStatusNew,
  TaskIconStatusInProgress,
  TaskIconStatusReview,
  TaskIconStatusDone,
  TaskIconStatusCancelled,
} from "@/lib/icons/task-icons";

/**
 * Chỉ báo trạng thái dùng bộ icon chuẩn của dự án (nét 1.5, bo tròn, chỉ viền).
 * Hình dạng khác nhau theo bậc, không phụ thuộc màu:
 * - NOT_STARTED / NEW: vòng tròn nét đứt (xám)
 * - IN_PROGRESS / DOING: vòng tròn có nửa trong (hổ phách)
 * - WAITING_APPROVAL: vòng tròn có vòng nhỏ ở tâm (xanh da trời)
 * - NEEDS_REVIEW: vòng tròn có vòng nhỏ ở tâm (hổ phách đậm)
 * - COMPLETED / DONE: vòng tròn có dấu tick (xanh lá)
 * - CANCELLED: vòng tròn có dấu X (xám nhạt)
 */
export function TaskStatusCircle({
  status,
  className,
}: {
  status?: TaskStatus | string;
  className?: string;
}) {
  const s = (status || "NOT_STARTED").toUpperCase();

  if (s === "COMPLETED" || s === "DONE") {
    return <TaskIconStatusDone className={cn("size-4 shrink-0 text-emerald-500", className)} />;
  }
  if (s === "IN_PROGRESS" || s === "DOING") {
    return <TaskIconStatusInProgress className={cn("size-4 shrink-0 text-amber-500", className)} />;
  }
  if (s === "WAITING_APPROVAL" || s === "PENDING_EXECUTIVE_APPROVAL") {
    return <TaskIconStatusReview className={cn("size-4 shrink-0 text-sky-500", className)} />;
  }
  if (s === "NEEDS_REVIEW") {
    return <TaskIconStatusReview className={cn("size-4 shrink-0 text-amber-600", className)} />;
  }
  if (s === "CANCELLED" || s === "CANCELED") {
    return <TaskIconStatusCancelled className={cn("size-4 shrink-0 text-muted-foreground/40", className)} />;
  }
  return <TaskIconStatusNew className={cn("size-4 shrink-0 text-muted-foreground/50", className)} />;
}
