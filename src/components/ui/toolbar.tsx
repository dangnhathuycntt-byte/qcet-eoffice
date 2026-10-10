"use client";

import * as React from "react";
import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import { cn } from "@/lib/utils";
import { focusRingClass } from "@/components/ui/focus-ring";

/** Thanh công cụ: mũi tên trái/phải di chuyển giữa các điều khiển (roving focus). Chỉ đặt tối đa một ô nhập và để ở cuối. */
export function Toolbar({ className, ...props }: React.ComponentPropsWithoutRef<typeof BaseToolbar.Root>) {
  return (
    <BaseToolbar.Root
      className={cn("flex min-h-11 flex-wrap items-center gap-1.5 sm:min-h-10", className)}
      {...props}
    />
  );
}

export function ToolbarGroup({ className, ...props }: React.ComponentPropsWithoutRef<typeof BaseToolbar.Group>) {
  return <BaseToolbar.Group className={cn("flex items-center gap-1", className)} {...props} />;
}

export function ToolbarSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof BaseToolbar.Separator>) {
  return <BaseToolbar.Separator className={cn("mx-1 h-5 w-px bg-border", className)} {...props} />;
}

export function ToolbarButton({ className, ...props }: React.ComponentPropsWithoutRef<typeof BaseToolbar.Button>) {
  return (
    <BaseToolbar.Button
      className={cn(
        `inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground outline-none transition-colors duration-100 hover:bg-accent hover:text-foreground ${focusRingClass} data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 [&_svg]:size-4 motion-reduce:transition-none`,
        className,
      )}
      {...props}
    />
  );
}
