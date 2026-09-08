"use client";

import * as React from "react";
import type { UnifiedAdaptiveWorkspaceProps, WorkspaceScope } from "./types";
import { useAdaptiveWorkspaceData } from "./hooks/use-adaptive-workspace-data";
import { AdaptiveScopeHeader } from "./components/adaptive-scope-header";
import { AdaptiveMetricStrip } from "./components/adaptive-metric-strip";
import { UniversalActionQueue } from "./components/universal-action-queue";
import { CascadingTaskTable } from "@/components/tasks/cascading-task-table";
import { isExecutiveUser, isManagerUser } from "@/components/layout/scope-switcher";

export function UnifiedAdaptiveWorkspace({
  user,
  tasks,
  initialScope,
  forcedScope,
  forcedRole,
  selectedDepartment,
  contextTitle,
  contextBadge,
  onSelectTask,
  onReview,
  onSubmitDeliverable,
  onStatusChange,
  onSendReminder,
  onCreateTask,
  onRefresh,
  isRefreshing,
  onAction,
}: UnifiedAdaptiveWorkspaceProps) {
  // Determine default scope based on user role or explicit props
  const defaultScope: WorkspaceScope = React.useMemo(() => {
    if (forcedScope) return forcedScope;
    if (initialScope) return initialScope;
    if (forcedRole === "ADMIN" || isExecutiveUser(user)) return "school";
    if (forcedRole === "MANAGER" || isManagerUser(user)) return "unit";
    return "my";
  }, [forcedScope, initialScope, forcedRole, user]);

  const [activeScope, setActiveScope] = React.useState<WorkspaceScope>(defaultScope);

  // Synchronize when forcedScope or initialScope changes externally
  React.useEffect(() => {
    if (forcedScope) {
      setActiveScope(forcedScope);
    } else if (initialScope) {
      setActiveScope(initialScope);
    }
  }, [forcedScope, initialScope]);

  const { scopedTasks, metrics, actionQueue } = useAdaptiveWorkspaceData(
    tasks,
    user,
    activeScope,
    selectedDepartment
  );

  return (
    <div
      data-slot="unified-adaptive-workspace"
      data-active-scope={activeScope}
      className="space-y-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:pb-8"
    >
      {/* Context banner when provided by adapter shims */}
      {(contextTitle || contextBadge) && (
        <aside
          data-slot="workspace-context-banner"
          role="region"
          aria-label="Thông tin ngữ cảnh không gian làm việc"
          className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-muted/40 rounded-xl border border-border/70 text-xs"
        >
          <div className="flex items-center gap-2">
            {contextBadge && (
              <span
                data-slot="workspace-context-badge"
                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20"
              >
                {contextBadge}
              </span>
            )}
            {contextTitle && (
              <span
                data-slot="workspace-context-title"
                className="font-medium text-foreground"
              >
                {contextTitle}
              </span>
            )}
          </div>
        </aside>
      )}

      {/* 1. Adaptive Scope Switcher Header */}
      <AdaptiveScopeHeader
        user={user}
        activeScope={activeScope}
        onScopeChange={setActiveScope}
        onRefresh={onRefresh}
        onCreateTask={
          onCreateTask
            ? () => onCreateTask(activeScope)
            : undefined
        }
        isRefreshing={isRefreshing}
      />

      {/* 2. Adaptive Metric Strip */}
      <AdaptiveMetricStrip metrics={metrics} scope={activeScope} />

      {/* 3. Universal Action Queue (Approvals & Deliverables) */}
      <UniversalActionQueue
        actionQueue={actionQueue}
        onSelectTask={onSelectTask}
        scope={activeScope}
        onReview={onReview}
        onSubmitDeliverable={onSubmitDeliverable}
      />

      {/* 4. Single Shared Task Canvas */}
      <div className="pt-2">
        <CascadingTaskTable
          tasks={scopedTasks}
          onSelectTask={onSelectTask}
          onStatusChange={onStatusChange}
          onRefresh={onRefresh}
          onAddTask={
            onCreateTask
              ? () => onCreateTask(activeScope)
              : undefined
          }
          onOpenSubmitModal={
            onSubmitDeliverable
              ? (st) =>
                  onSubmitDeliverable({
                    taskId: st.id,
                    deliverableName: st.title || "Minh chứng",
                    url: "",
                    note: "",
                  })
              : undefined
          }
        />
      </div>
    </div>
  );
}
