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
  onRefresh?: () => void;
  onCreateTask?: () => void;
  isRefreshing?: boolean;
}

export function AdaptiveScopeHeader({
  user,
  activeScope,
  onScopeChange,
  onRefresh,
  onCreateTask,
  isRefreshing,
}: AdaptiveScopeHeaderProps) {
  const isExecutive = isExecutiveUser(user);
  const isManager = isManagerUser(user) || isExecutive;
  const unitLabel = user.department || user.departmentCode || "Đơn vị";

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
      visible: isManager,
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
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center p-1 bg-muted/60 rounded-xl border border-border/70">
          {scopes
            .filter((s) => s.visible)
            .map((s) => {
              const Icon = s.icon;
              const isActive = activeScope === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  data-scope={s.id}
                  onClick={() => onScopeChange(s.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[36px] sm:min-h-[32px] touch-manipulation",
                    isActive
                      ? "bg-card text-foreground shadow-xs font-bold border border-border/80"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                  )}
                >
                  <Icon className="size-3.5 shrink-0 select-none" strokeWidth={1.5} aria-hidden="true" />
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.shortLabel}</span>
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
            className="h-8 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 cursor-pointer"
          >
            <Plus className="size-3.5 mr-1" strokeWidth={1.5} />
            <span>Giao nhiệm vụ</span>
          </Button>
        )}
      </div>
    </div>
  );
}
