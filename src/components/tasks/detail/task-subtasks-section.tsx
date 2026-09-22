"use client";

import * as React from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  Plus,
  Calendar,
  User,
  MoreHorizontal,
  AlertCircle,
  ChevronDown,
  X,
  Edit3,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import type { StaffTask } from "@/types/dashboard";
import { formatDisplayDate } from "@/lib/format/date";
import { formatAssigneeNameWithTitle } from "@/lib/format/personnel";
import { computeDueStatus } from "@/domain/tasks/deadlines";
import { getStatusDisplay } from "@/domain/tasks/display-config";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import {
  toCanonicalUnitCode,
} from "@/lib/departments";
import { useAuth } from "@/lib/auth-context";
import { usePersonnelList } from "@/hooks/use-personnel-list";

export interface TaskSubtasksSectionProps {
  parentId: string;
  subTasks: StaffTask[];
  canEdit?: boolean;
  departmentCode?: string;
  personnel?: Array<{ id?: string; name: string; role?: string }>;
  onToggleSubtask?: (subtask: StaffTask) => Promise<void> | void;
  onSelectSubtask?: (subtask: StaffTask) => void;
  onDeleteSubtask?: (subtask: StaffTask) => Promise<void> | void;
  onAddSubTask?: (parentId: string) => void;
  onCreateSubTaskInline?: (title: string, assigneeName?: string, dueDate?: string, assigneeId?: string) => Promise<void> | void;
  className?: string;
}

export function TaskSubtasksSection({
  parentId,
  subTasks = [],
  canEdit = true,
  departmentCode,
  personnel,
  onToggleSubtask,
  onSelectSubtask,
  onDeleteSubtask,
  onAddSubTask,
  onCreateSubTaskInline,
  className,
}: TaskSubtasksSectionProps) {
  const totalCount = subTasks.length;
  const completedCount = subTasks.filter((s) => s.status === "COMPLETED").length;

  const { user } = useAuth();
  const { personnel: hookPersonnel } = usePersonnelList();
  const effectiveDeptCode = React.useMemo(() => {
    const raw =
      departmentCode ||
      user?.departmentCode ||
      user?.department ||
      (user as any)?.departmentId ||
      "BGH";
    return toCanonicalUnitCode(raw) || raw;
  }, [departmentCode, user]);

  // Inline creation state (Full detailed modal/row)
  const [isAddingInline, setIsAddingInline] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newAssigneeName, setNewAssigneeName] = React.useState("");
  const [newDueDate, setNewDueDate] = React.useState("");
  const [inlineError, setInlineError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  // Quick add state (Bottom inline one-key creator)
  const [quickAddTitle, setQuickAddTitle] = React.useState("");
  const [isQuickAdding, setIsQuickAdding] = React.useState(false);
  const quickAddInputRef = React.useRef<HTMLInputElement>(null);

  const handleQuickAdd = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const trimmed = quickAddTitle.trim();
    if (!trimmed || isQuickAdding) return;

    setIsQuickAdding(true);
    try {
      if (onCreateSubTaskInline) {
        await onCreateSubTaskInline(trimmed);
      } else if (onAddSubTask) {
        onAddSubTask(parentId);
      }
      setQuickAddTitle("");
      setTimeout(() => quickAddInputRef.current?.focus(), 20);
    } catch {
      // ignore
    } finally {
      setIsQuickAdding(false);
    }
  };

  // Unit-scoped personnel list for assignee selector
  const [personnelList, setPersonnelList] = React.useState<Array<{ id?: string; name: string; role?: string }>>(() => {
    if (personnel && personnel.length > 0) return personnel;
    // Use hookPersonnel as initial fallback (flat list, no dept grouping needed)
    return hookPersonnel.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.title || m.departmentName,
    }));
  });

  React.useEffect(() => {
    if (personnel && personnel.length > 0) {
      setPersonnelList(personnel);
      return;
    }
    // If hookPersonnel loaded, use it as initial list
    if (hookPersonnel.length > 0) {
      setPersonnelList(hookPersonnel.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.title || m.departmentName,
      })));
    }

    // Fetch users for this department with search fallback to attach real DB user IDs
    fetch(`/api/users?departmentId=${encodeURIComponent(effectiveDeptCode)}&limit=100`)
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.users)) {
          setPersonnelList((prev) => {
            return prev.map((p) => {
              const clean = p.name.replace(/^(ThS\.|TS\.|CN\.|BS\.|PGS\.|GS\.|KS\.|GVC\.)\s*/, "").trim().toLowerCase();
              const match = data.users.find(
                (u: any) =>
                  u.name?.toLowerCase().trim() === p.name.toLowerCase().trim() ||
                  u.name?.toLowerCase().includes(clean) ||
                  clean.includes(u.name?.toLowerCase())
              );
              return match ? { ...p, id: match.id, role: match.role || p.role } : p;
            });
          });
        }
      })
      .catch(() => {});
  }, [effectiveDeptCode, personnel]);

  const handleOpenInline = () => {
    setInlineError(null);
    setIsAddingInline(true);
  };

  React.useEffect(() => {
    if (isAddingInline) {
      titleInputRef.current?.focus();
      const timer = setTimeout(() => titleInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isAddingInline]);

  const handleSaveInline = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle || isSaving) return;

    setIsSaving(true);
    setInlineError(null);
    try {
      const selectedPerson = personnelList.find(
        (p) =>
          p.name === newAssigneeName ||
          p.name.toLowerCase() === newAssigneeName.toLowerCase()
      );
      let assigneeId = selectedPerson?.id;

      // Fallback search by clean name if user ID not yet attached
      if (!assigneeId && newAssigneeName) {
        try {
          const cleanName = newAssigneeName.replace(/^(ThS\.|TS\.|CN\.|BS\.|PGS\.|GS\.|KS\.|GVC\.)\s*/, "").trim();
          const uRes = await fetch(`/api/users?search=${encodeURIComponent(cleanName)}`);
          const uData = await uRes.json();
          if (uData && Array.isArray(uData.users) && uData.users.length > 0) {
            const matched =
              uData.users.find((u: any) => u.departmentId === effectiveDeptCode || u.department?.shortName === effectiveDeptCode) ||
              uData.users.find((u: any) => u.name?.toLowerCase().includes(cleanName.toLowerCase())) ||
              uData.users[0];
            if (matched) assigneeId = matched.id;
          }
        } catch {
          // Fallback
        }
      }

      if (onCreateSubTaskInline) {
        await onCreateSubTaskInline(
          trimmedTitle,
          newAssigneeName || undefined,
          newDueDate || undefined,
          assigneeId || undefined
        );
      } else if (onAddSubTask) {
        onAddSubTask(parentId);
      }
      setNewTitle("");
      setNewAssigneeName("");
      setNewDueDate("");
      setIsAddingInline(false);
    } catch (err: unknown) {
      setInlineError(err instanceof Error ? err.message : "Không thể tạo việc thành phần. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (e: React.MouseEvent, st: StaffTask) => {
    e.stopPropagation();
    if (onToggleSubtask) {
      onToggleSubtask(st);
    }
  };

  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <section data-slot="task-subtasks-section" className={cn("space-y-2 select-none w-full", className)}>
      {/* 1. Header: "Việc thành phần" + progress "33% (1/3)" + mini progress bar + nút "+ Thêm chi tiết" */}
      <div className="flex items-center justify-between gap-2 py-1 select-none">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-xs font-semibold text-foreground tracking-tight">
            Việc thành phần
          </h2>
          {totalCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-medium text-muted-foreground tabular-nums">
                {percent}% ({completedCount}/{totalCount})
              </span>
              <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Tiến độ hoàn thành việc thành phần"
                className="w-16 sm:w-24 h-1.5 bg-muted rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={handleOpenInline}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-foreground hover:bg-muted border border-border/60 hover:border-border transition-colors cursor-pointer"
            title="Thêm chi tiết việc con"
            aria-label="Thêm chi tiết việc con"
          >
            <Plus className="size-3.5" strokeWidth={1.5} />
            <span>Thêm chi tiết</span>
          </button>
        )}
      </div>

      {/* 2. Empty State (Tối giản, không card/box lớn, không lặp nút thêm) */}
      {totalCount === 0 && !isAddingInline && (
        <div className="py-6 px-3 text-center select-none">
          <p className="text-xs font-medium text-muted-foreground">
            Chưa có việc thành phần
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Gõ vào ô bên dưới hoặc nhấn &quot;Thêm chi tiết&quot; để phân rã nhiệm vụ này.
          </p>
        </div>
      )}

      {/* 3. Inline Detailed Subtask Creation Row (Linear Style) */}
      {isAddingInline && (
        <div className="space-y-1.5">
          <form
            onSubmit={handleSaveInline}
            className="min-h-10 sm:min-h-11 flex flex-wrap sm:flex-nowrap items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/40 bg-muted/20 text-xs"
          >
            <Circle className="size-4 text-muted-foreground/40 shrink-0" />
            <input
              ref={titleInputRef}
              type="text"
              required
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsAddingInline(false);
                  setInlineError(null);
                }
              }}
              placeholder="Tên việc con mới... (Enter để lưu, Esc để hủy)"
              className="flex-1 min-w-[140px] bg-transparent text-xs font-normal text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden"
            />

            {/* Người phụ trách việc con */}
            <div className="relative flex items-center shrink-0">
              <User className="size-3 text-muted-foreground absolute left-2 pointer-events-none" strokeWidth={1.5} />
              <select
                value={newAssigneeName}
                onChange={(e) => setNewAssigneeName(e.target.value)}
                className="h-7 pl-6 pr-6 rounded-md border border-border/60 bg-background text-[11px] font-medium text-foreground hover:border-border focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer max-w-[140px] sm:max-w-[170px] truncate"
                aria-label="Người phụ trách việc con"
                title={newAssigneeName ? `Phụ trách: ${newAssigneeName}` : "Chọn người phụ trách"}
              >
                <option value="">Phụ trách: Chưa giao</option>
                {personnelList.map((p, idx) => (
                  <option key={p.id || `person-${idx}-${p.name}`} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="size-2.5 text-muted-foreground absolute right-1.5 pointer-events-none" strokeWidth={1.5} />
            </div>

            {/* Hạn hoàn thành */}
            <div className="shrink-0">
              <VietnameseDatePicker
                value={newDueDate}
                onChange={(val) => setNewDueDate(val)}
                variant="chip"
                icon={<Calendar className="size-3 text-muted-foreground" strokeWidth={1.5} />}
                placeholder="dd/mm/yyyy"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              <button
                type="submit"
                disabled={isSaving || !newTitle.trim()}
                className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-none transition-opacity"
              >
                {isSaving ? "Đang lưu..." : "Thêm"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingInline(false);
                  setInlineError(null);
                }}
                className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                title="Hủy"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </form>

          {inlineError && (
            <div className="p-2 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-center gap-1.5">
              <AlertCircle className="size-3.5 text-rose-600 shrink-0" />
              <span>{inlineError}</span>
            </div>
          )}
        </div>
      )}

      {/* 4. Danh sách việc con với layout chuẩn: [Checkbox] Title [Avatar] [Actions] / [Date] - Status */}
      {totalCount > 0 && (
        <div className="flex flex-col gap-1">
          {subTasks.map((st, idx) => {
            const isCompleted = st.status === "COMPLETED";
            const dueStatus = computeDueStatus(st.dueDate);
            const statusObj = getStatusDisplay(st.status);
            const assigneeTitle = formatAssigneeNameWithTitle(st.assigneeName, hookPersonnel) || "Chưa giao";

            return (
              <div
                key={st.id || `subtask-row-${idx}-${st.title}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSubtask && onSelectSubtask(st)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectSubtask && onSelectSubtask(st);
                  }
                }}
                className={cn(
                  "group flex items-start gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer border border-transparent hover:bg-muted/40 hover:border-border/40 focus-visible:outline-hidden focus-visible:bg-muted/50 select-none",
                  isCompleted && "opacity-80"
                )}
              >
                {/* 1. Checkbox: click -> toggle status COMPLETED / IN_PROGRESS */}
                <div className="pt-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => handleToggle(e, st)}
                    className="size-4.5 rounded-[4px] border border-border/80 flex items-center justify-center transition-all cursor-pointer focus-visible:outline-none hover:border-primary"
                    title={isCompleted ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"}
                    aria-label={isCompleted ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"}
                  >
                    {isCompleted ? (
                      <div className="size-3.5 rounded-[3px] bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                        <Check className="size-2.5 text-white" strokeWidth={1.5} />
                      </div>
                    ) : (
                      <div className="size-3.5 rounded-[3px] bg-background hover:bg-primary/5 transition-colors" />
                    )}
                  </button>
                </div>

                {/* 2. Content: 2-line layout */}
                <div className="flex-1 min-w-0 space-y-1">
                  {/* Line 1: [Tiêu đề subtask] [Avatar DRI] [Hover action edit / delete] */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-xs font-medium text-foreground transition-all duration-200 truncate",
                        isCompleted && "line-through text-muted-foreground/60"
                      )}
                      title={st.title}
                    >
                      {st.title}
                    </span>

                    {/* Right side: Hover action icons + Avatar DRI 24px */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Hover action: Hiển thị icon edit / delete khi hover row */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSubtask?.(st);
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          title="Chỉnh sửa việc con"
                          aria-label="Chỉnh sửa việc con"
                        >
                          <Edit3 className="size-3" strokeWidth={1.5} />
                        </button>
                        {onDeleteSubtask && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSubtask(st);
                            }}
                            className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Xóa việc con"
                            aria-label="Xóa việc con"
                          >
                            <Trash2 className="size-3" strokeWidth={1.5} />
                          </button>
                        )}
                      </div>

                      {/* Avatar tròn 24px + tooltip tên đầy đủ */}
                      <div
                        className="size-6 shrink-0 rounded-full flex items-center justify-center overflow-hidden ring-1 ring-border/40"
                        title={`Phụ trách: ${assigneeTitle}`}
                      >
                        {st.assigneeAvatar ? (
                          <img
                            src={st.assigneeAvatar}
                            alt={assigneeTitle}
                            width={24}
                            height={24}
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center bg-muted text-[10px] font-semibold text-muted-foreground">
                            {getInitials(st.assigneeName || "?")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Line 2: [Icon lịch] dd/mm/yyyy - Trạng thái */}
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Calendar
                      className={cn(
                        "size-3 shrink-0",
                        dueStatus.isOverdue
                          ? "text-rose-600"
                          : "text-muted-foreground/60"
                      )}
                      strokeWidth={1.5}
                    />
                    <span
                      className={cn(
                        "font-mono tabular-nums",
                        dueStatus.isOverdue && "text-rose-600 font-semibold"
                      )}
                    >
                      {st.dueDate ? formatDisplayDate(st.dueDate) : "Chưa đặt hạn"}
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium border leading-tight",
                        statusObj.colorClass
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", statusObj.dotClass)} />
                      <span>{statusObj.label}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Inline Quick Add: Input ở cuối list "Thêm việc con... (Enter để tạo)" */}
      {canEdit && (
        <div className="pt-1">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 hover:border-border focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20 bg-background transition-all">
            <Plus className="size-3.5 text-muted-foreground/60 shrink-0" strokeWidth={1.5} />
            <input
              ref={quickAddInputRef}
              type="text"
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
              onKeyDown={handleQuickAdd}
              disabled={isQuickAdding}
              placeholder="Thêm việc con... (Enter để tạo)"
              className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
            {isQuickAdding && (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
