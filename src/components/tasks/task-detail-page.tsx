"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Layers,
  ListTodo,
  Clock,
  FileText,
  Paperclip,
  Plus,
  ExternalLink,
  CheckCircle2,
  Building2,
  User,
  Calendar,
  Edit2,
  Check,
  X,
  Loader2,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import { useAuth } from "@/lib/auth-context";
import { useListScrollRestore } from "@/hooks/use-list-scroll-restore";
import { cn } from "@/lib/utils";
import { formatDetailDate } from "@/components/dashboard/task-detail-side-sheet";
import { TaskDetailHeaderNav } from "@/components/tasks/detail/task-detail-header-nav";
import { TaskIdentityBlock } from "@/components/tasks/detail/task-identity-block";
import { TaskProgressComposer } from "@/components/tasks/detail/task-progress-composer";
import { TaskSubtasksSection } from "@/components/tasks/detail/task-subtasks-section";
import { LinearPropertiesSidebar, type AuditLogItem } from "@/components/tasks/detail/linear-properties-sidebar";
import { CreateTaskModal } from "@/components/dashboard/create-task-modal";
import { updateTaskStatus, updateTaskPriority, updateTaskDueDate } from "@/lib/tasks/task-actions";

export type DetailTab = "overview" | "subtasks" | "activity";

export interface TaskDetailPageProps {
  task: SchoolTask | StaffTask;
  auditEvents?: Array<{
    id: string;
    action: string;
    timestamp: string;
    actorName?: string;
    description?: string;
  }>;
  currentUser?: any;
}

export function TaskDetailPage({
  task: initialTask,
  auditEvents: initialAuditEvents = [],
  currentUser: serverUser,
}: TaskDetailPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user: clientUser } = useAuth();
  const currentUser = clientUser || serverUser;

  const { restoreScrollAndNavigateBack } = useListScrollRestore();

  // Task local state
  const [task, setTask] = React.useState<SchoolTask | StaffTask>(initialTask);
  React.useEffect(() => {
    setTask(initialTask);
  }, [initialTask]);

  // Inspector visibility state
  const [showInspector, setShowInspector] = React.useState(true);

  // Sub-Tabs URL sync (REQ-14)
  const tabParam = searchParams.get("tab");
  const validTab: DetailTab =
    tabParam === "subtasks" || tabParam === "activity" ? tabParam : "overview";

  const [activeTab, setActiveTab] = React.useState<DetailTab>(validTab);
  React.useEffect(() => {
    if (tabParam === "subtasks" || tabParam === "activity" || tabParam === "overview") {
      setActiveTab(tabParam as DetailTab);
    }
  }, [tabParam]);

  const handleTabChange = (newTab: DetailTab) => {
    setActiveTab(newTab);
    try {
      const currentParams = new URLSearchParams(searchParams.toString());
      if (newTab === "overview") {
        currentParams.delete("tab");
      } else {
        currentParams.set("tab", newTab);
      }
      const newQuery = currentParams.toString();
      const targetUrl = newQuery ? `${pathname}?${newQuery}` : pathname;
      window.history.replaceState(null, "", targetUrl);
    } catch {
      // Fallback safe
    }
  };

  // Keyboard shortcut: Cmd/Ctrl + I toggle Inspector
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setShowInspector((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Audit events state
  const [auditEvents, setAuditEvents] = React.useState<AuditLogItem[]>(initialAuditEvents);
  React.useEffect(() => {
    setAuditEvents(initialAuditEvents);
  }, [initialAuditEvents]);

  // Deliverables / Resources state
  const initialDeliverables = (task as any).deliverables || [];
  const [deliverables, setDeliverables] = React.useState<
    Array<{ id: string; title: string; fileUrl?: string; notes?: string }>
  >(initialDeliverables);
  React.useEffect(() => {
    if (Array.isArray((task as any).deliverables)) {
      setDeliverables((task as any).deliverables);
    }
  }, [task]);

  // Description inline edit state
  const isSchool = isSchoolTask(task);
  const schoolTask = isSchool ? (task as SchoolTask) : null;
  const staffTask = !isSchool ? (task as StaffTask) : null;

  const currentDescription = isSchool
    ? schoolTask?.description || ""
    : staffTask?.deliverableDescription || (task as any).description || "";

  const [descriptionDraft, setDescriptionDraft] = React.useState(currentDescription);
  const [isEditingDescription, setIsEditingDescription] = React.useState(false);
  const [isSavingDescription, setIsSavingDescription] = React.useState(false);

  React.useEffect(() => {
    setDescriptionDraft(currentDescription);
  }, [currentDescription]);

  // Subtask modal state
  const [isCreateSubTaskModalOpen, setIsCreateSubTaskModalOpen] = React.useState(false);

  // Computed fields
  const taskCode =
    task.code ||
    (isSchool ? schoolTask?.taskCode : staffTask?.taskId) ||
    task.id.slice(0, 8).toUpperCase();

  const subTasks: StaffTask[] = isSchool && Array.isArray(schoolTask?.subTasks) ? schoolTask.subTasks : [];

  const currentProgressPercent =
    typeof (task as any).progressPercent === "number"
      ? (task as any).progressPercent
      : isSchool
      ? schoolTask?.progress ?? 0
      : 0;

  // Return to task list with preserved scroll & filters (REQ-12)
  const handleBackToList = () => {
    restoreScrollAndNavigateBack("/tasks");
  };

  // Title inline change handler
  const handleTitleChange = async (taskId: string, newTitle: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });

      if (res.ok) {
        setTask((prev) => ({ ...prev, title: newTitle }));
        setAuditEvents((prev) => [
          {
            id: `audit-title-${Date.now()}`,
            action: "UPDATE_TITLE",
            timestamp: new Date().toISOString(),
            actorName: currentUser?.name || "Người dùng",
            description: `Đổi tiêu đề nhiệm vụ thành: "${newTitle}"`,
          },
          ...prev,
        ]);
        router.refresh();
      }
    } catch {
      // safe fallback
    }
  };

  // Description save handler
  const handleSaveDescription = async () => {
    setIsSavingDescription(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: descriptionDraft.trim() }),
      });

      if (res.ok) {
        setTask((prev) => {
          if (isSchool && schoolTask) {
            return { ...prev, description: descriptionDraft.trim() } as SchoolTask;
          }
          return { ...prev, deliverableDescription: descriptionDraft.trim(), description: descriptionDraft.trim() } as any;
        });
        setIsEditingDescription(false);
      }
    } catch {
      // safe fallback
    } finally {
      setIsSavingDescription(false);
    }
  };

  // Status change handler (REQ-20)
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus, note?: string) => {
    const res = await updateTaskStatus(taskId, newStatus, note);
    if (!res.ok) {
      console.error("Lỗi cập nhật trạng thái:", res.error);
      return;
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
        description: `Đổi trạng thái sang: ${
          newStatus === "COMPLETED"
            ? "Hoàn thành"
            : newStatus === "IN_PROGRESS"
            ? "Đang thực hiện"
            : newStatus === "WAITING_APPROVAL"
            ? "Chờ duyệt"
            : "Chưa bắt đầu"
        }${note ? ` (${note})` : ""}`,
      },
      ...prev,
    ]);
  };

  // Priority change handler (REQ-20)
  const handlePriorityChange = async (taskId: string, newPriority: TaskPriority) => {
    const res = await updateTaskPriority(taskId, newPriority);
    if (!res.ok) {
      console.error("Lỗi cập nhật độ ưu tiên:", res.error);
      return;
    }

    const normalizedPriority = (newPriority === "MEDIUM" ? "NORMAL" : newPriority) as any;
    setTask((prev) => ({
      ...prev,
      priority: normalizedPriority,
    }));
  };

  // Due date change handler (REQ-20)
  const handleDueDateChange = async (taskId: string, newDueDate: string) => {
    const res = await updateTaskDueDate(taskId, newDueDate);
    if (!res.ok) {
      console.error("Lỗi cập nhật hạn hoàn thành:", res.error);
      return;
    }

    setTask((prev) => ({
      ...prev,
      dueDate: newDueDate,
    }));

    setAuditEvents((prev) => [
      {
        id: `audit-due-${Date.now()}`,
        action: "UPDATE_DUE_DATE",
        timestamp: new Date().toISOString(),
        actorName: currentUser?.name || "Người điều hành",
        description: `Gia hạn thời hạn hoàn thành: ${formatDetailDate(newDueDate)}`,
      },
      ...prev,
    ]);
  };

  // Progress updated handler
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

  // Subtask toggle status handler
  const handleToggleSubtask = async (st: StaffTask) => {
    const newStatus: TaskStatus = st.status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED";
    const res = await updateTaskStatus(st.id, newStatus);
    if (res.ok) {
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
    }
  };

  // Inline subtask creation handler
  const handleCreateSubTaskInline = async (title: string, assigneeName?: string, dueDate?: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          parentTaskId: task.id,
          dueDate: dueDate || task.dueDate,
          scope: "DEPARTMENT",
          priority: "NORMAL",
        }),
      });

      if (res.ok) {
        router.refresh();
      }
    } catch {
      // safe fallback
    }
  };

  // Deliverables add handler
  const handleAddDeliverable = async (title: string, fileUrl?: string, notes?: string) => {
    const newDeliverable = {
      id: `res-${Date.now()}`,
      title: title.trim() || "Tài liệu minh chứng",
      fileUrl: fileUrl?.trim() || undefined,
      notes: notes?.trim() || undefined,
    };

    await fetch(`/api/tasks/${task.id}/deliverables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDeliverable),
    });

    setDeliverables((prev) => [...prev, newDeliverable]);
  };

  // Deliverables delete handler
  const handleDeleteDeliverable = async (deliverableId: string) => {
    try {
      await fetch(`/api/tasks/${task.id}/deliverables?deliverableId=${deliverableId}`, {
        method: "DELETE",
      });
    } catch {
      // transient
    }
    setDeliverables((prev) => prev.filter((d) => d.id !== deliverableId));
  };

  return (
    <div
      data-slot="task-workspace"
      className="w-full min-h-screen flex flex-col bg-background text-foreground"
    >
      {/* 1. Header Navigation Bar (Linear Style) */}
      <TaskDetailHeaderNav
        taskCode={taskCode}
        taskTitle={task.title}
        onBack={handleBackToList}
        showInspector={showInspector}
        onToggleInspector={() => setShowInspector((prev) => !prev)}
        onRefresh={() => router.refresh()}
      />

      {/* 2. Sub-Tabs Bar (Linear Style: Overview, Activity, Issues) */}
      <nav
        role="tablist"
        aria-label="Các phân mục chi tiết nhiệm vụ"
        className="flex items-center gap-1 px-4 sm:px-6 border-b border-border/40 bg-background/90 text-xs font-medium sticky top-12 z-20 backdrop-blur-md select-none"
      >
        <button
          role="tab"
          id="tab-overview"
          aria-selected={activeTab === "overview"}
          aria-controls="panel-overview"
          type="button"
          onClick={() => handleTabChange("overview")}
          className={cn(
            "px-3 py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:outline-hidden",
            activeTab === "overview"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <span>Overview</span>
        </button>

        <button
          role="tab"
          id="tab-activity"
          aria-selected={activeTab === "activity"}
          aria-controls="panel-activity"
          type="button"
          onClick={() => handleTabChange("activity")}
          className={cn(
            "px-3 py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:outline-hidden",
            activeTab === "activity"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <span>Activity</span>
          {auditEvents.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-muted text-[10px] font-mono font-medium tabular-nums text-muted-foreground">
              {auditEvents.length}
            </span>
          )}
        </button>

        <button
          role="tab"
          id="tab-subtasks"
          aria-selected={activeTab === "subtasks"}
          aria-controls="panel-subtasks"
          type="button"
          onClick={() => handleTabChange("subtasks")}
          className={cn(
            "px-3 py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:outline-hidden",
            activeTab === "subtasks"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <span>Issues</span>
          {subTasks.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-muted text-[10px] font-mono font-medium tabular-nums text-muted-foreground">
              {subTasks.length}
            </span>
          )}
        </button>
      </nav>

      {/* 3. Main 2-Column Canvas Layout */}
      <div className="flex-1 flex flex-col md:flex-row min-w-0">
        {/* Left / Center Main Content Canvas */}
        <main
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className={cn(
            "flex-1 p-6 sm:p-8 lg:p-10 space-y-8 overflow-y-auto min-w-0 thin-scrollbar",
            showInspector ? "w-full max-w-4xl" : "w-full max-w-5xl mx-auto"
          )}
        >
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <>
              {/* Task Identity Block (Icon, Title, Subtitle, Linear Properties Row, Resources Row) */}
              <TaskIdentityBlock
                task={task}
                canEdit={true}
                deliverables={deliverables}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
                onTitleChange={handleTitleChange}
                onAddDeliverable={handleAddDeliverable}
                onDeleteDeliverable={handleDeleteDeliverable}
              />

              {/* Task Progress Composer (Linear "Latest update" block) */}
              <TaskProgressComposer
                taskId={task.id}
                initialProgress={currentProgressPercent}
                taskStatus={task.status}
                leadName={isSchool ? schoolTask?.leadAssigneeName : staffTask?.assigneeName}
                canEdit={true}
                onProgressUpdated={handleProgressUpdated}
                onStatusChange={handleStatusChange}
              />

              {/* Description Section (Linear Minimalist Markdown / Text Style) */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-foreground tracking-tight">
                    Description
                  </h2>
                  {!isEditingDescription && (
                    <button
                      type="button"
                      onClick={() => setIsEditingDescription(true)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                    >
                      <Edit2 className="size-3" strokeWidth={1.5} />
                      <span>Sửa mô tả</span>
                    </button>
                  )}
                </div>

                {isEditingDescription ? (
                  <div className="space-y-2 pt-1 animate-in fade-in-0 duration-150">
                    <textarea
                      value={descriptionDraft}
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                      rows={5}
                      placeholder="Nhập mô tả hoặc hướng dẫn thực hiện nhiệm vụ..."
                      className="w-full text-sm leading-relaxed text-foreground bg-background p-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/40 focus:outline-hidden font-sans resize-y"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDescriptionDraft(currentDescription);
                          setIsEditingDescription(false);
                        }}
                        disabled={isSavingDescription}
                        className="px-3 py-1 rounded-md border border-border bg-background text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveDescription}
                        disabled={isSavingDescription}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingDescription ? (
                          <>
                            <Loader2 className="size-3 animate-spin" />
                            <span>Đang lưu...</span>
                          </>
                        ) : (
                          <>
                            <Check className="size-3.5" strokeWidth={1.5} />
                            <span>Lưu mô tả</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsEditingDescription(true)}
                    className="text-sm leading-relaxed text-foreground/90 font-sans whitespace-pre-wrap rounded-lg hover:bg-muted/20 p-1 -m-1 transition-colors cursor-pointer"
                    title="Nhấp để sửa mô tả"
                  >
                    {currentDescription || (
                      <p className="text-muted-foreground/70 italic text-xs">
                        Chưa có mô tả chi tiết. Nhấp để thêm mô tả...
                      </p>
                    )}
                  </div>
                )}
              </section>

              {/* Subtasks / Issues Section */}
              <TaskSubtasksSection
                parentId={task.id}
                subTasks={subTasks}
                canEdit={true}
                onToggleSubtask={handleToggleSubtask}
                onAddSubTask={() => setIsCreateSubTaskModalOpen(true)}
                onCreateSubTaskInline={handleCreateSubTaskInline}
              />
            </>
          )}

          {/* TAB 2: ISSUES / SUBTASKS */}
          {activeTab === "subtasks" && (
            <div className="space-y-4">
              <TaskSubtasksSection
                parentId={task.id}
                subTasks={subTasks}
                canEdit={true}
                onToggleSubtask={handleToggleSubtask}
                onAddSubTask={() => setIsCreateSubTaskModalOpen(true)}
                onCreateSubTaskInline={handleCreateSubTaskInline}
              />
            </div>
          )}

          {/* TAB 3: ACTIVITY FEED */}
          {activeTab === "activity" && (
            <section className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div>
                  <h2 className="text-xs font-semibold text-foreground tracking-tight">
                    Nhật ký xử lý & Lịch sử hoạt động
                  </h2>
                  <p className="text-xs text-muted-foreground pt-0.5">
                    Ghi nhận đầy đủ các mốc giao việc, cập nhật tiến độ, phê duyệt và thay đổi thời hạn.
                  </p>
                </div>
                <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md tabular-nums">
                  {auditEvents.length} mốc
                </span>
              </div>

              {auditEvents.length > 0 ? (
                <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border/60">
                  {auditEvents.map((evt) => (
                    <div key={evt.id} className="relative flex flex-col gap-0.5 text-xs">
                      <span className="absolute -left-5 top-1 flex size-2.5 items-center justify-center rounded-full border border-background bg-primary" />
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium text-foreground">
                          {evt.description || evt.action}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          {formatDetailDate(evt.timestamp)}
                        </span>
                      </div>
                      {evt.actorName && (
                        <span className="text-[11px] text-muted-foreground">
                          Người thao tác: {evt.actorName}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border/60">
                  Chưa có lịch sử xử lý nào được ghi nhận cho nhiệm vụ này.
                </div>
              )}
            </section>
          )}
        </main>

        {/* Right Column: Properties Inspector Sidebar (Linear Style) */}
        {showInspector && (
          <aside
            aria-label="Cột thuộc tính nhiệm vụ"
            className="w-full md:w-[280px] lg:w-[320px] shrink-0 border-t md:border-t-0 md:border-l border-border/40 bg-background overflow-y-auto"
          >
            <LinearPropertiesSidebar
              task={task}
              currentUser={currentUser}
              onStatusChange={handleStatusChange}
              onPriorityChange={handlePriorityChange}
              onDueDateChange={handleDueDateChange}
              onNavigateTab={(tab) => handleTabChange(tab)}
              auditEvents={auditEvents}
              isMobileAccordion={true}
            />
          </aside>
        )}
      </div>

      {/* Modal Add SubTask */}
      {isCreateSubTaskModalOpen && (
        <CreateTaskModal
          isOpen={isCreateSubTaskModalOpen}
          onClose={() => setIsCreateSubTaskModalOpen(false)}
          onSubmitSuccess={() => {
            setIsCreateSubTaskModalOpen(false);
            router.refresh();
          }}
          initialParentTaskId={task.id}
          initialParentTaskTitle={task.title}
          initialLevel="DON_VI"
        />
      )}
    </div>
  );
}
