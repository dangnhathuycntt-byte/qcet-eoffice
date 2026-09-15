"use client";

import * as React from "react";
import {
  ArrowLeft,
  Box,
  Copy,
  Check,
  PanelRightClose,
  PanelRightOpen,
  Calendar,
  User,
  Users,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Plus,
  Paperclip,
  FileText,
  ExternalLink,
  ListTodo,
  Share2,
  RotateCcw,
  Sparkles,
  Link as LinkIcon,
  Briefcase,
  Layers,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import { cn } from "@/lib/utils";
import { formatDetailDate, getRelativeDueTime } from "@/components/dashboard/task-detail-side-sheet";
import { LinearPropertiesSidebar, type AuditLogItem } from "./linear-properties-sidebar";

export interface LinearTaskDetailViewProps {
  task: SchoolTask | StaffTask;
  onBack: () => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus, note?: string) => Promise<void> | void;
  onPriorityChange?: (taskId: string, newPriority: TaskPriority) => Promise<void> | void;
  onDueDateChange?: (taskId: string, newDueDate: string) => Promise<void> | void;
  onAddSubTask?: (parentId: string) => void;
  onSelectSubTask?: (subTaskOrId: string | StaffTask) => void;
  currentUser?: AuthUser | null;
  auditEvents?: AuditLogItem[];
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
  onAddSubTask,
  onSelectSubTask,
  currentUser,
  auditEvents: initialAuditEvents = [],
  onRefresh,
  onSubmitDeliverable,
  onReview,
  initialTab = "overview",
  onTabChange,
  className,
}: LinearTaskDetailViewProps) {
  const [task, setTask] = React.useState<SchoolTask | StaffTask>(initialTask);
  React.useEffect(() => {
    setTask(initialTask);
  }, [initialTask]);

  const [activeTab, setActiveTab] = React.useState<DetailTab>(initialTab);
  React.useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleTabSelect = (tab: DetailTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const [showSidebar, setShowSidebar] = React.useState(true);
  const [copiedLink, setCopiedLink] = React.useState(false);

  // Local audit events
  const [auditEvents, setAuditEvents] = React.useState<AuditLogItem[]>(initialAuditEvents);
  React.useEffect(() => {
    setAuditEvents(initialAuditEvents);
  }, [initialAuditEvents]);

  // Progress update state
  const isSchool = isSchoolTask(task);
  const schoolTask = isSchool ? (task as SchoolTask) : null;
  const staffTask = !isSchool ? (task as StaffTask) : null;

  const currentProgressPercent =
    typeof (task as any).progressPercent === "number"
      ? (task as any).progressPercent
      : isSchool
      ? schoolTask?.progress ?? 0
      : 0;

  const [progressInput, setProgressInput] = React.useState<number>(currentProgressPercent);
  React.useEffect(() => {
    setProgressInput(currentProgressPercent);
  }, [currentProgressPercent]);

  const [progressNote, setProgressNote] = React.useState<string>("");
  const [isUpdatingProgress, setIsUpdatingProgress] = React.useState(false);
  const [progressFeedback, setProgressFeedback] = React.useState<string | null>(null);

  // Deliverables / Resources state
  const initialDeliverables = (task as any).deliverables || [];
  const [deliverables, setDeliverables] = React.useState<Array<{ id: string; title: string; fileUrl?: string; notes?: string }>>(
    initialDeliverables
  );
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

  // Keyboard shortcut: Ctrl/Cmd + I toggles sidebar
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setShowSidebar((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const taskCode =
    task.code ||
    (isSchool ? schoolTask?.taskCode : staffTask?.taskId) ||
    task.id.slice(0, 8).toUpperCase();

  const leadName = isSchool
    ? schoolTask?.leadAssigneeName || "Chưa phân công"
    : staffTask?.assigneeName || "Chưa phân công";

  const departmentName = isSchool
    ? schoolTask?.leadDepartment || schoolTask?.department || schoolTask?.departmentName || "Ban Giám hiệu"
    : staffTask?.assignedToDepartmentName || staffTask?.department || "Tổ chuyên môn";

  const subTasks = isSchool && Array.isArray(schoolTask?.subTasks) ? schoolTask.subTasks : [];

  const taskDescription = isSchool
    ? schoolTask?.description
    : staffTask?.deliverableDescription || (task as any).description;

  const relativeDue = getRelativeDueTime(task.dueDate);

  // Status mapping
  const statusLabel =
    task.status === "COMPLETED"
      ? "Hoàn thành"
      : task.status === "IN_PROGRESS"
      ? "Đang thực hiện"
      : task.status === "WAITING_APPROVAL" || task.status === "NEEDS_REVIEW"
      ? "Chờ duyệt"
      : "Chưa bắt đầu";

  const statusBadgeStyle =
    task.status === "COMPLETED"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : task.status === "IN_PROGRESS"
      ? "text-blue-700 bg-blue-50 border-blue-200"
      : task.status === "WAITING_APPROVAL" || task.status === "NEEDS_REVIEW"
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-slate-600 bg-slate-100 border-slate-200";

  const priorityVal = (task as any).priority || "NORMAL";
  const priorityLabel =
    priorityVal === "URGENT"
      ? "Khẩn cấp"
      : priorityVal === "HIGH"
      ? "Cao"
      : priorityVal === "LOW"
      ? "Thấp"
      : "Bình thường";

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    navigator.clipboard.writeText(url.toString());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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
        actorName: currentUser?.name || "Người dùng hiện tại",
        description: `Đã đổi trạng thái sang: ${
          newStatus === "COMPLETED"
            ? "Hoàn thành"
            : newStatus === "IN_PROGRESS"
            ? "Đang thực hiện"
            : newStatus === "WAITING_APPROVAL"
            ? "Chờ duyệt"
            : "Chưa bắt đầu"
        }`,
      },
      ...prev,
    ]);
  };

  const handlePriorityChangeInternal = async (taskId: string, newPriority: TaskPriority) => {
    if (onPriorityChange) {
      await onPriorityChange(taskId, newPriority);
    }
    const normalizedPriority = (newPriority === "MEDIUM" ? "NORMAL" : newPriority) as any;
    setTask((prev) => ({
      ...prev,
      priority: normalizedPriority,
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

  const handleUpdateProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProgress(true);
    setProgressFeedback(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/actions/update-progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progressPercent: progressInput,
          note: progressNote,
        }),
      });

      if (!res.ok) {
        // Fallback PATCH if endpoint differs
        await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            progressPercent: progressInput,
          }),
        });
      }

      setTask((prev) => ({
        ...prev,
        progressPercent: progressInput,
        ...(progressInput === 100 ? { status: "COMPLETED" as TaskStatus } : {}),
      }));

      setAuditEvents((prev) => [
        {
          id: `audit-prog-${Date.now()}`,
          action: "UPDATE_PROGRESS",
          timestamp: new Date().toISOString(),
          actorName: currentUser?.name || "Người thực hiện",
          description: `Cập nhật tiến độ: ${progressInput}%${progressNote ? ` (${progressNote})` : ""}`,
        },
        ...prev,
      ]);

      setProgressFeedback("Đã cập nhật tiến độ thành công");
      setProgressNote("");
      setTimeout(() => setProgressFeedback(null), 3000);
    } catch {
      setProgressFeedback("Lỗi khi cập nhật tiến độ");
    } finally {
      setIsUpdatingProgress(false);
    }
  };

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

  return (
    <div
      data-slot="linear-task-detail-view"
      className={cn(
        "w-full min-h-[680px] bg-white rounded-xl border border-border/40 shadow-2xs flex flex-col overflow-hidden text-slate-900",
        className
      )}
    >
      {/* 1. Top Breadcrumb & Actions Bar */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/40 bg-white sticky top-0 z-20">
        {/* Left: Back button & Breadcrumbs */}
        <nav aria-label="Đường dẫn trang" className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            title="Quay lại danh sách nhiệm vụ"
            aria-label="Quay lại danh sách nhiệm vụ"
          >
            <ArrowLeft className="size-4" strokeWidth={2} />
            <span className="hidden sm:inline">Quay lại Nhiệm vụ</span>
            <span className="sm:hidden">Quay lại</span>
          </button>

          <span className="text-slate-300" aria-hidden="true">/</span>

          <div className="flex items-center gap-1.5 min-w-0 text-xs text-slate-500">
            <span className="font-mono font-semibold text-slate-700 shrink-0">
              {taskCode}
            </span>
            <span className="text-slate-300" aria-hidden="true">/</span>
            <span className="font-medium text-slate-900 truncate max-w-[180px] sm:max-w-[360px] md:max-w-[480px]">
              {task.title}
            </span>
          </div>
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Copy Link Button */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            title="Sao chép liên kết nhiệm vụ"
            aria-label="Sao chép liên kết nhiệm vụ"
          >
            {copiedLink ? (
              <>
                <Check className="size-3.5 text-emerald-600" strokeWidth={2} />
                <span className="text-emerald-700 font-semibold">Đã chép</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5 text-slate-500" strokeWidth={1.5} />
                <span className="hidden sm:inline">Sao chép liên kết</span>
              </>
            )}
          </button>

          {/* Toggle Sidebar Button (Desktop / Tablet) */}
          <button
            type="button"
            onClick={() => setShowSidebar(!showSidebar)}
            className={cn(
              "hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
              showSidebar
                ? "bg-slate-100 border-border/70 text-slate-800"
                : "bg-white border-border/60 text-slate-500 hover:bg-slate-50"
            )}
            title="Ẩn / Hiện cột thuộc tính (Ctrl + I / Cmd + I)"
            aria-label="Ẩn hoặc hiện cột thuộc tính"
            aria-pressed={showSidebar}
          >
            {showSidebar ? (
              <PanelRightClose className="size-3.5" strokeWidth={1.5} />
            ) : (
              <PanelRightOpen className="size-3.5" strokeWidth={1.5} />
            )}
            <span>Thuộc tính</span>
            <kbd className="hidden lg:inline-block px-1 py-0.2 rounded bg-slate-200 text-[10px] font-mono text-slate-600">
              ⌘I
            </kbd>
          </button>
        </div>
      </header>

      {/* 2. Sub-Tabs Bar (REQ-14) */}
      <nav
        role="tablist"
        aria-label="Các phân mục chi tiết nhiệm vụ"
        className="flex items-center gap-1 px-4 sm:px-6 border-b border-border/40 bg-slate-50/40 text-xs font-medium"
      >
        <button
          role="tab"
          id="tab-overview"
          aria-selected={activeTab === "overview"}
          aria-controls="panel-overview"
          type="button"
          onClick={() => handleTabSelect("overview")}
          className={cn(
            "px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
            activeTab === "overview"
              ? "border-primary text-primary font-bold bg-white/60"
              : "border-transparent text-slate-600 hover:text-slate-900"
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
          onClick={() => handleTabSelect("subtasks")}
          className={cn(
            "px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
            activeTab === "subtasks"
              ? "border-primary text-primary font-bold bg-white/60"
              : "border-transparent text-slate-600 hover:text-slate-900"
          )}
        >
          <ListTodo className="size-3.5" strokeWidth={1.5} />
          <span>Đầu việc con</span>
          {subTasks.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-[10px] font-mono tabular-nums">
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
          onClick={() => handleTabSelect("activity")}
          className={cn(
            "px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
            activeTab === "activity"
              ? "border-primary text-primary font-bold bg-white/60"
              : "border-transparent text-slate-600 hover:text-slate-900"
          )}
        >
          <Clock className="size-3.5" strokeWidth={1.5} />
          <span>Nhật ký hoạt động</span>
          {auditEvents.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-[10px] font-mono tabular-nums">
              {auditEvents.length}
            </span>
          )}
        </button>
      </nav>

      {/* 3. Main 2-Column Grid (REQ-13 & REQ-15: Desktop >= 1280px 2 cột ~68% / ~32%; Tablet 768-1279px collapsible rail; Mobile < 768px single col accordion) */}
      <div className="flex-1 flex flex-col md:flex-row min-w-0">
        {/* Left / Center Content Canvas */}
        <main
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className={cn(
            "flex-1 p-4 sm:p-6 lg:p-7 space-y-6 overflow-y-auto min-w-0 thin-scrollbar",
            showSidebar
              ? "md:max-w-[calc(100%-280px)] lg:max-w-[calc(100%-320px)] xl:max-w-[68%]"
              : "w-full"
          )}
        >
          {/* Tab: Overview */}
          {activeTab === "overview" && (
            <>
              {/* Header: Task Code + Title + Lead summary - Flat Document style */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-medium text-slate-500 uppercase">
                    {taskCode}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs text-slate-500 font-normal">
                    {isSchool ? "Cấp Trường" : "Cấp Đơn vị"}
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight leading-snug">
                  {task.title}
                </h1>

                {/* Inline properties summary strip - quiet & restrained */}
                <div className="flex flex-wrap items-center gap-3 pt-1 pb-3 border-b border-border/40 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <span className="size-1.5 rounded-full bg-blue-500" />
                    <span>{statusLabel}</span>
                  </span>

                  <span className="inline-flex items-center gap-1">
                    <AlertCircle className="size-3 text-slate-400" strokeWidth={1.5} />
                    <span>{priorityLabel}</span>
                  </span>

                  <span className="inline-flex items-center gap-1">
                    <User className="size-3 text-slate-400" strokeWidth={1.5} />
                    <span className="text-slate-800 font-medium">{leadName}</span>
                  </span>

                  <span className="inline-flex items-center gap-1 font-mono">
                    <Calendar className="size-3 text-slate-400" strokeWidth={1.5} />
                    <span>{formatDetailDate(task.dueDate)}</span>
                    {relativeDue && (
                      <span className={cn("ml-1 font-sans text-[10px]", relativeDue.color)}>
                        ({relativeDue.text})
                      </span>
                    )}
                  </span>

                  <span className="inline-flex items-center gap-1">
                    <Building2 className="size-3 text-slate-400" strokeWidth={1.5} />
                    <span>{departmentName}</span>
                  </span>
                </div>
              </div>

              {/* Progress updater - Sleek hairline inline block */}
              <div className="py-2.5 border-b border-border/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Tiến độ thực hiện
                  </span>
                  <span className="font-mono text-xs font-semibold text-primary tabular-nums">
                    {progressInput}%
                  </span>
                </div>

                <form onSubmit={handleUpdateProgressSubmit} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {[0, 25, 50, 75, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setProgressInput(preset)}
                        className={cn(
                          "px-2 py-0.5 rounded text-xs font-mono font-medium border transition-colors cursor-pointer",
                          progressInput === preset
                            ? "bg-slate-900 text-white border-slate-900 font-bold"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-1.5">
                    <input
                      type="text"
                      value={progressNote}
                      onChange={(e) => setProgressNote(e.target.value)}
                      placeholder="Ghi chú tóm tắt kết quả hoặc tiến độ..."
                      className="flex-1 w-full px-2.5 py-1 text-xs rounded border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary"
                    />

                    <button
                      type="submit"
                      disabled={isUpdatingProgress}
                      className="w-full sm:w-auto px-3 py-1 text-xs font-medium rounded bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {isUpdatingProgress ? "Đang lưu..." : "Cập nhật"}
                    </button>
                  </div>

                  {progressFeedback && (
                    <p className="text-[11px] font-medium text-emerald-700 animate-in fade-in">
                      {progressFeedback}
                    </p>
                  )}
                </form>
              </div>

              {/* Mô tả chi tiết (Description) - Document-like flat presentation */}
              <section aria-labelledby="desc-heading" className="space-y-1.5 pt-1">
                <h2 id="desc-heading" className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                  Mô tả & Yêu cầu thực hiện
                </h2>

                <div className="text-sm leading-relaxed text-slate-800 space-y-2.5 py-1">
                  {taskDescription ? (
                    <div className="whitespace-pre-line">{taskDescription}</div>
                  ) : (
                    <p className="italic text-slate-400">Chưa có nội dung mô tả chi tiết cho nhiệm vụ này.</p>
                  )}

                  {/* Institutional criteria if BGH / School Task */}
                  {schoolTask?.executiveCriteria && (
                    <div className="p-2.5 rounded border border-blue-100 bg-blue-50/40 text-blue-900 space-y-1 mt-2">
                      <span className="font-semibold text-xs text-blue-800 block">
                        Căn cứ chỉ đạo & Tiêu chí nghiệm thu từ Ban Giám hiệu:
                      </span>
                      <p className="whitespace-pre-line text-xs">{schoolTask.executiveCriteria}</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Tài liệu & Minh chứng kết quả (Deliverables / Resources) */}
              <section aria-labelledby="resources-heading" className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Paperclip className="size-4 text-slate-500" strokeWidth={1.5} />
                    <h2 id="resources-heading" className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                      Tài liệu & Minh chứng kết quả
                    </h2>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      ({deliverables.length})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddingResource(!isAddingResource)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                    aria-expanded={isAddingResource}
                  >
                    <Plus className="size-3.5" strokeWidth={2} />
                    <span>+ Thêm văn bản / liên kết</span>
                  </button>
                </div>

                {isAddingResource && (
                  <form
                    onSubmit={handleAddResourceSubmit}
                    className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-2.5 animate-in fade-in"
                  >
                    <span className="text-xs font-semibold text-primary block">
                      Thêm liên kết văn bản chỉ đạo hoặc minh chứng nghiệm thu
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <input
                        type="text"
                        placeholder="Tên tài liệu / văn bản..."
                        value={resourceTitle}
                        onChange={(e) => setResourceTitle(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-border/60 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-primary"
                        required
                      />
                      <input
                        type="url"
                        placeholder="Đường dẫn liên kết (URL / Drive)..."
                        value={resourceUrl}
                        onChange={(e) => setResourceUrl(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-border/60 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-primary font-mono text-[11px]"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingResource(false)}
                        className="px-3 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingResource}
                        className="px-3 py-1 text-xs font-semibold rounded-md bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingResource ? "Đang lưu..." : "Lưu tài liệu"}
                      </button>
                    </div>
                  </form>
                )}

                {deliverables.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-border/60 bg-slate-50/40 text-center text-xs text-slate-400">
                    Chưa có văn bản chỉ đạo hoặc minh chứng nào được đính kèm.
                  </div>
                ) : (
                  <div className="divide-y divide-border/40 rounded-xl border border-border/60 overflow-hidden bg-white">
                    {deliverables.map((item: any, idx: number) => (
                      <div
                        key={item.id || idx}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="size-4 text-slate-400 shrink-0" strokeWidth={1.5} />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">
                              {item.title || item.name}
                            </p>
                            {item.fileUrl && (
                              <a
                                href={item.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-primary hover:underline font-mono truncate block"
                              >
                                {item.fileUrl}
                              </a>
                            )}
                          </div>
                        </div>

                        {item.fileUrl && (
                          <a
                            href={item.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border/60 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shrink-0"
                          >
                            <ExternalLink className="size-3" />
                            <span>Mở</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Danh sách đầu việc con (Subtasks Preview) */}
              <section aria-labelledby="subtasks-heading" className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListTodo className="size-4 text-slate-500" strokeWidth={1.5} />
                    <h2 id="subtasks-heading" className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                      Đầu việc con / Mốc thực hiện
                    </h2>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      ({subTasks.length})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onAddSubTask?.(task.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    <Plus className="size-3.5" strokeWidth={2} />
                    <span>+ Thêm việc con</span>
                  </button>
                </div>

                {subTasks.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-border/60 bg-slate-50/40 text-center text-xs text-slate-400">
                    Chưa có đầu việc con trực thuộc nhiệm vụ này.
                  </div>
                ) : (
                  <div className="divide-y divide-border/40 rounded-xl border border-border/60 overflow-hidden bg-white text-xs">
                    {subTasks.map((st) => (
                      <div
                        key={st.id}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleToggleSubtaskStatus(st)}
                            className="text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer shrink-0"
                            title={st.status === "COMPLETED" ? "Đánh dấu chưa xong" : "Đánh dấu hoàn thành"}
                            aria-label={st.status === "COMPLETED" ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"}
                          >
                            <CheckCircle2
                              className={cn(
                                "size-4",
                                st.status === "COMPLETED" ? "text-emerald-600 fill-emerald-50" : "text-slate-300"
                              )}
                              strokeWidth={2}
                            />
                          </button>

                          <div
                            onClick={() => onSelectSubTask?.(st.id)}
                            className="min-w-0 flex-1 cursor-pointer"
                          >
                            <p
                              className={cn(
                                "font-semibold text-slate-900 hover:text-primary transition-colors truncate",
                                st.status === "COMPLETED" && "line-through text-slate-400"
                              )}
                            >
                              {st.title}
                            </p>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                              <span>{st.assigneeName || "Chưa phân công"}</span>
                              <span>•</span>
                              <span className="font-mono">{formatDetailDate(st.dueDate)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-semibold border",
                              st.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            )}
                          >
                            {st.status === "COMPLETED" ? "Hoàn thành" : "Đang làm"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {/* Tab: Subtasks (Full Checklist View) */}
          {activeTab === "subtasks" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Danh sách đầu việc con & Mốc thực hiện
                  </h2>
                  <p className="text-xs text-slate-500">
                    Phân rã nhiệm vụ thành các mốc cụ thể cho cán bộ và giảng viên thực hiện.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onAddSubTask?.(task.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-2xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                >
                  <Plus className="size-3.5" strokeWidth={2} />
                  <span>+ Thêm việc con</span>
                </button>
              </div>

              {subTasks.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 rounded-xl border border-dashed border-border/60 bg-slate-50/40">
                  Chưa có đầu việc con nào được tạo cho nhiệm vụ này.
                </div>
              ) : (
                <div className="divide-y divide-border/40 rounded-xl border border-border/60 overflow-hidden bg-white text-xs">
                  {subTasks.map((st) => (
                    <div
                      key={st.id}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleSubtaskStatus(st)}
                          className="text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer shrink-0"
                          aria-label={st.status === "COMPLETED" ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"}
                        >
                          <CheckCircle2
                            className={cn(
                              "size-4",
                              st.status === "COMPLETED" ? "text-emerald-600 fill-emerald-50" : "text-slate-300"
                            )}
                            strokeWidth={2}
                          />
                        </button>

                        <div
                          onClick={() => onSelectSubTask?.(st.id)}
                          className="min-w-0 flex-1 cursor-pointer"
                        >
                          <p
                            className={cn(
                              "font-semibold text-slate-900 hover:text-primary transition-colors truncate",
                              st.status === "COMPLETED" && "line-through text-slate-400"
                            )}
                          >
                            {st.title}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                            <span>Phụ trách: {st.assigneeName || "Chưa phân công"}</span>
                            <span>•</span>
                            <span className="font-mono">Hạn: {formatDetailDate(st.dueDate)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {typeof st.progressPercent === "number" && (
                          <span className="font-mono text-xs font-bold text-slate-700 tabular-nums">
                            {st.progressPercent}%
                          </span>
                        )}
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded text-[11px] font-semibold border",
                            st.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          )}
                        >
                          {st.status === "COMPLETED" ? "Hoàn thành" : "Đang làm"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Activity Feed */}
          {activeTab === "activity" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Nhật ký xử lý & Lịch sử hoạt động
                  </h2>
                  <p className="text-xs text-slate-500">
                    Ghi nhận toàn bộ thao tác giao việc, cập nhật tiến độ và phê duyệt hoàn thành.
                  </p>
                </div>
                <span className="font-mono text-xs text-slate-400 tabular-nums">
                  {auditEvents.length} mốc
                </span>
              </div>

              {auditEvents.length > 0 ? (
                <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                  {auditEvents.map((evt) => (
                    <div key={evt.id} className="relative flex flex-col gap-0.5 text-xs">
                      <span className="absolute -left-5 top-1 flex size-3 items-center justify-center rounded-full border border-white bg-blue-500" />
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">
                          {evt.description || evt.action}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                          {formatDetailDate(evt.timestamp)}
                        </span>
                      </div>
                      {evt.actorName && (
                        <span className="text-[11px] text-slate-500">
                          Người thao tác: {evt.actorName}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400 rounded-xl border border-dashed border-border/60 bg-slate-50/40">
                  Chưa có lịch sử xử lý nào được ghi nhận cho nhiệm vụ này.
                </div>
              )}
            </div>
          )}
        </main>

        {/* Right Column: Properties Sidebar (Desktop >= 1280px ~32%; Tablet 768-1279px collapsible rail; Mobile < 768px accordion) */}
        {showSidebar && (
          <div className="w-full md:w-[280px] lg:w-[320px] xl:w-[32%] shrink-0 border-t md:border-t-0 border-border/40">
            <LinearPropertiesSidebar
              task={task}
              currentUser={currentUser}
              onStatusChange={handleStatusChangeInternal}
              onPriorityChange={handlePriorityChangeInternal}
              onDueDateChange={handleDueDateChangeInternal}
              auditEvents={auditEvents}
              isMobileAccordion={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
