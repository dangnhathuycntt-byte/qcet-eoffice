"use client";

import * as React from "react";
import { createTaskSequenceListener } from "@/lib/shortcuts/task-shortcuts";

export interface UseTaskShortcutsOptions {
  enabled?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

/**
 * Global keyboard shortcut hook inspired by Linear:
 * - Holding `n` then pressing `p`, or sequential `n` followed by `p` within 500ms
 * - Single key `c` shortcut for quick task creation
 * - Safely ignores typing in inputs, textareas, selects, and contenteditable elements via shouldIgnoreShortcut
 */
export function useTaskShortcuts(options: UseTaskShortcutsOptions = {}) {
  const { enabled = true, onOpen, onClose } = options;
  const [isNewTaskOpen, setIsNewTaskOpen] = React.useState(false);

  const openNewTask = React.useCallback(() => {
    setIsNewTaskOpen(true);
    onOpen?.();
  }, [onOpen]);

  const closeNewTask = React.useCallback(() => {
    setIsNewTaskOpen(false);
    onClose?.();
  }, [onClose]);

  // Listen to custom global events for cross-component triggers
  React.useEffect(() => {
    const handleGlobalOpen = () => openNewTask();
    const handleGlobalClose = () => closeNewTask();

    window.addEventListener("qcet:open-create-task", handleGlobalOpen);
    window.addEventListener("qcet:close-create-task", handleGlobalClose);

    return () => {
      window.removeEventListener("qcet:open-create-task", handleGlobalOpen);
      window.removeEventListener("qcet:close-create-task", handleGlobalClose);
    };
  }, [openNewTask, closeNewTask]);

  React.useEffect(() => {
    if (!enabled) return;

    const listener = createTaskSequenceListener({
      enabled,
      onCreateTask: openNewTask,
    });

    window.addEventListener("keydown", listener.handleKeyDown);
    window.addEventListener("keyup", listener.handleKeyUp);

    return () => {
      window.removeEventListener("keydown", listener.handleKeyDown);
      window.removeEventListener("keyup", listener.handleKeyUp);
    };
  }, [enabled, openNewTask]);

  return {
    isNewTaskOpen,
    openNewTask,
    closeNewTask,
  };
}
