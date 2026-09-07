"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExecutiveCockpitWorkspace } from "@/components/portal/executive-cockpit-workspace";
import { DepartmentManagerWorkspace } from "@/components/portal/department-manager-workspace";
import { LecturerFocusWorkspace } from "@/components/portal/lecturer-focus-workspace";
import {
  useDashboardData,
  useDashboardActions,
  useDashboardModal,
} from "@/components/dashboard/dashboard-context";

function TasksFocusLandingComponent() {
  const {
    tasks,
    user,
    effectiveManagerUser,
    isExecutive,
    isSchoolView,
    isUnitView,
    isRefreshing,
  } = useDashboardData();

  const {
    handleReviewAction,
    handleSubmitDeliverable,
    handleStatusChange,
    handleManualRefresh,
  } = useDashboardActions();

  const { openTaskDetail, openCreateModal } = useDashboardModal();

  return (
    <div className="space-y-4" data-slot="role-workspace-landing">
      {/* Context Banner & Action Bar (non-executive roles only; ExecutiveCockpitWorkspace provides its own header) */}
      {!isExecutive && !isSchoolView && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border border-border rounded-2xl p-4 shadow-xs">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-2xs font-mono">
                {isUnitView
                  ? "Trung tâm điều hành Đơn vị"
                  : "Không gian làm việc cá nhân"}
              </span>
              <span className="text-xs text-muted-foreground font-mono tabular-nums">
                Năm học 2026 - 2027
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-heading">
              {isUnitView
                ? `Trung tâm Điều hành: ${effectiveManagerUser.department || user?.department || "Khoa / Phòng"}`
                : "Công việc Của tôi (My Focus)"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isUnitView
                ? "Phân công nhiệm vụ, kiểm tra tiến độ và thẩm định minh chứng cấp khoa/phòng"
                : "Tập trung xử lý nhiệm vụ được phân công, theo dõi hạn chót và nộp minh chứng"}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="gap-1.5 text-xs rounded-xl"
            >
              <RefreshCw
                size={14}
                strokeWidth={1.5}
                className={isRefreshing ? "animate-spin text-primary" : ""}
              />
              <span className="hidden sm:inline">Làm mới</span>
            </Button>
          </div>
        </div>
      )}

      {/* Role-Based Dispatching: Executive, Manager, or Staff Workspace */}
      {isSchoolView ? (
        <ExecutiveCockpitWorkspace
          user={user}
          tasks={tasks}
          onSelectTask={(task) => openTaskDetail(task)}
          onReview={handleReviewAction}
          onSubmitDeliverable={handleSubmitDeliverable}
          onCreateDirective={() => openCreateModal("TRUONG")}
          onSendReminder={(_deptCode, _reason) => {
            // Executive reminder dispatched
          }}
        />
      ) : isUnitView ? (
        <DepartmentManagerWorkspace
          user={effectiveManagerUser}
          tasks={tasks}
          onSelectTask={(task) => openTaskDetail(task)}
          onReview={handleReviewAction}
          onSubmitDeliverable={handleSubmitDeliverable}
          onStatusChange={handleStatusChange}
          onCreateSubTask={(parentTaskId) =>
            openCreateModal("DON_VI", parentTaskId)
          }
        />
      ) : (
        /* STAFF, GIANG_VIEN, CHUYEN_VIEN & Fallback */
        <LecturerFocusWorkspace
          user={user}
          tasks={tasks}
          onSelectTask={(task) => openTaskDetail(task)}
          onSubmitDeliverable={handleSubmitDeliverable}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

export const TasksFocusLanding = React.memo(TasksFocusLandingComponent);
