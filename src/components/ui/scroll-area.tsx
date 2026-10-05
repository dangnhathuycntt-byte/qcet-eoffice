"use client";

import * as React from "react";
import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";
import { cn } from "@/lib/utils";

export interface ScrollAreaProps extends React.ComponentPropsWithoutRef<typeof BaseScrollArea.Root> {
  orientation?: "vertical" | "horizontal" | "both";
  viewportClassName?: string;
}

/**
 * Vùng cuộn tùy chỉnh đa nền tảng, dựng trên `@base-ui/react/scroll-area`.
 * Thanh cuộn tự động ẩn khi không di chuột, xuất hiện êm ái khi cuộn.
 */
export function ScrollArea({
  children,
  className,
  viewportClassName,
  orientation = "vertical",
  ...props
}: ScrollAreaProps) {
  const showVertical = orientation === "vertical" || orientation === "both";
  const showHorizontal = orientation === "horizontal" || orientation === "both";

  return (
    <BaseScrollArea.Root className={cn("relative overflow-hidden", className)} {...props}>
      <BaseScrollArea.Viewport className={cn("size-full rounded-[inherit]", viewportClassName)}>
        <BaseScrollArea.Content>{children}</BaseScrollArea.Content>
      </BaseScrollArea.Viewport>
      {showVertical ? (
        <BaseScrollArea.Scrollbar
          orientation="vertical"
          className="flex w-2.5 touch-none select-none p-0.5 transition-opacity duration-150 data-[hovering]:opacity-100 data-[scrolling]:opacity-100 opacity-0"
        >
          <BaseScrollArea.Thumb className="relative flex-1 rounded-full bg-mark hover:bg-muted-foreground" />
        </BaseScrollArea.Scrollbar>
      ) : null}
      {showHorizontal ? (
        <BaseScrollArea.Scrollbar
          orientation="horizontal"
          className="flex h-2.5 touch-none select-none p-0.5 transition-opacity duration-150 data-[hovering]:opacity-100 data-[scrolling]:opacity-100 opacity-0"
        >
          <BaseScrollArea.Thumb className="relative flex-1 rounded-full bg-mark hover:bg-muted-foreground" />
        </BaseScrollArea.Scrollbar>
      ) : null}
      <BaseScrollArea.Corner />
    </BaseScrollArea.Root>
  );
}
