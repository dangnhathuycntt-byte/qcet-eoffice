"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  useDashboardModal,
  useDashboardData,
  useDashboardActions,
} from "@/components/dashboard/dashboard-context";

const TaskDetailSideSheet = dynamic(
  () => import("@/components/dashboard/task-detail-side-sheet").then((m) => m.TaskDetailSideSheet),
  { ssr: false }
);

const CreateTaskModal = dynamic(
  () => import("@/components/dashboard/create-task-modal").then((m) => m.CreateTaskModal),
  { ssr: false }
);

const DelegationManagementModal = dynamic(
  () =>
    import("@/components/dashboard/delegation-management-modal").then(
      (m) => m.DelegationManagementModal
    ),
  { ssr: false }
);

function DashboardModalsHostComponent() {
  const {
    selectedTask,
    isCreateModalOpen,
    initialTaskLevel,
    initialParentTaskId,
    initialAssigneeName,
    isDelegationModalOpen,
    delegationDeptCode,
    closeTaskDetail,
    closeCreateModal,
    closeDelegationModal,
  } = useDashboardModal();

  const { tasks, parentSchoolTaskTitle, delegations } = useDashboardData();
  const {
    handleStatusChange,
    handleCreateTask,
    handleSaveDelegation,
    handleRevokeDelegation,
  } = useDashboardActions();

  return (
    <div data-slot="dashboard-modals-host">
      {/* TaskDetailSideSheet Slide-Over (only rendered when task is active) */}
      {selectedTask && (
        <TaskDetailSideSheet
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={closeTaskDetail}
          onStatusChange={handleStatusChange}
          parentSchoolTaskTitle={parentSchoolTaskTitle}
          delegations={delegations}
        />
      )}

      {/* CreateTaskModal for School-level & Unit-level task creation (rendered on-demand) */}
      {isCreateModalOpen && (
        <CreateTaskModal
          isOpen={isCreateModalOpen}
          onClose={closeCreateModal}
          onSubmit={handleCreateTask}
          initialLeadAssigneeName={initialAssigneeName}
          schoolTasks={tasks}
          initialLevel={initialTaskLevel}
          initialParentTaskId={initialParentTaskId}
        />
      )}

      {/* DelegationManagementModal for Stanford Authority Delegation (rendered on-demand) */}
      {isDelegationModalOpen && (
        <DelegationManagementModal
          isOpen={isDelegationModalOpen}
          onClose={closeDelegationModal}
          departmentCode={delegationDeptCode}
          delegations={delegations}
          onSaveDelegation={handleSaveDelegation}
          onRevokeDelegation={handleRevokeDelegation}
        />
      )}
    </div>
  );
}

export const DashboardModalsHost = React.memo(DashboardModalsHostComponent);
