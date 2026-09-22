"use client";

import * as React from "react";
import {
  X,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import { TaskPropertiesSidebar, type AuditLogItem } from "./task-properties-sidebar";

export interface TaskPropertiesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  task: SchoolTask | StaffTask;
  currentUser?: AuthUser | null;
  onStatusChange?: (taskId: string, newStatus: TaskStatus, note?: string) => Promise<void> | void;
  onPriorityChange?: (taskId: string, newPriority: TaskPriority) => Promise<void> | void;
  onDueDateChange?: (taskId: string, newDueDate: string) => Promise<void> | void;
  onStartDateChange?: (taskId: string, newStartDate: string) => Promise<void> | void;
  auditEvents?: AuditLogItem[];
  canEdit?: boolean;
  className?: string;
}

export function TaskPropertiesDrawer({
  isOpen,
  onClose,
  task,
  currentUser,
  onStatusChange,
  onPriorityChange,
  onDueDateChange,
  onStartDateChange,
  auditEvents,
  canEdit = true,
  className,
}: TaskPropertiesDrawerProps) {
  // Lock body scroll when drawer is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-slot="task-properties-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Bảng thuộc tính nhiệm vụ"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-in fade-in-0 duration-200"
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        className={cn(
          "relative z-10 w-full max-w-sm h-full bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200",
          className
        )}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-muted/30">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" strokeWidth={1.5} />
            <h3 className="text-xs font-semibold text-foreground">
              Thuộc tính nhiệm vụ
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Đóng bảng thuộc tính (Esc)"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <TaskPropertiesSidebar
            task={task}
            currentUser={currentUser}
            onStatusChange={onStatusChange}
            onPriorityChange={onPriorityChange}
            onDueDateChange={onDueDateChange}
            onStartDateChange={onStartDateChange}
            auditEvents={auditEvents}
            canEdit={canEdit}
            isMobileAccordion={false}
          />
        </div>
      </div>
    </div>
  );
}
