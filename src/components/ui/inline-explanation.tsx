"use client";

import * as React from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRingClass } from "@/components/ui/focus-ring";

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
          `inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 text-xs text-muted-foreground transition-colors hover:text-foreground outline-none ${focusRingClass} cursor-pointer select-none`,
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
              "w-72 rounded-2xl border-0 bg-popover p-3 text-xs text-popover-foreground shadow-menu outline-none",
            )}
          >
            {title && (
              <div className="font-semibold text-foreground pb-1 mb-1 border-0">
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
