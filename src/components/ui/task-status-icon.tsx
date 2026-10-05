import * as React from "react";
import { cn } from "@/lib/utils";

export type TaskStatusKey =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "WAITING_APPROVAL"
  | "NEEDS_REVIEW"
  | "COMPLETED"
  | "CANCELLED"
  | "not_started"
  | "in_progress"
  | "waiting_approval"
  | "needs_review"
  | "completed"
  | "cancelled"
  | (string & {});

export interface TaskStatusIconProps extends React.SVGAttributes<SVGSVGElement> {
  status: TaskStatusKey;
  size?: number | string;
}

/**
 * Biểu tượng trạng thái nhiệm vụ chuẩn hình học QCET (16x16px).
 * Thay thế badge màu sặc sỡ bằng hình học sắc nét theo chuẩn thiết kế hành chính tối giản.
 */
export function TaskStatusIcon({
  status,
  size = 16,
  className,
  ...props
}: TaskStatusIconProps) {
  const normalized = status.toUpperCase().replace(/\s+/g, "_");

  switch (normalized) {
    case "IN_PROGRESS":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Đang thực hiện"
          className={cn("shrink-0 text-primary", className)}
          {...props}
        >
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 1.75 A6.25 6.25 0 0 1 8 14.25 Z" fill="currentColor" />
        </svg>
      );

    case "WAITING_APPROVAL":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Chờ duyệt"
          className={cn("shrink-0 text-foreground", className)}
          {...props}
        >
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
          <polyline
            points="8 4.5 8 8 10.5 9.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "NEEDS_REVIEW":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Cần chỉnh sửa"
          className={cn("shrink-0 text-foreground", className)}
          {...props}
        >
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="2.25" fill="currentColor" />
        </svg>
      );

    case "COMPLETED":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Đã hoàn thành"
          className={cn("shrink-0 text-foreground", className)}
          {...props}
        >
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path
            d="M5 8.25 L7 10.25 L11 5.75"
            stroke="var(--card, #fff)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "CANCELLED":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Đã hủy"
          className={cn("shrink-0 text-muted-foreground", className)}
          {...props}
        >
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
          <line
            x1="5.5"
            y1="5.5"
            x2="10.5"
            y2="10.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="10.5"
            y1="5.5"
            x2="5.5"
            y2="10.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );

    case "NOT_STARTED":
    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Chưa bắt đầu"
          className={cn("shrink-0 text-muted-foreground", className)}
          {...props}
        >
          <circle
            cx="8"
            cy="8"
            r="6.25"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="2.5 2.5"
          />
        </svg>
      );
  }
}
