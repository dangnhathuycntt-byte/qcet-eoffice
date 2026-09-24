"use client";

import * as React from "react";
import {
  Search,
  X,
  RotateCcw,
  Plus,
  SlidersHorizontal,
  FilterX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface WorkspaceToolbarAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export interface WorkspaceToolbarProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  leftSlot?: React.ReactNode;
  centerSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  viewSlot?: React.ReactNode;
  periodSlot?: React.ReactNode;
  primaryAction?: WorkspaceToolbarAction;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
  filterCount?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * WorkspaceToolbar - Canonical single control point for workspace chrome.
 * Enforces the "Single Control Point" invariant: consolidates search, views, filters, and actions.
 * WCAG 2.2 AA compliant with 44px+ touch targets and visible focus rings.
 * Strictly Light-Only with zero dark: classes and zero emojis.
 */
export function WorkspaceToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Tìm kiếm nhiệm vụ, mã công việc, người phụ trách...",
  leftSlot,
  centerSlot,
  rightSlot,
  viewSlot,
  periodSlot,
  primaryAction,
  onRefresh,
  isRefreshing = false,
  onResetFilters,
  hasActiveFilters = false,
  filterCount,
  className,
  children,
}: WorkspaceToolbarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClearSearch = () => {
    onSearchChange?.("");
    inputRef.current?.focus();
  };

  const PrimaryIcon = primaryAction?.icon || Plus;

  return (
    <div
      role="toolbar"
      aria-label="Thanh công cụ không gian làm việc"
      className={cn(
        "flex flex-col gap-3 p-3 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs",
        className
      )}
    >
      {/* Top row: Search input + Scope/Center slots + Actions */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Bar & Reset Filters */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {typeof onSearchChange === "function" && (
            <div className="relative flex-1 min-w-[220px]">
              <div
                className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500"
                aria-hidden="true"
              >
                <Search className="size-4" strokeWidth={1.5} />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={searchQuery ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Tìm kiếm trong không gian làm việc"
                className={cn(
                  "w-full rounded-xl pl-10 pr-10 py-2.5 text-sm font-medium bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-600 min-h-[44px] transition-all",
                  "hover:bg-slate-100/70 hover:border-slate-300",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 focus-visible:bg-white focus-visible:border-blue-600"
                )}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Xóa nội dung tìm kiếm"
                  className={cn(
                    "absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 min-w-[44px] justify-center",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg"
                  )}
                >
                  <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {/* Reset Filters button if active */}
          {hasActiveFilters && onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              aria-label="Đặt lại tất cả bộ lọc"
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 min-h-[44px] shrink-0 transition-colors",
                "hover:bg-rose-100 active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
              )}
            >
              <FilterX className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Đặt lại</span>
              {typeof filterCount === "number" && filterCount > 0 && (
                <span className="font-mono bg-rose-200/60 px-1 rounded-full text-xs">
                  {filterCount}
                </span>
              )}
            </button>
          )}

          {/* Left Slot (e.g. Scope Switcher or category dropdown) */}
          {leftSlot && <div className="shrink-0">{leftSlot}</div>}
        </div>

        {/* Center / Right slots: View Switcher, Period Selector, Actions */}
        <div className="flex items-center flex-wrap sm:flex-nowrap gap-2 self-stretch lg:self-auto justify-end">
          {centerSlot && <div className="shrink-0">{centerSlot}</div>}
          {periodSlot && <div className="shrink-0">{periodSlot}</div>}
          {viewSlot && <div className="shrink-0">{viewSlot}</div>}

          {/* Refresh Button */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={isRefreshing ? "Đang làm mới..." : "Làm mới dữ liệu"}
              className={cn(
                "inline-flex items-center justify-center size-11 rounded-xl bg-white border border-slate-200 text-slate-700 transition-colors shrink-0",
                "hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1",
                isRefreshing && "opacity-60 cursor-not-allowed"
              )}
            >
              <RotateCcw
                className={cn("size-4", isRefreshing && "animate-spin text-blue-600")}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </button>
          )}

          {/* Custom right slot */}
          {rightSlot && <div className="shrink-0">{rightSlot}</div>}

          {/* Primary Action Button (e.g. "+ Thêm nhiệm vụ") */}
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              aria-label={primaryAction.ariaLabel || primaryAction.label}
              className={cn(
                "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-blue-600 shadow-sm transition-all min-h-[44px] shrink-0 select-none",
                "hover:bg-blue-700 active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
                primaryAction.disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <PrimaryIcon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span>{primaryAction.label}</span>
            </button>
          )}
        </div>
      </div>

      {/* Secondary Bottom Slot for Sub-filters / Breadcrumbs / Status chips */}
      {children && (
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          {children}
        </div>
      )}
    </div>
  );
}
