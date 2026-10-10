"use client";

import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import {
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import {
  updateTaskStatus,
  updateTaskPriority,
  updateTaskAssignee,
  updateTaskDueDate,
  deleteTask,
} from "@/lib/tasks/task-actions";
import { CORE_STATUS_OPTIONS } from "@/domain/tasks/display-config";
import {
  TaskIconStatus,
  TaskIconPriority,
  TaskIconAssignee,
  TaskIconDeadline,
  TaskIconLink,
  TaskIconCopy,
  TaskIconView,
  TaskIconTrash,
  TaskIconPriorityUrgent,
  TaskIconPriorityHigh,
  TaskIconPriorityNormal,
  TaskIconPriorityLow,
} from "@/components/tasks/task-action-icons";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import { VietnameseDayCalendar } from "@/components/ui/vietnamese-day-calendar";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { useFeedback } from "@/components/ui/feedback-layer";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Pressable } from "@/components/ui/pressable";

const ROW =
  "flex w-full items-center gap-2 px-2 h-7 rounded-md text-left text-xs text-foreground cursor-pointer transition-colors outline-none hover:bg-accent focus-visible:bg-accent";

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="font-sans text-xs tabular-nums text-muted-foreground/80">{children}</kbd>;
}

/** Hàng thao tác ở menu chính: icon · nhãn · phím tắt. */
function MenuRow({
  icon,
  label,
  shortcut,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(ROW, danger && "text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10")}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {shortcut ? <Kbd>{shortcut}</Kbd> : null}
    </button>
  );
}

/** Hàng mở menu con: icon · nhãn · phím tắt · mũi tên. */
function SubmenuRow({
  name,
  icon,
  label,
  shortcut,
  expanded,
  onOpen,
  onToggle,
  onLeave,
  panelClassName,
  panelPlacementClass,
  children,
}: {
  name: string;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  expanded: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onLeave: () => void;
  panelClassName: string;
  panelPlacementClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative" data-submenu={name} onMouseLeave={onLeave}>
      <Pressable
        role="menuitem"
        aria-haspopup="true"
        aria-expanded={expanded}
        onMouseEnter={onOpen}
        onClick={onToggle}
        className={cn(ROW, expanded && "bg-accent")}
      >
        <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        <Kbd>{shortcut}</Kbd>
        <ChevronRight className="size-3 shrink-0 text-muted-foreground/70" strokeWidth={1.5} />
      </Pressable>
      {expanded ? (
        <div
          role="menu"
          className={cn(
            panelPlacementClass,
            "rounded-lg border border-border/80 bg-popover p-1 text-xs shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 z-50",
            panelClassName
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function SubmenuTitle({ children }: { children: React.ReactNode }) {
  return <div className="px-2 pt-1 pb-1 text-xs text-muted-foreground select-none">{children}</div>;
}

/** Hàng lựa chọn trong menu con: [leading] nhãn · gợi ý · dấu chọn. */
function OptionRow({
  leading,
  label,
  hint,
  selected,
  onClick,
}: {
  leading?: React.ReactNode;
  label: React.ReactNode;
  hint?: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <Pressable
      role="menuitem"
      aria-current={selected ? "true" : undefined}
      onClick={onClick}
      className={cn(ROW, selected && "bg-accent font-medium")}
    >
      {leading ? <span className="flex size-4 shrink-0 items-center justify-center">{leading}</span> : null}
      <span className="flex-1 truncate">{label}</span>
      {hint ? <span className="text-xs tabular-nums text-muted-foreground/80">{hint}</span> : null}
      {selected ? <Check className="size-3.5 shrink-0 text-foreground" strokeWidth={1.5} /> : null}
    </Pressable>
  );
}

/** Ngày hiện tại theo giờ Việt Nam + n ngày, dạng YYYY-MM-DD. */
function vnDatePlus(days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function vnEndOfMonth(): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const [y, m] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

const shortDate = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

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
  // Phím số 1-9 chọn nhanh mục trong menu con đang mở (như Linear)
  const digitSelectRef = React.useRef<((digit: number) => void) | null>(null);
  const [activeSubmenu, setActiveSubmenu] = React.useState<ActiveSubmenu>(null);
  // Hướng mở của menu con: tự lật trái/lên khi sát mép màn hình để không bị cắt
  const [submenuPlacement, setSubmenuPlacement] = React.useState<{ side: "right" | "left"; align: "top" | "bottom" }>({
    side: "right",
    align: "top",
  });

  const toggleSubmenu = React.useCallback((name: Exclude<ActiveSubmenu, null>, mode: "open" | "toggle" = "toggle") => {
    const item = menuRef.current?.querySelector<HTMLElement>(`[data-submenu="${name}"]`);
    if (item && menuRef.current) {
      const itemRect = item.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();
      // Menu hạn hoàn thành có thêm cấp 3 (lịch) nên cần chừa nhiều chỗ hơn
      const SUBMENU_WIDTH = name === "dueDate" ? 470 : 220;
      const SUBMENU_HEIGHT = 280;
      setSubmenuPlacement({
        side: menuRect.right + SUBMENU_WIDTH + 8 > window.innerWidth ? "left" : "right",
        align: itemRect.top + SUBMENU_HEIGHT > window.innerHeight ? "bottom" : "top",
      });
    }
    setActiveSubmenu((prev) => (mode === "open" ? name : prev === name ? null : name));
  }, []);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [copiedNotification, setCopiedNotification] = React.useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const feedback = useFeedback();
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    router = useRouter();
  } catch {
    // Graceful fallback for non-App-Router or test environments
  }

  React.useEffect(() => {
    if (!isOpen) return;
    setActiveSubmenu(null);
    setCalendarOpen(false);
    setShowDeleteConfirm(false);
    setIsDeleting(false);
  }, [isOpen, position]);

  React.useEffect(() => {
    if (activeSubmenu !== "dueDate") setCalendarOpen(false);
  }, [activeSubmenu]);

  // Đổi hạn trực tiếp cần task.assign; người thực hiện dùng Xin gia hạn (T-01).
  const actions = (task as { availableActions?: unknown } | null)?.availableActions;
  const canChangeDueDate = !Array.isArray(actions) || actions.includes("task.assign");

  // ponytail: click-outside + Escape + focus trap → Base UI Popover
  React.useEffect(() => {
    if (!isOpen || !task) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "s") { e.preventDefault(); toggleSubmenu("status"); }
      else if (key === "p") { e.preventDefault(); toggleSubmenu("priority"); }
      else if (key === "a") { e.preventDefault(); toggleSubmenu("assignee"); }
      else if (key === "d" && canChangeDueDate) { e.preventDefault(); toggleSubmenu("dueDate"); }
      else if (/^[1-9]$/.test(e.key) && digitSelectRef.current) { digitSelectRef.current(Number(e.key)); }
      else if (e.key === "Enter") { e.preventDefault(); onClose(); onOpenDetail?.(task); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, task, onOpenDetail, toggleSubmenu, canChangeDueDate]);

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
      await updateTaskStatus(task.id, status, undefined, (task as any).version);
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

  const handleSetDueDate = async (dateStr: string) => {
    if (onDueDateChange) {
      await onDueDateChange(task.id, dateStr);
    } else {
      await updateTaskDueDate(task.id, dateStr);
    }
    onClose();
  };

  const handleDeleteTask = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    // Optimistic: remove từ UI ngay lập tức
    window.dispatchEvent(new CustomEvent("qcet:task-archived", { detail: { taskId: task.id, optimistic: true } }));
    setShowDeleteConfirm(false);
    onClose();
    setIsDeleting(true);
    try {
      if (onDeleteTask) {
        await onDeleteTask(task.id);
      } else {
        const result = await deleteTask(task.id, Number((task as any).version ?? 1) || 0);
        if (!result.ok) {
          // Rollback: trả task về danh sách
          window.dispatchEvent(new CustomEvent("qcet:task-archive-rollback", { detail: { taskId: task.id } }));
          feedback.notifyError(result.error || "Không thể xóa/hủy nhiệm vụ. Vui lòng thử lại.");
          return;
        }
      }
      feedback.notifySuccess(`Đã lưu trữ "${taskTitle}".`);
      // Confirm: refresh để sync server truth
      window.dispatchEvent(new CustomEvent("qcet:task-archived", { detail: { taskId: task.id, optimistic: false } }));
      router?.refresh();
    } catch (err) {
      window.dispatchEvent(new CustomEvent("qcet:task-archive-rollback", { detail: { taskId: task.id } }));
      feedback.notifyError(
        err instanceof Error ? err.message : "Không thể xóa/hủy nhiệm vụ. Vui lòng thử lại."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const PRIORITY_OPTIONS: Array<{ priority: TaskPriority; label: string; icon: React.ComponentType<any>; color: string }> = [
    { priority: "URGENT", label: "Khẩn cấp", icon: TaskIconPriorityUrgent, color: "text-destructive" },
    { priority: "HIGH", label: "Ưu tiên cao", icon: TaskIconPriorityHigh, color: "text-foreground/70" },
    { priority: "NORMAL", label: "Bình thường", icon: TaskIconPriorityNormal, color: "text-muted-foreground" },
    { priority: "LOW", label: "Thấp", icon: TaskIconPriorityLow, color: "text-muted-foreground/50" },
  ];

  digitSelectRef.current = (digit: number) => {
    if (activeSubmenu === "status") {
      const opt = CORE_STATUS_OPTIONS[digit - 1];
      if (opt) handleStatusSelect(opt.value);
    } else if (activeSubmenu === "priority") {
      const opt = PRIORITY_OPTIONS[digit - 1];
      if (opt) handlePrioritySelect(opt.priority);
    }
  };

  const submenuClass = cn(
    "absolute z-50 before:absolute before:inset-y-0 before:w-2 before:content-['']",
    submenuPlacement.side === "right" ? "left-full ml-1 before:-left-2" : "right-full mr-1 before:-right-2",
    submenuPlacement.align === "top" ? "-top-1" : "-bottom-1",
  );

  return (
    <>
    <Menu.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
    <Menu.Portal>
    <Menu.Positioner className="z-50"
      anchor={position ? { getBoundingClientRect: () => new DOMRect(position.x, position.y, 0, 0) } : triggerElement}
      align="start"
      collisionPadding={12}
    >
    <Menu.Popup
      ref={menuRef}
      aria-label="Thao tác nhanh nhiệm vụ"
      className="w-60 select-none rounded-lg border border-border/80 bg-popover p-1 text-xs text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 duration-100"
    >
      {/* Copied Feedback Toast */}
      {copiedNotification && (
        <div className="mb-1 rounded bg-foreground px-2 py-1 text-center font-medium text-background shadow-xs">
          {copiedNotification}
        </div>
      )}

      {/* Task header: mã + tiêu đề */}
      <div className="px-2 pt-1 pb-1.5 mb-1 border-b border-border/40">
        <div className="font-mono text-xs uppercase text-muted-foreground truncate">{taskCode}</div>
        <div className="text-xs font-medium text-foreground truncate" title={taskTitle}>
          {taskTitle}
        </div>
      </div>

      <MenuRow
        icon={
          <TaskIconPriorityUrgent
            className={cn("size-4", currentPriority === "URGENT" ? "text-destructive" : "text-muted-foreground")}
          />
        }
        label={currentPriority === "URGENT" ? "Bỏ ưu tiên khẩn cấp" : "Đánh dấu khẩn cấp"}
        onClick={handleToggleStar}
      />

      <SubmenuRow
        name="status"
        icon={<TaskIconStatus className="size-4 text-muted-foreground" />}
        label="Đổi trạng thái"
        shortcut="S"
        expanded={activeSubmenu === "status"}
        onOpen={() => toggleSubmenu("status", "open")}
        onToggle={() => toggleSubmenu("status")}
        onLeave={() => setActiveSubmenu(null)}
        panelClassName="w-48"
        panelPlacementClass={submenuClass}
      >
        <SubmenuTitle>Trạng thái</SubmenuTitle>
        {CORE_STATUS_OPTIONS.map((opt, index) => (
          <OptionRow
            key={opt.value}
            leading={<TaskStatusCircle status={opt.value} />}
            label={opt.label}
            hint={index + 1}
            selected={currentStatus === opt.value}
            onClick={() => handleStatusSelect(opt.value)}
          />
        ))}
      </SubmenuRow>

      <SubmenuRow
        name="priority"
        icon={<TaskIconPriority className="size-4 text-muted-foreground" />}
        label="Đặt độ ưu tiên"
        shortcut="P"
        expanded={activeSubmenu === "priority"}
        onOpen={() => toggleSubmenu("priority", "open")}
        onToggle={() => toggleSubmenu("priority")}
        onLeave={() => setActiveSubmenu(null)}
        panelClassName="w-48"
        panelPlacementClass={submenuClass}
      >
        <SubmenuTitle>Độ ưu tiên</SubmenuTitle>
        {PRIORITY_OPTIONS.map((opt, index) => {
          const Icon = opt.icon;
          return (
            <OptionRow
              key={opt.priority}
              leading={<Icon className={cn("size-4", opt.color)} />}
              label={opt.label}
              hint={index + 1}
              selected={currentPriority === opt.priority}
              onClick={() => handlePrioritySelect(opt.priority)}
            />
          );
        })}
      </SubmenuRow>

      <SubmenuRow
        name="assignee"
        icon={<TaskIconAssignee className="size-4 text-muted-foreground" />}
        label="Gán người chủ trì"
        shortcut="A"
        expanded={activeSubmenu === "assignee"}
        onOpen={() => toggleSubmenu("assignee", "open")}
        onToggle={() => toggleSubmenu("assignee")}
        onLeave={() => setActiveSubmenu(null)}
        panelClassName="w-60 max-h-64 overflow-y-auto"
        panelPlacementClass={submenuClass}
      >
        <SubmenuTitle>Người chủ trì (DRI)</SubmenuTitle>
        {availableAssignees.length > 0 ? (
          availableAssignees.map((person) => {
            const currentLeadName = (task as SchoolTask).leadAssigneeName || (task as StaffTask).assigneeName;
            return (
              <OptionRow
                key={person.id}
                leading={<UserAvatar name={person.name} avatarUrl={person.avatar} size="sm" />}
                label={person.name}
                selected={currentLeadName === person.name}
                onClick={() => handleAssigneeSelect(person.id, person.name)}
              />
            );
          })
        ) : (
          <div className="px-2 py-1.5 text-muted-foreground text-center text-xs">Chưa có danh sách cán bộ / nhân sự</div>
        )}
      </SubmenuRow>

      {canChangeDueDate ? (
      <SubmenuRow
        name="dueDate"
        icon={<TaskIconDeadline className="size-4 text-muted-foreground" />}
        label="Đổi hạn hoàn thành"
        shortcut="D"
        expanded={activeSubmenu === "dueDate"}
        onOpen={() => toggleSubmenu("dueDate", "open")}
        onToggle={() => toggleSubmenu("dueDate")}
        onLeave={() => setActiveSubmenu(null)}
        panelClassName="w-52"
        panelPlacementClass={submenuClass}
      >
        <SubmenuTitle>Hạn hoàn thành</SubmenuTitle>
        {[
          { label: "Hôm nay", date: vnDatePlus(0) },
          { label: "Ngày mai", date: vnDatePlus(1) },
          { label: "Tuần tới", date: vnDatePlus(7) },
          { label: "Cuối tháng này", date: vnEndOfMonth() },
        ].map((opt) => (
          <OptionRow
            key={opt.label}
            label={opt.label}
            hint={shortDate(opt.date)}
            selected={task.dueDate?.slice(0, 10) === opt.date}
            onClick={() => handleSetDueDate(opt.date)}
          />
        ))}
        <div className="pt-1 mt-1 border-t border-border/40 relative">
          <Pressable
            role="menuitem"
            aria-haspopup="dialog"
            aria-expanded={calendarOpen}
            onMouseEnter={() => setCalendarOpen(true)}
            onClick={() => setCalendarOpen((v) => !v)}
            className={cn(ROW, calendarOpen && "bg-accent")}
          >
            <span className="flex size-4 shrink-0 items-center justify-center">
              <TaskIconDeadline className="size-4 text-muted-foreground" />
            </span>
            <span className="flex-1 truncate">Chọn ngày khác</span>
            <ChevronRight className="size-3 shrink-0 text-muted-foreground/70" strokeWidth={1.5} />
          </Pressable>
          {calendarOpen ? (
            <div
              role="dialog"
              aria-label="Chọn ngày hoàn thành"
              className={cn(
                submenuClass,
                "w-56 rounded-lg border border-border/80 bg-popover p-2 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 z-50"
              )}
            >
              <VietnameseDayCalendar
                value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                onSelect={handleSetDueDate}
              />
            </div>
          ) : null}
        </div>
      </SubmenuRow>
      ) : null}

      <div className="my-1 border-t border-border/40" />

      <MenuRow icon={<TaskIconLink className="size-4 text-muted-foreground" />} label="Sao chép liên kết" shortcut="⌘⇧C" onClick={handleCopyLink} />
      <MenuRow icon={<TaskIconCopy className="size-4 text-muted-foreground" />} label="Sao chép mã nhiệm vụ" shortcut="⌘⌥C" onClick={handleCopyCode} />
      <MenuRow
        icon={<TaskIconView className="size-4 text-muted-foreground" />}
        label="Xem chi tiết"
        shortcut="Enter"
        onClick={() => {
          onClose();
          onOpenDetail?.(task);
        }}
      />

      <div className="my-1 border-t border-border/40" />

      <MenuRow icon={<TaskIconTrash className="size-4" />} label="Xóa / Hủy nhiệm vụ" onClick={handleDeleteTask} danger />

    </Menu.Popup>
    </Menu.Positioner>
    </Menu.Portal>
    </Menu.Root>


      {/* Destructive Confirmation Dialog */}
      <DestructiveConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setIsDeleting(false); }}
        onConfirm={handleConfirmDelete}
        title="Xóa / Hủy nhiệm vụ"
        entityName={taskTitle}
        description="sẽ được lưu trữ và không còn hiển thị trong danh sách nhiệm vụ đang hoạt động."
        confirmLabel="Xóa / Hủy nhiệm vụ"
        cancelLabel="Giữ lại"
        irreversible
        isConfirming={isDeleting}
      />
    </>
  );
}
