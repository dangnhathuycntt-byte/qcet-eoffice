"use client";

import * as React from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { Kbd } from "@/components/ui/kbd";
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

/**
 * Nội dung tooltip, kiểu Linear (người dùng gửi ảnh tooltip "Create new issue  C" của Linear 20/10/2026, thay kiểu viên đen):
 * thẻ nền sáng `bg-popover` bo 8px (`rounded-sm`), viền và bóng mảnh của `shadow-menu`, chữ `text-xs` đậm vừa; phím tắt (`shortcut`) nằm sau nhãn
 * trong ô `Kbd` viền mảnh. Truyền một phím ("E") hoặc nhiều phím (["⌘", "B"]).
 */
export const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
    /** Căn theo nút: `start` giữ tooltip trong phía nút đứng, không tràn sang vùng bên cạnh (thanh điều hướng). */
    align?: "start" | "center" | "end";
    hidden?: boolean;
    /** Phím tắt hiện sau nhãn, mỗi phím một ô. */
    shortcut?: string | readonly string[];
  }
>(({ className, side = "right", sideOffset = 8, align = "center", hidden = false, shortcut, children, ...props }, ref) => {
  if (hidden) return null;
  const keys = shortcut === undefined ? [] : typeof shortcut === "string" ? [shortcut] : shortcut;
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner side={SIDE_MAP[side]} sideOffset={sideOffset} align={align} className="z-60">
        <BaseTooltip.Popup
          ref={ref}
          className={cn(
            "z-60 flex items-center gap-2 overflow-hidden rounded-sm bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-menu whitespace-nowrap pointer-events-none motion-reduce:transition-none",
            "transition-opacity duration-100 ease-out",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {keys.length > 0 ? <span className="min-w-0">{children}</span> : children}
          {keys.length > 0 ? (
            <span className="flex shrink-0 items-center gap-0.5">
              {keys.map((key) => (
                <Kbd key={key} className="bg-background font-medium">
                  {key}
                </Kbd>
              ))}
            </span>
          ) : null}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  );
});
TooltipContent.displayName = "TooltipContent";
