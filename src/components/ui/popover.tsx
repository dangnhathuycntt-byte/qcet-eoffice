"use client";

import * as React from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

export const Popover = BasePopover;

export interface StandardPopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  sideOffset?: number;
}

/**
 * Standard Popover wrapper over `@base-ui/react/popover`.
 * Provides accessible floating positioning, click-outside and ESC dismiss.
 */
export function StandardPopover({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  children,
  className,
  sideOffset = 6,
}: StandardPopoverProps) {
  return (
    <BasePopover.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      <BasePopover.Trigger render={React.isValidElement(trigger) ? trigger : <span>{trigger}</span>} />
      <BasePopover.Portal>
        <BasePopover.Positioner sideOffset={sideOffset}>
          <BasePopover.Popup
            className={cn(
              "z-50 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none",
              "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95",
              className
            )}
          >
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
