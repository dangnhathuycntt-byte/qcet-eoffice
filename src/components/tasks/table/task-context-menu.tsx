"use client";

import * as React from "react";
import {
  Star,
  Clock,
  CheckCircle2,
  Circle,
  AlertTriangle,
  User,
  Calendar,
  Copy,
  ExternalLink,
  Trash2,
  ChevronRight,
  Sparkles,
  Signal,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Eye,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import {
  updateTaskStatus,
  updateTaskPriority,
  updateTaskAssignee,
  updateTaskDueDate,
  deleteTask,
} from "@/lib/tasks/task-actions";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";

export interface TaskContextMenuProps {
  task: SchoolTask | StaffTask | null;
  position: { x: number; y: number } | null;
  isOpen: boolean;
  onClose: () => void;
  triggerElement?: HTMLElement | null;
  onOpenDetail?: (task: SchoolTask | StaffTask) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void | Promise<void>;
  onPriorityChange?: (taskId: string, newPriority: TaskPriority) => void | Promise<void>;
  onAssigneeChange?: (taskId: string, newAssigneeId: string, newAssigneeName: string) => void | Promise<void>;
  onDueDateChange?: (taskId: string, newDueDate: string) => void | Promise<void>;
  onDeleteTask?: (taskId: string) => void | Promise<void>;
  availableAssignees?: Array<{ id: string; name: string; avatar?: string; department?: string }>;
}

type ActiveSubmenu = "status" | "priority" | "assignee" | "dueDate" | null;

export function TaskContextMenu({
  task,
  position,
  isOpen,
  onClose,
  triggerElement,
  onOpenDetail,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onDueDateChange,
  onDeleteTask,
  availableAssignees = [],
}: TaskContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const previousActiveElement = React.useRef<HTMLElement | null>(null);
  const [activeSubmenu, setActiveSubmenu] = React.useState<ActiveSubmenu>(null);
  const [copiedNotification, setCopiedNotification] = React.useState<string | null>(null);
  const [menuCoords, setMenuCoords] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Focus trap & Return focus (REQ-07 / REQ-23)
  React.useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = (triggerElement || document.activeElement) as HTMLElement | null;
      const timer = setTimeout(() => {
        if (menuRef.current) {
          const firstFocusable = menuRef.current.querySelector<HTMLElement>(
            'button:not([disabled]), [tabindex="0"]:not([disabled]), input:not([disabled])'
          );
          firstFocusable?.focus();
        }
      }, 40);
      return () => clearTimeout(timer);
    } else {
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
        previousActiveElement.current = null;
      }
    }
  }, [isOpen, triggerElement]);

  // Adjust menu position to keep within viewport bounds
  React.useEffect(() => {
    if (!isOpen || !position) return;

    const menuWidth = 240;
    const menuHeight = 360;
    const padding = 12;

    const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
    const windowHeight = typeof window !== "undefined" ? window.innerHeight : 768;

    let adjustedX = position.x;
    let adjustedY = position.y;

    if (adjustedX + menuWidth > windowWidth - padding) {
      adjustedX = windowWidth - menuWidth - padding;
    }
    if (adjustedY + menuHeight > windowHeight - padding) {
      adjustedY = Math.max(padding, windowHeight - menuHeight - padding);
    }

    setMenuCoords({ x: Math.max(padding, adjustedX), y: Math.max(padding, adjustedY) });
    setActiveSubmenu(null);
  }, [isOpen, position]);

  // Handle outside click & escape
  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Focus trap for Tab key
      if (e.key === "Tab") {
        if (!menuRef.current) return;
        const focusables = Array.from(
          menuRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [tabindex="0"]:not([disabled]), input:not([disabled])'
          )
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
        return;
      }

      // Keyboard shortcuts when context menu is open
      if (!task) return;

      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        setActiveSubmenu((prev) => (prev === "status" ? null : "status"));
      } else if (key === "p") {
        e.preventDefault();
        setActiveSubmenu((prev) => (prev === "priority" ? null : "priority"));
      } else if (key === "a") {
        e.preventDefault();
        setActiveSubmenu((prev) => (prev === "assignee" ? null : "assignee"));
      } else if (key === "d") {
        e.preventDefault();
        setActiveSubmenu((prev) => (prev === "dueDate" ? null : "dueDate"));
      } else if (e.key === "Enter") {
        e.preventDefault();
        onClose();
        onOpenDetail?.(task);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, task, onOpenDetail]);

  if (!isOpen || !task) {
    return null;
  }

  const taskTitle = task.title;
  const taskCode = (task as SchoolTask).taskCode || task.code || task.id;
  const currentStatus = task.status;
  const currentPriority = (task as SchoolTask).priority || "NORMAL";

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}/tasks/${task.id}`;
      await navigator.clipboard.writeText(url);
      setCopiedNotification("Đã sao chép liên kết!");
      setTimeout(() => {
        setCopiedNotification(null);
        onClose();
      }, 700);
    } catch {
      onClose();
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(taskCode.toUpperCase());
      setCopiedNotification("Đã sao chép mã!");
      setTimeout(() => {
        setCopiedNotification(null);
        onClose();
      }, 700);
    } catch {
      onClose();
    }
  };

  const handleToggleStar = async () => {
    const nextPriority: TaskPriority = currentPriority === "URGENT" ? "NORMAL" : "URGENT";
    if (onPriorityChange) {
      await onPriorityChange(task.id, nextPriority);
    } else {
      await updateTaskPriority(task.id, nextPriority);
    }
    onClose();
  };

  const handleStatusSelect = async (status: TaskStatus) => {
    if (onStatusChange) {
      await onStatusChange(task.id, status);
    } else {
      await updateTaskStatus(task.id, status);
    }
    onClose();
  };

  const handlePrioritySelect = async (priority: TaskPriority) => {
    if (onPriorityChange) {
      await onPriorityChange(task.id, priority);
    } else {
      await updateTaskPriority(task.id, priority);
    }
    onClose();
  };

  const handleAssigneeSelect = async (personId: string, personName: string) => {
    if (onAssigneeChange) {
      await onAssigneeChange(task.id, personId, personName);
    } else {
      await updateTaskAssignee(task.id, personId, personName);
    }
    onClose();
  };

  const handleQuickDueDate = async (daysToAdd: number) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysToAdd);
    const dateStr = targetDate.toISOString().slice(0, 10);
    if (onDueDateChange) {
      await onDueDateChange(task.id, dateStr);
    } else {
      await updateTaskDueDate(task.id, dateStr);
    }
    onClose();
  };

  const handleEndOfMonthDueDate = async () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const dateStr = lastDay.toISOString().slice(0, 10);
    if (onDueDateChange) {
      await onDueDateChange(task.id, dateStr);
    } else {
      await updateTaskDueDate(task.id, dateStr);
    }
    onClose();
  };

  const handleDeleteTask = async () => {
    if (confirm(`Bạn có chắc chắn muốn lưu trữ nhiệm vụ "${taskTitle}"?`)) {
      if (onDeleteTask) {
        await onDeleteTask(task.id);
      } else {
        await deleteTask(task.id, Number((task as any).version ?? 1));
      }
      onClose();
    }
  };

  const STATUS_OPTIONS: Array<{ status: TaskStatus; label: string; icon: typeof Circle; color: string }> = [
    { status: "NOT_STARTED", label: "Chưa bắt đầu", icon: Circle, color: "text-slate-400" },
    { status: "IN_PROGRESS", label: "Đang làm", icon: Clock, color: "text-blue-600" },
    { status: "WAITING_APPROVAL", label: "Chờ duyệt", icon: AlertTriangle, color: "text-amber-500" },
    { status: "COMPLETED", label: "Hoàn thành", icon: CheckCircle2, color: "text-emerald-600" },
  ];

  const PRIORITY_OPTIONS: Array<{ priority: TaskPriority; label: string; icon: typeof Signal; color: string }> = [
    { priority: "URGENT", label: "Khẩn cấp", icon: AlertTriangle, color: "text-rose-600" },
    { priority: "HIGH", label: "Ưu tiên cao", icon: SignalHigh, color: "text-amber-600" },
    { priority: "NORMAL", label: "Bình thường", icon: SignalMedium, color: "text-blue-600" },
    { priority: "LOW", label: "Thấp", icon: SignalLow, color: "text-slate-400" },
  ];

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Thao tác nhanh nhiệm vụ"
      style={{
        position: "fixed",
        top: `${menuCoords.y}px`,
        left: `${menuCoords.x}px`,
        zIndex: 9999,
      }}
      className="w-60 select-none rounded-lg border border-border/80 bg-white p-1 text-xs text-slate-800 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100"
    >
      {/* Copied Feedback Toast */}
      {copiedNotification && (
        <div className="mb-1 rounded bg-slate-900 px-2 py-1 text-center font-medium text-white shadow-xs">
          {copiedNotification}
        </div>
      )}

      {/* Task Header Preview */}
      <div className="px-2.5 py-1.5 border-b border-border/40 mb-1">
        <div className="font-mono text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {taskCode}
        </div>
        <div className="font-medium text-foreground truncate max-w-[210px]" title={taskTitle}>
          {taskTitle}
        </div>
      </div>

      {/* Item 1: Toggle Priority / Star */}
      <button
        type="button"
        role="menuitem"
        onClick={handleToggleStar}
        className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-slate-100/80 transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2">
          <Star
            className={cn(
              "size-3.5",
              currentPriority === "URGENT"
                ? "text-amber-500 fill-amber-500"
                : "text-slate-400"
            )}
            strokeWidth={1.5}
          />
          <span>{currentPriority === "URGENT" ? "Bỏ ưu tiên khẩn cấp" : "Đánh dấu ưu tiên"}</span>
        </span>
      </button>

      {/* Item 2: Change Status (S) */}
      <div className="relative">
        <button
          type="button"
          role="menuitem"
          aria-haspopup="true"
          aria-expanded={activeSubmenu === "status"}
          onMouseEnter={() => setActiveSubmenu("status")}
          onClick={() => setActiveSubmenu((prev) => (prev === "status" ? null : "status"))}
          className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-slate-100/80 transition-colors cursor-pointer text-left"
        >
          <span className="flex items-center gap-2">
            <Clock className="size-3.5 text-blue-600" strokeWidth={1.5} />
            <span>Đổi trạng thái...</span>
          </span>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <kbd className="font-mono text-[10px] px-1 py-0.2 bg-slate-100 border border-slate-200 rounded">S</kbd>
            <ChevronRight className="size-3" strokeWidth={1.5} />
          </div>
        </button>

        {activeSubmenu === "status" && (
          <div
            role="menu"
            className="absolute left-full top-0 ml-1 w-44 rounded-lg border border-border/80 bg-white p-1 text-xs shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 z-50"
          >
            {STATUS_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = currentStatus === opt.status;
              return (
                <button
                  key={opt.status}
                  type="button"
                  role="menuitem"
                  onClick={() => handleStatusSelect(opt.status)}
                  className={cn(
                    "flex w-full items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer",
                    isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-slate-100/80 text-slate-700"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className={cn("size-3.5", opt.color)} strokeWidth={1.5} />
                    <span>{opt.label}</span>
                  </span>
                  {isSelected && <Check className="size-3 text-primary" strokeWidth={2} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Item 3: Set Priority (P) */}
      <div className="relative">
        <button
          type="button"
          role="menuitem"
          aria-haspopup="true"
          aria-expanded={activeSubmenu === "priority"}
          onMouseEnter={() => setActiveSubmenu("priority")}
          onClick={() => setActiveSubmenu((prev) => (prev === "priority" ? null : "priority"))}
          className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-slate-100/80 transition-colors cursor-pointer text-left"
        >
          <span className="flex items-center gap-2">
            <Signal className="size-3.5 text-amber-600" strokeWidth={1.5} />
            <span>Đặt độ ưu tiên...</span>
          </span>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <kbd className="font-mono text-[10px] px-1 py-0.2 bg-slate-100 border border-slate-200 rounded">P</kbd>
            <ChevronRight className="size-3" strokeWidth={1.5} />
          </div>
        </button>

        {activeSubmenu === "priority" && (
          <div
            role="menu"
            className="absolute left-full top-0 ml-1 w-44 rounded-lg border border-border/80 bg-white p-1 text-xs shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 z-50"
          >
            {PRIORITY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = currentPriority === opt.priority;
              return (
                <button
                  key={opt.priority}
                  type="button"
                  role="menuitem"
                  onClick={() => handlePrioritySelect(opt.priority)}
                  className={cn(
                    "flex w-full items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer",
                    isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-slate-100/80 text-slate-700"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className={cn("size-3.5", opt.color)} strokeWidth={1.5} />
                    <span>{opt.label}</span>
                  </span>
                  {isSelected && <Check className="size-3 text-primary" strokeWidth={2} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Item 4: Assign Lead (A) */}
      <div className="relative">
        <button
          type="button"
          role="menuitem"
          aria-haspopup="true"
          aria-expanded={activeSubmenu === "assignee"}
          onMouseEnter={() => setActiveSubmenu("assignee")}
          onClick={() => setActiveSubmenu((prev) => (prev === "assignee" ? null : "assignee"))}
          className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-slate-100/80 transition-colors cursor-pointer text-left"
        >
          <span className="flex items-center gap-2">
            <User className="size-3.5 text-slate-600" strokeWidth={1.5} />
            <span>Gán người chủ trì DRI...</span>
          </span>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <kbd className="font-mono text-[10px] px-1 py-0.2 bg-slate-100 border border-slate-200 rounded">A</kbd>
            <ChevronRight className="size-3" strokeWidth={1.5} />
          </div>
        </button>

        {activeSubmenu === "assignee" && (
          <div
            role="menu"
            className="absolute left-full top-0 ml-1 w-56 max-h-60 overflow-y-auto rounded-lg border border-border/80 bg-white p-1 text-xs shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 z-50"
          >
            {availableAssignees.length > 0 ? (
              availableAssignees.map((person) => {
                const currentLeadName = (task as SchoolTask).leadAssigneeName || (task as StaffTask).assigneeName;
                const isSelected = currentLeadName === person.name;
                return (
                  <button
                    key={person.id}
                    type="button"
                    role="menuitem"
                    onClick={() => handleAssigneeSelect(person.id, person.name)}
                    className={cn(
                      "flex w-full items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer",
                      isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-slate-100/80 text-slate-700"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="size-4.5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-700 shrink-0">
                        {person.name.slice(0, 1)}
                      </div>
                      <span className="truncate">{person.name}</span>
                    </div>
                    {isSelected && <Check className="size-3 text-primary shrink-0" strokeWidth={2} />}
                  </button>
                );
              })
            ) : (
              <div className="px-2 py-1.5 text-muted-foreground text-center text-[11px]">
                Chưa có danh sách cán bộ / nhân sự
              </div>
            )}
          </div>
        )}
      </div>

      {/* Item 5: Change Due Date (D) */}
      <div className="relative">
        <button
          type="button"
          role="menuitem"
          aria-haspopup="true"
          aria-expanded={activeSubmenu === "dueDate"}
          onMouseEnter={() => setActiveSubmenu("dueDate")}
          onClick={() => setActiveSubmenu((prev) => (prev === "dueDate" ? null : "dueDate"))}
          className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-slate-100/80 transition-colors cursor-pointer text-left"
        >
          <span className="flex items-center gap-2">
            <Calendar className="size-3.5 text-slate-600" strokeWidth={1.5} />
            <span>Thay đổi hạn hoàn thành...</span>
          </span>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <kbd className="font-mono text-[10px] px-1 py-0.2 bg-slate-100 border border-slate-200 rounded">D</kbd>
            <ChevronRight className="size-3" strokeWidth={1.5} />
          </div>
        </button>

        {activeSubmenu === "dueDate" && (
          <div
            role="menu"
            className="absolute left-full top-0 ml-1 w-48 rounded-lg border border-border/80 bg-white p-1 text-xs shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 z-50 space-y-0.5"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => handleQuickDueDate(0)}
              className="flex w-full items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-100/80 text-slate-700 text-left transition-colors cursor-pointer"
            >
              <span>Hôm nay</span>
              <span className="text-[10px] text-muted-foreground font-mono">T+0</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => handleQuickDueDate(1)}
              className="flex w-full items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-100/80 text-slate-700 text-left transition-colors cursor-pointer"
            >
              <span>Ngày mai</span>
              <span className="text-[10px] text-muted-foreground font-mono">T+1</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => handleQuickDueDate(7)}
              className="flex w-full items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-100/80 text-slate-700 text-left transition-colors cursor-pointer"
            >
              <span>Tuần tới (7 ngày)</span>
              <span className="text-[10px] text-muted-foreground font-mono">T+7</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleEndOfMonthDueDate}
              className="flex w-full items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-100/80 text-slate-700 text-left transition-colors cursor-pointer"
            >
              <span>Cuối tháng này</span>
            </button>
            <div className="pt-1 mt-1 border-t border-border/40 px-1">
              <VietnameseDatePicker
                value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                onChange={(val) => {
                  if (val) {
                    if (onDueDateChange) {
                      onDueDateChange(task.id, val);
                    } else {
                      updateTaskDueDate(task.id, val);
                    }
                    onClose();
                  }
                }}
                variant="input"
                placeholder="Chọn ngày cụ thể..."
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      <div className="my-1 border-t border-border/40" />

      {/* Item 6: Copy Link (⌘⇧C) */}
      <button
        type="button"
        role="menuitem"
        onClick={handleCopyLink}
        className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-slate-100/80 transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2">
          <Copy className="size-3.5 text-slate-500" strokeWidth={1.5} />
          <span>Sao chép liên kết</span>
        </span>
        <kbd className="font-mono text-[10px] px-1 py-0.2 bg-slate-100 border border-slate-200 rounded text-muted-foreground">
          ⌘⇧C
        </kbd>
      </button>

      {/* Item 7: Copy Task Code (⌘⌥C) */}
      <button
        type="button"
        role="menuitem"
        onClick={handleCopyCode}
        className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-slate-100/80 transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2">
          <Copy className="size-3.5 text-slate-500" strokeWidth={1.5} />
          <span>Sao chép mã nhiệm vụ</span>
        </span>
        <kbd className="font-mono text-[10px] px-1 py-0.2 bg-slate-100 border border-slate-200 rounded text-muted-foreground">
          ⌘⌥C
        </kbd>
      </button>

      {/* Item 8: View Detail (Enter) */}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onOpenDetail?.(task);
        }}
        className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-slate-100/80 transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2">
          <Eye className="size-3.5 text-slate-500" strokeWidth={1.5} />
          <span>Xem chi tiết nhiệm vụ</span>
        </span>
        <kbd className="font-mono text-[10px] px-1 py-0.2 bg-slate-100 border border-slate-200 rounded text-muted-foreground">
          Enter
        </kbd>
      </button>

      <div className="my-1 border-t border-border/40" />

      {/* Item 9: Delete Task */}
      <button
        type="button"
        role="menuitem"
        onClick={handleDeleteTask}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-md text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-left"
      >
        <Trash2 className="size-3.5" strokeWidth={1.5} />
        <span>Xóa / Hủy nhiệm vụ...</span>
      </button>
    </div>
  );
}
