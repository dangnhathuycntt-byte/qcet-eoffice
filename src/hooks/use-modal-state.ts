"use client";

import * as React from "react";
import type { SchoolTask, StaffTask } from "@/types/dashboard";

export interface ModalStateReturn {
  selectedTask: SchoolTask | StaffTask | null;
  isCreateModalOpen: boolean;
  initialTaskLevel: "TRUONG" | "DON_VI";
  initialParentTaskId?: string;
  initialAssigneeName?: string;
  initialAssigneeId?: string;
  initialTitle?: string;
  isDelegationModalOpen: boolean;
  delegationDeptCode: string;
  /** A user-visible message shown when a requested task cannot be opened. */
  taskDetailNotice: string | null;
  setTaskDetailNotice: React.Dispatch<React.SetStateAction<string | null>>;
  dismissTaskDetailNotice: () => void;
  setSelectedTask: React.Dispatch<React.SetStateAction<SchoolTask | StaffTask | null>>;
  openTaskDetail: (task: SchoolTask | StaffTask) => void;
  closeTaskDetail: () => void;
  openCreateModal: (
    level?: "TRUONG" | "DON_VI",
    parentId?: string,
    assigneeName?: string,
    initialTitle?: string,
    assigneeId?: string
  ) => void;
  closeCreateModal: () => void;
  openDelegationModal: (deptCode?: string) => void;
  closeDelegationModal: () => void;
}

export function useModalState(): ModalStateReturn {
  const [selectedTask, setSelectedTask] = React.useState<SchoolTask | StaffTask | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [initialTaskLevel, setInitialTaskLevel] = React.useState<"TRUONG" | "DON_VI">("TRUONG");
  const [initialParentTaskId, setInitialParentTaskId] = React.useState<string | undefined>(undefined);
  const [initialAssigneeName, setInitialAssigneeName] = React.useState<string | undefined>(undefined);
  const [initialAssigneeId, setInitialAssigneeId] = React.useState<string | undefined>(undefined);
  const [initialTitle, setInitialTitle] = React.useState<string | undefined>(undefined);
  const [isDelegationModalOpen, setIsDelegationModalOpen] = React.useState(false);
  const [delegationDeptCode, setDelegationDeptCode] = React.useState("K_CNTT");
  const [taskDetailNotice, setTaskDetailNotice] = React.useState<string | null>(null);

  const openTaskDetail = React.useCallback((task: SchoolTask | StaffTask) => {
    setTaskDetailNotice(null);
    setSelectedTask(task);
  }, []);

  const closeTaskDetail = React.useCallback(() => {
    setSelectedTask(null);
  }, []);

  const dismissTaskDetailNotice = React.useCallback(() => {
    setTaskDetailNotice(null);
  }, []);

  const openCreateModal = React.useCallback(
    (
      level: "TRUONG" | "DON_VI" = "TRUONG",
      parentId?: string,
      assigneeName?: string,
      title?: string,
      assigneeId?: string
    ) => {
      // Modal hierarchy rule: Close detail sheet when opening creation modal to prevent nested dialogs
      setSelectedTask(null);
      setInitialTaskLevel(level);
      setInitialParentTaskId(parentId);
      setInitialAssigneeName(assigneeName);
      setInitialAssigneeId(assigneeId);
      setInitialTitle(title);
      setIsCreateModalOpen(true);
    },
    []
  );

  const closeCreateModal = React.useCallback(() => {
    setIsCreateModalOpen(false);
    setInitialParentTaskId(undefined);
    setInitialAssigneeName(undefined);
    setInitialAssigneeId(undefined);
    setInitialTitle(undefined);
  }, []);

  const openDelegationModal = React.useCallback((deptCode: string = "K_CNTT") => {
    // Modal hierarchy rule: Close detail sheet when opening delegation modal
    setSelectedTask(null);
    setDelegationDeptCode(deptCode);
    setIsDelegationModalOpen(true);
  }, []);

  const closeDelegationModal = React.useCallback(() => {
    setIsDelegationModalOpen(false);
  }, []);

  return {
    selectedTask,
    isCreateModalOpen,
    initialTaskLevel,
    initialParentTaskId,
    initialAssigneeName,
    initialAssigneeId,
    initialTitle,
    isDelegationModalOpen,
    delegationDeptCode,
    taskDetailNotice,
    setTaskDetailNotice,
    dismissTaskDetailNotice,
    setSelectedTask,
    openTaskDetail,
    closeTaskDetail,
    openCreateModal,
    closeCreateModal,
    openDelegationModal,
    closeDelegationModal,
  };
}
