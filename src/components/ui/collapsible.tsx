"use client";

import * as React from "react";
import { Collapsible as BaseCollapsible } from "@base-ui/react/collapsible";
import { cn } from "@/lib/utils";

export const Collapsible = BaseCollapsible;

export interface StandardCollapsibleProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  panelClassName?: string;
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
  panelClassName,
}: StandardCollapsibleProps) {
  return (
    <BaseCollapsible.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      className={cn("w-full", className)}
    >
      <BaseCollapsible.Trigger render={React.isValidElement(trigger) ? trigger : <span>{trigger}</span>} />
      <BaseCollapsible.Panel
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out data-[state=closed]:grid-rows-[0fr] data-[state=open]:grid-rows-[1fr]",
          panelClassName
        )}
      >
        <div className="overflow-hidden">{children}</div>
      </BaseCollapsible.Panel>
    </BaseCollapsible.Root>
  );
}
