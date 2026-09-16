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

  const [isAddingResource, setIsAddingResource] = React.useState(false);
  const [resourceTitle, setResourceTitle] = React.useState("");
  const [resourceUrl, setResourceUrl] = React.useState("");
  const [resourceNote, setResourceNote] = React.useState("");
  const [isSavingResource, setIsSavingResource] = React.useState(false);

  // Subtask modal state
  const [isCreateSubTaskModalOpen, setIsCreateSubTaskModalOpen] = React.useState(false);

  // Computed fields
  const isSchool = isSchoolTask(task);
  const schoolTask = isSchool ? (task as SchoolTask) : null;
  const staffTask = !isSchool ? (task as StaffTask) : null;

  const taskCode =
    task.code ||
    (isSchool ? schoolTask?.taskCode : staffTask?.taskId) ||
    task.id.slice(0, 8).toUpperCase();

  const subTasks: StaffTask[] = isSchool && Array.isArray(schoolTask?.subTasks) ? schoolTask.subTasks : [];

  const taskDescription = isSchool
    ? schoolTask?.description
    : staffTask?.deliverableDescription || (task as any).description;

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
  const handleAddResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceTitle.trim() && !resourceUrl.trim()) return;

    setIsSavingResource(true);
    try {
      const newDeliverable = {
        id: `res-${Date.now()}`,
        title: resourceTitle.trim() || "Tài liệu minh chứng",
        fileUrl: resourceUrl.trim() || undefined,
        notes: resourceNote.trim() || undefined,
      };

      await fetch(`/api/tasks/${task.id}/deliverables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDeliverable),
      });

      setDeliverables((prev) => [...prev, newDeliverable]);
      setResourceTitle("");
      setResourceUrl("");
      setResourceNote("");
      setIsAddingResource(false);
    } catch {
      // transient
    } finally {
      setIsSavingResource(false);
    }
  };

  return (
    <div
      data-slot="task-workspace"
      className="w-full min-h-screen flex flex-col bg-background text-foreground"
    >
      {/* 1. Header Navigation Bar (48px height, compact, sticky top) */}
      <TaskDetailHeaderNav
        taskCode={taskCode}
        taskTitle={task.title}
        onBack={handleBackToList}
        showInspector={showInspector}
        onToggleInspector={() => setShowInspector((prev) => !prev)}
        onRefresh={() => router.refresh()}
      />

      {/* 2. Sub-Tabs Bar (Overview, Subtasks, Activity) */}
      <nav
        role="tablist"
        aria-label="Các phân mục chi tiết nhiệm vụ"
        className="flex items-center gap-1 px-4 sm:px-6 border-b border-border/60 bg-muted/20 text-xs font-medium sticky top-12 z-20 backdrop-blur-xs"
      >
        <button
          role="tab"
          id="tab-overview"
          aria-selected={activeTab === "overview"}
          aria-controls="panel-overview"
          type="button"
          onClick={() => handleTabChange("overview")}
          className={cn(
            "px-3.5 py-2.5 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden",
            activeTab === "overview"
              ? "border-primary text-primary font-bold bg-background shadow-2xs"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Layers className="size-3.5" strokeWidth={1.5} />
          <span>Tổng quan</span>
        </button>

        <button
          role="tab"
          id="tab-subtasks"
          aria-selected={activeTab === "subtasks"}
          aria-controls="panel-subtasks"
          type="button"
          onClick={() => handleTabChange("subtasks")}
          className={cn(
            "px-3.5 py-2.5 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden",
            activeTab === "subtasks"
              ? "border-primary text-primary font-bold bg-background shadow-2xs"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <ListTodo className="size-3.5" strokeWidth={1.5} />
          <span>Việc thành phần</span>
          {subTasks.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-muted text-[10px] font-mono font-semibold tabular-nums text-foreground">
              {subTasks.length}
            </span>
          )}
        </button>

        <button
          role="tab"
          id="tab-activity"
          aria-selected={activeTab === "activity"}
          aria-controls="panel-activity"
          type="button"
          onClick={() => handleTabChange("activity")}
          className={cn(
            "px-3.5 py-2.5 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden",
            activeTab === "activity"
              ? "border-primary text-primary font-bold bg-background shadow-2xs"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Clock className="size-3.5" strokeWidth={1.5} />
          <span>Nhật ký hoạt động</span>
          {auditEvents.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-muted text-[10px] font-mono font-semibold tabular-nums text-foreground">
              {auditEvents.length}
            </span>
          )}
        </button>
      </nav>

      {/* 3. Main 2-Column Full-Workspace Canvas */}
      <div className="flex-1 flex flex-col md:flex-row min-w-0">
        {/* Left / Center Main Content Canvas */}
        <main
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className={cn(
            "flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto min-w-0 thin-scrollbar",
            showInspector ? "w-full" : "w-full max-w-5xl mx-auto"
          )}
        >
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <>
              {/* Task Identity Block (Code, Scope, Title with Inline Edit, Pinned Status/Progress/Due, Assignee/Dept) */}
              <TaskIdentityBlock
                task={task}
                canEdit={true}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
                onTitleChange={handleTitleChange}
              />

              {/* Task Progress Composer (Visual slider + quick presets + submit note) */}
              <TaskProgressComposer
                taskId={task.id}
                initialProgress={currentProgressPercent}
                taskStatus={task.status}
                canEdit={true}
                onProgressUpdated={handleProgressUpdated}
                onStatusChange={handleStatusChange}
              />

              {/* Task Description Section */}
              <section className="space-y-2 rounded-xl border border-border/70 bg-card/60 p-4 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <FileText className="size-4 text-primary shrink-0" strokeWidth={1.5} />
                  <h2>Mô tả & Hướng dẫn thực hiện</h2>
                </div>
                {taskDescription ? (
                  <div className="text-xs leading-relaxed text-foreground whitespace-pre-wrap pt-1 font-sans">
                    {taskDescription}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic pt-1">
                    Chưa có hướng dẫn hoặc mô tả chi tiết cho nhiệm vụ này.
                  </p>
                )}
              </section>

              {/* Subtasks Section */}
              <TaskSubtasksSection
                parentId={task.id}
                subTasks={subTasks}
                canEdit={true}
                onToggleSubtask={handleToggleSubtask}
                onAddSubTask={() => setIsCreateSubTaskModalOpen(true)}
                onCreateSubTaskInline={handleCreateSubTaskInline}
              />

              {/* Deliverables / Attachments Section */}
              <section className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-4 shadow-2xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Paperclip className="size-4 text-primary shrink-0" strokeWidth={1.5} />
                    <h2 className="text-xs font-semibold text-foreground">
                      Tài liệu & Minh chứng ({deliverables.length})
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddingResource((prev) => !prev)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/80 bg-background hover:bg-muted/80 text-xs font-semibold text-foreground transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="size-3.5 text-primary" strokeWidth={1.5} />
                    <span>Thêm tài liệu</span>
                  </button>
                </div>

                {/* Add Resource Form */}
                {isAddingResource && (
                  <form
                    onSubmit={handleAddResourceSubmit}
                    className="p-3 rounded-xl border border-primary/40 bg-primary/5 space-y-2.5 animate-in fade-in-0 duration-150"
                  >
                    <div className="space-y-1">
                      <input
                        type="text"
                        required
                        autoFocus
                        value={resourceTitle}
                        onChange={(e) => setResourceTitle(e.target.value)}
                        placeholder="Tên tài liệu / Tệp minh chứng đính kèm..."
                        className="w-full text-xs font-medium text-foreground bg-background px-2.5 py-1.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/40 focus:outline-hidden"
                      />
                    </div>
                    <div className="space-y-1">
                      <input
                        type="url"
                        value={resourceUrl}
                        onChange={(e) => setResourceUrl(e.target.value)}
                        placeholder="Liên kết URL (Google Drive, OneDrive, hoặc link tệp)..."
                        className="w-full text-xs font-mono text-foreground bg-background px-2.5 py-1.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/40 focus:outline-hidden"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingResource(false)}
                        className="px-2.5 py-1 rounded-md border border-border bg-background text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingResource}
                        className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                      >
                        {isSavingResource ? "Đang lưu..." : "Lưu tài liệu"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Deliverables List */}
                {deliverables.length === 0 && !isAddingResource ? (
                  <div className="p-3.5 rounded-xl border border-dashed border-border/80 bg-muted/20 text-center">
                    <p className="text-xs text-muted-foreground">
                      Chưa có tệp minh chứng hoặc tài liệu đính kèm nào.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card overflow-hidden">
                    {deliverables.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <FileText className="size-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate">
                              {item.title}
                            </p>
                            {item.notes && (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {item.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {item.fileUrl && (
                          <a
                            href={item.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                          >
                            <span>Mở tệp</span>
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {/* TAB 2: SUBTASKS */}
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
            <section className="space-y-4 rounded-xl border border-border/70 bg-card/60 p-4 sm:p-6 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div>
                  <h2 className="text-xs font-semibold text-foreground">
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
                <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border">
                  {auditEvents.map((evt) => (
                    <div key={evt.id} className="relative flex flex-col gap-0.5 text-xs">
                      <span className="absolute -left-5 top-1 flex size-3 items-center justify-center rounded-full border border-background bg-primary" />
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">
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
                <div className="py-12 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border/80 bg-muted/20">
                  Chưa có lịch sử xử lý nào được ghi nhận cho nhiệm vụ này.
                </div>
              )}
            </section>
          )}
        </main>

        {/* Right Column: Properties Inspector Sidebar */}
        {showInspector && (
          <aside
            aria-label="Cột thuộc tính nhiệm vụ"
            className="w-full md:w-[300px] lg:w-[340px] xl:w-[360px] shrink-0 border-t md:border-t-0 md:border-l border-border/60 bg-muted/10 overflow-y-auto"
          >
            <LinearPropertiesSidebar
              task={task}
              currentUser={currentUser}
              onStatusChange={handleStatusChange}
              onPriorityChange={handlePriorityChange}
              onDueDateChange={handleDueDateChange}
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
          initialParentTaskId={task.id}
          initialLevel="DON_VI"
          onSubmit={async () => {
            setIsCreateSubTaskModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
