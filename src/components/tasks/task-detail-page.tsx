"use client";

// Task Detail Workspace Component - Full Linear & Notion-style Canvas with ReBAC & Progress Integration
import * as React from "react";
import styles from "./task-detail-page.module.css";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import { useAuth } from "@/lib/auth-context";
import { useSidebarLayout } from "@/components/layout/sidebar-context";
import { useListScrollRestore } from "@/hooks/use-list-scroll-restore";
import { cn } from "@/lib/utils";
import { formatDetailDate } from "@/lib/task-detail-helpers";
import { TaskDetailHeaderNav } from "@/components/tasks/detail/task-detail-header-nav";
import { TaskIdentityBlock } from "@/components/tasks/detail/task-identity-block";
import { DirectInlineEditor } from "@/components/tasks/detail/direct-inline-editor";
import { TaskProgressComposer } from "@/components/tasks/detail/task-progress-composer";
import { SubtaskDetailDrawer } from "@/components/tasks/detail/subtask-detail-drawer";
import { DEFAULT_PEEK_WIDTH, MIN_PEEK_WIDTH, MAX_PEEK_WIDTH } from "./detail/subtask-peek-layout";
import { TaskNotionBlockContent } from "@/components/tasks/detail/task-notion-block-content";
import { TaskDetailSplitLayout } from "@/components/tasks/detail/task-detail-split-layout";
import { LinearPropertiesSidebar, type AuditLogItem } from "@/components/tasks/detail/linear-properties-sidebar";
import { LinearCreateTaskModal } from "@/components/tasks/create/linear-create-task-modal";
import { updateTaskStatus, updateTaskProgress, updateTaskPriority, updateTaskDueDate, updateTaskStartDate } from "@/lib/tasks/task-actions";
import { consolidateActivityFeed, getAuditActionLabel } from "@/lib/tasks/activity-feed-aggregator";
import { useFeedback } from "@/components/ui/feedback-layer";

export type DetailTab = "overview" | "activity";

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
  canEdit?: boolean;
  /** Independently authorized peek targets (descendants with availableActions) */
  peekTasks?: StaffTask[];
}

const PEEK_STORAGE_KEY = "qcet_subtask_peek_width";

export function TaskDetailPage({
  task: initialTask,
  auditEvents: initialAuditEvents = [],
  currentUser: serverUser,
  canEdit = false,
  peekTasks: _peekTasks,
}: TaskDetailPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user: clientUser } = useAuth();
  const currentUser = clientUser || serverUser;
  const { setBreadcrumbItems } = useSidebarLayout();

  const { restoreScrollAndNavigateBack } = useListScrollRestore();
  const { notifySuccess, notifyError, notifyWarning } = useFeedback();

  // Task local state
  const [task, setTask] = React.useState<SchoolTask | StaffTask>(initialTask);
  const [isStatusUpdating, setIsStatusUpdating] = React.useState(false);
  React.useEffect(() => {
    setTask(initialTask);
  }, [initialTask]);

  // Inspector visibility state
  const [inspectorExpanded, setShowInspector] = React.useState(true);
  const [isProgressModalOpen, setIsProgressModalOpen] = React.useState(false);

  // Sub-Tabs URL sync (REQ-14)
  const tabParam = searchParams.get("tab");
  const validTab: DetailTab =
    tabParam === "activity" ? tabParam : "overview";

  const [activeTab, setActiveTab] = React.useState<DetailTab>(validTab);
  const canvasRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    if (canvasRef.current) canvasRef.current.scrollTop = 0;
  }, [activeTab]);
  React.useEffect(() => {
    if (tabParam === "activity" || tabParam === "overview") {
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

  // Subtask Drawer State (URL: ?subtaskId=...)
  const initialSubtaskId = searchParams.get("subtaskId");
  const [selectedSubtaskId, setSelectedSubtaskId] = React.useState<string | null>(initialSubtaskId);

  // Persistent peek drawer width (Notion / Linear Resizable Side Peek)
  const [peekWidth, setPeekWidth] = React.useState<number>(DEFAULT_PEEK_WIDTH);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(PEEK_STORAGE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_PEEK_WIDTH && parsed <= MAX_PEEK_WIDTH) {
          setPeekWidth(parsed);
        }
      }
    } catch {}
  }, []);

  const handlePeekWidthChange = React.useCallback((width: number, persist = true) => {
    setPeekWidth(width);
    if (!persist) return;
    try {
      localStorage.setItem(PEEK_STORAGE_KEY, String(width));
    } catch {}
  }, []);

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
    setSelectedSubtaskId(st.id);
    updateSubtaskUrl(st.id);
  }, [updateSubtaskUrl]);

  const handleCloseSubtaskDrawer = React.useCallback(() => {
    setSelectedSubtaskId(null);
    updateSubtaskUrl(null);
  }, [updateSubtaskUrl]);

  // Handler toggle Inspector dùng chung cho cả nút bấm và phím tắt
  const handleToggleInspector = React.useCallback(() => {
    setShowInspector((prev) => !prev);
  }, []);

  // Create subtask modal state
  const [isCreateSubtaskOpen, setIsCreateSubtaskOpen] = React.useState(false);
  const handleAddSubtask = React.useCallback(() => setIsCreateSubtaskOpen(true), []);

  // Keyboard shortcut: Cmd/Ctrl + I để thu gọn/mở Inspector sidebar
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
      const tag = el.tagName?.toLowerCase();
      return tag === "button" || tag === "a" || el.getAttribute("role") === "button" || el.getAttribute("role") === "menuitem" || el.getAttribute("role") === "option";
    };
    const isDialogOpen = (): boolean => Boolean(document.querySelector('[role="dialog"]:not([hidden]), [role="menu"]:not([hidden]), [data-state="open"]'));



    const handleKeyDown = (e: KeyboardEvent) => {
      const focused = document.activeElement as HTMLElement | null;
      const target = e.target as HTMLElement | null;
      if (
        e.defaultPrevented || e.isComposing || e.keyCode === 229 ||
        isEditable(target) || isEditable(focused) ||
        target?.closest?.('[data-slot="task-notion-block-content"]')
      ) return;

      // Phím Cmd/Ctrl + I
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        if (e.repeat) return;
        e.preventDefault();
        handleToggleInspector();
      }
      // Space to toggle inspector
      if (e.code === "Space" || e.key === " ") {
        if (e.repeat) return;
        if (isInteractiveControl(target) || isInteractiveControl(focused)) return;
        if (isDialogOpen()) return;
        e.preventDefault();
        handleToggleInspector();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToggleInspector]);

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
  const officialCode = task.code || (isSchool ? schoolTask?.taskCode : staffTask?.taskId);
  const taskCode = officialCode || task.id.slice(0, 8).toUpperCase();

  const parentTaskId = (task as any).parentSchoolTaskId || (task as any).parentTaskId || (task as any).parentTask?.id;
  const parentTaskTitle = (task as any).parentSchoolTaskTitle || (task as any).parentTaskTitle || (task as any).parentTask?.title;
  const parentTaskCode = (task as any).parentSchoolTaskCode || (task as any).parentTaskCode || (task as any).parentTask?.code;

  React.useEffect(() => {
    const items: Array<{ label: string; href?: string; mono?: boolean }> = [
      { label: "Nhiệm vụ", href: "/tasks" },
    ];
    if (parentTaskId) {
      items.push({
        label: parentTaskCode || parentTaskTitle || "Nhiệm vụ cha",
        href: `/tasks/${parentTaskId}`,
        mono: Boolean(parentTaskCode),
      });
    }
    // Ưu tiên hiển thị mã nhiệm vụ chính thức (NV-...), nếu chưa có mã thì hiển thị tiêu đề
    items.push({
      label: officialCode || task.title,
      mono: Boolean(officialCode),
    });
    setBreadcrumbItems(items);
    return () => setBreadcrumbItems(null);
  }, [setBreadcrumbItems, officialCode, task.title, parentTaskId, parentTaskCode, parentTaskTitle]);

  const subTasks: StaffTask[] = isSchool && Array.isArray(schoolTask?.subTasks) ? schoolTask.subTasks : [];

  const activeSubtask = React.useMemo(() => {
    if (!selectedSubtaskId) return null;
    return subTasks.find((st) => st.id === selectedSubtaskId) || null;
  }, [selectedSubtaskId, subTasks]);

  const showInspector = inspectorExpanded && !activeSubtask;

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
        body: JSON.stringify({ title: newTitle, expectedVersion: (task as any).version }),
      });

      if (!res.ok) throw new Error("Không thể lưu tiêu đề");
      if (res.ok) {
        const payload = await res.json().catch(() => null);
        setTask((prev) => ({ ...prev, title: newTitle }));
        if (payload?.data?.version ?? payload?.task?.version) {
          setTask((prev) => ({
            ...prev,
            version: payload?.data?.version ?? payload?.task?.version,
          } as any));
        }
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
      body: JSON.stringify({ description: trimmed, expectedVersion: (task as any).version }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const serverMsg = errBody?.error || errBody?.message || "";
      throw new Error(serverMsg || "Không thể lưu mô tả");
    }

    const payload = await res.json().catch(() => null);
    setTask((prev) => {
      if (isSchool && schoolTask) {
        return { ...prev, description: trimmed, version: payload?.data?.version ?? payload?.task?.version ?? (prev as any).version } as any;
      }
      return {
        ...prev,
        deliverableDescription: trimmed,
        description: trimmed,
        version: payload?.data?.version ?? payload?.task?.version ?? (prev as any).version,
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

  // Status change handler (REQ-20 & State Machine Integration)
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus, note?: string) => {
    if (isStatusUpdating) return;
    setIsStatusUpdating(true);

    const previousTask = task;
    const previousAudit = auditEvents;

    const statusMap: Record<string, string> = {
      NOT_STARTED: "Mới",
      IN_PROGRESS: "Đang thực hiện",
      WAITING_APPROVAL: "Chờ duyệt",
      COMPLETED: "Hoàn thành",
      CANCELLED: "Đã hủy",
    };
    const targetLabel = statusMap[newStatus] || newStatus;
    const fromLabel = statusMap[previousTask.status] || previousTask.status;

    // Optimistic Update
    setTask((prev) => ({
      ...prev,
      status: newStatus,
      ...(newStatus === "COMPLETED"
        ? { progressPercent: 100, progress: 100 }
        : newStatus === "NOT_STARTED"
        ? { progressPercent: 0, progress: 0 }
        : {}),
    }));

    try {
      const res = await updateTaskStatus(taskId, newStatus, note, (task as any).version);
      if (!res.ok) {
        // Rollback state
        setTask(previousTask);
        setAuditEvents(previousAudit);

        const errorReason = res.reason || res.error || "Không thể chuyển trạng thái nhiệm vụ";
        notifyError(errorReason, "Không thể đổi trạng thái");
        return;
      }

      // Success - update version & verified status from server
      if (res.data) {
        setTask((prev) => ({
          ...prev,
          version: res.data?.version ?? ((prev as any).version ? (prev as any).version + 1 : 1),
          status: res.data?.status ?? newStatus,
          ...(res.data?.progressPercent !== undefined
            ? { progressPercent: res.data.progressPercent, progress: res.data.progressPercent }
            : {}),
        }));
      }

      setAuditEvents((prev) => [
        {
          id: `audit-${Date.now()}`,
          action: "TASK_STATUS_CHANGED",
          timestamp: new Date().toISOString(),
          actorName: currentUser?.name || "Người dùng",
          description: `Chuyển trạng thái từ '${fromLabel}' sang '${targetLabel}'${note ? ` (${note})` : ""}`,
        },
        ...prev,
      ]);

      notifySuccess(`Đã chuyển trạng thái sang "${targetLabel}"`);
      router.refresh();
    } catch (err: unknown) {
      setTask(previousTask);
      setAuditEvents(previousAudit);
      notifyError(err instanceof Error ? err.message : String(err) || "Lỗi kết nối máy chủ", "Lỗi thao tác");
    } finally {
      setIsStatusUpdating(false);
    }
  };

  // Priority change handler (REQ-20)
  const handlePriorityChange = async (taskId: string, newPriority: TaskPriority) => {
    const res = await updateTaskPriority(taskId, newPriority, (task as any).version);
    if (!res.ok) {
      notifyError(res.error || "Không thể cập nhật độ ưu tiên", "Lỗi cập nhật");
      return;
    }

    const normalizedPriority = (newPriority === "MEDIUM" ? "NORMAL" : newPriority) as any;
    setTask((prev) => ({
      ...prev,
      priority: normalizedPriority,
      version: (res.data as any)?.data?.version ?? (res.data as any)?.task?.version ?? (prev as any).version,
    }));
    notifySuccess("Đã cập nhật độ ưu tiên");
    router.refresh();
  };

  // Start date change handler
  const handleStartDateChange = async (taskId: string, newStartDate: string) => {
    const res = await updateTaskStartDate(taskId, newStartDate, (task as any).version);
    if (!res.ok) {
      notifyError(res.error || "Không thể cập nhật ngày bắt đầu", "Lỗi cập nhật");
      return;
    }

    setTask((prev) => ({
      ...prev,
      startDate: newStartDate,
      assignedDate: newStartDate,
      version: (res.data as any)?.data?.version ?? (res.data as any)?.task?.version ?? (prev as any).version,
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
    notifySuccess("Đã cập nhật ngày bắt đầu");
    router.refresh();
  };

  // Due date change handler (REQ-20)
  const handleDueDateChange = async (taskId: string, newDueDate: string) => {
    const res = await updateTaskDueDate(taskId, newDueDate, (task as any).version);
    if (!res.ok) {
      notifyError(res.error || "Không thể cập nhật hạn hoàn thành", "Lỗi cập nhật");
      return;
    }

    setTask((prev) => ({
      ...prev,
      dueDate: newDueDate,
      version: (res.data as any)?.data?.version ?? (res.data as any)?.task?.version ?? (prev as any).version,
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
    notifySuccess("Đã cập nhật hạn hoàn thành");
    router.refresh();
  };

  // Reassign Lead / DRI handler
  const handleReassignLead = async (personId: string, personName: string) => {
    const res = await fetch(`/api/tasks/${task.id}/actions/reassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newAssigneeId: personId,
        newAssigneeName: personName,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const errMsg =
        errJson?.error?.message ||
        errJson?.message ||
        (res.status === 403
          ? "Bạn không có quyền chuyển giao người phụ trách (403 Forbidden)"
          : "Không thể chuyển giao người phụ trách. Vui lòng thử lại");
      throw new Error(errMsg);
    }

    setTask((prev) => ({
      ...prev,
      assignedTo: personName,
      leadAssigneeName: personName,
      leadAssigneeId: personId,
      assigneeName: personName,
      assigneeId: personId,
    } as any));

    setAuditEvents((prev) => [
      {
        id: `audit-reassign-${Date.now()}`,
        action: "REASSIGN_LEAD",
        timestamp: new Date().toISOString(),
        actorName: currentUser?.name || "Người điều hành",
        description: `Chuyển giao người phụ trách cho: ${personName}`,
      },
      ...prev,
    ]);

    router.refresh();
  };

  // Progress updated handler
  const handleProgressUpdated = async (newProgress: number, note?: string) => {
    const derivedStatus: TaskStatus =
      newProgress === 100
        ? "WAITING_APPROVAL"
        : newProgress > 0
        ? "IN_PROGRESS"
        : "NOT_STARTED";

    setTask((prev) => ({
      ...prev,
      progressPercent: newProgress,
      progress: newProgress,
      status: derivedStatus,
    } as any));

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

    router.refresh();
  };

  // Deliverables add handler
  const handleAddDeliverable = async (title: string, fileUrl?: string, notes?: string) => {
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
    const createdDeliverable = data?.deliverable || data?.data;

    if (!createdDeliverable || !createdDeliverable.id) {
      throw new Error("Dữ liệu tài liệu phản hồi từ máy chủ không hợp lệ");
    }

    setDeliverables((prev) => [
      ...prev,
      {
        id: createdDeliverable.id,
        title: createdDeliverable.title || trimmedTitle,
        fileUrl: createdDeliverable.fileUrl || trimmedUrl,
        notes: createdDeliverable.notes,
        reviewStatus: createdDeliverable.reviewStatus,
        createdAt: createdDeliverable.createdAt,
      },
    ]);

    setAuditEvents((prev) => [
      {
        id: `audit-deliv-${Date.now()}`,
        action: "SUBMIT_DELIVERABLE",
        timestamp: new Date().toISOString(),
        actorName: currentUser?.name || "Người thực hiện",
        description: `Đã nộp tài liệu minh chứng: "${trimmedTitle}"`,
      },
      ...prev,
    ]);
  };

  // Deliverables delete handler
  const handleDeleteDeliverable = async (deliverableId: string) => {
    const previousDeliverables = deliverables;
    // Optimistic remove from local list
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

      setAuditEvents((prev) => [
        {
          id: `audit-del-deliv-${Date.now()}`,
          action: "DELETE_DELIVERABLE",
          timestamp: new Date().toISOString(),
          actorName: currentUser?.name || "Người thực hiện",
          description: `Đã xóa tài liệu minh chứng`,
        },
        ...prev,
      ]);
    } catch (error: unknown) {
      // Rollback on failure
      setDeliverables(previousDeliverables);
      notifyError(error instanceof Error ? error.message : String(error) || "Không thể xóa tài liệu minh chứng", "Lỗi xóa minh chứng");
    }
  };

  return (
    <div
      className={styles.splitWorkspace}
      data-peek-open={Boolean(activeSubtask)}
      style={
        activeSubtask
          ? ({
              "--qcet-subtask-peek-width": `${peekWidth}px`,
            } as React.CSSProperties)
          : undefined
      }
    >
    {/* Parent pane */}
    <div
      data-slot="task-workspace"
      className={styles.workspace}
    >
      {/* Header Navigation Bar */}
      <TaskDetailHeaderNav
        taskId={task.id}
        showInspector={showInspector}
        onToggleInspector={handleToggleInspector}
        isDrawerOpen={Boolean(activeSubtask)}
        onOpenProgressModal={canEdit ? () => setIsProgressModalOpen(true) : undefined}
      />

      {/* Tabs: Tổng quan + Hoạt động — thanh mảnh, tinh tế */}
      <nav
        role="tablist"
        aria-label="Các phân mục chi tiết nhiệm vụ"
        className="flex items-center gap-1 px-4 sm:px-6 h-9 border-b border-border/30 bg-background/70 text-xs font-normal sticky top-12 z-20 backdrop-blur-xs select-none"
      >
        <button
          role="tab"
          id="tab-overview"
          aria-selected={activeTab === "overview"}
          aria-controls="panel-overview"
          type="button"
          onClick={() => handleTabChange("overview")}
          className={cn(
            "h-full px-2.5 border-b-2 text-xs transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:outline-hidden -mb-px",
            activeTab === "overview"
              ? "border-primary text-foreground font-medium"
              : "border-transparent text-muted-foreground/70 hover:text-foreground hover:border-border/40 font-normal"
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
            "h-full px-2.5 border-b-2 text-xs transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:outline-hidden -mb-px",
            activeTab === "activity"
              ? "border-primary text-foreground font-medium"
              : "border-transparent text-muted-foreground/70 hover:text-foreground hover:border-border/40 font-normal"
          )}
        >
          <span>Hoạt động</span>
          {feedActivityEvents.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-muted/50 text-[10px] font-mono font-normal tabular-nums text-muted-foreground/60 leading-none">
              {feedActivityEvents.length}
            </span>
          )}
        </button>
      </nav>

      {/* Main Workspace Canvas */}
      <div ref={canvasRef} className={styles.canvas}>
        <TaskDetailSplitLayout
          inspectorOpen={showInspector}
          onToggleInspector={handleToggleInspector}
          inspector={
            <aside aria-label="Cột thuộc tính nhiệm vụ" style={{ overflow: "hidden", minWidth: 0, width: "100%" }}>
              <LinearPropertiesSidebar
                task={task}
                currentUser={currentUser}
                canEdit={canEdit}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
                onDueDateChange={handleDueDateChange}
                onStartDateChange={handleStartDateChange}
                onReassignLead={handleReassignLead}
                onNavigateTab={(tab) => handleTabChange(tab as DetailTab)}
                auditEvents={feedActivityEvents}
                isMobileAccordion={true}
                showRelatedSections={true}
                subTasks={subTasks}
                activeSubtaskId={selectedSubtaskId}
                onSelectSubtask={handleOpenSubtaskDrawer}
                onAddSubtask={handleAddSubtask}
              />
            </aside>
          }
        >
          <main
            role="tabpanel"
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
            className={styles.content}
          >
          {activeTab === "overview" && (
            <>
              <TaskIdentityBlock
                task={task}
                currentUser={currentUser}
                canEdit={canEdit}
                deliverables={deliverables}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
                onTitleChange={handleTitleChange}
                onStartDateChange={handleStartDateChange}
                onDueDateChange={handleDueDateChange}
                onReassignLead={handleReassignLead}
                onAddDeliverable={handleAddDeliverable}
                onDeleteDeliverable={handleDeleteDeliverable}
                showInlineProperties={!showInspector}
              />

              <TaskNotionBlockContent
                globalFileDrop={!activeSubtask}
                taskId={task.id}
                initialDescription={currentDescription}
                subTasks={subTasks}
                canEdit={canEdit}
                onSaveContent={handleSaveDescription}
                onSelectSubtask={(st) => handleOpenSubtaskDrawer(st)}
              />
            </>
          )}

          {activeTab === "activity" && (
            <div className="space-y-4">
              <section className="space-y-4">
                <div className="pb-3 border-b border-border/40">
                  <h2 className="text-xs font-semibold text-foreground tracking-tight">
                    Nhật ký xử lý &amp; Lịch sử hoạt động
                  </h2>
                  <p className="text-xs text-muted-foreground pt-0.5">
                    Ghi nhận đầy đủ các thay đổi, cập nhật và thao tác trên nhiệm vụ.
                  </p>
                </div>

                {feedActivityEvents.length > 0 ? (
                  <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border/60">
                    {feedActivityEvents.map((evt) => (
                      <div key={evt.id} className="relative flex flex-col gap-0.5 text-xs">
                        <span className="absolute -left-5 top-1 flex size-2.5 items-center justify-center rounded-full border border-background bg-primary" />
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-foreground">
                              {evt.description || getAuditActionLabel(evt.action)}
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
                </main>

        </TaskDetailSplitLayout>
      </div>

    </div>

    {/* Child peek — independent card beside parent */}
    <SubtaskDetailDrawer
      isOpen={Boolean(activeSubtask)}
      onClose={handleCloseSubtaskDrawer}
      subtask={activeSubtask}
      canEdit={Boolean(activeSubtask && (activeSubtask as any).availableActions?.includes('task.update_execution'))}
      currentUser={currentUser}
      onSubtaskUpdated={handleSubtaskUpdated}
      siblings={subTasks}
      onSelectSibling={handleOpenSubtaskDrawer}
      onAddSubtask={handleAddSubtask}
      peekWidth={peekWidth}
      onPeekWidthChange={handlePeekWidthChange}
    />

    {/* Modal Tạo việc con */}
    <LinearCreateTaskModal
      isOpen={isCreateSubtaskOpen}
      onClose={() => setIsCreateSubtaskOpen(false)}
      initialParentTaskId={task.id}
      initialParentTaskTitle={task.title}
      onSubmitSuccess={() => {
        setIsCreateSubtaskOpen(false);
        router.refresh();
      }}
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
            canEdit={canEdit}
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
    </div>
  );
}
