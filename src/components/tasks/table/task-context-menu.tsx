"use client";

import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import {
  ChevronRight,
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
  type TaskActionResult,
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
import { usePersonnelList } from "@/hooks/use-personnel-list";
import { getTaskUnitId } from "@/lib/tasks/task-unit";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Pressable } from "@/components/ui/pressable";
import {
  MENU_ROW_CLASS as ROW,
  MenuSubmenuTitle as SubmenuTitle,
  MenuSheetHeader,
  SHEET_BACKDROP_CLASS,
  SHEET_POPUP_CLASS,
  SHEET_POSITIONER_CLASS,
} from "@/components/ui/menu";

/** Điện thoại: menu con không bay ngang mà thay thế nội dung trong bottom sheet (có nút quay lại ở đầu sheet). */
const MOBILE_INLINE_PANEL =
  "max-md:static! max-md:m-0! max-md:w-full! max-md:max-h-none! max-md:overflow-visible! max-md:bg-transparent max-md:p-0 max-md:shadow-none max-md:animate-none";
const SUBMENU_ONLY_ON_MOBILE = {
  status: "max-md:[&>*:not([data-submenu=status]):not([data-sheet-header])]:hidden",
  priority: "max-md:[&>*:not([data-submenu=priority]):not([data-sheet-header])]:hidden",
  assignee: "max-md:[&>*:not([data-submenu=assignee]):not([data-sheet-header])]:hidden",
  dueDate: "max-md:[&>*:not([data-submenu=dueDate]):not([data-sheet-header])]:hidden",
} as const;

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
  // Chuột lệch khỏi hàng/panel một chút không đóng ngay: chờ 200ms, vào lại thì hủy; mở menu con khác thì hủy luôn
  const leaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelLeave = React.useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);
  React.useEffect(() => {
    if (!expanded) cancelLeave();
    return cancelLeave;
  }, [expanded, cancelLeave]);

  return (
    <div
      className="relative"
      data-submenu={name}
      onMouseEnter={cancelLeave}
      onMouseLeave={() => {
        cancelLeave();
        leaveTimer.current = setTimeout(onLeave, 200);
      }}
    >
      <Pressable
        role="menuitem"
        aria-haspopup="true"
        aria-expanded={expanded}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") onOpen();
        }}
        onClick={onToggle}
        className={cn(ROW, expanded && "bg-accent")}
      >
        <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        <Kbd>{shortcut}</Kbd>
        <ChevronRight className="size-3 shrink-0 text-muted-foreground/70" />
      </Pressable>
      {expanded ? (
        <div
          role="menu"
          className={cn(
            panelPlacementClass,
            "rounded-[var(--radius-menu)] border-0 bg-popover p-1 text-xs shadow-menu animate-in fade-in-0 zoom-in-95 duration-100 z-50",
            panelClassName,
            MOBILE_INLINE_PANEL
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
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
      {selected ? <Check className="size-3.5 shrink-0 text-foreground" /> : null}
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
  availableAssignees: availableAssigneesProp,
}: TaskContextMenuProps) {
  // Đơn vị nào giao việc đơn vị đó: chỉ liệt kê cán bộ thuộc đơn vị chủ trì của nhiệm vụ
  const unitId = getTaskUnitId(task);
  const { personnel: unitPersonnel } = usePersonnelList({ enabled: isOpen && !availableAssigneesProp && Boolean(unitId), departmentId: unitId });
  const availableAssignees = React.useMemo(
    () =>
      availableAssigneesProp ??
      (unitId
        ? unitPersonnel.map((person) => ({ id: person.id, name: person.name, avatar: person.avatarUrl ?? undefined, department: person.departmentName }))
        : []),
    [availableAssigneesProp, unitId, unitPersonnel]
  );
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
      feedback.notifySuccess("Đã sao chép liên kết");
      onClose();
    } catch {
      onClose();
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(taskCode.toUpperCase());
      feedback.notifySuccess("Đã sao chép mã nhiệm vụ");
      onClose();
    } catch {
      onClose();
    }
  };

  const version = (task as { version?: number }).version;

  // Chạy một thao tác sửa nhanh: handler của nơi giữ dữ liệu (có thể ném lỗi) hoặc gọi API trực tiếp;
  // lỗi nào cũng báo cho người dùng thay vì nuốt mất, rồi mới đóng menu.
  const runEdit = async (
    viaHandler: (() => Promise<void> | void) | undefined,
    viaApi: () => Promise<TaskActionResult>,
    failureMessage: string
  ) => {
    try {
      if (viaHandler) {
        await viaHandler();
      } else {
        const res = await viaApi();
        if (!res.ok) feedback.notifyError(res.error || failureMessage, "Lỗi cập nhật");
      }
    } catch (err) {
      feedback.notifyError(err instanceof Error ? err.message : failureMessage, "Lỗi cập nhật");
    }
    onClose();
  };

  const handleToggleStar = async () => {
    const nextPriority: TaskPriority = currentPriority === "URGENT" ? "NORMAL" : "URGENT";
    await runEdit(
      onPriorityChange && (() => onPriorityChange(task.id, nextPriority)),
      () => updateTaskPriority(task.id, nextPriority),
      "Không thể cập nhật độ ưu tiên"
    );
  };

  const handleStatusSelect = async (status: TaskStatus) => {
    await runEdit(
      onStatusChange && (() => onStatusChange(task.id, status)),
      () => updateTaskStatus(task.id, status, undefined, version),
      "Không thể chuyển trạng thái nhiệm vụ"
    );
  };

  const handlePrioritySelect = async (priority: TaskPriority) => {
    await runEdit(
      onPriorityChange && (() => onPriorityChange(task.id, priority)),
      () => updateTaskPriority(task.id, priority),
      "Không thể cập nhật độ ưu tiên"
    );
  };

  const handleAssigneeSelect = async (personId: string, personName: string) => {
    await runEdit(
      onAssigneeChange && (() => onAssigneeChange(task.id, personId, personName)),
      () => updateTaskAssignee(task.id, personId, personName, version),
      "Không thể phân công người chủ trì"
    );
  };

  const handleSetDueDate = async (dateStr: string) => {
    await runEdit(
      onDueDateChange && (() => onDueDateChange(task.id, dateStr)),
      () => updateTaskDueDate(task.id, dateStr),
      "Không thể cập nhật hạn hoàn thành"
    );
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
      feedback.notifySuccess("Đã lưu trữ 1 nhiệm vụ.");
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
    "absolute z-50 before:absolute before:inset-y-0 before:w-3 before:content-['']",
    submenuPlacement.side === "right" ? "left-full ml-0.5 before:-left-3" : "right-full mr-0.5 before:-right-3",
    // Nâng lên so với hàng gốc để chuột đi chéo từ hàng sang mục đầu tiên không trượt ra ngoài
    submenuPlacement.align === "top" ? "-top-3" : "-bottom-3",
  );

  return (
    <>
    <Menu.Root open={isOpen && !showDeleteConfirm} onOpenChange={(open) => { if (!open) onClose(); }}>
    <Menu.Portal>
    <Menu.Backdrop className={SHEET_BACKDROP_CLASS} />
    <Menu.Positioner className={cn("z-50", SHEET_POSITIONER_CLASS)}
      anchor={position ? { getBoundingClientRect: () => new DOMRect(position.x, position.y, 0, 0) } : triggerElement}
      align="start"
      collisionPadding={12}
    >
    <Menu.Popup
      ref={menuRef}
      aria-label="Thao tác nhanh nhiệm vụ"
      className={cn(
        "w-60 select-none rounded-[var(--radius-menu)] border-0 bg-popover p-1 text-xs text-popover-foreground shadow-menu animate-in fade-in-0 zoom-in-95 duration-100",
        SHEET_POPUP_CLASS,
        "max-md:animate-none max-md:[&_[data-submenu]>[aria-haspopup=true][aria-expanded=true]]:hidden max-md:[&_[data-slot=menu-submenu-title]]:hidden",
        activeSubmenu && SUBMENU_ONLY_ON_MOBILE[activeSubmenu]
      )}
    >
      <MenuSheetHeader
        title={
          activeSubmenu
            ? { status: "Đổi trạng thái", priority: "Độ ưu tiên", assignee: "Người chủ trì", dueDate: "Hạn hoàn thành" }[activeSubmenu]
            : taskTitle
        }
        onBack={activeSubmenu ? () => setActiveSubmenu(null) : undefined}
      />
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
        panelClassName="w-60 max-h-64 overflow-y-auto overflow-x-hidden"
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
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") setCalendarOpen(true);
            }}
            onClick={() => setCalendarOpen((v) => !v)}
            className={cn(ROW, calendarOpen && "bg-accent")}
          >
            <span className="flex size-4 shrink-0 items-center justify-center">
              <TaskIconDeadline className="size-4 text-muted-foreground" />
            </span>
            <span className="flex-1 truncate">Chọn ngày khác</span>
            <ChevronRight className="size-3 shrink-0 text-muted-foreground/70" />
          </Pressable>
          {calendarOpen ? (
            <div
              role="dialog"
              aria-label="Chọn ngày hoàn thành"
              className={cn(
                submenuClass,
                "w-56 rounded-lg border border-border/80 bg-popover p-2 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 z-50",
                "max-md:static! max-md:mt-1 max-md:w-full! max-md:animate-none max-md:border-0 max-md:p-0 max-md:shadow-none"
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

      <MenuRow icon={<TaskIconTrash className="size-4" />} label="Xóa nhiệm vụ" onClick={handleDeleteTask} danger />

    </Menu.Popup>
    </Menu.Positioner>
    </Menu.Portal>
    </Menu.Root>


      {/* Destructive Confirmation Dialog */}
      <DestructiveConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setIsDeleting(false); }}
        onConfirm={handleConfirmDelete}
        title="Xóa nhiệm vụ?"
        entityName={taskTitle}
        description="sẽ được lưu trữ và không còn hiển thị trong danh sách nhiệm vụ đang hoạt động."
        confirmLabel="Xóa nhiệm vụ"
        cancelLabel="Giữ lại"
        irreversible
        isConfirming={isDeleting}
      />
    </>
  );
}
