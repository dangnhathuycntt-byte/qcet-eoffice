"use client";

import * as React from "react";
import { School, Building2, User, ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkspaceScope = "school" | "unit" | "my";
export type WorkspaceScopeType = WorkspaceScope;

export interface ScopeTabItem {
  id: WorkspaceScope;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description?: string;
}

export interface UnitOption {
  id: string;
  name: string;
  shortName?: string;
}

export interface ScopeSwitcherProps {
  activeScope: WorkspaceScope;
  onScopeChange: (scope: WorkspaceScope) => void;
  counts?: Partial<Record<WorkspaceScope, number>>;
  disabledScopes?: WorkspaceScope[];
  unitLabel?: string;
  className?: string;
  size?: "default" | "sm" | "lg";
  fullWidth?: boolean;
  syncUrl?: boolean;
  selectedUnitId?: string;
  onUnitChange?: (unitId: string) => void;
  units?: UnitOption[];
}

const DEFAULT_SCOPES: ScopeTabItem[] = [
  {
    id: "school",
    label: "Toàn trường",
    shortLabel: "Trường",
    icon: School,
    description: "Nhiệm vụ trọng tâm và chỉ đạo điều hành toàn trường",
  },
  {
    id: "unit",
    label: "Đơn vị",
    shortLabel: "Đơn vị",
    icon: Building2,
    description: "Nhiệm vụ phân bổ và giám sát theo Khoa / Phòng / Ban",
  },
  {
    id: "my",
    label: "Của tôi",
    shortLabel: "Cá nhân",
    icon: User,
    description: "Nhiệm vụ trực tiếp phụ trách và cần xử lý cá nhân",
  },
];

/**
 * Synchronizes workspace scope state to the URL search parameters if enabled.
 */
export function syncScopeToUrl(scope: WorkspaceScope) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("scope") !== scope) {
      url.searchParams.set("scope", scope);
      window.history.replaceState(window.history.state, "", url.toString());
    }
  } catch {
    // Ignore history replace state errors
  }
}

/**
 * ScopeSwitcher - Canonical 3-tab scope switcher: [Toàn trường, Đơn vị, Của tôi].
 * Provides accessible tablist navigation, 44px+ touch targets, and senior ergonomics.
 * Strictly Light-Only with zero dark: classes and zero emojis.
 */
export function ScopeSwitcher({
  activeScope,
  onScopeChange,
  counts,
  disabledScopes = [],
  unitLabel,
  className,
  size = "default",
  fullWidth = false,
  syncUrl = false,
  selectedUnitId,
  onUnitChange,
  units,
}: ScopeSwitcherProps) {
  const tabsRef = React.useRef<(HTMLButtonElement | null)[]>([]);

  const handleSelect = (scope: WorkspaceScope) => {
    if (disabledScopes.includes(scope)) return;
    if (syncUrl) {
      syncScopeToUrl(scope);
    }
    onScopeChange(scope);
  };

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    const enabledTabs = DEFAULT_SCOPES.filter(
      (s) => !disabledScopes.includes(s.id)
    );
    if (enabledTabs.length === 0) return;

    let nextIndex = currentIndex;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % DEFAULT_SCOPES.length;
      while (disabledScopes.includes(DEFAULT_SCOPES[nextIndex].id)) {
        nextIndex = (nextIndex + 1) % DEFAULT_SCOPES.length;
      }
      tabsRef.current[nextIndex]?.focus();
      handleSelect(DEFAULT_SCOPES[nextIndex].id);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex =
        (currentIndex - 1 + DEFAULT_SCOPES.length) % DEFAULT_SCOPES.length;
      while (disabledScopes.includes(DEFAULT_SCOPES[nextIndex].id)) {
        nextIndex =
          (nextIndex - 1 + DEFAULT_SCOPES.length) % DEFAULT_SCOPES.length;
      }
      tabsRef.current[nextIndex]?.focus();
      handleSelect(DEFAULT_SCOPES[nextIndex].id);
    } else if (e.key === "Home") {
      e.preventDefault();
      const firstEnabled = DEFAULT_SCOPES.findIndex(
        (s) => !disabledScopes.includes(s.id)
      );
      if (firstEnabled !== -1) {
        tabsRef.current[firstEnabled]?.focus();
        handleSelect(DEFAULT_SCOPES[firstEnabled].id);
      }
    } else if (e.key === "End") {
      e.preventDefault();
      const lastEnabled = DEFAULT_SCOPES.map((s) => s.id)
        .reverse()
        .findIndex((id) => !disabledScopes.includes(id));
      if (lastEnabled !== -1) {
        const target = DEFAULT_SCOPES.length - 1 - lastEnabled;
        tabsRef.current[target]?.focus();
        handleSelect(DEFAULT_SCOPES[target].id);
      }
    }
  };

  const sizeClasses = {
    sm: "min-h-[40px] py-1.5 px-3 text-xs gap-1.5",
    default: "min-h-[44px] py-2 px-3.5 text-sm gap-2",
    lg: "min-h-[48px] py-2.5 px-4 text-base gap-2.5",
  };

  const hasSubordinateUnit =
    activeScope === "unit" && Boolean(units && units.length > 0);

  const tablistMarkup = (
    <div
      role="tablist"
      aria-label="Phạm vi công việc"
      className={cn(
        "inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 shadow-xs",
        fullWidth && !hasSubordinateUnit && "w-full grid grid-cols-3",
        !hasSubordinateUnit && className
      )}
    >
      {DEFAULT_SCOPES.map((tab, idx) => {
        const isActive = activeScope === tab.id;
        const isDisabled = disabledScopes.includes(tab.id);
        const IconComponent = tab.icon;
        const count = counts?.[tab.id];
        const displayLabel =
          tab.id === "unit" && unitLabel ? unitLabel : tab.label;

        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabsRef.current[idx] = el;
            }}
            type="button"
            role="tab"
            id={`scope-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`scope-panel-${tab.id}`}
            aria-label={`${tab.label}${typeof count === "number" ? ` (${count} việc)` : ""}`}
            tabIndex={isActive ? 0 : -1}
            disabled={isDisabled}
            onClick={() => handleSelect(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "group relative inline-flex items-center justify-center font-medium rounded-lg transition-all select-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1",
              sizeClasses[size],
              fullWidth ? "w-full" : "flex-1 sm:flex-initial",
              isActive
                ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60",
              isDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
            )}
          >
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
            <span className="truncate max-w-[130px] sm:max-w-[200px]">
              {displayLabel}
            </span>

            {typeof count === "number" && (
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-mono font-semibold transition-colors shrink-0",
                  isActive
                    ? "bg-blue-100 text-blue-800 border border-blue-200"
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

  if (!hasSubordinateUnit) {
    return tablistMarkup;
  }

  const selectorSizeClasses = {
    sm: "min-h-[40px] py-1.5 pl-3 pr-8 text-xs",
    default: "min-h-[44px] py-2 pl-3.5 pr-9 text-sm",
    lg: "min-h-[48px] py-2.5 pl-4 pr-10 text-base",
  };

  return (
    <div
      className={cn(
        "inline-flex flex-wrap sm:flex-nowrap items-center gap-2",
        fullWidth && "w-full",
        className
      )}
    >
      {tablistMarkup}

      {/* Subordinate unit selector - strictly subordinate to 'unit' scope */}
      <div className="relative inline-flex items-center shrink-0">
        <label htmlFor="subordinate-unit-selector" className="sr-only">
          Chọn đơn vị trực thuộc
        </label>
        <select
          id="subordinate-unit-selector"
          aria-label="Chọn đơn vị trực thuộc"
          value={selectedUnitId || ""}
          onChange={(e) => onUnitChange?.(e.target.value)}
          className={cn(
            "appearance-none bg-white border border-slate-200 text-slate-800 font-medium rounded-xl shadow-xs transition-all",
            "hover:bg-slate-50 hover:border-slate-300",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1",
            selectorSizeClasses[size],
            "cursor-pointer"
          )}
        >
          <option value="">Tất cả đơn vị</option>
          {units?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.shortName || u.name}
            </option>
          ))}
        </select>
        <ChevronDown
          className="size-4 text-slate-500 absolute right-2.5 sm:right-3 pointer-events-none"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
