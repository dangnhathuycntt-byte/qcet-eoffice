"use client";

import * as React from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <BaseTooltip.Provider delay={300}>{children}</BaseTooltip.Provider>;
}

export function Tooltip({
  children,
  open,
  onOpenChange,
  delayDuration: _delay,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  delayDuration?: number;
}) {
  const handleChange = React.useCallback(
    (nextOpen: boolean) => { onOpenChange?.(nextOpen); },
    [onOpenChange],
  );
  return (
    <BaseTooltip.Root open={open} onOpenChange={handleChange}>
      {children}
    </BaseTooltip.Root>
  );
}

export const TooltipTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { asChild?: boolean }
>(({ children, asChild, ...props }, ref) => {
  if (asChild && React.isValidElement(children)) {
    return <BaseTooltip.Trigger ref={ref as any} render={children as any} {...props} />;
  }
  return <BaseTooltip.Trigger ref={ref as any} {...props}>{children}</BaseTooltip.Trigger>;
});
TooltipTrigger.displayName = "TooltipTrigger";

const SIDE_MAP = { top: "top", bottom: "bottom", left: "left", right: "right" } as const;

export const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
    hidden?: boolean;
  }
>(({ className, side = "right", sideOffset = 8, hidden = false, children, ...props }, ref) => {
  if (hidden) return null;
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner side={SIDE_MAP[side]} sideOffset={sideOffset}>
        <BaseTooltip.Popup
          ref={ref}
          className={cn(
            "z-50 overflow-hidden rounded-md bg-[#1c1c1e] px-2.5 py-1.5 text-xs font-medium text-white shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in-0 zoom-in-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
            className,
          )}
          {...props}
        >
          {children}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  );
});
TooltipContent.displayName = "TooltipContent";
