"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  startOpenTimer: () => void;
  clearOpenTimer: () => void;
  closeImmediately: () => void;
}

const TooltipContext = React.createContext<TooltipContextType | undefined>(undefined);

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Tooltip({
  children,
  open: controlledOpen,
  onOpenChange,
  delayDuration = 300,
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

  const clearOpenTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startOpenTimer = React.useCallback(() => {
    clearOpenTimer();
    timerRef.current = setTimeout(() => {
      setOpen(true);
    }, delayDuration);
  }, [clearOpenTimer, delayDuration, setOpen]);

  const closeImmediately = React.useCallback(() => {
    clearOpenTimer();
    setOpen(false);
  }, [clearOpenTimer, setOpen]);

  React.useEffect(() => {
    return () => {
      clearOpenTimer();
    };
  }, [clearOpenTimer]);

  return (
    <TooltipContext.Provider
      value={{
        open,
        setOpen,
        startOpenTimer,
        clearOpenTimer,
        closeImmediately,
      }}
    >
      <div className="relative inline-flex items-center justify-center">{children}</div>
    </TooltipContext.Provider>
  );
}

export const TooltipTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { asChild?: boolean }
>(({ children, className, asChild, ...props }, ref) => {
  const context = React.useContext(TooltipContext);
  const isPointerDownRef = React.useRef(false);

  const handleMouseEnter = () => {
    context?.startOpenTimer();
  };

  const handleMouseLeave = () => {
    context?.closeImmediately();
  };

  const handlePointerDown = () => {
    isPointerDownRef.current = true;
    context?.closeImmediately();
  };

  const handleClick = () => {
    context?.closeImmediately();
  };

  const handleFocus = (e: React.FocusEvent) => {
    // If focus arrived via mouse/touch click, don't show tooltip
    if (isPointerDownRef.current) {
      isPointerDownRef.current = false;
      return;
    }
    // Only open on keyboard navigation focus
    try {
      if (e.target.matches(":focus-visible")) {
        context?.startOpenTimer();
      }
    } catch {
      context?.startOpenTimer();
    }
  };

  const handleBlur = () => {
    isPointerDownRef.current = false;
    context?.closeImmediately();
  };

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
      onPointerDown: (e: React.PointerEvent) => {
        handlePointerDown();
        (children.props as any).onPointerDown?.(e);
      },
      onClick: (e: React.MouseEvent) => {
        handleClick();
        (children.props as any).onClick?.(e);
      },
      onFocus: (e: React.FocusEvent) => {
        handleFocus(e);
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
      onPointerDown={handlePointerDown}
      onClick={handleClick}
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
    hidden?: boolean;
  }
>(({ className, side = "right", sideOffset = 8, hidden = false, children, ...props }, ref) => {
  const context = React.useContext(TooltipContext);
  if (!context?.open || hidden) return null;

  const sideClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-3",
  }[side];

  return (
    <div
      ref={ref}
      role="tooltip"
      className={cn(
        "absolute z-50 overflow-hidden rounded-md border border-border/80 bg-popover/95 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md transition-all whitespace-nowrap pointer-events-none animate-in fade-in-0 zoom-in-95",
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
