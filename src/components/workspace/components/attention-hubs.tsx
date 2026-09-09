"use client";

import * as React from "react";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import type {
  ApprovalActionPayload,
  DeliverableSubmissionPayload,
} from "@/types/workspace";
import { UnifiedAdaptiveWorkspace } from "../unified-adaptive-workspace";

export interface AttentionHubBaseProps {
  user: AuthUser;
  tasks: SchoolTask[];
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onReview?: (payload: ApprovalActionPayload) => Promise<void> | void;
  onSubmitDeliverable?: (payload: DeliverableSubmissionPayload) => Promise<void> | void;
  onStatusChange?: (taskId: string, status: TaskStatus, note?: string) => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
  className?: string;
}

export interface ExecutiveAttentionHubProps extends AttentionHubBaseProps {
  onCreateDirective?: () => void;
  onSendReminder?: (taskId: string, deptCode: string) => void;
}

export interface DepartmentAttentionHubProps extends AttentionHubBaseProps {
  onCreateSubTask?: (parentTaskId: string) => void;
}

export interface StaffAttentionHubProps extends AttentionHubBaseProps {
  referenceDate?: string;
}

/**
 * ExecutiveAttentionHub - Unified high-altitude workspace focusing executive attention
 * on school-level bottlenecks, strategic directives, and institutional health radar.
 */
export function ExecutiveAttentionHub({
  user,
  tasks,
  onSelectTask,
  onReview,
  onSubmitDeliverable,
  onStatusChange,
  onCreateDirective,
  onSendReminder,
  onRefresh,
  isRefreshing,
  className,
}: ExecutiveAttentionHubProps) {
  return (
    <div className={className} data-slot="executive-attention-hub">
      <UnifiedAdaptiveWorkspace
        user={user}
        tasks={tasks}
        initialScope="school"
        forcedRole="ADMIN"
        contextTitle="Khoang điều hành Ban Giám hiệu"
        contextBadge="BGH"
        onSelectTask={onSelectTask}
        onReview={onReview}
        onSubmitDeliverable={onSubmitDeliverable}
        onStatusChange={onStatusChange}
        onCreateTask={onCreateDirective ? () => onCreateDirective() : undefined}
        onSendReminder={onSendReminder}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />
    </div>
  );
}

/**
 * DepartmentAttentionHub - Unified mid-altitude workspace focusing department head attention
 * on unit approval queues, staff task delegation, and departmental performance.
 */
export function DepartmentAttentionHub({
  user,
  tasks,
  onSelectTask,
  onReview,
  onSubmitDeliverable,
  onStatusChange,
  onCreateSubTask,
  onRefresh,
  isRefreshing,
  className,
}: DepartmentAttentionHubProps) {
  return (
    <div className={className} data-slot="department-attention-hub">
      <UnifiedAdaptiveWorkspace
        user={user}
        tasks={tasks}
        initialScope="unit"
        forcedRole="MANAGER"
        contextTitle="Không gian làm việc Trưởng đơn vị - Khoa / Phòng"
        contextBadge="Trưởng đơn vị"
        onSelectTask={onSelectTask}
        onReview={onReview}
        onSubmitDeliverable={onSubmitDeliverable}
        onStatusChange={onStatusChange}
        onCreateTask={onCreateSubTask ? () => onCreateSubTask("") : undefined}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />
    </div>
  );
}

/**
 * StaffAttentionHub - Unified personal workspace focusing faculty/staff attention
 * on imminent deadlines, deliverable submissions, and revision resolution.
 */
export function StaffAttentionHub({
  user,
  tasks,
  onSelectTask,
  onReview,
  onSubmitDeliverable,
  onStatusChange,
  onRefresh,
  isRefreshing,
  className,
}: StaffAttentionHubProps) {
  return (
    <div className={className} data-slot="staff-attention-hub">
      <UnifiedAdaptiveWorkspace
        user={user}
        tasks={tasks}
        initialScope="my"
        forcedRole="STAFF"
        contextTitle="Không gian công việc Giảng viên / Chuyên viên"
        contextBadge="Giảng viên"
        onSelectTask={onSelectTask}
        onReview={onReview}
        onSubmitDeliverable={onSubmitDeliverable}
        onStatusChange={onStatusChange}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />
    </div>
  );
}
