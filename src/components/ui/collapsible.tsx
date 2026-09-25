"use client";

import * as React from "react";
import { Collapsible as BaseCollapsible } from "@base-ui/react/collapsible";
import { cn } from "@/lib/utils";

// Namespace re-export
export const Collapsible = BaseCollapsible;
export const CollapsibleRoot = BaseCollapsible.Root;
export const CollapsibleTrigger = BaseCollapsible.Trigger;

export interface CollapsiblePanelProps
  extends React.ComponentPropsWithoutRef<typeof BaseCollapsible.Panel> {
  /** Optional class name for the inner overflow-hidden wrapper */
  innerClassName?: string;
}

/**
 * CollapsiblePanel with smooth CSS Grid height animation (0fr -> 1fr)
 * conforming to ui-polish rule #8 (dynamic real height expansion).
 */
export const CollapsiblePanel = React.forwardRef<
  HTMLDivElement,
  CollapsiblePanelProps
>(({ className, innerClassName, children, ...props }, ref) => {
  return (
    <BaseCollapsible.Panel
      ref={ref}
      className={cn(
        "grid motion-safe:transition-[grid-template-rows] duration-200 ease-out",
        "data-[state=closed]:grid-rows-[0fr] data-[state=open]:grid-rows-[1fr]",
        "data-closed:grid-rows-[0fr] data-open:grid-rows-[1fr]",
        "data-[starting-style]:grid-rows-[0fr] data-[ending-style]:grid-rows-[0fr]",
        className
      )}
      {...props}
    >
      <div className={cn("overflow-hidden min-h-0", innerClassName)}>
        {children}
      </div>
    </BaseCollapsible.Panel>
  );
});

CollapsiblePanel.displayName = "CollapsiblePanel";

export interface StandardCollapsibleProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
  innerClassName?: string;
  disabled?: boolean;
}

/**
 * Standard Collapsible wrapper over `@base-ui/react/collapsible`.
 * Implements smooth height animation via CSS Grid rows (0fr -> 1fr) per ui-polish rules.
 */
export function StandardCollapsible({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  children,
  className,
  triggerClassName,
  panelClassName,
  innerClassName,
  disabled,
}: StandardCollapsibleProps) {
  return (
    <BaseCollapsible.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      disabled={disabled}
      className={cn("w-full", className)}
    >
      <BaseCollapsible.Trigger
        className={triggerClassName}
        render={React.isValidElement(trigger) ? trigger : <span>{trigger}</span>}
      />
      <CollapsiblePanel className={panelClassName} innerClassName={innerClassName}>
        {children}
      </CollapsiblePanel>
    </BaseCollapsible.Root>
  );
}
