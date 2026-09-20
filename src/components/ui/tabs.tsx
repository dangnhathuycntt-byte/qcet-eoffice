"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import * as m from "motion/react-m";
import { cn } from "@/lib/utils";
import { motionTransition } from "@/lib/motion/tokens";

interface TabsContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  motionIndicator?: boolean;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

interface TabsListContextValue {
  variant?: "default" | "line";
  motionIndicator?: boolean;
  layoutId?: string;
}

const TabsListContext = React.createContext<TabsListContextValue>({});

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs component");
  }
  return context;
}

export interface TabsProps extends React.ComponentProps<"div"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  motionIndicator?: boolean;
}

function Tabs({
  className,
  value: controlledValue,
  defaultValue,
  onValueChange,
  orientation = "horizontal",
  motionIndicator = false,
  ...props
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? "");
  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : uncontrolledValue;

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [isControlled, onValueChange]
  );

  return (
    <TabsContext.Provider
      value={{
        value: activeValue,
        onValueChange: handleValueChange,
        orientation,
        motionIndicator,
      }}
    >
      <div
        data-slot="tabs"
        data-orientation={orientation}
        className={cn(
          "group/tabs flex gap-2",
          orientation === "horizontal" ? "flex-col" : "flex-row",
          className
        )}
        {...props}
      />
    </TabsContext.Provider>
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface TabsListProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof tabsListVariants> {
  motionIndicator?: boolean;
  layoutId?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
}

function TabsList({
  className,
  variant = "default",
  motionIndicator,
  layoutId,
  children,
  onKeyDown,
  ...props
}: TabsListProps) {
  const tabsContext = useTabsContext();
  const generatedId = React.useId();
  const effectiveMotionIndicator = motionIndicator ?? tabsContext.motionIndicator ?? false;
  const indicatorLayoutId = layoutId || `tabs-indicator-${generatedId}`;
  const listRef = React.useRef<HTMLDivElement>(null);

  // WAI-ARIA Tabs keyboard navigation: Arrow keys, Home, End
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e);
      const list = listRef.current;
      if (!list) return;
      const tabs = Array.from(
        list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
      );
      if (tabs.length === 0) return;
      const focused = document.activeElement as HTMLButtonElement;
      const idx = tabs.indexOf(focused);
      const isHorizontal = tabsContext.orientation !== "vertical";

      let next = -1;
      if (
        (isHorizontal && e.key === "ArrowRight") ||
        (!isHorizontal && e.key === "ArrowDown")
      ) {
        e.preventDefault();
        next = idx < 0 ? 0 : (idx + 1) % tabs.length;
      } else if (
        (isHorizontal && e.key === "ArrowLeft") ||
        (!isHorizontal && e.key === "ArrowUp")
      ) {
        e.preventDefault();
        next = idx < 0 ? tabs.length - 1 : (idx - 1 + tabs.length) % tabs.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        next = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        next = tabs.length - 1;
      }
      if (next >= 0) {
        tabs[next].focus();
        tabs[next].click();
      }
    },
    [onKeyDown, tabsContext.orientation]
  );

  return (
    <TabsListContext.Provider
      value={{
        variant: variant ?? "default",
        motionIndicator: effectiveMotionIndicator,
        layoutId: indicatorLayoutId,
      }}
    >
      <div
        ref={listRef}
        data-slot="tabs-list"
        data-variant={variant}
        data-motion-indicator={effectiveMotionIndicator ? "true" : undefined}
        role="tablist"
        aria-orientation={tabsContext.orientation ?? "horizontal"}
        onKeyDown={handleKeyDown}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      >
        {children}
      </div>
    </TabsListContext.Provider>
  );
}

export interface TabsTriggerProps extends React.ComponentProps<"button"> {
  value: string;
}

function TabsTrigger({
  className,
  value,
  onClick,
  disabled,
  children,
  ...props
}: TabsTriggerProps) {
  const { value: activeValue, onValueChange } = useTabsContext();
  const { motionIndicator, layoutId, variant } = React.useContext(TabsListContext);
  const isActive = activeValue === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      data-slot="tabs-trigger"
      data-state={isActive ? "active" : "inactive"}
      data-active={isActive ? "" : undefined}
      disabled={disabled}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && !disabled) {
          onValueChange?.(value);
        }
      }}
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer",
        motionIndicator
          ? "data-active:text-foreground"
          : "data-active:bg-background data-active:text-foreground",
        !motionIndicator &&
          "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    >
      {motionIndicator && isActive && (
        <m.div
          layoutId={layoutId}
          data-slot="tabs-indicator"
          transition={motionTransition.snappySpring}
          className={cn(
            "absolute pointer-events-none",
            variant === "line"
              ? "group-data-horizontal/tabs:bottom-[-5px] group-data-horizontal/tabs:inset-x-0 group-data-horizontal/tabs:h-0.5 group-data-vertical/tabs:inset-y-0 group-data-vertical/tabs:-right-1 group-data-vertical/tabs:w-0.5 bg-foreground"
              : "inset-0 rounded-md bg-background shadow-xs"
          )}
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-1.5">{children}</span>
    </button>
  );
}

export interface TabsContentProps extends React.ComponentProps<"div"> {
  value: string;
}

function TabsContent({
  className,
  value,
  children,
  ...props
}: TabsContentProps) {
  const { value: activeValue } = useTabsContext();
  const isActive = activeValue === value;

  if (!isActive) return null;

  return (
    <div
      data-slot="tabs-content"
      role="tabpanel"
      data-state={isActive ? "active" : "inactive"}
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
