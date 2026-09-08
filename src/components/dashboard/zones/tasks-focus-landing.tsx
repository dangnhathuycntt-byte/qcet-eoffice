"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UnifiedAdaptiveWorkspace } from "@/components/workspace";
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
    isRefreshing,
  } = useDashboardData();

  const {
    handleReviewAction,
    handleSubmitDeliverable,
    handleStatusChange,
    handleManualRefresh,
  } = useDashboardActions();

  const { openTaskDetail, openCreateModal } = useDashboardModal();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border bg-card/50">
        <h3 className="text-base font-semibold text-foreground mb-1">Chưa đăng nhập</h3>
        <p className="text-xs text-muted-foreground mb-4">Vui lòng đăng nhập để truy cập không gian công việc.</p>
        <Button onClick={() => router.push("/login")} size="sm">
          Đăng nhập ngay
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-slot="role-workspace-landing" id="tour-tasks-landing">
      {!tasks || tasks.length === 0 ? (
        <ActionableEmptyState
          onCreateTask={() => openCreateModal("DON_VI")}
          onOpenDocs={() => router.push("/documents")}
        />
      ) : (
        <UnifiedAdaptiveWorkspace
          user={effectiveManagerUser || user}
          tasks={tasks}
          onSelectTask={(task) => openTaskDetail(task)}
          onReview={handleReviewAction}
          onSubmitDeliverable={handleSubmitDeliverable}
          onStatusChange={handleStatusChange}
          onCreateTask={(scope) => openCreateModal(scope === "school" ? "TRUONG" : "DON_VI")}
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
        />
      )}
    </div>
  );
}

export const TasksFocusLanding = React.memo(TasksFocusLandingComponent);
