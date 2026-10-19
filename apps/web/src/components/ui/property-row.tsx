import * as React from "react";
import { cn } from "@/lib/utils";

export interface PropertyRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Label displayed on the left side */
  label: string;
  /** Optional icon rendered before the label */
  icon?: React.ReactNode;
  /** Ghi đè nhãn, ví dụ độ rộng cột nhãn cố định trong khối thông tin chỉ đọc. */
  labelClassName?: string;
  /** compact: nhãn cao 20px + đệm 8px = hàng 28px, giá trị dài tự xuống dòng. Mặc định giữ nguyên (nhiệm vụ). */
  density?: "default" | "compact";
  /** Ghi đè vùng giá trị, ví dụ `justify-start` cho văn bản dài canh trái. */
  valueClassName?: string;
}

/**
 * Consistent property row layout for sidebars and detail panels.
 *
 * Replaces 7+ copy-paste className patterns in task-properties-sidebar.tsx
 * with a single cva-driven component.
 */
export function PropertyRow({
  label,
  icon,
  labelClassName,
  valueClassName,
  density = "default",
  children,
  className,
  ...props
}: PropertyRowProps) {
  return (
    <div className={cn("group/row -mx-1.5 flex min-h-[28px] select-none items-start justify-between gap-2 rounded-md px-1.5 py-1 transition-colors", className)} {...props}>
      <span className={cn("flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 min-w-[80px]", density === "compact" ? "h-5" : "h-7", labelClassName)}>
        {icon}
        {label}
      </span>
      <div className={cn("flex-1 min-w-0 flex items-center justify-end", density === "compact" && "min-h-5", valueClassName)}>
        {children}
      </div>
    </div>
  );
}
