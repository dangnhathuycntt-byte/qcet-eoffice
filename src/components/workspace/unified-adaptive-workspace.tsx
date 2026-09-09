"use client";

import * as React from "react";
import { Inbox, AlertTriangle, Loader2 } from "lucide-react";
import type { UnifiedAdaptiveWorkspaceProps, WorkspaceScope } from "./types";
import {
  useAdaptiveWorkspaceData,
  countScopeTasks,
} from "./hooks/use-adaptive-workspace-data";
import { AdaptiveScopeHeader } from "./components/adaptive-scope-header";
import { AdaptiveMetricStrip } from "./components/adaptive-metric-strip";
import { UniversalActionQueue } from "./components/universal-action-queue";
import { ActiveFilterBreadcrumb } from "./components/active-filter-breadcrumb";
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
  onCreateSubtask,
  onRefresh,
  isRefreshing,
  onAction,
  activeStatus,
  searchQuery,
  isOverdueOnly,
  activeWorkbox,
  onDepartmentChange,
  onStatusFilterChange,
  onSearchChange,
  onOverdueFilterChange,
  onWorkboxChange,
  onResetFilters,
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
  const [submittingTask, setSubmittingTask] = React.useState<SchoolTask | StaffTask | null>(null);

  const effectiveReviewerRole: "ADMIN" | "MANAGER" | "STAFF" = React.useMemo(() => {
    if (forcedRole) return forcedRole;
    if (isExecutiveUser(user)) return "ADMIN";
    if (isManagerUser(user)) return "MANAGER";
    return "STAFF";
  }, [forcedRole, user]);

  // Filter state synchronized with props
  const [internalDept, setInternalDept] = React.useState<string | undefined>(selectedDepartment);
  const [internalStatus, setInternalStatus] = React.useState<string | undefined>(activeStatus);
  const [internalSearch, setInternalSearch] = React.useState<string | undefined>(searchQuery);
  const [internalOverdue, setInternalOverdue] = React.useState<boolean>(Boolean(isOverdueOnly));
  const [internalWorkbox, setInternalWorkbox] = React.useState<string | undefined>(activeWorkbox);

  React.useEffect(() => {
    setInternalDept(selectedDepartment);
  }, [selectedDepartment]);

  React.useEffect(() => {
    setInternalStatus(activeStatus);
  }, [activeStatus]);

  React.useEffect(() => {
    setInternalSearch(searchQuery);
  }, [searchQuery]);

  React.useEffect(() => {
    setInternalOverdue(Boolean(isOverdueOnly));
  }, [isOverdueOnly]);

  React.useEffect(() => {
    setInternalWorkbox(activeWorkbox);
  }, [activeWorkbox]);

  const currentDept = internalDept ?? selectedDepartment;
  const currentStatus = internalStatus ?? activeStatus;
  const currentSearch = internalSearch ?? searchQuery;
  const currentOverdue = internalOverdue || Boolean(isOverdueOnly);
  const currentWorkbox = internalWorkbox ?? activeWorkbox;

  const { scopedTasks, metrics, actionQueue } = useAdaptiveWorkspaceData(
    tasks,
    user,
    activeScope,
    currentDept
  );

  // Filter tasks based on search, status, and overdue criteria
  const displayedTasks = React.useMemo(() => {
    let result = scopedTasks;
    if (currentSearch && currentSearch.trim()) {
      const q = currentSearch.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.code?.toLowerCase().includes(q) ||
          t.leadAssigneeName?.toLowerCase().includes(q) ||
          t.assignedTo?.toLowerCase().includes(q)
      );
    }
    if (currentStatus && currentStatus !== "ALL") {
      result = result.filter((t) => t.status === currentStatus);
    }
    return result;
  }, [scopedTasks, currentSearch, currentStatus]);

  const handleResetFilters = React.useCallback(() => {
    setInternalDept(undefined);
    setInternalStatus(undefined);
    setInternalSearch(undefined);
    setInternalOverdue(false);
    setInternalWorkbox(undefined);
    if (onResetFilters) onResetFilters();
    if (onDepartmentChange) onDepartmentChange("ALL");
    if (onStatusFilterChange) onStatusFilterChange(undefined);
    if (onSearchChange) onSearchChange("");
    if (onOverdueFilterChange) onOverdueFilterChange(false);
    if (onWorkboxChange) onWorkboxChange("ALL");
    if (onAction) onAction("RESET_FILTERS");
  }, [
    onResetFilters,
    onDepartmentChange,
    onStatusFilterChange,
    onSearchChange,
    onOverdueFilterChange,
    onWorkboxChange,
    onAction,
  ]);

  const handleRemoveDept = React.useCallback(() => {
    setInternalDept(undefined);
    if (onDepartmentChange) onDepartmentChange("ALL");
  }, [onDepartmentChange]);

  const handleRemoveStatus = React.useCallback(() => {
    setInternalStatus(undefined);
    if (onStatusFilterChange) onStatusFilterChange(undefined);
  }, [onStatusFilterChange]);

  const handleRemoveSearch = React.useCallback(() => {
    setInternalSearch(undefined);
    if (onSearchChange) onSearchChange("");
  }, [onSearchChange]);

  const handleRemoveOverdue = React.useCallback(() => {
    setInternalOverdue(false);
    if (onOverdueFilterChange) onOverdueFilterChange(false);
  }, [onOverdueFilterChange]);

  const handleRemoveWorkbox = React.useCallback(() => {
    setInternalWorkbox(undefined);
    if (onWorkboxChange) onWorkboxChange("ALL");
  }, [onWorkboxChange]);

  const isStaff =
    !isExecutiveUser(user) &&
    !isManagerUser(user) &&
    forcedRole !== "ADMIN" &&
    forcedRole !== "MANAGER" &&
    forcedScope !== "school" &&
    forcedScope !== "unit";

  // Compute scope badge counts for AdaptiveScopeHeader tabs
  const badgeCounts = React.useMemo<Partial<Record<WorkspaceScope, number>>>(() => {
    return {
      school: tasks.length,
      unit: countScopeTasks(tasks, user, "unit", selectedDepartment),
      my: countScopeTasks(tasks, user, "my", selectedDepartment),
    };
  }, [tasks, user, selectedDepartment]);

  // Unified task creation handler: defaults staff to "DON_VI" or "my"
  const handleCreateTask = React.useCallback(() => {
    if (onCreateTask) {
      if (isStaff) {
        const staffScope = activeScope === "unit" ? "DON_VI" : "my";
        onCreateTask(staffScope);
      } else {
        onCreateTask(activeScope);
      }
    } else if (onAction) {
      const staffScope = activeScope === "unit" ? "DON_VI" : "my";
      onAction("CREATE_TASK", { scope: isStaff ? staffScope : activeScope });
    }
  }, [onCreateTask, onAction, isStaff, activeScope]);

  const canCreateTask = Boolean(onCreateTask || onAction);

  return (
    <div
      data-slot="unified-adaptive-workspace"
      data-active-scope={activeScope}
      className="space-y-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:pb-8"
    >
      {/* Screen-reader accessible context info when provided by adapter shims (visual banner removed for clean unified canvas) */}
      {(contextTitle || contextBadge) && (
        <aside
          role="region"
          aria-label="Thông tin ngữ cảnh không gian làm việc"
          className="sr-only"
        >
          {contextBadge && <span>{contextBadge}</span>}
          {contextTitle && <span>{contextTitle}</span>}
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
        onCreateTask={canCreateTask ? handleCreateTask : undefined}
        badgeCounts={badgeCounts}
        isRefreshing={isRefreshing}
        hideScopeSwitcher={hideScopeSwitcher}
        contextTitle={contextTitle}
        contextBadge={contextBadge}
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

      {/* 2. Split-Cockpit Layout: Primary Work Table + Contextual Side Panel */}
      <div
        data-slot="split-cockpit-layout"
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start"
      >
        {/* Primary Work Table (approx 58-66% width on desktop) */}
        <div
          data-slot="split-cockpit-primary"
          className="lg:col-span-7 xl:col-span-8 space-y-3 min-w-0"
        >
          {/* Active Filter Breadcrumb */}
          <ActiveFilterBreadcrumb
            department={currentDept}
            status={currentStatus}
            search={currentSearch}
            overdue={currentOverdue}
            workbox={currentWorkbox}
            totalFilteredCount={displayedTasks.length}
            totalCount={tasks.length}
            onResetFilters={handleResetFilters}
            onRemoveDepartment={handleRemoveDept}
            onRemoveStatus={handleRemoveStatus}
            onRemoveSearch={handleRemoveSearch}
            onRemoveOverdue={handleRemoveOverdue}
            onRemoveWorkbox={handleRemoveWorkbox}
          />

          {/* Single Shared Task Canvas or Authentic Empty State */}
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
                {canCreateTask && (
                  <Button
                    size="sm"
                    onClick={handleCreateTask}
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
            <div className="pt-0.5">
              <CascadingTaskTable
                tasks={displayedTasks}
                onSelectTask={onSelectTask}
                onStatusChange={onStatusChange}
                onRefresh={onRefresh}
                onOpenSubmitModal={
                  onSubmitDeliverable
                    ? (st) => setSubmittingTask(st)
                    : undefined
                }
              />
            </div>
          )}
        </div>

        {/* Contextual Side Panel: Action Queue & Metrics (approx 33-42% width on desktop) */}
        <div
          data-slot="split-cockpit-side-panel"
          className="lg:col-span-5 xl:col-span-4 space-y-4 min-w-0"
        >
          {/* Adaptive Metric Strip */}
          <AdaptiveMetricStrip metrics={metrics} scope={activeScope} />

          {/* Universal Action Queue (Approvals & Deliverables) */}
          <UniversalActionQueue
            actionQueue={actionQueue}
            onSelectTask={onSelectTask}
            scope={activeScope}
            onReview={onReview}
            onSubmitDeliverable={onSubmitDeliverable}
            onOpenReview={onReview ? (task) => setReviewingTask(task) : undefined}
            onOpenSubmit={onSubmitDeliverable ? (task) => setSubmittingTask(task) : undefined}
            onCreateSubtask={
              onCreateSubtask
                ? onCreateSubtask
                : onCreateTask
                ? (parentId) => onCreateTask(activeScope === "unit" ? "DON_VI" : activeScope, parentId)
                : undefined
            }
            onRemindDRI={
              onSendReminder
                ? (taskId, target) => onSendReminder(target, `Đôn đốc tiến độ thực hiện nhiệm vụ ${taskId}`)
                : undefined
            }
          />
        </div>
      </div>

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
          task={submittingTask as any}
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
