"use client";

import * as React from "react";
import { Drawer as VaulDrawer } from "vaul";
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
  return (
    <VaulDrawer.Root
      direction="right"
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <VaulDrawer.Portal>
        <VaulDrawer.Overlay
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
        />
        <VaulDrawer.Content
          data-slot="task-properties-drawer"
          aria-label="Bảng thuộc tính nhiệm vụ"
          className={cn(
            "fixed inset-y-0 right-0 z-50 w-full max-w-sm h-full bg-background border-l border-border shadow-2xl flex flex-col focus:outline-none",
            className
          )}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" strokeWidth={1.5} />
              <VaulDrawer.Title className="text-xs font-semibold text-foreground">
                Thuộc tính nhiệm vụ
              </VaulDrawer.Title>
              <VaulDrawer.Description className="sr-only">
                Xem và chỉnh sửa các thuộc tính của nhiệm vụ
              </VaulDrawer.Description>
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
          <div className="flex-1 overflow-y-auto p-4 thin-scrollbar">
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
        </VaulDrawer.Content>
      </VaulDrawer.Portal>
    </VaulDrawer.Root>
  );
}
