"use client";

import * as React from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

// Namespace re-export
export const Popover = BasePopover;

// Individual primitives re-export
export const PopoverRoot = BasePopover.Root;
export const PopoverTrigger = BasePopover.Trigger;
export const PopoverPortal = BasePopover.Portal;
export const PopoverPositioner = BasePopover.Positioner;
export const PopoverPopup = BasePopover.Popup;
export const PopoverArrow = BasePopover.Arrow;
export const PopoverBackdrop = BasePopover.Backdrop;
export const PopoverTitle = BasePopover.Title;
export const PopoverDescription = BasePopover.Description;
export const PopoverClose = BasePopover.Close;
export const PopoverViewport = BasePopover.Viewport;

export interface PopoverContentProps
  extends React.ComponentPropsWithoutRef<typeof BasePopover.Popup> {
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  alignOffset?: number;
  collisionPadding?: number;
  showBackdrop?: boolean;
  backdropClassName?: string;
  positionerClassName?: string;
  arrow?: boolean;
}

/**
 * Standard PopoverContent built over `@base-ui/react/popover`.
 * Features automatic Portal, Positioner with collision avoidance, optional backdrop blur,
 * and smooth scale/fade animations conforming to QCET UI polish tokens.
 */
export const PopoverContent = React.forwardRef<
  HTMLDivElement,
  PopoverContentProps
>(
  (
    {
      className,
      align = "center",
      side = "bottom",
      sideOffset = 6,
      alignOffset = 0,
      collisionPadding = 12,
      showBackdrop = false,
      backdropClassName,
      positionerClassName,
      arrow = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <BasePopover.Portal>
        {showBackdrop && (
          <BasePopover.Backdrop
            className={cn(
              "fixed inset-0 z-40 bg-black/15 backdrop-blur-xs transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
              backdropClassName
            )}
          />
        )}
        <BasePopover.Positioner
          side={side}
          align={align}
          sideOffset={sideOffset}
          alignOffset={alignOffset}
          collisionPadding={collisionPadding}
          className={cn("z-50 outline-none", positionerClassName)}
        >
          <BasePopover.Popup
            ref={ref}
            className={cn(
              "z-50 w-72 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg outline-none",
              "origin-[var(--transform-origin)] transition-[opacity,scale] duration-150 ease-out",
              "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
              "data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
              "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95",
              className
            )}
            {...props}
          >
            {children}
            {arrow && (
              <BasePopover.Arrow className="fill-popover stroke-border stroke-1" />
            )}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    );
  }
);

PopoverContent.displayName = "PopoverContent";

export interface StandardPopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  sideOffset?: number;
  alignOffset?: number;
  collisionPadding?: number;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  showBackdrop?: boolean;
  backdropClassName?: string;
  positionerClassName?: string;
  arrow?: boolean;
}

/**
 * Standard Popover wrapper over `@base-ui/react/popover`.
 * Provides accessible floating positioning, collision avoidance, click-outside and ESC dismiss.
 */
export function StandardPopover({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  children,
  className,
  sideOffset = 6,
  alignOffset = 0,
  collisionPadding = 12,
  align = "center",
  side = "bottom",
  showBackdrop = false,
  backdropClassName,
  positionerClassName,
  arrow = false,
}: StandardPopoverProps) {
  return (
    <BasePopover.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      <BasePopover.Trigger
        render={React.isValidElement(trigger) ? trigger : <span>{trigger}</span>}
      />
      <PopoverContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        showBackdrop={showBackdrop}
        backdropClassName={backdropClassName}
        positionerClassName={positionerClassName}
        arrow={arrow}
        className={className}
      >
        {children}
      </PopoverContent>
    </BasePopover.Root>
  );
}
