"use client";

import * as React from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InlineExplanationProps {
  /** The clickable text trigger (e.g. "Vì sao trễ?", "Chi tiết hạn") */
  triggerText: string;
  /** Explanation content shown inside the popover */
  children?: React.ReactNode;
  title?: string;
  showIcon?: boolean;
  className?: string;
}

/**
 * Inline explanation component matching Components4.dc.html:
 * "Chữ có gạch chấm mở giải thích ngắn khi bấm."
 */
export function InlineExplanation({
  triggerText,
  children,
  title,
  showIcon = false,
  className,
}: InlineExplanationProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <BasePopover.Root open={open} onOpenChange={setOpen}>
      <BasePopover.Trigger
        type="button"
        className={cn(
          "inline-flex items-center gap-1 border-b border-dotted border-muted-foreground/60 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none",
          className,
        )}
      >
        {showIcon && <HelpCircle className="size-3 shrink-0" strokeWidth={1.5} />}
        <span>{triggerText}</span>
      </BasePopover.Trigger>

      <BasePopover.Portal>
        <BasePopover.Positioner side="top" align="center" sideOffset={6} className="z-50">
          <BasePopover.Popup
            className={cn(
              "w-72 rounded-xl border border-border/70 bg-popover p-3 text-xs text-popover-foreground shadow-md outline-none",
              "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95",
            )}
          >
            {title && (
              <div className="font-medium text-foreground pb-1 mb-1 border-b border-border/40">
                {title}
              </div>
            )}
            <div className="text-muted-foreground leading-relaxed">
              {children}
            </div>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
