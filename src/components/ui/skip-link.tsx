"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { focusRingClass } from "@/components/ui/focus-ring";

export interface SkipLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  targetId?: string;
  children?: React.ReactNode;
}

/**
 * Liên kết truy cập nhanh bàn phím (Skip link) bỏ qua điều hướng tới nội dung chính.
 * Chuẩn QCET & WAI-ARIA: Artboard Components5 & Access (Ẩn mặc định, hiện nổi bật khi Tab vào).
 */
export function SkipLink({
  targetId = "main-content",
  children = "Bỏ qua tới nội dung chính",
  className,
  ...props
}: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        "sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50",
        "inline-flex h-9 items-center justify-center rounded-xl bg-foreground px-4 text-xs sm:text-sm font-medium text-background",
        `shadow-dialog border-0 outline-none ${focusRingClass} transition-colors duration-100 cursor-pointer`,
        className
      )}
      {...props}
    >
      {children}
    </a>
  );
}
