"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const TooltipContext = React.createContext<TooltipContextType | undefined>(undefined);

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Tooltip({
  children,
  open: controlledOpen,
  onOpenChange,
  delayDuration = 150,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  delayDuration?: number;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (value: React.SetStateAction<boolean>) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (!isControlled) {
        setUncontrolledOpen(value);
      }
      if (onOpenChange) {
        const nextValue = typeof value === "function" ? value(open) : value;
        onOpenChange(nextValue);
      }
    },
    [isControlled, onOpenChange, open]
  );

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-flex items-center justify-center">{children}</div>
    </TooltipContext.Provider>
  );
}

export const TooltipTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { asChild?: boolean }
>(({ children, className, asChild, ...props }, ref) => {
  const context = React.useContext(TooltipContext);

  const handleMouseEnter = () => context?.setOpen(true);
  const handleMouseLeave = () => context?.setOpen(false);
  const handleFocus = () => context?.setOpen(true);
  const handleBlur = () => context?.setOpen(false);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref,
      onMouseEnter: (e: React.MouseEvent) => {
        handleMouseEnter();
        (children.props as any).onMouseEnter?.(e);
      },
      onMouseLeave: (e: React.MouseEvent) => {
        handleMouseLeave();
        (children.props as any).onMouseLeave?.(e);
      },
      onFocus: (e: React.FocusEvent) => {
        handleFocus();
        (children.props as any).onFocus?.(e);
      },
      onBlur: (e: React.FocusEvent) => {
        handleBlur();
        (children.props as any).onBlur?.(e);
      },
      ...props,
    });
  }

  return (
    <span
      ref={ref as any}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    >
      {children}
    </span>
  );
});
TooltipTrigger.displayName = "TooltipTrigger";

export const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
  }
>(({ className, side = "right", sideOffset = 8, children, ...props }, ref) => {
  const context = React.useContext(TooltipContext);
  if (!context?.open) return null;

  const sideClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2.5",
  }[side];

  return (
    <div
      ref={ref}
      role="tooltip"
      className={cn(
        "absolute z-50 overflow-hidden rounded-md border border-border/80 bg-popover/95 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md transition-all whitespace-nowrap pointer-events-none",
        sideClasses,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
TooltipContent.displayName = "TooltipContent";
