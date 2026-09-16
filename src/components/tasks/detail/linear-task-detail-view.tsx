"use client";

import * as React from "react";
import {
  FileText,
  Edit2,
  Check,
  X,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import { cn } from "@/lib/utils";
import { TaskDetailHeaderNav } from "./task-detail-header-nav";
import { TaskIdentityBlock } from "./task-identity-block";
import { TaskProgressComposer } from "./task-progress-composer";
import { TaskSubtasksSection } from "./task-subtasks-section";
import { TaskEvidenceSection, type DeliverableItem } from "./task-evidence-section";
import { TaskActivityTimeline, type ActivityEvent } from "./task-activity-timeline";
import { LinearPropertiesSidebar, type AuditLogItem } from "./linear-properties-sidebar";
import { TaskPropertiesDrawer } from "./task-properties-drawer";

export interface LinearTaskDetailViewProps {
  task: SchoolTask | StaffTask;
  onBack: () => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus, note?: string) => Promise<void> | void;
  onPriorityChange?: (taskId: string, newPriority: TaskPriority) => Promise<void> | void;
  onDueDateChange?: (taskId: string, newDueDate: string) => Promise<void> | void;
  onTitleChange?: (taskId: string, newTitle: string) => Promise<void> | void;
  onDescriptionChange?: (taskId: string, newDescription: string) => Promise<void> | void;
  onAddSubTask?: (parentId: string) => void;
  onSelectSubTask?: (subTaskOrId: string | StaffTask) => void;
  currentUser?: AuthUser | null;
  auditEvents?: AuditLogItem[] | ActivityEvent[];
  onRefresh?: () => Promise<void> | void;
  onSubmitDeliverable?: (task: SchoolTask | StaffTask) => void;
  onReview?: (task: SchoolTask | StaffTask) => void;
  initialTab?: "overview" | "activity" | "subtasks";
  onTabChange?: (tab: "overview" | "activity" | "subtasks") => void;
  className?: string;
}

export type DetailTab = "overview" | "activity" | "subtasks";

export function LinearTaskDetailView({
  task: initialTask,
  onBack,
  onStatusChange,
  onPriorityChange,
  onDueDateChange,
  onTitleChange,
  onDescriptionChange,
  onAddSubTask,
  onSelectSubTask,
  currentUser,
  auditEvents: initialAuditEvents = [],
  onRefresh,
  onSubmitDeliverable,
  onReview,
  className,
}: LinearTaskDetailViewProps) {
  const [task, setTask] = React.useState<SchoolTask | StaffTask>(initialTask);
  React.useEffect(() => {
    setTask(initialTask);
  }, [initialTask]);

  const [showInspector, setShowInspector] = React.useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);

  // Local audit events
  const [auditEvents, setAuditEvents] = React.useState<ActivityEvent[]>(initialAuditEvents as ActivityEvent[]);
  React.useEffect(() => {
    setAuditEvents(initialAuditEvents as ActivityEvent[]);
  }, [initialAuditEvents]);

  // Keyboard shortcut: Ctrl/Cmd + I toggles inspector
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        // On desktop toggle sidebar; on mobile toggle drawer
        if (typeof window !== "undefined" && window.innerWidth < 1024) {
          setIsMobileDrawerOpen((prev) => !prev);
        } else {
          setShowInspector((prev) => !prev);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isSchool = isSchoolTask(task);
  const schoolTask = isSchool ? (task as SchoolTask) : null;
  const staffTask = !isSchool ? (task as StaffTask) : null;

  const taskCode =
    task.code ||
    (isSchool ? schoolTask?.taskCode : staffTask?.taskId) ||
    task.id.slice(0, 8).toUpperCase();

  const currentProgressPercent =
    typeof (task as any).progressPercent === "number"
      ? (task as any).progressPercent
      : isSchool
      ? schoolTask?.progress ?? 0
      : 0;

  const subTasks = isSchool && Array.isArray(schoolTask?.subTasks) ? schoolTask.subTasks : [];

  const rawDescription = isSchool
    ? schoolTask?.description
    : staffTask?.deliverableDescription || (task as any).description;

  // Description inline edit state
  const [isEditingDescription, setIsEditingDescription] = React.useState(false);
  const [descriptionDraft, setDescriptionDraft] = React.useState(rawDescription || "");

  React.useEffect(() => {
    setDescriptionDraft(rawDescription || "");
  }, [rawDescription]);

  // Deliverables / Resources state
  const initialDeliverables = (task as any).deliverables || [];
  const [deliverables, setDeliverables] = React.useState<DeliverableItem[]>(initialDeliverables);
  React.useEffect(() => {
    if (Array.isArray((task as any).deliverables)) {
      setDeliverables((task as any).deliverables);
    }
  }, [task]);

  const handleToggleInspector = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsMobileDrawerOpen((prev) => !prev);
    } else {
      setShowInspector((prev) => !prev);
    }
  };

  const handleStatusChangeInternal = async (taskId: string, newStatus: TaskStatus, note?: string) => {
    if (onStatusChange) {
      await onStatusChange(taskId, newStatus, note);
    }
    setTask((prev) => ({
      ...prev,
      status: newStatus,
      ...(newStatus === "COMPLETED" ? { progressPercent: 100 } : {}),
    }));
    setAuditEvents((prev) => [
      {
        id: `audit-${Date.now()}`,
        action: newStatus,
        timestamp: new Date().toISOString(),
        actorName: currentUser?.name || "Người dùng",
        description: note || `Đổi trạng thái sang: ${newStatus}`,
      },
      ...prev,
    ]);
  };

  const handlePriorityChangeInternal = async (taskId: string, newPriority: TaskPriority) => {
    if (onPriorityChange) {
      await onPriorityChange(taskId, newPriority);
    }
    const cleanPriority: "URGENT" | "HIGH" | "NORMAL" | "LOW" =
      newPriority === "MEDIUM" ? "NORMAL" : newPriority;
    setTask((prev) => ({
      ...prev,
      priority: cleanPriority,
    }));
  };

  const handleDueDateChangeInternal = async (taskId: string, newDueDate: string) => {
    if (onDueDateChange) {
      await onDueDateChange(taskId, newDueDate);
    }
    setTask((prev) => ({
      ...prev,
      dueDate: newDueDate,
    }));
  };

  const handleTitleChangeInternal = async (taskId: string, newTitle: string) => {
    if (onTitleChange) {
      await onTitleChange(taskId, newTitle);
    } else {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
    }
    setTask((prev) => ({
      ...prev,
      title: newTitle,
    }));
  };

  const handleSaveDescription = async () => {
    setIsEditingDescription(false);
    if (onDescriptionChange) {
      await onDescriptionChange(task.id, descriptionDraft);
    } else {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: descriptionDraft }),
      });
    }
    setTask((prev) => ({
      ...prev,
      description: descriptionDraft,
    }));
  };

  const handleProgressUpdated = async (newProgress: number, note?: string) => {
    setTask((prev) => ({
      ...prev,
      progressPercent: newProgress,
      ...(newProgress === 100 ? { status: "COMPLETED" as TaskStatus } : {}),
    }));
    setAuditEvents((prev) => [
      {
        id: `audit-prog-${Date.now()}`,
        action: "UPDATE_PROGRESS",
        timestamp: new Date().toISOString(),
        actorName: currentUser?.name || "Người thực hiện",
        description: `Cập nhật tiến độ: ${newProgress}%${note ? ` (${note})` : ""}`,
      },
      ...prev,
    ]);
  };

  const handleToggleSubtaskStatus = async (st: StaffTask) => {
    const newStatus: TaskStatus = st.status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED";
    if (onStatusChange) {
      await onStatusChange(st.id, newStatus);
    }
    setTask((prev) => {
      if (!isSchool || !schoolTask) return prev;
      const updatedSubtasks = schoolTask.subTasks.map((s) =>
        s.id === st.id ? { ...s, status: newStatus } : s
      );
      return {
        ...prev,
        subTasks: updatedSubtasks,
      } as SchoolTask;
    });
  };

  const handleAddDeliverable = async (title: string, fileUrl?: string, notes?: string) => {
    const newDeliv: DeliverableItem = {
      id: `deliv-${Date.now()}`,
      title,
      fileUrl,
      notes,
      uploadedBy: currentUser ? { id: currentUser.id, name: currentUser.name || "Người dùng" } : undefined,
      createdAt: new Date().toISOString(),
      status: "PENDING",
    };

    await fetch(`/api/tasks/${task.id}/deliverables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDeliv),
    });

    setDeliverables((prev) => [newDeliv, ...prev]);
  };

  return (
    <div
      data-slot="linear-task-detail-view"
      className={cn(
        "w-full min-h-screen bg-background text-foreground flex flex-col antialiased",
        className
      )}
    >
      {/* 1. Compact Detail Navigation Header (44-48px) */}
      <TaskDetailHeaderNav
        taskCode={taskCode}
        taskTitle={task.title}
        onBack={onBack}
        showInspector={showInspector}
        onToggleInspector={handleToggleInspector}
        onRefresh={onRefresh}
      />

      {/* 2. Workspace Body: Main Content + Right Properties Inspector */}
      <div className="flex-1 w-full flex flex-col lg:flex-row min-h-0">
        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 max-w-5xl">
          {/* A. Task Identity Block */}
          <TaskIdentityBlock
            task={task}
            canEdit={true}
            onStatusChange={handleStatusChangeInternal}
            onPriorityChange={handlePriorityChangeInternal}
            onTitleChange={handleTitleChangeInternal}
          />

          {/* B. Progress Composer */}
          <TaskProgressComposer
            taskId={task.id}
            initialProgress={currentProgressPercent}
            taskStatus={task.status}
            canEdit={true}
            onProgressUpdated={handleProgressUpdated}
            onStatusChange={handleStatusChangeInternal}
          />

          {/* C. Description Section (Prose with clean readable width) */}
          <section data-slot="task-description-section" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-primary shrink-0" strokeWidth={1.5} />
                <h2 className="text-xs font-semibold text-foreground">
                  Mô tả nhiệm vụ
                </h2>
              </div>
              {!isEditingDescription && (
                <button
                  type="button"
                  onClick={() => setIsEditingDescription(true)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  title="Chỉnh sửa mô tả"
                  aria-label="Chỉnh sửa mô tả"
                >
                  <Edit2 className="size-3.5" strokeWidth={1.5} />
                </button>
              )}
            </div>

            {isEditingDescription ? (
              <div className="space-y-2">
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  rows={4}
                  placeholder="Nhập mô tả chi tiết, hướng dẫn hoặc yêu cầu cụ thể của nhiệm vụ..."
                  className="w-full text-xs text-foreground bg-background p-3 rounded-xl border border-primary focus:ring-2 focus:ring-primary/40 focus:outline-hidden leading-relaxed resize-y"
                  aria-label="Soạn thảo mô tả nhiệm vụ"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveDescription}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-2xs"
                  >
                    <Check className="size-3.5" strokeWidth={1.5} />
                    <span>Lưu mô tả</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingDescription(false);
                      setDescriptionDraft(rawDescription || "");
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-background text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <X className="size-3.5" strokeWidth={1.5} />
                    <span>Hủy</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingDescription(true)}
                className="text-xs text-foreground leading-relaxed p-3.5 rounded-xl border border-border/60 bg-card/40 cursor-pointer hover:border-border transition-colors group/desc"
                title="Nhấp để chỉnh sửa mô tả"
              >
                {rawDescription ? (
                  <p className="whitespace-pre-wrap max-w-4xl text-foreground">
                    {rawDescription}
                  </p>
                ) : (
                  <span className="text-muted-foreground italic">
                    Chưa có mô tả chi tiết cho nhiệm vụ này. Nhấp vào đây để thêm mô tả...
                  </span>
                )}
              </div>
            )}
          </section>

          {/* D. Subtasks Section */}
          <TaskSubtasksSection
            parentId={task.id}
            subTasks={subTasks}
            canEdit={true}
            onToggleSubtask={handleToggleSubtaskStatus}
            onSelectSubtask={onSelectSubTask}
            onAddSubTask={onAddSubTask}
          />

          {/* E. Evidence & Deliverables Section */}
          <TaskEvidenceSection
            taskId={task.id}
            deliverables={deliverables}
            canEdit={true}
            onAddDeliverable={handleAddDeliverable}
          />

          {/* F. Activity & Governance Timeline */}
          <TaskActivityTimeline events={auditEvents} />
        </main>

        {/* Desktop Right Rail Properties Inspector (280-320px) */}
        {showInspector && (
          <div className="hidden lg:block w-[280px] xl:w-[320px] shrink-0 border-l border-border/60 bg-muted/20 p-5 overflow-y-auto">
            <LinearPropertiesSidebar
              task={task}
              currentUser={currentUser}
              onStatusChange={handleStatusChangeInternal}
              onPriorityChange={handlePriorityChangeInternal}
              onDueDateChange={handleDueDateChangeInternal}
              auditEvents={auditEvents as AuditLogItem[]}
              canEdit={true}
            />
          </div>
        )}
      </div>

      {/* Mobile / Tablet Drawer (< 1024px) */}
      <TaskPropertiesDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        task={task}
        currentUser={currentUser}
        onStatusChange={handleStatusChangeInternal}
        onPriorityChange={handlePriorityChangeInternal}
        onDueDateChange={handleDueDateChangeInternal}
        auditEvents={auditEvents as AuditLogItem[]}
      />
    </div>
  );
}
