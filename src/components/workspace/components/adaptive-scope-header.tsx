"use client";

import * as React from "react";
import { School, Building2, User, Plus, RefreshCw } from "lucide-react";
import type { AuthUser } from "@/types/auth";
import type { WorkspaceScope } from "../types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isExecutiveUser, isManagerUser } from "@/components/layout/scope-switcher";

export interface AdaptiveScopeHeaderProps {
  user: AuthUser;
  activeScope: WorkspaceScope;
  onScopeChange: (scope: WorkspaceScope) => void;
  badgeCounts?: Partial<Record<WorkspaceScope, number>>;
  onRefresh?: () => void;
  onCreateTask?: () => void;
  isRefreshing?: boolean;
  hideScopeSwitcher?: boolean;
  contextTitle?: string;
  contextBadge?: string;
}

const scopeActiveStyles: Record<WorkspaceScope, string> = {
  school: "text-amber-700 bg-amber-50/80 border-amber-300 font-bold",
  unit: "text-blue-700 bg-blue-50/80 border-blue-300 font-bold",
  my: "text-emerald-700 bg-emerald-50/80 border-emerald-300 font-bold",
};

const scopeBadgeActiveStyles: Record<WorkspaceScope, string> = {
  school: "bg-amber-100 text-amber-800 border-amber-200",
  unit: "bg-blue-100 text-blue-800 border-blue-200",
  my: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export function syncScopeToUrl(scope: WorkspaceScope) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("scope") !== scope) {
      url.searchParams.set("scope", scope);
      window.history.replaceState(window.history.state, "", url.toString());
    }
  } catch {
    // Ignore URL parse errors in unsupported environments
  }
}

export function AdaptiveScopeHeader({
  user,
  activeScope,
  onScopeChange,
  badgeCounts,
  onRefresh,
  onCreateTask,
  isRefreshing,
  hideScopeSwitcher: _hideScopeSwitcher,
  contextTitle,
  contextBadge,
}: AdaptiveScopeHeaderProps) {
  const isExecutive = isExecutiveUser(user);
  const isManager = isManagerUser(user) || isExecutive;
  const unitLabel = user.department || user.departmentCode || "Đơn vị";

  // Check URL search params on mount if not matching current activeScope
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const scopeParam = params.get("scope") as WorkspaceScope | null;
      if (
        scopeParam &&
        (scopeParam === "school" || scopeParam === "unit" || scopeParam === "my") &&
        scopeParam !== activeScope
      ) {
        if (scopeParam === "school" && !isExecutive) return;
        onScopeChange(scopeParam);
      }
    } catch {
      // Ignore errors in non-standard window environments
    }
  }, [isExecutive, activeScope, onScopeChange]);

  const handleScopeClick = (scope: WorkspaceScope) => {
    syncScopeToUrl(scope);
    onScopeChange(scope);
  };

  const scopes: Array<{
    id: WorkspaceScope;
    label: string;
    shortLabel: string;
    icon: typeof School;
    visible: boolean;
  }> = [
    {
      id: "school",
      label: "Toàn trường",
      shortLabel: "Trường",
      icon: School,
      visible: isExecutive,
    },
    {
      id: "unit",
      label: unitLabel,
      shortLabel: unitLabel,
      icon: Building2,
      visible: true,
    },
    {
      id: "my",
      label: "Việc của tôi",
      shortLabel: "Của tôi",
      icon: User,
      visible: true,
    },
  ];

  return (
    <div
      data-slot="adaptive-scope-header"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border/60"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 min-w-0">
        {(contextTitle || contextBadge) && (
          <div className="flex items-center gap-2 min-w-0 mr-1">
            {contextBadge && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                {contextBadge}
              </span>
            )}
            {contextTitle && (
              <h2 className="text-sm font-bold text-foreground truncate">
                {contextTitle}
              </h2>
            )}
          </div>
        )}
        <div
          role="tablist"
          aria-label="Phạm vi công việc"
          className="flex items-center p-1 bg-muted/60 rounded-xl border border-border/70"
        >
          {scopes
            .filter((s) => s.visible)
            .map((s) => {
              const Icon = s.icon;
              const isActive = activeScope === s.id;
              const count = badgeCounts?.[s.id];
              const showBadge = typeof count === "number" && count > 0;

              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  id={`scope-tab-${s.id}`}
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  data-scope={s.id}
                  onClick={() => handleScopeClick(s.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[44px] sm:min-h-[36px] touch-manipulation border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    isActive
                      ? scopeActiveStyles[s.id]
                      : "text-muted-foreground border-transparent hover:text-foreground hover:bg-card/50"
                  )}
                >
                  <Icon className="size-3.5 shrink-0 select-none" strokeWidth={1.5} aria-hidden="true" />
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.shortLabel}</span>
                  {showBadge && (
                    <span
                      data-slot="scope-badge"
                      aria-label={`${count} nhiệm vụ`}
                      className={cn(
                        "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-mono tabular-nums font-semibold border ml-0.5",
                        isActive
                          ? scopeBadgeActiveStyles[s.id]
                          : "bg-muted text-muted-foreground border-border/60"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 px-2.5 rounded-xl border-border/80 text-xs font-medium cursor-pointer"
            aria-label="Làm mới dữ liệu"
          >
            <RefreshCw
              className={cn("size-3.5 text-muted-foreground", isRefreshing && "animate-spin")}
              strokeWidth={1.5}
            />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>
        )}
        {onCreateTask && (
          <Button
            size="sm"
            onClick={onCreateTask}
            aria-label="Thêm nhiệm vụ / Giao nhiệm vụ"
            className="hidden sm:inline-flex h-8 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 cursor-pointer"
          >
            <Plus className="size-3.5 mr-1" strokeWidth={1.5} />
            <span>Thêm nhiệm vụ</span>
          </Button>
        )}
      </div>
    </div>
  );
}
