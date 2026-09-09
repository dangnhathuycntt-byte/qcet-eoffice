"use client";

import * as React from "react";
import {
  useDashboardModal,
  useDashboardData,
  useDashboardActions,
} from "@/components/dashboard/dashboard-context";
import { TaskDetailSideSheet } from "@/components/dashboard/task-detail-side-sheet";
import { CreateTaskModal } from "@/components/dashboard/create-task-modal";
import { DelegationManagementModal } from "@/components/dashboard/delegation-management-modal";

function DashboardModalsHostComponent() {
  const {
    selectedTask,
    isCreateModalOpen,
    initialTaskLevel,
    initialParentTaskId,
    initialAssigneeName,
    initialTitle,
    isDelegationModalOpen,
    delegationDeptCode,
    openTaskDetail,
    openCreateModal,
    closeTaskDetail,
    closeCreateModal,
    closeDelegationModal,
  } = useDashboardModal();

  const { tasks, parentSchoolTaskTitle, delegations } = useDashboardData();
  const { handleStatusChange, handleCreateTask, handleSaveDelegation, handleRevokeDelegation } =
    useDashboardActions();

  const parentTaskForCreate = React.useMemo(() => {
    return initialParentTaskId ? tasks.find((t) => t.id === initialParentTaskId) : undefined;
  }, [initialParentTaskId, tasks]);

  const handleSelectSubTask = React.useCallback(
    (subTaskOrId: Parameters<NonNullable<React.ComponentProps<typeof TaskDetailSideSheet>["onSelectSubTask"]>>[0]) => {
      if (typeof subTaskOrId === "string") {
        const foundSchool = tasks.find((t) => t.id === subTaskOrId);
        if (foundSchool) return openTaskDetail(foundSchool);
        for (const t of tasks) {
          const sub = t.subTasks?.find((s) => s.id === subTaskOrId);
          if (sub) return openTaskDetail(sub);
        }
      } else if (subTaskOrId) {
        openTaskDetail(subTaskOrId);
      }
    },
    [tasks, openTaskDetail]
  );

  return (
    <div data-slot="dashboard-modals-host">
      {selectedTask && (
        <TaskDetailSideSheet
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={closeTaskDetail}
          onStatusChange={handleStatusChange}
          onAddSubTask={(parentId, prefillTitle) => openCreateModal("DON_VI", parentId, undefined, prefillTitle)}
          onSelectSubTask={handleSelectSubTask}
          parentSchoolTaskTitle={parentSchoolTaskTitle}
          delegations={delegations}
        />
      )}

      {isCreateModalOpen && (
        <CreateTaskModal
          isOpen={isCreateModalOpen}
          onClose={closeCreateModal}
          onSubmit={handleCreateTask}
          initialTitle={initialTitle}
          initialLeadAssigneeName={initialAssigneeName}
          schoolTasks={tasks}
          initialLevel={initialTaskLevel}
          initialParentTaskId={initialParentTaskId}
          initialParentTaskTitle={parentTaskForCreate?.title}
          initialParentTaskDueDate={parentTaskForCreate?.dueDate}
        />
      )}

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
