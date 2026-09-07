"use client";

import * as React from "react";
import type { SchoolTask, StaffTask } from "@/types/dashboard";

export interface ModalStateReturn {
  selectedTask: SchoolTask | StaffTask | null;
  isCreateModalOpen: boolean;
  initialTaskLevel: "TRUONG" | "DON_VI";
  initialParentTaskId?: string;
  initialAssigneeName?: string;
  isDelegationModalOpen: boolean;
  delegationDeptCode: string;
  setSelectedTask: React.Dispatch<React.SetStateAction<SchoolTask | StaffTask | null>>;
  openTaskDetail: (task: SchoolTask | StaffTask) => void;
  closeTaskDetail: () => void;
  openCreateModal: (level?: "TRUONG" | "DON_VI", parentId?: string, assigneeName?: string) => void;
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
  const [isDelegationModalOpen, setIsDelegationModalOpen] = React.useState(false);
  const [delegationDeptCode, setDelegationDeptCode] = React.useState("K_CNTT");

  const openTaskDetail = React.useCallback((task: SchoolTask | StaffTask) => {
    setSelectedTask(task);
  }, []);

  const closeTaskDetail = React.useCallback(() => {
    setSelectedTask(null);
  }, []);

  const openCreateModal = React.useCallback(
    (level: "TRUONG" | "DON_VI" = "TRUONG", parentId?: string, assigneeName?: string) => {
      setInitialTaskLevel(level);
      setInitialParentTaskId(parentId);
      setInitialAssigneeName(assigneeName);
      setIsCreateModalOpen(true);
    },
    []
  );

  const closeCreateModal = React.useCallback(() => {
    setIsCreateModalOpen(false);
    setInitialParentTaskId(undefined);
    setInitialAssigneeName(undefined);
  }, []);

  const openDelegationModal = React.useCallback((deptCode: string = "K_CNTT") => {
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
    isDelegationModalOpen,
    delegationDeptCode,
    setSelectedTask,
    openTaskDetail,
    closeTaskDetail,
    openCreateModal,
    closeCreateModal,
    openDelegationModal,
    closeDelegationModal,
  };
}
