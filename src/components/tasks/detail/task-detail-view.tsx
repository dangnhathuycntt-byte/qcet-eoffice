"use client";

import * as React from "react";
import {
  FileText,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import { cn } from "@/lib/utils";
import { TaskDetailHeaderNav } from "./task-detail-header-nav";
import { TaskIdentityBlock } from "./task-identity-block";
import { TaskProgressComposer } from "./task-progress-composer";
import { TaskEvidenceSection, type DeliverableItem } from "./task-evidence-section";
import { TaskActivityTimeline, type ActivityEvent } from "./task-activity-timeline";
import { TaskPropertiesSidebar, type AuditLogItem } from "./task-properties-sidebar";
import { TaskPropertiesDrawer } from "./task-properties-drawer";
import { DirectInlineEditor } from "./direct-inline-editor";
import { updateTaskStartDate } from "@/lib/tasks/task-actions";
import { consolidateActivityFeed } from "@/lib/tasks/activity-feed-aggregator";
import { useFeedback } from "@/components/ui/feedback-layer";

export interface TaskDetailViewProps {
  task: SchoolTask | StaffTask;
  taskId: string;
  onStatusChange?: (taskId: string, newStatus: TaskStatus, note?: string) => Promise<void> | void;
  onPriorityChange?: (taskId: string, newPriority: TaskPriority) => Promise<void> | void;
  onDueDateChange?: (taskId: string, newDueDate: string) => Promise<void> | void;
  onStartDateChange?: (taskId: string, newStartDate: string) => Promise<void> | void;
  onTitleChange?: (taskId: string, newTitle: string) => Promise<void> | void;
  onDescriptionChange?: (taskId: string, newDescription: string) => Promise<void> | void;
  onSelectSubTask?: (subTaskOrId: string | StaffTask) => void;
  currentUser?: AuthUser | null;
  auditEvents?: AuditLogItem[] | ActivityEvent[];
  onRefresh?: () => Promise<void> | void;
  onSubmitDeliverable?: (task: SchoolTask | StaffTask) => void;
  onReview?: (task: SchoolTask | StaffTask) => void;
  className?: string;
}

const EMPTY_DELIVERABLES: DeliverableItem[] = [];

export function TaskDetailView({
  task: initialTask,
  taskId,
  onStatusChange,
  onPriorityChange,
  onDueDateChange,
  onStartDateChange,
  onTitleChange,
  onDescriptionChange,
  onSelectSubTask,
  currentUser,
  auditEvents: initialAuditEvents = [],
  onRefresh,
  onSubmitDeliverable,
  onReview,
  className,
}: TaskDetailViewProps) {
  const { notifyError, notifySuccess } = useFeedback();
  const [task, setTask] = React.useState<SchoolTask | StaffTask>(initialTask);
  React.useEffect(() => {
    setTask(initialTask);
  }, [initialTask]);

  const [showInspector, setShowInspector] = React.useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);
  const mainRef = React.useRef<HTMLElement>(null);

  // Local audit events
  const [auditEvents, setAuditEvents] = React.useState<ActivityEvent[]>(initialAuditEvents as ActivityEvent[]);
  React.useEffect(() => {
    setAuditEvents(initialAuditEvents as ActivityEvent[]);
  }, [initialAuditEvents]);

  // Consolidated activity events for clean feed without autosave duplicates
  const feedActivityEvents = React.useMemo(() => {
    return consolidateActivityFeed(auditEvents as any[], 60000);
  }, [auditEvents]);

  const handleToggleInspector = React.useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsMobileDrawerOpen((prev) => !prev);
    } else {
      setShowInspector((prev) => !prev);
    }
  }, []);

  // Keyboard shortcut: Ctrl/Cmd + I toggles inspector
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        if (e.repeat) return;
        e.preventDefault();
        handleToggleInspector();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToggleInspector]);

  const isSchool = isSchoolTask(task);
  const schoolTask = isSchool ? (task as SchoolTask) : null;
  const staffTask = !isSchool ? (task as StaffTask) : null;

  const currentProgressPercent =
    typeof (task as any).progressPercent === "number"
      ? (task as any).progressPercent
      : isSchool
      ? schoolTask?.progress ?? 0
      : 0;

  const rawDescription = isSchool
    ? schoolTask?.description
    : staffTask?.deliverableDescription || (task as any).description;

  // Deliverables / Resources state
  const taskDeliverables = (task as any).deliverables as DeliverableItem[] | undefined;
  const [deliverables, setDeliverables] = React.useState<DeliverableItem[]>(
    taskDeliverables || EMPTY_DELIVERABLES,
  );
  React.useEffect(() => {
    if (Array.isArray(taskDeliverables)) {
      setDeliverables(taskDeliverables);
    }
  }, [taskDeliverables]);

  const handleStatusChangeInternal = React.useCallback(async (taskId: string, newStatus: TaskStatus, note?: string) => {
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
  }, [onStatusChange, currentUser?.name]);

  const handlePriorityChangeInternal = React.useCallback(async (taskId: string, newPriority: TaskPriority) => {
    if (onPriorityChange) {
      await onPriorityChange(taskId, newPriority);
    }
    const cleanPriority: "URGENT" | "HIGH" | "NORMAL" | "LOW" =
      newPriority === "MEDIUM" ? "NORMAL" : newPriority;
    setTask((prev) => ({
      ...prev,
      priority: cleanPriority,
    }));
  }, [onPriorityChange]);

  const handleDueDateChangeInternal = React.useCallback(async (taskId: string, newDueDate: string) => {
    if (onDueDateChange) {
      await onDueDateChange(taskId, newDueDate);
    }
    setTask((prev) => ({
      ...prev,
      dueDate: newDueDate,
    }));
  }, [onDueDateChange]);

  const handleStartDateChangeInternal = React.useCallback(async (taskId: string, newStartDate: string) => {
    if (onStartDateChange) {
      await onStartDateChange(taskId, newStartDate);
    } else {
      const res = await updateTaskStartDate(taskId, newStartDate, (task as any).version);
      if (!res.ok) {
        notifyError(res.error || "Không thể cập nhật ngày bắt đầu", "Lỗi cập nhật");
        return;
      }
      setTask((prev) => ({
        ...prev,
        startDate: newStartDate,
        version: (res.data as any)?.data?.version ?? (res.data as any)?.task?.version ?? (prev as any).version,
      } as any));
    }
  }, [onStartDateChange, task, notifyError]);

  const handleTitleChangeInternal = React.useCallback(async (taskId: string, newTitle: string) => {
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
  }, [onTitleChange]);

  const handleSaveDescription = React.useCallback(async (newDesc: string) => {
    const trimmed = newDesc.trim();
    if (onDescriptionChange) {
      await onDescriptionChange(task.id, trimmed);
    } else {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed }),
      });
      if (!res.ok) {
        throw new Error("Không thể lưu mô tả");
      }
    }
    setTask((prev) => ({
      ...prev,
      description: trimmed,
    }));
  }, [onDescriptionChange, task.id]);

  const handleProgressUpdated = React.useCallback(async (newProgress: number, note?: string) => {
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
  }, [currentUser?.name]);

  const handleCreateSubtaskInline = React.useCallback(async (
    title: string,
    assigneeName?: string,
    dueDate?: string,
    assigneeId?: string
  ) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    let resolvedAssigneeId = assigneeId;
    if (!resolvedAssigneeId && assigneeName) {
      try {
        const cleanName = assigneeName.replace(/^(ThS\.|TS\.|CN\.|BS\.|PGS\.|GS\.|KS\.|GVC\.)\s*/, "").trim();
        const uRes = await fetch(`/api/users?search=${encodeURIComponent(cleanName)}`);
        const uData = await uRes.json();
        if (uData && Array.isArray(uData.users) && uData.users.length > 0) {
          const matched =
            uData.users.find((u: any) => u.departmentId === "BGH" || u.department?.shortName === "BGH") ||
            uData.users.find((u: any) => u.name?.toLowerCase().includes(cleanName.toLowerCase())) ||
            uData.users[0];
          if (matched) resolvedAssigneeId = matched.id;
        }
      } catch {
        // Fallback
      }
    }

    const resolvedDueDate = dueDate || (task as any).dueDate || new Date().toISOString().split("T")[0];

    // Payload adhering strictly to CreateTaskInputSchema
    const payload: Record<string, unknown> = {
      title: trimmedTitle,
      parentTaskId: task.id,
      dueDate: resolvedDueDate,
      priority: "NORMAL",
      scope: isSchool ? "DEPARTMENT" : "INDIVIDUAL",
    };

    if (resolvedAssigneeId) {
      payload.assigneeId = resolvedAssigneeId;
    }
    const deptId = (task as any).departmentId || (task as any).leadDepartmentId;
    if (deptId) {
      payload.departmentId = deptId;
    }

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      let errorMsg = err?.error?.message || err?.message;
      if (err?.details && typeof err.details === "object") {
        const detailList = Object.entries(err.details)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join("; ");
        if (detailList) errorMsg = `${errorMsg || "Lỗi xác thực"}: ${detailList}`;
      }
      throw new Error(errorMsg || "Không thể tạo việc thành phần");
    }

    const data = await res.json();
    const created = data?.task || data?.data;

    if (created) {
      setTask((prev) => {
        if (!isSchool || !schoolTask) return prev;
        const resolvedName =
          created.assigneeName ||
          created.assignee?.name ||
          (resolvedAssigneeId ? assigneeName : undefined) ||
          assigneeName ||
          "Chưa phân công";

        const newSubtask: StaffTask = {
          id: created.id || `sub-${Date.now()}`,
          title: created.title || trimmedTitle,
          assigneeName: resolvedName,
          assigneeId: created.assigneeId || resolvedAssigneeId,
          status: "NEW",
          dueDate: created.dueDate || resolvedDueDate,
          parentSchoolTaskId: task.id,
          parentSchoolTaskTitle: task.title,
          parentSchoolTaskCode: task.code,
          priority: "NORMAL",
          progress: 0,
          updatedAt: new Date().toISOString(),
        } as StaffTask;
        return {
          ...prev,
          subTasks: [...(schoolTask.subTasks || []), newSubtask],
          totalSubTasks: (schoolTask.totalSubTasks || 0) + 1,
        } as SchoolTask;
      });
      notifySuccess("Tạo việc thành phần thành công", "Thành công");
    }
  }, [task, isSchool, schoolTask, notifySuccess]);

  const handleToggleSubtaskStatus = React.useCallback(async (st: StaffTask) => {
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
  }, [onStatusChange, isSchool, schoolTask]);

  const handleAddDeliverable = React.useCallback(async (title: string, fileUrl?: string, notes?: string) => {
    const trimmedTitle = title.trim();
    const trimmedUrl = fileUrl?.trim();

    if (!trimmedTitle) {
      throw new Error("Tên tài liệu minh chứng không được để trống");
    }
    if (!trimmedUrl) {
      throw new Error("Đường dẫn liên kết tài liệu minh chứng là bắt buộc");
    }

    const res = await fetch(`/api/tasks/${task.id}/deliverables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: trimmedTitle,
        fileUrl: trimmedUrl,
        notes: notes?.trim() || undefined,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const errMsg =
        errJson?.error?.message ||
        errJson?.message ||
        (res.status === 403
          ? "Bạn không có quyền nộp tài liệu minh chứng cho nhiệm vụ này (403 Forbidden)"
          : "Không thể thêm tài liệu minh chứng. Vui lòng thử lại");
      throw new Error(errMsg);
    }

    const data = await res.json();
    const created = data?.deliverable || data?.data;

    if (!created || !created.id) {
      throw new Error("Dữ liệu tài liệu phản hồi từ máy chủ không hợp lệ");
    }

    const newDeliv: DeliverableItem = {
      id: created.id,
      title: created.title || trimmedTitle,
      fileUrl: created.fileUrl || trimmedUrl,
      notes: created.notes || notes,
      uploadedBy: currentUser ? { id: currentUser.id, name: currentUser.name || "Người dùng" } : undefined,
      createdAt: created.createdAt || new Date().toISOString(),
      status: created.reviewStatus || "PENDING",
    };

    setDeliverables((prev) => [newDeliv, ...prev]);
  }, [task.id, currentUser]);

  const handleDeleteDeliverable = React.useCallback(async (deliverableId: string) => {
    const previousDeliverables = deliverables;
    setDeliverables((prev) => prev.filter((d) => d.id !== deliverableId));

    try {
      const res = await fetch(
        `/api/tasks/${task.id}/deliverables?deliverableId=${encodeURIComponent(deliverableId)}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const errMsg =
          errJson?.error?.message ||
          errJson?.message ||
          (res.status === 403
            ? "Bạn không có quyền xóa tài liệu minh chứng này (403 Forbidden)"
            : res.status === 404
            ? "Không tìm thấy tài liệu minh chứng cần xóa"
            : "Không thể xóa tài liệu minh chứng. Vui lòng thử lại");
        throw new Error(errMsg);
      }
    } catch (error: unknown) {
      setDeliverables(previousDeliverables);
      notifyError(error instanceof Error ? error.message : "Không thể xóa tài liệu minh chứng", "Lỗi xóa minh chứng");
    }
  }, [task.id, deliverables, notifyError]);

  return (
    <div
      data-slot="task-detail-view"
      className={cn(
        "w-full min-h-screen bg-background text-foreground flex flex-col antialiased",
        className
      )}
    >
      {/* 1. Compact Detail Navigation Header */}
      <TaskDetailHeaderNav
        taskId={taskId}
        showInspector={showInspector}
        onToggleInspector={handleToggleInspector}
      />

      {/* 2. Workspace Body: Main Content + Right Properties Inspector */}
      <div className="flex-1 w-full flex flex-col lg:flex-row min-h-0 overflow-hidden lg:gap-0">
        {/* Main Content Area */}
        <main
          ref={mainRef}
          className="flex-1 min-w-0 overflow-y-auto px-6 py-6 lg:px-10 lg:py-8 space-y-7 max-w-4xl cursor-text"
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target !== mainRef.current) return;
            // Click on main padding → focus description editor at end
            const editable = mainRef.current?.querySelector<HTMLElement>(
              "[data-slot='task-description-section'] [contenteditable], [data-slot='task-description-section'] textarea"
            );
            if (editable) { editable.focus(); return; }
            // Fallback: click the description view to activate it
            const descView = mainRef.current?.querySelector<HTMLElement>(
              "[data-slot='task-description-section'] [class*='cursor-text']"
            );
            descView?.click();
          }}
        >
          {/* A. Task Identity Block */}
          <TaskIdentityBlock
            task={task}
            currentUser={currentUser}
            canEdit={true}
            deliverables={deliverables}
            onStatusChange={handleStatusChangeInternal}
            onPriorityChange={handlePriorityChangeInternal}
            onTitleChange={handleTitleChangeInternal}
            onStartDateChange={handleStartDateChangeInternal}
            onDueDateChange={handleDueDateChangeInternal}
            onAddDeliverable={handleAddDeliverable}
            onDeleteDeliverable={handleDeleteDeliverable}
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
          <section data-slot="task-description-section" className="space-y-2 cursor-text">
            <div className="flex items-center justify-between gap-2 cursor-default">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-primary shrink-0" strokeWidth={1.5} />
                <h2 className="text-xs font-semibold text-foreground">
                  Mô tả nhiệm vụ
                </h2>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border/60 bg-card/40">
              <DirectInlineEditor
                value={rawDescription || ""}
                onSave={handleSaveDescription}
                canEdit={true}
                multiline={true}
                as="div"
                submitOnEnter={false}
                minRows={3}
                ariaLabel="Mô tả nhiệm vụ"
                placeholder="Chưa có mô tả chi tiết cho nhiệm vụ này. Nhấp vào đây để thêm mô tả..."
                viewClassName="text-xs leading-relaxed text-foreground min-h-[48px]"
                editorClassName="text-xs leading-relaxed text-foreground min-h-[48px]"
              />
            </div>
          </section>

          {/* D. Evidence & Deliverables Section */}
          <TaskEvidenceSection
            taskId={task.id}
            deliverables={deliverables}
            canEdit={true}
            onAddDeliverable={handleAddDeliverable}
            onDeleteDeliverable={handleDeleteDeliverable}
          />

          {/* F. Activity & Governance Timeline */}
          <TaskActivityTimeline events={feedActivityEvents as any[]} />
        </main>

        {/* Desktop Right Rail Properties Inspector (280-320px) */}
        <AnimatePresence initial={false}>
          {showInspector && (
            <m.div
              key="inspector-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="hidden lg:block shrink-0 border-l border-border/50 bg-muted/30 overflow-y-auto overflow-x-hidden self-start sticky top-0 max-h-screen"
            >
              <div className="w-[300px] px-5 py-6">
                <TaskPropertiesSidebar
                  task={task}
                  currentUser={currentUser}
                  onStatusChange={handleStatusChangeInternal}
                  onPriorityChange={handlePriorityChangeInternal}
                  onStartDateChange={handleStartDateChangeInternal}
                  onDueDateChange={handleDueDateChangeInternal}
                  auditEvents={feedActivityEvents as AuditLogItem[]}
                  canEdit={true}
                />
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile / Tablet Drawer (< 1024px) */}
      <TaskPropertiesDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        task={task}
        currentUser={currentUser}
        onStatusChange={handleStatusChangeInternal}
        onPriorityChange={handlePriorityChangeInternal}
        onStartDateChange={handleStartDateChangeInternal}
        onDueDateChange={handleDueDateChangeInternal}
        auditEvents={feedActivityEvents as AuditLogItem[]}
      />
    </div>
  );
}
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
