"use client";

import * as React from "react";
import { Inbox, AlertTriangle, Loader2 } from "lucide-react";
import type { UnifiedAdaptiveWorkspaceProps, WorkspaceScope } from "./types";
import { useAdaptiveWorkspaceData } from "./hooks/use-adaptive-workspace-data";
import { AdaptiveScopeHeader } from "./components/adaptive-scope-header";
import { AdaptiveMetricStrip } from "./components/adaptive-metric-strip";
import { UniversalActionQueue } from "./components/universal-action-queue";
import { CascadingTaskTable } from "@/components/tasks/cascading-task-table";
import { isExecutiveUser, isManagerUser } from "@/components/layout/scope-switcher";
import { ReviewActionDialog } from "@/components/portal/review-action-dialog";
import { SubmitDeliverableModal } from "@/components/portal/submit-deliverable-modal";
import { Button } from "@/components/ui/button";
import type { SchoolTask, StaffTask } from "@/types/dashboard";

export function UnifiedAdaptiveWorkspace({
  user,
  tasks,
  initialScope,
  forcedScope,
  forcedRole,
  selectedDepartment,
  contextTitle,
  contextBadge,
  initialLoading,
  isLoading,
  isOffline,
  errorMessage,
  hideScopeSwitcher,
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
    const role = (user?.role || user?.dbRole || "").toUpperCase();
    if (
      forcedRole === "ADMIN" ||
      isExecutiveUser(user) ||
      role === "ADMIN" ||
      role === "BAN_GIAM_HIEU" ||
      role === "BGH"
    ) {
      return "school";
    }
    if (
      forcedRole === "MANAGER" ||
      isManagerUser(user) ||
      role === "MANAGER" ||
      role === "TRUONG_PHONG" ||
      role === "TRUONG_DON_VI" ||
      role === "TRUONG_KHOA"
    ) {
      return "unit";
    }
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

  // Interactive dialog states for task review and deliverable submission
  const [reviewingTask, setReviewingTask] = React.useState<SchoolTask | StaffTask | null>(null);
  const [submittingTask, setSubmittingTask] = React.useState<StaffTask | null>(null);

  const effectiveReviewerRole: "ADMIN" | "MANAGER" | "STAFF" = React.useMemo(() => {
    if (forcedRole) return forcedRole;
    if (isExecutiveUser(user)) return "ADMIN";
    if (isManagerUser(user)) return "MANAGER";
    return "STAFF";
  }, [forcedRole, user]);

  const { scopedTasks, metrics, actionQueue } = useAdaptiveWorkspaceData(
    tasks,
    user,
    activeScope,
    selectedDepartment
  );

  const isStaff =
    !isExecutiveUser(user) &&
    !isManagerUser(user) &&
    forcedRole !== "ADMIN" &&
    forcedRole !== "MANAGER" &&
    forcedScope !== "school" &&
    forcedScope !== "unit";

  const effectiveHideScopeSwitcher =
    hideScopeSwitcher !== undefined ? hideScopeSwitcher : isStaff;

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

      {/* Offline / Server Error Alert Banner */}
      {(isOffline || errorMessage) && (
        <aside
          data-slot="workspace-offline-alert"
          role="alert"
          className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 text-xs"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="size-4 shrink-0 text-amber-700" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {isOffline ? "Mất kết nối máy chủ" : "Không thể đồng bộ dữ liệu"}
              </p>
              <p className="text-muted-foreground truncate mt-0.5">
                {errorMessage ||
                  "Không thể đồng bộ dữ liệu thời gian thực từ CSDL trường. Vui lòng kiểm tra đường truyền và thử lại."}
              </p>
            </div>
          </div>
          {onRefresh && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="text-xs h-8 px-3 shrink-0 bg-background hover:bg-muted"
            >
              Thử lại
            </Button>
          )}
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
        hideScopeSwitcher={effectiveHideScopeSwitcher}
      />

      {/* Loading state when fetching initial data */}
      {(initialLoading || isLoading) && tasks.length === 0 && (
        <div
          data-slot="workspace-loading-state"
          className="p-8 rounded-2xl border border-border/60 bg-card text-center space-y-3"
        >
          <div className="size-8 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary animate-spin">
            <Loader2 className="size-4" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            Đang tải dữ liệu nhiệm vụ từ máy chủ QCET...
          </p>
        </div>
      )}

      {/* 2. Adaptive Metric Strip */}
      <AdaptiveMetricStrip metrics={metrics} scope={activeScope} />

      {/* 3. Universal Action Queue (Approvals & Deliverables) */}
      <UniversalActionQueue
        actionQueue={actionQueue}
        onSelectTask={onSelectTask}
        scope={activeScope}
        onReview={onReview}
        onSubmitDeliverable={onSubmitDeliverable}
        onOpenReview={onReview ? (task) => setReviewingTask(task) : undefined}
        onOpenSubmit={(task) => setSubmittingTask(task)}
      />

      {/* 4. Single Shared Task Canvas or Authentic Empty State */}
      {tasks.length === 0 && !initialLoading && !isLoading ? (
        <div
          data-slot="workspace-empty-state"
          className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card/40 my-2"
        >
          <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-3">
            <Inbox className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-foreground mb-1">
            Chưa có nhiệm vụ nào được phân công trong kỳ này
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mb-5 leading-relaxed">
            Hiện tại không có nhiệm vụ nào trong cơ sở dữ liệu. Thầy/Cô có thể tạo nhiệm vụ mới hoặc làm mới dữ liệu từ máy chủ.
          </p>
          <div className="flex items-center gap-2">
            {onCreateTask && (
              <Button
                size="sm"
                onClick={() => onCreateTask(activeScope)}
                className="text-xs h-8 px-3"
              >
                Tạo nhiệm vụ mới
              </Button>
            )}
            {onRefresh && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="text-xs h-8 px-3"
              >
                Làm mới dữ liệu
              </Button>
            )}
          </div>
        </div>
      ) : (
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
              (st) => {
                if (onSubmitDeliverable) {
                  setSubmittingTask(st);
                }
              }
            }
          />
        </div>
      )}

      {/* 5. Authenticated Review Action Dialog */}
      {reviewingTask && onReview && (
        <ReviewActionDialog
          isOpen={Boolean(reviewingTask)}
          onClose={() => setReviewingTask(null)}
          task={reviewingTask}
          taskId={reviewingTask.id}
          taskTitle={reviewingTask.title}
          reviewerRole={effectiveReviewerRole}
          reviewerName={user.name}
          onReview={async (payload) => {
            await onReview(payload);
            setReviewingTask(null);
          }}
        />
      )}

      {/* 6. Authenticated Submit Deliverable Modal */}
      {submittingTask && onSubmitDeliverable && (
        <SubmitDeliverableModal
          isOpen={Boolean(submittingTask)}
          onClose={() => setSubmittingTask(null)}
          task={submittingTask}
          taskId={submittingTask.id}
          taskTitle={submittingTask.title}
          onSubmit={async (payload) => {
            await onSubmitDeliverable(payload);
            setSubmittingTask(null);
          }}
        />
      )}
    </div>
  );
}
