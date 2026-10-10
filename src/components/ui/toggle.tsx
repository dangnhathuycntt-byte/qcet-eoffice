"use client";

import * as React from "react";
import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const toggleVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border-0 text-xs sm:text-sm font-medium transition-colors duration-100 outline-none select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 motion-reduce:transition-none",
  {
    variants: {
      variant: {
        default:
          "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground data-[pressed]:bg-selected data-[pressed]:text-foreground data-[pressed]:font-semibold",
        outline:
          "bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground data-[pressed]:bg-selected data-[pressed]:text-foreground data-[pressed]:font-semibold",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        default: "h-[34px] px-3.5",
        lg: "h-10 px-4 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ToggleProps
  extends React.ComponentPropsWithoutRef<typeof BaseToggle>,
    VariantProps<typeof toggleVariants> {}

/**
 * Nút bật/tắt trạng thái độc lập (Toggle Button) chuẩn QCET.
 * Sử dụng phân tầng nền phẳng `bg-secondary` và `bg-selected`, không viền trang trí.
 */
export function Toggle({ className, variant, size, ...props }: ToggleProps) {
  return (
    <BaseToggle
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}
