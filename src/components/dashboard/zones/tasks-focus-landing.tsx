"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExecutiveCockpitWorkspace } from "@/components/portal/executive-cockpit-workspace";
import { DepartmentManagerWorkspace } from "@/components/portal/department-manager-workspace";
import { LecturerFocusWorkspace } from "@/components/portal/lecturer-focus-workspace";
import { ActionableEmptyState } from "@/components/onboarding/actionable-empty-state";
import {
  useDashboardData,
  useDashboardActions,
  useDashboardModal,
} from "@/components/dashboard/dashboard-context";

function TasksFocusLandingComponent() {
  const router = useRouter();
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
    <div className="space-y-4" data-slot="role-workspace-landing" id="tour-tasks-landing">
      {/* Role-Based Dispatching: Executive, Manager, or Staff Workspace */}
      {isExecutive && isSchoolView ? (
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
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
        />
      ) : !tasks || tasks.length === 0 ? (
        <ActionableEmptyState
          onCreateTask={() => openCreateModal("DON_VI")}
          onOpenDocs={() => router.push("/documents")}
        />
      ) : (
        /* STAFF, GIANG_VIEN, CHUYEN_VIEN & Fallback */
        <LecturerFocusWorkspace
          user={user}
          tasks={tasks}
          onSelectTask={(task) => openTaskDetail(task)}
          onSubmitDeliverable={handleSubmitDeliverable}
          onStatusChange={handleStatusChange}
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
        />
      )}
    </div>
  );
}

export const TasksFocusLanding = React.memo(TasksFocusLandingComponent);
