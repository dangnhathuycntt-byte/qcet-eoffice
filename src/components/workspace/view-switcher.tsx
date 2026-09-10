"use client";

import * as React from "react";
import {
  Table,
  Kanban,
  Calendar,
  List,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TaskViewMode = "table" | "kanban";
export type CalendarViewMode = "month" | "list" | "agenda";
export type ViewVariant = "tasks" | "calendar" | "calendar-agenda" | "custom";

export interface ViewOption<T extends string = string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  ariaLabel?: string;
}

export const TASK_VIEW_OPTIONS: ViewOption<TaskViewMode>[] = [
  {
    id: "table",
    label: "Bảng",
    icon: Table,
    ariaLabel: "Chế độ xem bảng chi tiết",
  },
  {
    id: "kanban",
    label: "Kanban",
    icon: Kanban,
    ariaLabel: "Chế độ xem bảng Kanban",
  },
];

export const CALENDAR_VIEW_OPTIONS: ViewOption<CalendarViewMode>[] = [
  {
    id: "month",
    label: "Lịch tháng",
    icon: Calendar,
    ariaLabel: "Chế độ xem lịch tháng",
  },
  {
    id: "list",
    label: "Danh sách",
    icon: List,
    ariaLabel: "Chế độ xem danh sách sự kiện",
  },
];

export const CALENDAR_AGENDA_VIEW_OPTIONS: ViewOption<CalendarViewMode>[] = [
  {
    id: "month",
    label: "Lịch tháng",
    icon: Calendar,
    ariaLabel: "Chế độ xem lịch tháng",
  },
  {
    id: "agenda",
    label: "Nghị sự",
    icon: List,
    ariaLabel: "Chế độ xem nghị sự",
  },
];

export interface ViewSwitcherProps<T extends string = string> {
  mode?: T;
  onModeChange?: (mode: T) => void;
  activeView?: T;
  onViewChange?: (view: T) => void;
  variant?: ViewVariant;
  options?: ViewOption<T>[];
  className?: string;
  size?: "default" | "sm" | "lg";
  label?: string;
  role?: "radiogroup" | "tablist";
}

/**
 * ViewSwitcher - Canonical view mode switcher.
 * Provides [Bảng, Kanban] for tasks and [Lịch tháng, Nghị sự / Danh sách] for calendar.
 * Supports dual-prop contracts: activeView/onViewChange and mode/onModeChange.
 * Supports role="radiogroup" (default) or role="tablist" per Carbon Design System.
 * WCAG 2.2 AA compliant with Arrow key navigation, 44px+ touch targets on mobile, senior ergonomics.
 * Strictly Light-Only with zero dark: classes and zero emojis.
 */
export function ViewSwitcher<T extends string = string>({
  mode,
  onModeChange,
  activeView,
  onViewChange,
  variant = "tasks",
  options,
  className,
  size = "default",
  label = "Chế độ hiển thị",
  role = "radiogroup",
}: ViewSwitcherProps<T>) {
  const tabsRef = React.useRef<(HTMLButtonElement | null)[]>([]);

  const currentView = (activeView ?? mode) as T;

  const handleSelectView = React.useCallback(
    (newView: T) => {
      onViewChange?.(newView);
      onModeChange?.(newView);
    },
    [onViewChange, onModeChange]
  );

  const resolvedOptions: ViewOption<T>[] = React.useMemo(() => {
    if (options && options.length > 0) return options;
    if (variant === "calendar") {
      if ((currentView as string) === "agenda") {
        return CALENDAR_AGENDA_VIEW_OPTIONS as unknown as ViewOption<T>[];
      }
      return CALENDAR_VIEW_OPTIONS as unknown as ViewOption<T>[];
    }
    if (variant === "calendar-agenda") {
      return CALENDAR_AGENDA_VIEW_OPTIONS as unknown as ViewOption<T>[];
    }
    return TASK_VIEW_OPTIONS as unknown as ViewOption<T>[];
  }, [options, variant, currentView]);

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    if (resolvedOptions.length === 0) return;

    let nextIndex = currentIndex;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % resolvedOptions.length;
      tabsRef.current[nextIndex]?.focus();
      handleSelectView(resolvedOptions[nextIndex].id);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex =
        (currentIndex - 1 + resolvedOptions.length) % resolvedOptions.length;
      tabsRef.current[nextIndex]?.focus();
      handleSelectView(resolvedOptions[nextIndex].id);
    } else if (e.key === "Home") {
      e.preventDefault();
      tabsRef.current[0]?.focus();
      handleSelectView(resolvedOptions[0].id);
    } else if (e.key === "End") {
      e.preventDefault();
      const last = resolvedOptions.length - 1;
      tabsRef.current[last]?.focus();
      handleSelectView(resolvedOptions[last].id);
    }
  };

  const sizeClasses = {
    sm: "min-h-[40px] px-2.5 py-1 text-xs gap-1.5",
    default: "min-h-[44px] px-3.5 py-1.5 text-sm gap-2",
    lg: "min-h-[48px] px-4 py-2 text-base gap-2.5",
  };

  const isRadio = role === "radiogroup";

  return (
    <div
      role={role}
      aria-label={label}
      className={cn(
        "inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 shadow-xs",
        className
      )}
    >
      {resolvedOptions.map((opt, idx) => {
        const isActive = currentView === opt.id;
        const IconComponent = opt.icon;

        return (
          <button
            key={opt.id}
            ref={(el) => {
              tabsRef.current[idx] = el;
            }}
            type="button"
            role={isRadio ? "radio" : "tab"}
            {...(isRadio
              ? { "aria-checked": isActive }
              : { "aria-selected": isActive })}
            aria-label={opt.ariaLabel || opt.label}
            tabIndex={isActive ? 0 : -1}
            onClick={() => handleSelectView(opt.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "group relative inline-flex items-center justify-center font-medium rounded-lg transition-all select-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1",
              sizeClasses[size],
              isActive
                ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            )}
          >
            {IconComponent && (
              <IconComponent
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  isActive
                    ? "text-blue-600"
                    : "text-slate-500 group-hover:text-slate-700"
                )}
                strokeWidth={isActive ? 2 : 1.75}
                aria-hidden="true"
              />
            )}
            <span className="whitespace-nowrap">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
