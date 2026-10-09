import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const propertyRowVariants = cva(
  "group/row flex items-start justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-md transition-colors select-none min-h-[28px]",
  {
    variants: {
      interactive: {
        true: "",
        false: "",
      },
    },
    defaultVariants: { interactive: false },
  },
);

export interface PropertyRowProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof propertyRowVariants> {
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
  interactive,
  children,
  className,
  ...props
}: PropertyRowProps) {
  return (
    <div className={cn(propertyRowVariants({ interactive }), className)} {...props}>
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

export { propertyRowVariants };
