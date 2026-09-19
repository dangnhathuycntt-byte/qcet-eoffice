"use client";

import * as React from "react";
import { Select } from "@base-ui/react/select";
import { Combobox } from "@base-ui/react/combobox";
import { Popover } from "@base-ui/react/popover";
import styles from "../task-detail-page.module.css";
import {
  X,
  Signal,
  UserPlus,
  Check,
  ChevronDown,
  Clock3,
  Link2,
  Users,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { STATUS_OPTIONS, PRIORITY_OPTIONS, computeDueStatus } from "./task-identity-block";
import { formatAssigneeNameWithTitle } from "@/lib/format/personnel";
import { formatDisplayDate } from "@/lib/format/date";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { DirectInlineEditor } from "./direct-inline-editor";
import { TaskNotionBlockContent } from "./task-notion-block-content";
import { updateTaskStatus, updateTaskPriority, updateTaskAssignee, updateTaskDueDate, updateTaskStartDate } from "@/lib/tasks/task-actions";
import { getTaskDetailUrl } from "@/lib/tasks/task-detail-navigation";
import { useFeedback } from "@/components/ui/feedback-layer";

export interface SubtaskDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  subtask: StaffTask | null;
  parentTaskId: string;
  canEdit?: boolean;
  onSubtaskUpdated?: (updated: StaffTask) => void;
  /** All siblings of the current child (parent's subTasks) */
  siblings?: StaffTask[];
  /** Navigate to a sibling child */
  onSelectSibling?: (st: StaffTask) => void;
  /** Open create-subtask flow */
  onAddSubtask?: () => void;
}

export function SubtaskDetailDrawer({
  isOpen,
  onClose,
  subtask: initialSubtask,
  parentTaskId,
  canEdit = true,
  onSubtaskUpdated,
  siblings = [],
  onSelectSibling,
  onAddSubtask,
}: SubtaskDetailDrawerProps) {
  const { notifySuccess, notifyError } = useFeedback();
  const [subtask, setSubtask] = React.useState<StaffTask | null>(initialSubtask);

  React.useEffect(() => {
    setSubtask(initialSubtask);
    setIsDeadlineEditorOpen(false);
  }, [initialSubtask]);

  // Dropdown states
  const [isDeadlineEditorOpen, setIsDeadlineEditorOpen] = React.useState(false);
  const [isReassigning, setIsReassigning] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadlineRef = React.useRef<HTMLDivElement>(null);
  const [personnelList, setPersonnelList] = React.useState<
    Array<{ id: string; name: string; email?: string; departmentName?: string }>
  >([]);

  React.useEffect(() => {
    if (!canEdit) return;
    fetch("/api/users")
      .then((response) => response.json())
      .then((data) => {
        if (!data.success || !Array.isArray(data.users)) return;
        setPersonnelList(data.users.map((user: any) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          departmentName: user.department?.name || user.departmentName || "Đơn vị",
        })));
      })
      .catch(() => {});
  }, [canEdit]);

  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Close deadline popover on outside click
  React.useEffect(() => {
    if (!isDeadlineEditorOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (deadlineRef.current && !deadlineRef.current.contains(e.target as Node)) {
        setIsDeadlineEditorOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isDeadlineEditorOpen]);

  // Status & Priority objects
  const currentStatusObj =
    STATUS_OPTIONS.find((s) => s.value === subtask?.status) || STATUS_OPTIONS[0];

  const currentPriorityVal =
    (subtask as any)?.priority === "MEDIUM"
      ? "NORMAL"
      : (subtask as any)?.priority || "NORMAL";
  const currentPriorityObj =
    PRIORITY_OPTIONS.find((p) => p.value === currentPriorityVal) || PRIORITY_OPTIONS[2];

  const assigneeDisplay = formatAssigneeNameWithTitle(subtask?.assigneeName);

  // Dates
  const rawStartDate = (subtask as any)?.startDate;
  const startDateIso = rawStartDate
    ? typeof rawStartDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawStartDate)
      ? rawStartDate.slice(0, 10)
      : new Date(rawStartDate).toISOString().slice(0, 10)
    : "";

  const dueDateIso = subtask?.dueDate
    ? typeof subtask.dueDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(subtask.dueDate)
      ? subtask.dueDate.slice(0, 10)
      : new Date(subtask.dueDate).toISOString().slice(0, 10)
    : "";

  const dueInfo = computeDueStatus(subtask?.dueDate);

  // Handlers
  const handleTitleChange = async (newTitle: string) => {
    if (!subtask) return;
    const currentVersion = typeof (subtask as any).version === "number" ? (subtask as any).version : undefined;
    const res = await fetch(`/api/tasks/${subtask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        ...(currentVersion !== undefined ? { expectedVersion: currentVersion } : {}),
      }),
    });
    if (!res.ok) throw new Error("Không thể lưu tiêu đề việc thành phần");

    const data = await res.json().catch(() => null);
    const nextVersion = data?.data?.version ?? data?.task?.version ?? (currentVersion ? currentVersion + 1 : 1);
    const updated = { ...subtask, title: newTitle.trim(), version: nextVersion };
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
  };

  const handleDescriptionChange = async (newDesc: string) => {
    if (!subtask) return;
    const trimmed = newDesc.trim();

    // Skip saving if description unchanged from what we already have
    const currentDesc = (subtask as any).description || subtask.deliverableDescription || "";
    if (trimmed === currentDesc.trim()) return;

    // Fetch latest version from server to avoid OCC conflict
    let latestVersion: number | undefined;
    try {
      const freshRes = await fetch(`/api/tasks/${subtask.id}`);
      if (freshRes.ok) {
        const freshData = await freshRes.json().catch(() => null);
        const freshTask = freshData?.data ?? freshData?.task;
        latestVersion = typeof freshTask?.version === "number" ? freshTask.version : undefined;
      }
    } catch { /* proceed without fresh version */ }

    const versionToSend = latestVersion ?? (typeof (subtask as any).version === "number" ? (subtask as any).version : undefined);

    const res = await fetch(`/api/tasks/${subtask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: trimmed,
        ...(versionToSend !== undefined ? { expectedVersion: versionToSend } : {}),
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const serverMsg = errBody?.error || errBody?.message || "";
      throw new Error(serverMsg || "Không thể lưu mô tả việc thành phần");
    }

    const data = await res.json().catch(() => null);
    const nextVersion = data?.data?.version ?? data?.task?.version ?? (versionToSend ? versionToSend + 1 : 1);
    const updated = { ...subtask, deliverableDescription: trimmed, description: trimmed, version: nextVersion } as StaffTask;
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!subtask) return;
    const currentVersion = typeof (subtask as any).version === "number" ? (subtask as any).version : undefined;
    const res = await updateTaskStatus(subtask.id, newStatus, undefined, currentVersion);
    if (!res.ok) {
      notifyError(res.reason || res.error || "Không thể cập nhật trạng thái nhiệm vụ thành phần", "Lỗi đổi trạng thái");
      return;
    }

    const nextVersion = (res.data as any)?.version ?? (res.data as any)?.data?.version ?? (currentVersion ? currentVersion + 1 : 1);
    const updated = { ...subtask, status: newStatus, version: nextVersion };
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
    notifySuccess("Đã cập nhật trạng thái việc thành phần");
  };

  const handlePriorityChange = async (newPriority: TaskPriority) => {
    if (!subtask) return;
    const currentVersion = typeof (subtask as any).version === "number" ? (subtask as any).version : undefined;
    const res = await updateTaskPriority(subtask.id, newPriority, currentVersion);
    if (!res.ok) {
      notifyError(res.error || "Không thể cập nhật độ ưu tiên", "Lỗi cập nhật");
      return;
    }

    const cleanPriority: TaskPriority = newPriority === "MEDIUM" ? "NORMAL" : newPriority;
    const nextVersion = (res.data as any)?.data?.version ?? (res.data as any)?.version ?? (currentVersion ? currentVersion + 1 : 1);
    const updated = { ...subtask, priority: cleanPriority, version: nextVersion };
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
    notifySuccess("Đã cập nhật độ ưu tiên việc thành phần");
  };

  const handleAssigneeChange = async (person: { id: string; name: string }) => {
    if (!subtask) return;
    setIsReassigning(true);
    const result = await updateTaskAssignee(subtask.id, person.id, person.name);
    setIsReassigning(false);
    if (!result.ok) {
      notifyError(result.error || "Không thể cập nhật người phụ trách", "Lỗi cập nhật");
      return;
    }

    const currentVersion = typeof (subtask as any).version === "number" ? (subtask as any).version : undefined;
    const nextVersion = (result.data as any)?.data?.version ?? (result.data as any)?.version ?? (currentVersion ? currentVersion + 1 : 1);
    const updated = {
      ...subtask,
      assigneeId: person.id,
      assigneeName: person.name,
      version: nextVersion,
    } as StaffTask;
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
    notifySuccess("Đã cập nhật người phụ trách việc thành phần");
  };

  const handleStartDateChange = async (newStartDate: string) => {
    if (!subtask) return;
    const res = await updateTaskStartDate(subtask.id, newStartDate, (subtask as any).version);
    if (!res.ok) {
      notifyError(res.error || "Không thể cập nhật ngày bắt đầu", "Lỗi cập nhật");
      return;
    }

    const nextVersion = (res.data as any)?.data?.version ?? (res.data as any)?.task?.version ?? (subtask as any).version;
    const updated = { ...subtask, startDate: newStartDate, version: nextVersion } as StaffTask;
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
    notifySuccess("Đã cập nhật ngày bắt đầu việc con");
  };

  const handleDueDateChange = async (newDueDate: string) => {
    if (!subtask) return;
    const res = await updateTaskDueDate(subtask.id, newDueDate, (subtask as any).version);
    if (!res.ok) {
      notifyError(res.error || "Không thể cập nhật hạn hoàn thành", "Lỗi cập nhật");
      return;
    }

    const nextVersion = (res.data as any)?.data?.version ?? (res.data as any)?.task?.version ?? (subtask as any).version;
    const updated = { ...subtask, dueDate: newDueDate, version: nextVersion };
    setSubtask(updated);
    onSubtaskUpdated?.(updated);
    notifySuccess("Đã cập nhật hạn hoàn thành việc con");
  };

  // Peek keyboard: Esc closes, ArrowUp/ArrowDown navigates siblings
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable ||
        !!target?.closest("[role='combobox'], [role='listbox'], [role='menu'], [data-slate-editor]");
      if (isEditing) return;

      if (e.key === "Escape") {
        onClose();
        return;
      }

      // ArrowUp/ArrowDown — navigate siblings
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && onSelectSibling && siblings.length > 1) {
        e.preventDefault();
        const currentIdx = subtask ? siblings.findIndex((st) => st.id === subtask.id) : -1;
        if (currentIdx === -1) return;
        const direction = e.key === "ArrowDown" ? 1 : -1;
        const nextIdx = (currentIdx + direction + siblings.length) % siblings.length;
        onSelectSibling(siblings[nextIdx]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onSelectSibling, siblings, subtask]);

  const handleCopyLink = React.useCallback(async () => {
    if (typeof window === "undefined" || !subtask) return;
    try {
      const url = getTaskDetailUrl(parentTaskId, subtask.id);
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedLink(false), 2000);
      notifySuccess("Đã sao chép liên kết việc thành phần");
    } catch {
      notifyError("Không thể sao chép liên kết", "Lỗi clipboard");
    }
  }, [notifySuccess, notifyError, subtask, parentTaskId]);

  if (!isOpen || !subtask) return null;

  // Sibling switcher data
  const currentIndex = siblings.findIndex((st) => st.id === subtask.id);
  const siblingPosition = currentIndex >= 0 ? currentIndex + 1 : 1;
  const siblingTotal = siblings.length;

  const description = (subtask as any).description || subtask.deliverableDescription || "";
  const startDateLabel = startDateIso ? formatDisplayDate(startDateIso) : "Chưa đặt";
  const dueDateLabel = dueDateIso ? formatDisplayDate(dueDateIso) : "Chưa đặt";
  const selectedAssignee = personnelList.find((person) =>
    person.id === (subtask as any).assigneeId || person.name === subtask.assigneeName
  ) || null;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-2xs animate-in fade-in duration-200 motion-reduce:animate-none lg:hidden"
      />

      <aside
        role="dialog"
        aria-label={`Chi tiết việc thành phần: ${subtask.title}`}
        className={styles.peekSurface}
      >
        <div className="group/peek-header flex h-12 shrink-0 items-center gap-1 border-b border-border px-3 select-none">
          {/* Sibling switcher trigger — left side */}
          {siblings.length > 0 && (
            <Popover.Root>
              <Popover.Trigger
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>Việc con</span>
                <span className="tabular-nums font-medium text-foreground">{siblingPosition}/{siblingTotal}</span>
                <ChevronDown className="size-3 opacity-60" strokeWidth={1.5} />
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner className="z-50" align="start" sideOffset={4} collisionPadding={8}>
                  <Popover.Popup className="w-72 rounded-lg border border-border bg-popover shadow-lg animate-in fade-in-0 duration-150">
                    {/* Popover header */}
                    <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
                      <span className="text-xs font-medium text-foreground">Việc con</span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">{siblingPosition}/{siblingTotal}</span>
                    </div>
                    {/* Sibling list */}
                    <div className="max-h-64 overflow-y-auto overscroll-contain px-1 pb-1">
                      {siblings.map((sib) => {
                        const isSelected = sib.id === subtask.id;
                        const statusObj = STATUS_OPTIONS.find((s) => s.value === sib.status) || STATUS_OPTIONS[0];
                        return (
                          <Popover.Close
                            key={sib.id}
                            onClick={() => {
                              if (!isSelected && onSelectSibling) onSelectSibling(sib);
                            }}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isSelected
                                ? "bg-muted/60 font-medium"
                                : "hover:bg-muted/40"
                            )}
                          >
                            <span className={cn("size-2 shrink-0 rounded-full", statusObj.dotClass)} />
                            <span className="min-w-0 truncate flex-1">{sib.title}</span>
                            {isSelected && <Check className="size-3 shrink-0 text-muted-foreground" />}
                          </Popover.Close>
                        );
                      })}
                    </div>
                    {/* Add subtask */}
                    {onAddSubtask && (
                      <div className="border-t border-border/40 px-1 py-1">
                        <Popover.Close
                          onClick={onAddSubtask}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Plus className="size-3.5" strokeWidth={1.5} />
                          <span>Thêm việc con</span>
                        </Popover.Close>
                      </div>
                    )}
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Copy link — subtle, visible on hover/focus */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex size-8 items-center justify-center text-muted-foreground/0 group-hover/peek-header:text-muted-foreground/60 hover:!text-foreground active:!text-foreground transition-colors cursor-pointer focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Sao chép liên kết"
            aria-label="Sao chép liên kết việc thành phần"
          >
            {copiedLink ? (
              <Check className="size-3.5 text-emerald-600" />
            ) : (
              <Link2 className="size-3.5" />
            )}
          </button>
          {/* Close — always visible */}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground active:scale-[0.96] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Đóng (Esc)"
            aria-label="Đóng chi tiết việc con"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden break-words px-6 pt-5 pb-6 overscroll-contain">
          {/* Child title first */}
          <div className="space-y-1.5">
            <DirectInlineEditor
              value={subtask.title}
              onSave={handleTitleChange}
              canEdit={canEdit}
              as="h2"
              multiline={false}
              submitOnEnter={true}
              ariaLabel="Tên việc thành phần"
              placeholder="Nhập tên việc thành phần..."
              viewClassName="text-[21px] font-semibold tracking-tight text-foreground leading-snug"
              editorClassName="text-[21px] font-semibold tracking-tight text-foreground leading-snug"
            />
          </div>

          <section aria-label="Thuộc tính việc thành phần" className="mt-4 space-y-0.5 text-xs select-none">
            <Select.Root
              value={subtask.status}
              onValueChange={(value) => void handleStatusChange(value as TaskStatus)}
              disabled={!canEdit}
            >
              <Select.Trigger className="group flex min-h-7 w-full items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none transition-colors hover:bg-muted/60 disabled:cursor-default">
                <span className={cn("size-2 shrink-0 rounded-full", currentStatusObj.dotClass)} />
                <Select.Value>{() => <span className="font-normal text-foreground">{currentStatusObj.label}</span>}</Select.Value>
                {canEdit && <Select.Icon><ChevronDown className="ml-auto size-3 text-muted-foreground/60" /></Select.Icon>}
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner className="z-50" align="start" sideOffset={4}>
                  <Select.Popup className="w-48 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
                    <Select.List>
                      {STATUS_OPTIONS.map((option) => (
                        <Select.Item
                          key={option.value}
                          value={option.value}
                          className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1 text-left text-xs outline-none data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:font-medium data-[selected]:text-primary"
                        >
                          <span className="flex items-center gap-1.5">
                            <span className={cn("size-1.5 rounded-full", option.dotClass)} />
                            <Select.ItemText>{option.label}</Select.ItemText>
                          </span>
                          <Select.ItemIndicator><Check className="size-3 text-primary" /></Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>

            <Select.Root
              value={currentPriorityVal}
              onValueChange={(value) => void handlePriorityChange(value as TaskPriority)}
              disabled={!canEdit}
            >
              <Select.Trigger className="group flex min-h-7 w-full items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none transition-colors hover:bg-muted/60 disabled:cursor-default">
                <Signal className={cn("size-3.5 shrink-0", currentPriorityObj.iconClass)} />
                <Select.Value>{() => <span className="font-normal text-foreground">{currentPriorityObj.label}</span>}</Select.Value>
                {canEdit && <Select.Icon><ChevronDown className="ml-auto size-3 text-muted-foreground/60" /></Select.Icon>}
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner className="z-50" align="start" sideOffset={4}>
                  <Select.Popup className="w-48 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
                    <Select.List>
                      {PRIORITY_OPTIONS.map((option) => (
                        <Select.Item
                          key={option.value}
                          value={option.value}
                          className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1 text-left text-xs outline-none data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:font-medium data-[selected]:text-primary"
                        >
                          <span className="flex items-center gap-1.5">
                            <Signal className={cn("size-3", option.iconClass)} />
                            <Select.ItemText>{option.label}</Select.ItemText>
                          </span>
                          <Select.ItemIndicator><Check className="size-3 text-primary" /></Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>

            <Combobox.Root
              items={personnelList}
              value={selectedAssignee}
              onValueChange={(person) => {
                if (person) void handleAssigneeChange(person);
              }}
              itemToStringLabel={(person) => person.name}
              itemToStringValue={(person) => person.id}
              isItemEqualToValue={(person, value) => person.id === value.id}
              filter={(person, query) => {
                const normalized = query.trim().toLocaleLowerCase("vi");
                if (!normalized) return true;
                return [person.name, person.email, person.departmentName]
                  .filter(Boolean)
                  .some((text) => text!.toLocaleLowerCase("vi").includes(normalized));
              }}
              autoHighlight
              disabled={!canEdit || isReassigning}
            >
              <Combobox.Trigger className="flex min-h-7 w-full items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none transition-colors hover:bg-muted/60 disabled:cursor-default">
                {isReassigning ? (
                  <Clock3 className="size-3.5 shrink-0 animate-spin text-primary" />
                ) : (
                  <UserPlus className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate font-normal text-foreground">{assigneeDisplay}</span>
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner className="z-50" align="start" sideOffset={4}>
                  <Combobox.Popup className="w-64 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
                    <Combobox.InputGroup className="m-1 border-b border-border/40 pb-1.5">
                      <Combobox.Input
                        placeholder="Tìm cán bộ..."
                        className="h-8 w-full rounded-md bg-muted/40 px-2 text-xs outline-none focus:bg-background"
                      />
                    </Combobox.InputGroup>
                    <Combobox.Empty className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                      Không tìm thấy cán bộ phù hợp
                    </Combobox.Empty>
                    <Combobox.List className="max-h-64 overflow-y-auto overscroll-contain outline-none">
                      {(person) => (
                        <Combobox.Item
                          key={person.id}
                          value={person}
                          className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-xs outline-none data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:text-primary"
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{person.name}</span>
                            {person.departmentName && <span className="block truncate text-[10px] text-muted-foreground">{person.departmentName}</span>}
                          </span>
                          <Combobox.ItemIndicator><Check className="size-3 text-primary" /></Combobox.ItemIndicator>
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>

            {Array.isArray(subtask.coAssignees) && subtask.coAssignees.length > 0 && (
              <div className="flex min-h-7 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/40">
                <Users className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">
                  {subtask.coAssignees.map((co: any) => co.name).join(", ")}
                </span>
              </div>
            )}

            <div ref={deadlineRef} className="relative">
              <button
                type="button"
                onClick={() => canEdit && setIsDeadlineEditorOpen((open) => !open)}
                disabled={!canEdit}
                aria-expanded={isDeadlineEditorOpen}
                className={cn(
                  "flex min-h-7 w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors",
                  canEdit ? "cursor-pointer hover:bg-muted/60" : "cursor-default",
                  dueInfo.isOverdue && "text-rose-700"
                )}
              >
                <Clock3 className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="tabular-nums text-foreground font-normal">
                  {startDateLabel} <span className="px-1 text-muted-foreground">→</span> {dueDateLabel}
                </span>
              </button>

              {isDeadlineEditorOpen && canEdit && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 grid grid-cols-2 gap-2 rounded-lg border border-border bg-popover p-2.5 shadow-lg ">
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Bắt đầu</span>
                    <VietnameseDatePicker
                      value={startDateIso}
                      onChange={handleStartDateChange}
                      placeholder="Bắt đầu"
                      variant="chip"
                      align="left"
                      className="w-full"
                      triggerClassName="h-7 w-full justify-start rounded-md border border-border/60 bg-background px-2 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Hạn chót</span>
                    <VietnameseDatePicker
                      value={dueDateIso}
                      onChange={handleDueDateChange}
                      placeholder="Hạn chót"
                      variant="chip"
                      align="right"
                      className="w-full"
                      triggerClassName="h-7 w-full justify-start rounded-md border border-border/60 bg-background px-2 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="mt-6">
            <TaskNotionBlockContent
              key={subtask.id}
              taskId={subtask.id}
              initialDescription={description}
              onSaveContent={handleDescriptionChange}
              canEdit={canEdit}
              globalFileDrop={false}
            />
          </section>
        </div>
      </aside>
    </>
  );
}
