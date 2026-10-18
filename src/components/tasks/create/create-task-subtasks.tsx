"use client";

import * as React from "react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { IconSidebarTasks } from "@/components/layout/sidebar-rounded-icons";
import { PersonPillPicker } from "@/components/tasks/create/person-pill-picker";
import { CREATE_TASK_MAX_SUBTASKS } from "@qcet/contracts/tasks";
import { motionDuration, motionEase } from "@/lib/motion/tokens";
import type { CreateTaskSubtaskFormItem } from "@/hooks/use-create-task-form";
import type { DepartmentPersonnel } from "@/hooks/use-department-list";

const EMPTY_DRAFT = { title: "", description: "", assigneeId: "", dueDate: "" };
const MIN_TITLE = 3;

/** "2026-10-30" → "30/10" (ngày nghiệp vụ đã ở giờ Việt Nam, chỉ đổi cách viết). */
function shortDate(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split("-");
  return month && day ? `${day}/${month}` : iso;
}

let draftSeq = 0;
/** Khóa client của một việc con trong form (cũng dùng khi Agent thêm việc con). */
export const nextSubtaskDraftId = () => `subtask-${Date.now().toString(36)}-${(draftSeq += 1)}`;

export interface CreateTaskSubtasksProps {
  items: CreateTaskSubtaskFormItem[];
  onChange: (items: CreateTaskSubtaskFormItem[]) => void;
  people: DepartmentPersonnel[];
  loadingPeople?: boolean;
  /** Chủ trì và hạn của nhiệm vụ: việc con để trống thì kế thừa (máy chủ cũng làm vậy) */
  parentLeadId: string;
  parentDueDate: string;
  error?: string;
  className?: string;
}

/**
 * Việc con tạo kèm nhiệm vụ, như khối Milestones trong hộp New project của Linear: hàng "Việc con +" khi trống,
 * danh sách việc đã thêm, thẻ soạn có tên, mô tả, chủ trì và hạn. Việc con chỉ được tạo khi bấm Tạo nhiệm vụ.
 */
export function CreateTaskSubtasks({ items, onChange, people, loadingPeople, parentLeadId, parentDueDate, error, className }: CreateTaskSubtasksProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(EMPTY_DRAFT);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [titleError, setTitleError] = React.useState<string | null>(null);
  const [dueError, setDueError] = React.useState<string | null>(null);
  const titleRef = React.useRef<HTMLInputElement>(null);
  const addButtonRef = React.useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  const parentLead = people.find((p) => p.id === parentLeadId) ?? null;
  const full = items.length >= CREATE_TASK_MAX_SUBTASKS;

  const openEditor = () => {
    setDraft(EMPTY_DRAFT);
    setTitleError(null);
    setDueError(null);
    setEditing(true);
  };
  const closeEditor = () => {
    setEditing(false);
    setTitleError(null);
    setDueError(null);
  };

  // Mở thẻ soạn thì focus ô tên; đóng thì trả focus về nút thêm (chỉ render lại khi thẻ đã đóng)
  const wasEditing = React.useRef(false);
  React.useEffect(() => {
    if (editing) titleRef.current?.focus();
    else if (wasEditing.current) addButtonRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const addDraft = () => {
    const title = draft.title.trim();
    if (title.length < MIN_TITLE) {
      setTitleError(`Tên việc con cần ít nhất ${MIN_TITLE} ký tự.`);
      titleRef.current?.focus();
      return;
    }
    // Máy chủ từ chối việc con có hạn sau hạn nhiệm vụ; báo ngay khi thêm (ISO so sánh được theo chuỗi)
    if (draft.dueDate && parentDueDate && draft.dueDate.slice(0, 10) > parentDueDate.slice(0, 10)) {
      setDueError(`Hạn việc con không được sau hạn nhiệm vụ (${shortDate(parentDueDate)}).`);
      return;
    }
    onChange([...items, { id: nextSubtaskDraftId(), ...draft, title }]);
    // Như Linear: thêm xong vẫn mở thẻ soạn để nhập tiếp việc sau
    setDraft(EMPTY_DRAFT);
    setTitleError(null);
    setDueError(null);
    if (items.length + 1 >= CREATE_TASK_MAX_SUBTASKS) closeEditor();
    else titleRef.current?.focus();
  };

  const removeItem = (id: string) => onChange(items.filter((item) => item.id !== id));

  return (
    <section aria-label="Việc con" className={cn("rounded-lg border border-border/70 bg-background", className)}>
      <div className="flex h-10 items-center gap-2 pr-1.5 pl-3">
        <h3 className="text-compact text-foreground">Việc con</h3>
        {items.length > 0 && <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>}
        {!editing && !full && (
          <Button ref={addButtonRef} variant="ghost" size="icon-xs" onClick={openEditor} aria-label="Thêm việc con" title="Thêm việc con" className="ml-auto rounded-full">
            <Plus />
          </Button>
        )}
        {full && <span className="ml-auto pr-1.5 text-xs text-muted-foreground">Tối đa {CREATE_TASK_MAX_SUBTASKS} việc con</span>}
      </div>

      {items.length > 0 && (
        <ul className="border-t border-border/60">
          {items.map((item) => {
            const lead = people.find((p) => p.id === (item.assigneeId || parentLeadId)) ?? null;
            const due = item.dueDate || parentDueDate;
            return (
              <li key={item.id} className="group flex h-9 items-center gap-2 pr-1.5 pl-3">
                <IconSidebarTasks size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-compact text-foreground" title={item.title}>
                  {item.title}
                </span>
                {lead && (
                  <span className={cn("flex shrink-0 items-center gap-1 text-xs", item.assigneeId ? "text-foreground" : "text-muted-foreground")} title={item.assigneeId ? `Chủ trì: ${lead.name}` : `Chủ trì theo nhiệm vụ: ${lead.name}`}>
                    <UserAvatar name={lead.name} avatarUrl={lead.avatarUrl} size="xs" className={cn(!item.assigneeId && "opacity-60")} />
                    <span className="max-w-[120px] truncate max-md:hidden">{lead.name}</span>
                  </span>
                )}
                {due && (
                  <span className={cn("shrink-0 text-xs tabular-nums", item.dueDate ? "text-foreground" : "text-muted-foreground")} title={item.dueDate ? "Hạn hoàn thành" : "Hạn theo nhiệm vụ"}>
                    {shortDate(due)}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Bỏ việc con ${item.title}`}
                  title="Bỏ việc con"
                  className="shrink-0 rounded-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
                >
                  <X />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Thẻ soạn giãn/thu chiều cao như khối Milestones của Linear (đo ~180ms ease-out); reduced motion chỉ còn mờ dần.
          overflow-clip (không phải hidden) để focus ô tên lúc mở không cuộn lệch nội dung bên trong */}
      <AnimatePresence initial={false}>
        {editing && (
          <m.div
            key="editor"
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: { duration: motionDuration.normal, ease: motionEase.enter } }}
            exit={{ ...(reduceMotion ? {} : { height: 0 }), opacity: 0, transition: { duration: motionDuration.fast, ease: motionEase.exit } }}
            className="overflow-clip"
          >
            <div
              className="flex flex-col gap-1 border-t border-border/60 px-3 pt-2 pb-3"
              onKeyDown={(e) => {
                // Esc chỉ đóng thẻ soạn, không đóng cả hộp tạo việc
                if (e.key === "Escape" && !pickerOpen) {
                  e.stopPropagation();
                  closeEditor();
                }
              }}
            >
              <div className="flex items-center gap-2">
                <IconSidebarTasks size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <label htmlFor="create-subtask-title" className="sr-only">
                  Tên việc con
                </label>
                <Input
                  id="create-subtask-title"
                  ref={titleRef}
                  compact
                  value={draft.title}
                  maxLength={255}
                  aria-invalid={titleError ? true : undefined}
                  aria-describedby={titleError ? "create-subtask-title-error" : undefined}
                  placeholder="Tên việc con"
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, title: e.target.value }));
                    if (titleError) setTitleError(null);
                  }}
                  onKeyDown={(e) => {
                    // Enter thêm việc con; giữ IME tiếng Việt đang gõ dở
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      e.stopPropagation();
                      addDraft();
                    }
                  }}
                  className="h-7 bg-transparent px-0 hover:bg-transparent focus-visible:bg-transparent focus-visible:outline-none aria-invalid:bg-transparent"
                />
              </div>
              {titleError && (
                <p id="create-subtask-title-error" className="pl-5.5 text-xs text-destructive">
                  {titleError}
                </p>
              )}
              <label htmlFor="create-subtask-description" className="sr-only">
                Mô tả việc con
              </label>
              <Textarea
                id="create-subtask-description"
                compact
                autoResize
                countOnlyNearLimit
                rows={1}
                value={draft.description}
                maxLength={5000}
                placeholder="Thêm mô tả…"
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                className="max-h-32 overflow-y-auto bg-transparent pl-5.5 hover:bg-transparent focus-visible:bg-transparent focus-visible:outline-none"
              />
              <div className="mt-1 flex flex-wrap items-center gap-2 pl-5.5">
                <PersonPillPicker
                  people={people}
                  valueId={draft.assigneeId}
                  onSelect={(person) => setDraft((d) => ({ ...d, assigneeId: person.id }))}
                  open={pickerOpen}
                  onOpenChange={setPickerOpen}
                  loading={loadingPeople}
                  fallbackPerson={parentLead}
                  fallbackHint={parentLead ? `Chủ trì theo nhiệm vụ: ${parentLead.name}` : undefined}
                />
                <VietnameseDatePicker
                  variant="pill"
                  className="flex"
                  value={draft.dueDate}
                  onChange={(iso) => {
                    setDraft((d) => ({ ...d, dueDate: iso }));
                    setDueError(null);
                  }}
                  error={dueError ?? undefined}
                  placeholder={parentDueDate ? `Hạn ${shortDate(parentDueDate)}` : "Hạn"}
                  title={parentDueDate ? "Để trống thì theo hạn của nhiệm vụ" : "Hạn hoàn thành"}
                  clearable
                />
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="ghost" size="pill-xs" onClick={closeEditor}>
                    Hủy
                  </Button>
                  <Button size="pill-xs" onClick={addDraft}>
                    Thêm việc con
                  </Button>
                </div>
              </div>
              {dueError && (
                <p role="alert" className="pl-5.5 text-xs text-destructive">
                  {dueError}
                </p>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {error && <p className="border-t border-border/60 px-3 py-2 text-xs text-destructive">{error}</p>}
    </section>
  );
}
