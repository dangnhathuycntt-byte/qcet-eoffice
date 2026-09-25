"use client";

import * as React from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

export interface TooltipProviderProps {
  children: React.ReactNode;
  delay?: number;
  closeDelay?: number;
  timeout?: number;
}

export function TooltipProvider({
  children,
  delay = 100,
  closeDelay = 0,
  timeout = 400,
}: TooltipProviderProps) {
  return (
    <BaseTooltip.Provider delay={delay} closeDelay={closeDelay} timeout={timeout}>
      {children}
    </BaseTooltip.Provider>
  );
}

export function Tooltip({
  children,
  open,
  onOpenChange,
  delayDuration,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  delayDuration?: number;
}) {
  const handleChange = React.useCallback(
    (nextOpen: boolean) => {
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  const root = (
    <BaseTooltip.Root open={open} onOpenChange={handleChange}>
      {children}
    </BaseTooltip.Root>
  );

  if (delayDuration !== undefined) {
    return <BaseTooltip.Provider delay={delayDuration}>{root}</BaseTooltip.Provider>;
  }

  return root;
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
      <BaseTooltip.Positioner side={SIDE_MAP[side]} sideOffset={sideOffset} className="z-[9999]">
        <BaseTooltip.Popup
          ref={ref}
          className={cn(
            "z-[9999] overflow-hidden rounded-md bg-zinc-600/90 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg whitespace-nowrap pointer-events-none",
            "origin-[var(--transform-origin)] transition-[opacity,scale] duration-100 ease-out",
            "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
            "data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
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
