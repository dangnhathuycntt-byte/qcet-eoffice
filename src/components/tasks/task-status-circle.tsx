import * as React from "react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/dashboard";

/**
 * Geometric status indicator circle matching design artifact qcet-nhiem-vu.html:
 * - new / not_started: dashed circle
 * - in_progress / doing: circle with right half filled (crescent)
 * - waiting_approval: circle with clock hands
 * - needs_review: circle with review dot
 * - completed / done: solid circle with white checkmark
 * - cancelled: circle with X
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
    return (
      <svg
        className={cn("size-4 shrink-0 text-foreground/85", className)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="8" fill="currentColor" />
        <path
          d="M8.5 12.3l2.5 2.5 4.5-5"
          stroke="#fff"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (s === "IN_PROGRESS" || s === "DOING") {
    return (
      <svg
        className={cn("size-4 shrink-0 text-foreground/80", className)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
      </svg>
    );
  }

  if (s === "WAITING_APPROVAL" || s === "PENDING_EXECUTIVE_APPROVAL") {
    return (
      <svg
        className={cn("size-4 shrink-0 text-foreground/75", className)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (s === "NEEDS_REVIEW") {
    return (
      <svg
        className={cn("size-4 shrink-0 text-amber-600", className)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    );
  }

  if (s === "CANCELLED" || s === "CANCELED") {
    return (
      <svg
        className={cn("size-4 shrink-0 text-muted-foreground/50", className)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M9 9l6 6M15 9l-6 6" strokeLinecap="round" />
      </svg>
    );
  }

  // NEW / NOT_STARTED
  return (
    <svg
      className={cn("size-4 shrink-0 text-muted-foreground/60", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="8" strokeDasharray="3.5 3.5" />
    </svg>
  );
}
