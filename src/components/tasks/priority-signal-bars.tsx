import * as React from "react";
import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/types/dashboard";

export interface PrioritySignalBarsProps {
  priority?: TaskPriority | string;
  className?: string;
  showLabel?: boolean;
}

/**
 * Priority 3-bar signal indicator matching design artifact qcet-nhiem-vu.html:
 * - Urgent: 3 red bars
 * - High: 3 dark bars
 * - Normal: 2 dark bars, 1 faint bar
 * - Low: 1 dark bar, 2 faint bars
 */
export function PrioritySignalBars({
  priority = "NORMAL",
  className,
  showLabel = false,
}: PrioritySignalBarsProps) {
  const p = (priority || "NORMAL").toUpperCase();
  const isUrgent = p === "URGENT";
  const isHigh = p === "HIGH";
  const isNormal = p === "NORMAL";
  const isLow = p === "LOW";

  const level = isLow ? 1 : isNormal ? 2 : 3;

  const label = isUrgent
    ? "Khẩn cấp"
    : isHigh
    ? "Cao"
    : isNormal
    ? "Bình thường"
    : "Thấp";

  return (
    <span
      className={cn(
        "inline-flex items-end gap-[2px] h-[13px] shrink-0 select-none",
        isUrgent ? "text-rose-600" : "text-foreground",
        className
      )}
      title={`Độ ưu tiên: ${label}`}
      role="img"
      aria-label={`Độ ưu tiên: ${label}`}
    >
      {[1, 2, 3].map((n) => {
        const isFilled = n <= level;
        return (
          <i
            key={n}
            className={cn(
              "block w-[3px] rounded-[1px] transition-colors",
              isUrgent && isFilled
                ? "bg-rose-600"
                : isFilled
                ? "bg-foreground/80"
                : "bg-muted-foreground/25"
            )}
            style={{ height: `${4 + n * 2.5}px` }}
          />
        );
      })}
      {showLabel && (
        <span
          className={cn(
            "text-[11px] font-medium ml-1",
            isUrgent ? "text-rose-600" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
