"use client";

import * as React from "react";
import {
  Layers,
  Clock,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  CircleDashed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatusFilterOption {
  id: string;
  label: string;
  shortLabel?: string;
  count?: number;
  icon?: LucideIcon;
  badgeClass?: string;
}

export const DEFAULT_STATUS_OPTIONS: StatusFilterOption[] = [
  {
    id: "ALL",
    label: "Tất cả",
    shortLabel: "Tất cả",
    icon: Layers,
  },
  {
    id: "IN_PROGRESS",
    label: "Đang thực hiện",
    shortLabel: "Đang làm",
    icon: Clock,
  },
  {
    id: "NEEDS_REVIEW",
    label: "Chờ phê duyệt",
    shortLabel: "Chờ duyệt",
    icon: FileCheck,
  },
  {
    id: "COMPLETED",
    label: "Đã hoàn thành",
    shortLabel: "Hoàn thành",
    icon: CheckCircle2,
  },
  {
    id: "OVERDUE",
    label: "Quá hạn",
    shortLabel: "Quá hạn",
    icon: AlertCircle,
  },
];

export interface StatusFilterProps {
  activeStatus: string;
  onStatusChange: (status: string) => void;
  options?: StatusFilterOption[];
  counts?: Record<string, number>;
  showAllOption?: boolean;
  className?: string;
  size?: "default" | "sm" | "lg";
  label?: string;
  scrollable?: boolean;
}

/**
 * StatusFilter - Accessible status selector with high-contrast indicator,
 * 44px+ touch targets on mobile, senior ergonomics, and zero dark: classes.
 * Displays counts and semantic icons with zero emojis.
 */
export function StatusFilter({
  activeStatus,
  onStatusChange,
  options = DEFAULT_STATUS_OPTIONS,
  counts,
  showAllOption = true,
  className,
  size = "default",
  label = "Bộ lọc trạng thái",
  scrollable = true,
}: StatusFilterProps) {
  const tabsRef = React.useRef<(HTMLButtonElement | null)[]>([]);

  const resolvedOptions = React.useMemo(() => {
    if (showAllOption) return options;
    return options.filter((opt) => opt.id !== "ALL");
  }, [options, showAllOption]);

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    if (resolvedOptions.length === 0) return;

    let nextIndex = currentIndex;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % resolvedOptions.length;
      tabsRef.current[nextIndex]?.focus();
      onStatusChange(resolvedOptions[nextIndex].id);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + resolvedOptions.length) % resolvedOptions.length;
      tabsRef.current[nextIndex]?.focus();
      onStatusChange(resolvedOptions[nextIndex].id);
    } else if (e.key === "Home") {
      e.preventDefault();
      tabsRef.current[0]?.focus();
      onStatusChange(resolvedOptions[0].id);
    } else if (e.key === "End") {
      e.preventDefault();
      const last = resolvedOptions.length - 1;
      tabsRef.current[last]?.focus();
      onStatusChange(resolvedOptions[last].id);
    }
  };

  const sizeClasses = {
    sm: "min-h-[40px] px-3 py-1.5 text-xs gap-1.5",
    default: "min-h-[44px] px-3.5 py-2 text-sm gap-2",
    lg: "min-h-[48px] px-4 py-2.5 text-base gap-2.5",
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200 shadow-xs",
        scrollable && "overflow-x-auto no-scrollbar max-w-full",
        className
      )}
    >
      {resolvedOptions.map((opt, idx) => {
        const isActive = activeStatus === opt.id;
        const IconComponent = opt.icon || CircleDashed;
        const count = counts?.[opt.id] ?? opt.count;

        return (
          <button
            key={opt.id}
            ref={(el) => {
              tabsRef.current[idx] = el;
            }}
            type="button"
            role="tab"
            id={`status-tab-${opt.id}`}
            aria-selected={isActive}
            aria-controls={`status-panel-${opt.id}`}
            aria-label={`${opt.label}${typeof count === "number" ? ` (${count})` : ""}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onStatusChange(opt.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "group relative inline-flex items-center justify-center font-medium rounded-lg transition-all shrink-0 select-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1",
              sizeClasses[size],
              isActive
                ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            )}
          >
            <IconComponent
              className={cn(
                "size-4 shrink-0 transition-colors",
                isActive
                  ? opt.id === "OVERDUE"
                    ? "text-rose-600"
                    : opt.id === "COMPLETED"
                    ? "text-emerald-600"
                    : opt.id === "NEEDS_REVIEW"
                    ? "text-amber-600"
                    : "text-blue-600"
                  : "text-slate-500 group-hover:text-slate-700"
              )}
              strokeWidth={isActive ? 2 : 1.75}
              aria-hidden="true"
            />
            <span className="whitespace-nowrap">{opt.label}</span>

            {typeof count === "number" && (
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-1.5 py-0.2 font-mono text-xs font-semibold transition-colors shrink-0",
                  isActive
                    ? opt.id === "OVERDUE"
                      ? "bg-rose-100 text-rose-800 border border-rose-200"
                      : opt.id === "COMPLETED"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : opt.id === "NEEDS_REVIEW"
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-blue-100 text-blue-800 border border-blue-200"
                    : "bg-slate-200 text-slate-700"
                )}
                aria-hidden="true"
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
