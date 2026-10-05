import * as React from "react";
import { cn } from "@/lib/utils";

export type PriorityLevel = "LOW" | "NORMAL" | "MEDIUM" | "HIGH" | "URGENT" | "low" | "normal" | "medium" | "high" | "urgent" | (string & {});

export interface PriorityIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  priority: PriorityLevel;
  showLabel?: boolean;
}

/**
 * Chỉ báo mức độ ưu tiên 4 vạch chuẩn QCET.
 * Thay thế badge màu sặc sỡ bằng chỉ báo 4 vạch trực quan:
 * - LOW: 1 vạch
 * - MEDIUM/NORMAL: 2 vạch
 * - HIGH: 3 vạch
 * - URGENT: 4 vạch đỏ #B91C1C
 */
export function PriorityIndicator({
  priority,
  showLabel = false,
  className,
  ...props
}: PriorityIndicatorProps) {
  const norm = priority.toUpperCase();
  const isUrgent = norm === "URGENT";

  const activeBars =
    norm === "LOW" ? 1 : norm === "MEDIUM" || norm === "NORMAL" ? 2 : norm === "HIGH" ? 3 : 4;

  const label =
    norm === "LOW"
      ? "Thấp"
      : norm === "MEDIUM" || norm === "NORMAL"
        ? "Trung bình"
        : norm === "HIGH"
          ? "Cao"
          : "Khẩn cấp";

  const heights = ["h-1.5", "h-2.5", "h-3.5", "h-4"];

  return (
    <div
      role="status"
      aria-label={`Mức ưu tiên: ${label}`}
      className={cn("inline-flex items-center gap-1.5 select-none", className)}
      {...props}
    >
      <div className="flex items-end gap-0.5 h-4" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => {
          const isActive = i < activeBars;
          return (
            <span
              key={i}
              className={cn(
                "w-1 rounded-xs transition-colors duration-100",
                heights[i],
                isActive
                  ? isUrgent
                    ? "bg-destructive"
                    : "bg-foreground"
                  : "bg-mark"
              )}
            />
          );
        })}
      </div>
      {showLabel ? (
        <span
          className={cn(
            "text-xs font-medium tabular-nums",
            isUrgent ? "text-destructive font-semibold" : "text-foreground"
          )}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
