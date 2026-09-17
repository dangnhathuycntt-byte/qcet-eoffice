"use client";

import * as React from "react";
import { School, Building2, User, Plus, RefreshCw, AlertTriangle, List, LayoutGrid } from "lucide-react";
import type { AuthUser } from "@/types/auth";
import type { WorkspaceScope, ViewMode } from "../types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isExecutiveUser, isManagerUser } from "@/components/layout/scope-switcher";
import { isUserUnassignedDepartment } from "@/lib/auth-context";

export interface AdaptiveScopeHeaderProps {
  user: AuthUser;
  activeScope: WorkspaceScope;
  onScopeChange: (scope: WorkspaceScope) => void;
  badgeCounts?: Partial<Record<WorkspaceScope, number>>;
  selectedDepartment?: string;
  onDepartmentChange?: (dept: string) => void;
  availableDepartments?: Array<{ code: string; name: string }>;
  onRefresh?: () => void;
  onCreateTask?: () => void;
  isRefreshing?: boolean;
  hideScopeSwitcher?: boolean;
  contextTitle?: string;
  contextBadge?: string;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

const scopeActiveStyles: Record<WorkspaceScope, string> = {
  school: "text-foreground bg-card border-border/80 shadow-2xs font-semibold",
  unit: "text-foreground bg-card border-border/80 shadow-2xs font-semibold",
  my: "text-foreground bg-card border-border/80 shadow-2xs font-semibold",
};

const scopeBadgeActiveStyles: Record<WorkspaceScope, string> = {
  school: "bg-primary/10 text-primary border-primary/20",
  unit: "bg-primary/10 text-primary border-primary/20",
  my: "bg-primary/10 text-primary border-primary/20",
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
  selectedDepartment,
  onDepartmentChange,
  availableDepartments,
  onRefresh,
  onCreateTask,
  isRefreshing,
  hideScopeSwitcher: _hideScopeSwitcher,
  contextTitle,
  contextBadge,
  viewMode,
  onViewModeChange,
}: AdaptiveScopeHeaderProps) {
  const isExecutive = isExecutiveUser(user);
  const isManager = isManagerUser(user) || isExecutive;
  const isUnassigned = isUserUnassignedDepartment(user);

  // Derive active unit name from real data
  const currentDeptCode = selectedDepartment && selectedDepartment !== "ALL"
    ? selectedDepartment
    : user.departmentCode || user.department || "";

  const resolvedUnitName = React.useMemo(() => {
    if (isUnassigned) return "Chưa chọn đơn vị";
    if (availableDepartments && currentDeptCode) {
      const found = availableDepartments.find(
        (d) => d.code.toUpperCase() === currentDeptCode.toUpperCase()
      );
      if (found) return found.name;
    }
    return user.department || user.departmentCode || currentDeptCode || "Đơn vị";
  }, [isUnassigned, availableDepartments, currentDeptCode, user]);

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
        onScopeChange(scopeParam);
      }
    } catch {
      // Ignore errors in non-standard window environments
    }
  }, [activeScope, onScopeChange]);

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
      id: "my",
      label: "Cá nhân",
      shortLabel: "Cá nhân",
      icon: User,
      visible: true,
    },
    {
      id: "unit",
      label: "Đơn vị",
      shortLabel: isUnassigned ? "Chưa chọn đ/vị" : "Đơn vị",
      icon: isUnassigned ? AlertTriangle : Building2,
      visible: true,
    },
    {
      id: "school",
      label: "Toàn trường",
      shortLabel: "Trường",
      icon: School,
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
              const showBadge = typeof count === "number" && !isNaN(count);
              const isUnitUnassigned = s.id === "unit" && isUnassigned;

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
                  <Icon
                    className="size-3.5 shrink-0 select-none text-muted-foreground"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.shortLabel}</span>
                  {showBadge && (
                    <span
                      data-slot="scope-badge-count"
                      data-scope={s.id}
                      className={cn(
                        "inline-flex items-center justify-center rounded px-1.5 py-0.2 text-[10px] font-mono tabular-nums font-semibold",
                        isActive
                          ? "bg-muted text-foreground border border-border/60"
                          : "bg-muted/80 text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                  )}
                  {isUnitUnassigned && (
                    <span
                      data-slot="unassigned-scope-badge"
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border/60 ml-0.5 shrink-0"
                    >
                      Cần chọn
                    </span>
                  )}
                </button>
              );
            })}
        </div>

        {/* Clean Secondary Text: Unit Name beside Scope Tabs */}
        {activeScope === "unit" && !isUnassigned && (
          <span className="text-xs text-muted-foreground font-normal truncate max-w-[260px] select-none" title={resolvedUnitName}>
            ({resolvedUnitName})
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        {onViewModeChange && (
          <div
            role="group"
            aria-label="Chế độ xem"
            className="flex items-center rounded-xl border border-border/70 bg-muted/40 p-0.5"
          >
            <button
              type="button"
              onClick={() => onViewModeChange("table")}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                viewMode === "table"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Xem dạng bảng chi tiết"
            >
              <List strokeWidth={1.5} className="size-3.5" />
              <span className="hidden md:inline">Bảng</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("kanban")}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                viewMode === "kanban"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Xem dạng bảng Kanban"
            >
              <LayoutGrid strokeWidth={1.5} className="size-3.5" />
              <span className="hidden md:inline">Kanban</span>
            </button>
          </div>
        )}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="hidden sm:inline-flex h-8 px-2.5 rounded-xl border-border/80 text-xs font-medium cursor-pointer"
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
            id="tour-create-task-btn"
            size="sm"
            onClick={onCreateTask}
            aria-label="Tạo nhiệm vụ mới"
            className="hidden sm:inline-flex h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium shadow-2xs hover:bg-primary/90 hover:brightness-105 active:scale-[0.98] cursor-pointer"
          >
            <Plus className="size-3.5 mr-1" strokeWidth={1.5} />
            <span>Tạo nhiệm vụ</span>
          </Button>
        )}
      </div>
    </div>
  );
}
