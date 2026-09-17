"use client";

import * as React from "react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import styles from "./task-detail-page.module.css";
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
import { useSidebarLayout } from "@/components/layout/sidebar-context";
import { useListScrollRestore } from "@/hooks/use-list-scroll-restore";
import { cn } from "@/lib/utils";
import { formatDetailDate } from "@/components/dashboard/task-detail-side-sheet";
import { TaskDetailHeaderNav } from "@/components/tasks/detail/task-detail-header-nav";
import { TaskIdentityBlock } from "@/components/tasks/detail/task-identity-block";
import { DirectInlineEditor } from "@/components/tasks/detail/direct-inline-editor";
import { TaskProgressComposer } from "@/components/tasks/detail/task-progress-composer";
import { TaskSubtasksSection } from "@/components/tasks/detail/task-subtasks-section";
import { SubtaskDetailDrawer } from "@/components/tasks/detail/subtask-detail-drawer";
import { LinearPropertiesSidebar, type AuditLogItem } from "@/components/tasks/detail/linear-properties-sidebar";
import { CreateTaskModal } from "@/components/dashboard/create-task-modal";
import { updateTaskStatus, updateTaskPriority, updateTaskDueDate, updateTaskStartDate } from "@/lib/tasks/task-actions";
import { consolidateActivityFeed } from "@/lib/tasks/activity-feed-aggregator";

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
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user: clientUser } = useAuth();
  const currentUser = clientUser || serverUser;
  const { setBreadcrumbItems } = useSidebarLayout();

  const { restoreScrollAndNavigateBack } = useListScrollRestore();

  // Task local state
  const [task, setTask] = React.useState<SchoolTask | StaffTask>(initialTask);
  React.useEffect(() => {
    setTask(initialTask);
  }, [initialTask]);

  // Inspector visibility state
  const [showInspector, setShowInspector] = React.useState(true);
  const [isProgressModalOpen, setIsProgressModalOpen] = React.useState(false);
  const [isCreateSubTaskModalOpen, setIsCreateSubTaskModalOpen] = React.useState(false);

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

  // Subtask Drawer State & History Navigation (URL: ?subtaskId=...)
  const initialSubtaskId = searchParams.get("subtaskId");
  const [selectedSubtaskId, setSelectedSubtaskId] = React.useState<string | null>(initialSubtaskId);
  const [subtaskHistory, setSubtaskHistory] = React.useState<string[]>([]);

  // Sync with URL search params changes (e.g. reload or back/forward)
  React.useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const sid = params.get("subtaskId");
      setSelectedSubtaskId(sid || null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  React.useEffect(() => {
    const sid = searchParams.get("subtaskId");
    if (sid && sid !== selectedSubtaskId) {
      setSelectedSubtaskId(sid);
    }
  }, [searchParams, selectedSubtaskId]);

  const updateSubtaskUrl = React.useCallback((subtaskId: string | null) => {
    try {
      if (typeof window === "undefined") return;
      const currentParams = new URLSearchParams(window.location.search);
      if (subtaskId) {
        currentParams.set("subtaskId", subtaskId);
      } else {
        currentParams.delete("subtaskId");
      }
      const newQuery = currentParams.toString();
      const targetUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
      window.history.pushState(null, "", targetUrl);
    } catch {
      // Fallback safe
    }
  }, []);

  const handleOpenSubtaskDrawer = React.useCallback((st: StaffTask) => {
    setSelectedSubtaskId((currentId) => {
      if (currentId && currentId !== st.id) {
        setSubtaskHistory((prev) => [...prev, currentId]);
      }
      return st.id;
    });
    updateSubtaskUrl(st.id);
  }, [updateSubtaskUrl]);

  const handleCloseSubtaskDrawer = React.useCallback(() => {
    setSelectedSubtaskId(null);
    setSubtaskHistory([]);
    updateSubtaskUrl(null);
  }, [updateSubtaskUrl]);

  const handleNavigateBackSubtaskHistory = React.useCallback(() => {
    setSubtaskHistory((prev) => {
      if (prev.length === 0) return prev;
      const prevId = prev[prev.length - 1];
      setSelectedSubtaskId(prevId);
      updateSubtaskUrl(prevId);
      return prev.slice(0, -1);
    });
  }, [updateSubtaskUrl]);

  // Handler toggle Inspector dùng chung cho cả nút bấm và phím tắt
  const handleToggleInspector = React.useCallback(() => {
    setShowInspector((prev) => !prev);
  }, []);

  // Keyboard shortcut: Space hoặc Cmd/Ctrl + I để thu gọn/mở Inspector sidebar
  React.useEffect(() => {
    const isEditable = (el: HTMLElement | null): boolean => {
      if (!el) return false;
      const tagName = el.tagName?.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || tagName === "select") {
        return true;
      }
      if (el.isContentEditable) {
        return true;
      }
      return Boolean(el.closest?.('input, textarea, select, [contenteditable="true"]'));
    };

    const isInteractiveControl = (el: HTMLElement | null): boolean => {
      if (!el) return false;
      const tagName = el.tagName?.toLowerCase();
      if (
        tagName === "button" ||
        tagName === "a" ||
        tagName === "summary" ||
        tagName === "details"
      ) {
        return true;
      }
      const role = el.getAttribute?.("role");
      if (
        role === "button" ||
        role === "tab" ||
        role === "menuitem" ||
        role === "checkbox" ||
        role === "radio" ||
        role === "switch" ||
        role === "slider" ||
        role === "combobox" ||
        role === "listbox" ||
        role === "option"
      ) {
        return true;
      }
      return Boolean(
        el.closest?.(
          'button, a, summary, [role="button"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="slider"]'
        )
      );
    };

    const isDialogOpen = (): boolean => {
      if (typeof document === "undefined") return false;
      return Boolean(
        document.querySelector(
          '[role="dialog"], [role="alertdialog"], [data-state="open"][role="menu"], [data-state="open"][role="listbox"]'
        )
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Phím Space
      if (e.code === "Space" || e.key === " ") {
        // Bỏ qua key repeat
        if (e.repeat) return;
        // Bỏ qua khi đang dùng IME tiếng Việt
        if (e.isComposing || (e as any).nativeEvent?.isComposing || e.keyCode === 229) return;
        // Bỏ qua khi mở dialog/popover
        if (isProgressModalOpen || isCreateSubTaskModalOpen || isDialogOpen()) return;

        const target = (e.target || document.activeElement) as HTMLElement | null;
        // Bỏ qua khi đang nhập liệu
        if (isEditable(target)) return;
        // Bỏ qua khi focus vào control tương tác khác
        if (isInteractiveControl(target)) return;

        // Chỉ preventDefault khi xử lý shortcut
        e.preventDefault();
        handleToggleInspector();
        return;
      }

      // 2. Phím Cmd/Ctrl + I
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        if (e.repeat) return;
        e.preventDefault();
        handleToggleInspector();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToggleInspector, isProgressModalOpen, isCreateSubTaskModalOpen]);

  // Audit events state (raw complete history from backend)
  const [auditEvents, setAuditEvents] = React.useState<AuditLogItem[]>(initialAuditEvents);
  React.useEffect(() => {
    setAuditEvents(initialAuditEvents);
  }, [initialAuditEvents]);

  // Consolidated activity feed: gộp các lần autosave/sửa đổi văn bản liên tiếp trong 60s
  const feedActivityEvents = React.useMemo(() => {
    return consolidateActivityFeed(auditEvents, 60000);
  }, [auditEvents]);

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

  // Computed fields
  const taskCode =
    task.code ||
    (isSchool ? schoolTask?.taskCode : staffTask?.taskId) ||
    task.id.slice(0, 8).toUpperCase();

  React.useEffect(() => {
    setBreadcrumbItems([
      { label: "Nhiệm vụ", href: "/tasks" },
      { label: task.title },
    ]);
    return () => setBreadcrumbItems(null);
  }, [setBreadcrumbItems, task.title]);

  const subTasks: StaffTask[] = isSchool && Array.isArray(schoolTask?.subTasks) ? schoolTask.subTasks : [];

  const activeSubtask = React.useMemo(() => {
    if (!selectedSubtaskId) return null;
    return subTasks.find((st) => st.id === selectedSubtaskId) || null;
  }, [selectedSubtaskId, subTasks]);

  const prevSubtaskId = subtaskHistory.length > 0 ? subtaskHistory[subtaskHistory.length - 1] : null;
  const prevSubtask = React.useMemo(() => {
    if (!prevSubtaskId) return null;
    return subTasks.find((st) => st.id === prevSubtaskId) || null;
  }, [prevSubtaskId, subTasks]);

  const handleSubtaskUpdated = React.useCallback((updated: StaffTask) => {
    setTask((prev) => {
      if (!isSchool || !schoolTask) return prev;
      const updatedSubtasks = schoolTask.subTasks.map((s) =>
        s.id === updated.id ? { ...s, ...updated } : s
      );
      return {
        ...prev,
        subTasks: updatedSubtasks,
      } as SchoolTask;
    });

    if (updated.status === "COMPLETED") {
      const nextSubtasks = subTasks.map((s) => (s.id === updated.id ? updated : s));
      const nextCompleted = nextSubtasks.filter((s) => s.status === "COMPLETED").length;
      const nextProgress = Math.round((nextCompleted / nextSubtasks.length) * 100);
      if (nextProgress === 100 && task.status !== "COMPLETED") {
        handleStatusChange(task.id, "COMPLETED", `Tự động từ hoàn thành toàn bộ việc thành phần`);
      }
    }
  }, [isSchool, schoolTask, subTasks, task.status, task.id]);

  const completedSubtasks = subTasks.filter((subTask) => subTask.status === "COMPLETED").length;
  const currentProgressPercent = subTasks.length > 0
    ? Math.round((completedSubtasks / subTasks.length) * 100)
    : typeof (task as any).progressPercent === "number"
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

      if (!res.ok) throw new Error("Không thể lưu tiêu đề");
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
    } catch (error) {
      throw error;
    }
  };

  // Description save handler
  const handleSaveDescription = async (newDescription: string) => {
    const trimmed = newDescription.trim();
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: trimmed }),
    });

    if (!res.ok) {
      throw new Error("Không thể lưu mô tả");
    }

    setTask((prev) => {
      if (isSchool && schoolTask) {
        return { ...prev, description: trimmed } as SchoolTask;
      }
      return {
        ...prev,
        deliverableDescription: trimmed,
        description: trimmed,
      } as any;
    });

    setAuditEvents((prev) => [
      {
        id: `audit-desc-${Date.now()}`,
        action: "UPDATE_DESCRIPTION",
        timestamp: new Date().toISOString(),
        actorName: currentUser?.name || "Người dùng",
        actorId: currentUser?.id,
        description: `Cập nhật mô tả nhiệm vụ`,
      },
      ...prev,
    ]);
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

  // Start date change handler
  const handleStartDateChange = async (taskId: string, newStartDate: string) => {
    const res = await updateTaskStartDate(taskId, newStartDate);
    if (!res.ok) {
      console.error("Lỗi cập nhật ngày bắt đầu:", res.error);
      return;
    }

    setTask((prev) => ({
      ...prev,
      startDate: newStartDate,
    } as any));

    setAuditEvents((prev) => [
      {
        id: `audit-start-${Date.now()}`,
        action: "UPDATE_START_DATE",
        timestamp: new Date().toISOString(),
        actorName: currentUser?.name || "Người điều hành",
        description: `Cập nhật ngày bắt đầu: ${formatDetailDate(newStartDate)}`,
      },
      ...prev,
    ]);
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
      const nextSubtasks = subTasks.map((subTask) =>
        subTask.id === st.id ? { ...subTask, status: newStatus } : subTask
      );
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

      const nextCompleted = nextSubtasks.filter((subTask) => subTask.status === "COMPLETED").length;
      const nextProgress = Math.round((nextCompleted / nextSubtasks.length) * 100);
      const parentStatus: TaskStatus = nextProgress === 100
        ? "COMPLETED"
        : nextProgress > 0
          ? "IN_PROGRESS"
          : "NOT_STARTED";
      if (parentStatus !== task.status) {
        await handleStatusChange(task.id, parentStatus, `Tự động từ ${nextCompleted}/${nextSubtasks.length} việc thành phần`);
      }
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
      className={styles.workspace}
    >
      {/* 1. Header Navigation Bar (Linear Style) */}
      <TaskDetailHeaderNav
        taskCode={taskCode}
        taskTitle={task.title}
        onBack={handleBackToList}
        showBreadcrumbs={false}
        showInspector={showInspector}
        onToggleInspector={handleToggleInspector}
        onOpenProgressModal={() => setIsProgressModalOpen(true)}
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
          <span>Tổng quan</span>
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
          <span>Hoạt động</span>
          {feedActivityEvents.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-muted text-[10px] font-mono font-medium tabular-nums text-muted-foreground">
              {feedActivityEvents.length}
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
          <span>Việc thành phần</span>
          {subTasks.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-muted text-[10px] font-mono font-medium tabular-nums text-muted-foreground">
              {subTasks.length}
            </span>
          )}
        </button>
      </nav>

      {/* 3. Main 2-Column Canvas Layout */}
      <div className={styles.canvas}>
        {/* Left / Center Main Content Canvas */}
        <m.main
          layout={reduceMotion ? false : "position"}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className={cn(
            styles.content,
            !showInspector && styles.expanded
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
                onStartDateChange={handleStartDateChange}
                onDueDateChange={handleDueDateChange}
                onAddDeliverable={handleAddDeliverable}
                onDeleteDeliverable={handleDeleteDeliverable}
                showInlineProperties={true}
              />



              {/* Description Section (Linear Minimalist Markdown / Text Style) */}
              <section className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-normal text-muted-foreground select-none">
                    Description
                  </h2>
                </div>

                <DirectInlineEditor
                  value={currentDescription}
                  onSave={handleSaveDescription}
                  canEdit={true}
                  multiline={true}
                  as="div"
                  submitOnEnter={false}
                  minRows={2}
                  ariaLabel="Mô tả nhiệm vụ"
                  placeholder="Thêm mô tả nhiệm vụ..."
                  viewClassName="text-sm leading-relaxed text-foreground min-h-[40px] py-1 font-sans"
                  editorClassName="text-sm leading-relaxed text-foreground min-h-[40px] py-1 font-sans placeholder:text-muted-foreground/50 placeholder:italic"
                />
              </section>
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
                onSelectSubtask={(st) => handleOpenSubtaskDrawer(st)}
                onAddSubTask={() => setIsCreateSubTaskModalOpen(true)}
                onCreateSubTaskInline={handleCreateSubTaskInline}
              />
            </div>
          )}

          {/* TAB 3: ACTIVITY FEED & PROGRESS REPORTS */}
          {activeTab === "activity" && (
            <div className="space-y-6">
              {/* Latest Progress Report Banner */}
              <div className="rounded-xl border border-border bg-white p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Báo cáo tiến độ mới nhất</span>
                  <button
                    type="button"
                    onClick={() => setIsProgressModalOpen(true)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                  >
                    Cập nhật tiến độ
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", task.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700")}>
                    <span className="size-1.5 rounded-full bg-current" />
                    <span>{task.status === "COMPLETED" ? "Hoàn thành" : `${currentProgressPercent}%`}</span>
                  </span>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="font-medium text-foreground">{isSchool ? schoolTask?.leadAssigneeName : staffTask?.assigneeName}</span>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="text-muted-foreground text-[11px]">Hôm nay</span>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed font-sans pt-1">
                  {(task as any).latestNote || ((task as any).progressPercent === 100 ? "Nhiệm vụ đã hoàn thành toàn bộ nội dung theo yêu cầu." : "Đang triển khai thực hiện theo kế hoạch phân công.")}
                </p>
              </div>

              {/* Chronological Audit Timeline */}
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
                    {feedActivityEvents.length} mốc
                  </span>
                </div>

                {feedActivityEvents.length > 0 ? (
                  <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border/60">
                    {feedActivityEvents.map((evt) => (
                      <div key={evt.id} className="relative flex flex-col gap-0.5 text-xs">
                        <span className="absolute -left-5 top-1 flex size-2.5 items-center justify-center rounded-full border border-background bg-primary" />
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-foreground">
                              {evt.description || evt.action}
                            </span>
                            {evt.count > 1 && (
                              <span className="px-1.5 py-0.2 rounded-full bg-muted text-[10px] font-mono text-muted-foreground">
                                {evt.count} lần lưu
                              </span>
                            )}
                          </div>
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
            </div>
          )}
                </m.main>

        {/* Right Column: Properties Inspector Sidebar (Linear Style) */}
        {showInspector && (
          <m.aside
            initial={{ opacity: reduceMotion ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            aria-label="Cột thuộc tính nhiệm vụ"
            className={styles.inspector}
          >
            <LinearPropertiesSidebar
              task={task}
              currentUser={currentUser}
              onStatusChange={handleStatusChange}
              onPriorityChange={handlePriorityChange}
              onDueDateChange={handleDueDateChange}
              onNavigateTab={(tab) => handleTabChange(tab)}
              onSelectSubtask={(st) => handleOpenSubtaskDrawer(st)}
              onAddSubTask={() => setIsCreateSubTaskModalOpen(true)}
              auditEvents={feedActivityEvents}
              isMobileAccordion={true}
              showRelatedSections={true}
            />
          </m.aside>
        )}
      </div>

      {/* Subtask Detail Peek Drawer (covers right sidebar area on desktop, full-screen on mobile) */}
      <SubtaskDetailDrawer
        isOpen={Boolean(activeSubtask)}
        onClose={handleCloseSubtaskDrawer}
        subtask={activeSubtask}
        parentTaskTitle={task.title}
        parentTaskCode={taskCode}
        canEdit={true}
        onSubtaskUpdated={handleSubtaskUpdated}
        onOpenAnotherSubtask={handleOpenSubtaskDrawer}
        onNavigateBackHistory={handleNavigateBackSubtaskHistory}
        hasHistoryPrev={subtaskHistory.length > 0}
        historyPrevTitle={prevSubtask?.title}
      />

            {/* Modal Cập nhật tiến độ */}
      {isProgressModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl border border-border shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <span className="text-sm font-semibold text-foreground">Cập nhật tiến độ nhiệm vụ</span>
              <button
                type="button"
                onClick={() => setIsProgressModalOpen(false)}
                className="size-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>

            <TaskProgressComposer
              taskId={task.id}
              initialProgress={currentProgressPercent}
              taskStatus={task.status}
              leadName={isSchool ? schoolTask?.leadAssigneeName : staffTask?.assigneeName}
              completedSubtasks={completedSubtasks}
              totalSubtasks={subTasks.length}
              canEdit={true}
              onProgressUpdated={async (p, note) => {
                await handleProgressUpdated(p, note);
                setIsProgressModalOpen(false);
              }}
              onStatusChange={async (id, st, note) => {
                await handleStatusChange(id, st, note);
                setIsProgressModalOpen(false);
              }}
            />
          </div>
        </div>
      )}

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
