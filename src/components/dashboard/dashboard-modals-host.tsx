"use client";

import * as React from "react";
import {
  useDashboardModal,
  useDashboardData,
  useDashboardActions,
} from "@/components/dashboard/dashboard-context";
import { AlertTriangle } from "lucide-react";
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
    taskDetailNotice,
    dismissTaskDetailNotice,
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
      {taskDetailNotice && (
        <div role="status" data-slot="task-detail-notice" className="fixed bottom-4 left-1/2 z-50 flex max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 shadow-lg">
          <AlertTriangle className="size-4 shrink-0" strokeWidth={1.5} />
          <span className="flex-1">{taskDetailNotice}</span>
          <button type="button" onClick={dismissTaskDetailNotice} className="shrink-0 rounded-md px-2 py-1 font-medium hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600" aria-label="Đóng thông báo">Đóng</button>
        </div>
      )}

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
