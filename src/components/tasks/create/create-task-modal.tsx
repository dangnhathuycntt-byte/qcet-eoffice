"use client";

import * as React from "react";
import {
  X,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Flag,
  User,
  Check,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { Popover } from "@base-ui/react/popover";
import { Dialog } from "@base-ui/react/dialog";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { getCategoryOptions } from "@/domain/tasks/display-config";
import type { CreateTaskLevel } from "@/lib/adapters/create-task-mapper";
import {
  useCreateTaskForm,
  type CreateTaskPriority,
} from "@/hooks/use-create-task-form";

// Re-export types for downstream consumers
export type { CreateTaskPriority } from "@/hooks/use-create-task-form";

/**
 * Feature Flag: Kích hoạt Trợ lý AI khi hệ thống tích hợp backend AI/LLM.
 * Mặc định: false (không hiển thị trong production).
 */
export const ENABLE_TASK_AGENT_ASSISTANT = false;

// ─── Visual Config ─────────────────────────────────────────────
const PRIORITY_CONFIG: Record<
  CreateTaskPriority,
  { label: string; color: string; bg: string; border: string; iconColor: string }
> = {
  URGENT: {
    label: "Khẩn cấp",
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    iconColor: "text-rose-500",
  },
  HIGH: {
    label: "Cao",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    iconColor: "text-amber-500",
  },
  MEDIUM: {
    label: "Bình thường",
    color: "text-muted-foreground",
    bg: "bg-muted/40",
    border: "border-border",
    iconColor: "text-muted-foreground",
  },
  LOW: {
    label: "Thấp",
    color: "text-muted-foreground",
    bg: "bg-muted/40",
    border: "border-border",
    iconColor: "text-muted-foreground",
  },
};

const PRIORITY_KEYS: CreateTaskPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];
const CATEGORY_OPTIONS = getCategoryOptions();

// ─── Props ─────────────────────────────────────────────────────
export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess?: (task: unknown) => void;
  onSubmit?: (data: any, result?: any) => void | Promise<void>;
  initialDepartmentCode?: string;
  initialTitle?: string;
  initialLevel?: CreateTaskLevel;
  initialParentTaskId?: string;
  initialParentTaskTitle?: string;
  /** @deprecated Use initialLeadAssigneeId instead — kept for backward compat */
  initialLeadAssigneeName?: string;
  initialLeadAssigneeId?: string;
  initialDueDate?: string;
}

// ─── Component ─────────────────────────────────────────────────
export function CreateTaskModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  onSubmit,
  initialDepartmentCode,
  initialTitle,
  initialLevel,
  initialParentTaskId,
  initialParentTaskTitle,
  initialLeadAssigneeId,
  initialDueDate,
}: CreateTaskModalProps) {
  const form = useCreateTaskForm({
    initialLevel,
    initialTitle,
    initialAssigneeId: initialLeadAssigneeId,
    initialDueDate,
    initialDepartmentCode,
    parentTaskId: initialParentTaskId,
  });

  // ── Local UI state ──────────────────────────────────────────
  const [showConfirmClose, setShowConfirmClose] = React.useState(false);
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);

  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const summaryInputRef = React.useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Autofocus title input when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => titleInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Cmd/Ctrl+Enter to submit
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        handleFormSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ────────────────────────────────────────────────
  const handleRequestClose = React.useCallback(() => {
    if (form.isSubmitting) return;
    if (form.isDirty) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  }, [form.isSubmitting, form.isDirty, onClose]);

  const handleConfirmDiscard = React.useCallback(() => {
    form.handleClearDraft();
    setShowConfirmClose(false);
    onClose();
  }, [form, onClose]);

  const handleFormSubmit = React.useCallback(async () => {
    const result = await form.handleSubmit();
    if (result === undefined) {
      // handleSubmit returns void; check submissionOutcome after it completes
      // The hook sets submissionOutcome internally — we check it via effect below
    }
  }, [form]);

  // React to submission outcome
  React.useEffect(() => {
    if (form.submissionOutcome === "created") {
      onSubmit?.(form.formData);
      onSubmitSuccess?.(form.formData);
      onClose();
    }
  }, [form.submissionOutcome]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived display values ──────────────────────────────────
  const leadAssigneeDisplayName = React.useMemo(
    () => form.availablePersonnel.find((p) => p.id === form.formData.leadAssigneeId)?.name ?? "",
    [form.availablePersonnel, form.formData.leadAssigneeId],
  );

  const currentDeptName = React.useMemo(() => {
    const dept = form.availableDepartments.find((d) => d.code === form.formData.selectedDeptCode);
    return dept?.name ?? "Đang tải...";
  }, [form.availableDepartments, form.formData.selectedDeptCode]);

  // Submission error message for banner
  const errorMessage = form.submissionOutcome === "rejected" || form.submissionOutcome === "unknown"
    ? form.submissionMessage
    : null;

  return (
    <>
      {/* ── Main Dialog ──────────────────────────────────────── */}
      <Dialog.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) handleRequestClose();
        }}
      >
        <Dialog.Portal keepMounted={isOpen}>
          <Dialog.Backdrop
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
          />
          <Dialog.Popup
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 outline-none"
          >
            {/* Outer Card: Compact task composer */}
            <div
              data-slot="create-task-modal"
              className={cn(
                "relative flex flex-col bg-card rounded-xl shadow-2xl border border-border/80 overflow-hidden",
                "w-full max-w-[680px] h-[540px] max-h-[85vh]",
                "animate-in fade-in zoom-in-95",
              )}
            >
              {/* ── Modal Top Header ──────────────────────────── */}
              <header className="flex items-center justify-between px-5 sm:px-6 py-2.5 border-b border-border/60 bg-card shrink-0">
                {/* Breadcrumb & Unit Selector */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />

                  {/* Department selector */}
                  {form.availableDepartments.length > 1 ? (
                    <Popover.Root
                      open={openDropdown === "dept"}
                      onOpenChange={(open) => setOpenDropdown(open ? "dept" : null)}
                    >
                      <div className="relative inline-block text-left">
                        <Popover.Trigger
                          type="button"
                          className={cn(
                            "inline-flex items-center gap-1 font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1.5 py-0.5 cursor-pointer",
                            openDropdown === "dept"
                              ? "text-foreground bg-accent shadow-2xs"
                              : "text-foreground hover:text-foreground/80 hover:bg-accent/50",
                          )}
                        >
                          <span>{currentDeptName}</span>
                          <ChevronDown
                            className={cn(
                              "size-3 text-muted-foreground transition-transform duration-200 ease-out",
                              openDropdown === "dept" && "rotate-180 text-foreground",
                            )}
                          />
                        </Popover.Trigger>

                        <Popover.Portal>
                          <Popover.Positioner className="z-[70]" align="start" sideOffset={4} collisionPadding={12}>
                            <Popover.Popup
                              style={{ maxWidth: "var(--available-width)", maxHeight: "var(--available-height)", overflowY: "auto" }}
                              className="w-64 p-1 space-y-0.5 rounded-xl border border-border bg-popover shadow-2xl"
                              aria-label="Chọn đơn vị phòng ban"
                            >
                              {form.availableDepartments.map((dept) => (
                                <button
                                  key={dept.code}
                                  type="button"
                                  onClick={() => {
                                    form.setField("selectedDeptCode", dept.code);
                                    form.setField("leadAssigneeId", "");
                                    setOpenDropdown(null);
                                  }}
                                  className={cn(
                                    "w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all duration-150 active:scale-[0.99] cursor-pointer",
                                    form.formData.selectedDeptCode === dept.code
                                      ? "font-semibold text-foreground bg-accent"
                                      : "text-foreground hover:bg-accent/70",
                                  )}
                                >
                                  <span className="truncate">{dept.name}</span>
                                  {form.formData.selectedDeptCode === dept.code && (
                                    <Check className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                  )}
                                </button>
                              ))}
                            </Popover.Popup>
                          </Popover.Positioner>
                        </Popover.Portal>
                      </div>
                    </Popover.Root>
                  ) : (
                    <span className="font-semibold text-foreground px-1.5 py-0.5 rounded bg-accent/40">
                      {currentDeptName}
                    </span>
                  )}

                  {initialParentTaskTitle && (
                    <>
                      <ChevronRight className="size-3 text-muted-foreground/40 shrink-0" />
                      <span
                        className="text-muted-foreground font-normal truncate max-w-[140px] sm:max-w-[200px]"
                        title={initialParentTaskTitle}
                      >
                        {initialParentTaskTitle}
                      </span>
                    </>
                  )}
                  <ChevronRight className="size-3 text-muted-foreground/40 shrink-0" />
                  <Dialog.Title className="text-muted-foreground font-medium truncate text-xs">
                    {initialParentTaskId ? "Giao việc con" : "Tạo nhiệm vụ"}
                  </Dialog.Title>
                </div>

                {/* Header Action: Close Button */}
                <Dialog.Close
                  className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                  aria-label="Đóng biểu mẫu tạo nhiệm vụ"
                >
                  <X className="size-4" strokeWidth={1.5} />
                </Dialog.Close>
              </header>

              {/* ── Restored Draft Banner ────────────────────── */}
              {form.hasRestoredDraft && (
                <div className="flex items-center justify-between px-5 sm:px-6 py-1.5 bg-muted/40 border-b border-border/60 text-[11px] text-muted-foreground shrink-0">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                    <span>Đã tự động khôi phục bản nháp chưa lưu từ phiên làm việc trước.</span>
                  </div>
                  <button
                    type="button"
                    onClick={form.handleClearDraft}
                    className="text-[11px] text-muted-foreground hover:text-rose-600 transition-colors underline underline-offset-2 cursor-pointer"
                  >
                    Xóa bản nháp
                  </button>
                </div>
              )}

              {/* ── Modal Scrollable Form Area ───────────────── */}
              <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 flex flex-col space-y-2.5 min-h-0">
                {/* Error banner */}
                {errorMessage && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="flex items-center gap-2 p-2 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700 shrink-0"
                  >
                    <AlertCircle className="size-4 shrink-0 text-rose-500" aria-hidden="true" />
                    <span className="flex-1 font-medium">{errorMessage}</span>
                  </div>
                )}

                {/* 1. Task Title (P0 Field) */}
                <div className="space-y-0.5 shrink-0">
                  <label htmlFor="create-task-title" className="sr-only">
                    {initialParentTaskId ? "Tên việc con" : "Tên nhiệm vụ"}
                  </label>
                  <input
                    id="create-task-title"
                    ref={titleInputRef}
                    type="text"
                    value={form.formData.title}
                    maxLength={255}
                    aria-required="true"
                    aria-invalid={Boolean(form.fieldErrors.title)}
                    aria-describedby={form.fieldErrors.title ? "create-task-title-error" : undefined}
                    onChange={(e) => {
                      form.setField("title", e.target.value);
                      if (form.fieldErrors.title) {
                        form.setFieldErrors((prev) => ({ ...prev, title: undefined }));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                        e.preventDefault();
                        summaryInputRef.current?.focus();
                      }
                    }}
                    placeholder={initialParentTaskId ? "Tên việc con... *" : "Tên nhiệm vụ... *"}
                    className={cn(
                      "w-full text-lg sm:text-xl font-semibold text-foreground placeholder:text-muted-foreground bg-transparent border-0 p-0 focus:outline-none focus:ring-0 leading-snug",
                      form.fieldErrors.title && "placeholder:text-rose-400 text-rose-900",
                    )}
                  />
                  {form.fieldErrors.title && (
                    <p id="create-task-title-error" role="alert" className="text-[11px] text-rose-600 font-medium">
                      {form.fieldErrors.title}
                    </p>
                  )}
                </div>

                {/* 2. Short Summary */}
                <div className="shrink-0">
                  <label htmlFor="create-task-summary" className="sr-only">
                    Mô tả ngắn hoặc kết quả kỳ vọng
                  </label>
                  <input
                    id="create-task-summary"
                    ref={summaryInputRef}
                    type="text"
                    value={form.formData.summary}
                    onChange={(e) => form.setField("summary", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                        e.preventDefault();
                        descriptionTextareaRef.current?.focus();
                      }
                    }}
                    placeholder="Thêm mô tả ngắn hoặc kết quả kỳ vọng..."
                    className="w-full text-xs text-muted-foreground placeholder:text-muted-foreground/70 bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
                  />
                </div>

                {/* 3. Compact Properties Chips Bar */}
                <div className="flex flex-wrap items-center gap-1.5 py-2 my-0.5 border-y border-border/60 shrink-0">
                  {/* 3.1 Priority Chip */}
                  <Popover.Root
                    open={openDropdown === "priority"}
                    onOpenChange={(open) => setOpenDropdown(open ? "priority" : null)}
                  >
                    <div className="relative">
                      <Popover.Trigger
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1.5 h-6.5 px-2 rounded-md text-[11px] font-medium border transition-all duration-150 cursor-pointer select-none",
                          openDropdown === "priority"
                            ? "border-border bg-accent text-foreground shadow-2xs"
                            : "border-border/60 bg-muted/30 hover:bg-accent hover:border-border text-foreground",
                        )}
                      >
                        <Flag
                          className={cn("size-3", PRIORITY_CONFIG[form.formData.priority].iconColor)}
                          strokeWidth={1.5}
                        />
                        <span>{PRIORITY_CONFIG[form.formData.priority].label}</span>
                        <ChevronDown
                          className={cn(
                            "size-2.5 text-muted-foreground transition-transform duration-200 ease-out",
                            openDropdown === "priority" && "rotate-180 text-foreground",
                          )}
                        />
                      </Popover.Trigger>

                      <Popover.Portal>
                        <Popover.Positioner className="z-[70]" align="start" sideOffset={4} collisionPadding={12}>
                          <Popover.Popup
                            style={{ maxWidth: "var(--available-width)", maxHeight: "var(--available-height)", overflowY: "auto" }}
                            className="w-40 p-1 space-y-0.5 rounded-xl border border-border bg-popover shadow-2xl"
                            aria-label="Chọn mức độ ưu tiên"
                          >
                            {PRIORITY_KEYS.map((p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => {
                                  form.setField("priority", p);
                                  setOpenDropdown(null);
                                }}
                                className={cn(
                                  "w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all duration-150 active:scale-[0.99]",
                                  form.formData.priority === p
                                    ? "font-semibold text-foreground bg-accent"
                                    : "text-foreground hover:bg-accent/70",
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Flag className={cn("size-3", PRIORITY_CONFIG[p].iconColor)} strokeWidth={1.5} />
                                  <span>{PRIORITY_CONFIG[p].label}</span>
                                </div>
                                {form.formData.priority === p && (
                                  <Check className="size-3 text-foreground shrink-0" strokeWidth={1.5} />
                                )}
                              </button>
                            ))}
                          </Popover.Popup>
                        </Popover.Positioner>
                      </Popover.Portal>
                    </div>
                  </Popover.Root>

                  {/* 3.2 Lead Assignee (DRI) Chip (P0 Field) */}
                  <Popover.Root
                    open={openDropdown === "dri"}
                    onOpenChange={(open) => setOpenDropdown(open ? "dri" : null)}
                  >
                    <div className="relative">
                      <Popover.Trigger
                        type="button"
                        aria-required="true"
                        className={cn(
                          "inline-flex items-center gap-1.5 h-6.5 px-2 rounded-md text-[11px] font-medium border transition-all duration-150 cursor-pointer select-none",
                          form.fieldErrors.lead
                            ? "bg-rose-50 text-rose-700 border-rose-300"
                            : openDropdown === "dri"
                              ? "border-border bg-accent text-foreground shadow-2xs"
                              : "border-border/60 bg-muted/30 hover:bg-accent hover:border-border text-foreground",
                        )}
                      >
                        <User className="size-3 text-muted-foreground" strokeWidth={1.5} />
                        <span>
                          {leadAssigneeDisplayName ? `Chủ trì: ${leadAssigneeDisplayName}` : "Chủ trì *"}
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-2.5 text-muted-foreground transition-transform duration-200 ease-out",
                            openDropdown === "dri" && "rotate-180 text-foreground",
                          )}
                        />
                      </Popover.Trigger>

                      <Popover.Portal>
                        <Popover.Positioner className="z-[70]" align="start" sideOffset={4} collisionPadding={12}>
                          <Popover.Popup
                            style={{ maxWidth: "var(--available-width)", maxHeight: "var(--available-height)", overflowY: "auto" }}
                            className="w-60 p-1 space-y-0.5 max-h-56 rounded-xl border border-border bg-popover shadow-2xl overflow-y-auto"
                            aria-label="Chọn người chủ trì"
                          >
                            {form.availablePersonnel.length === 0 ? (
                              <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                                Chưa có nhân sự trong đơn vị này
                              </div>
                            ) : (
                              form.availablePersonnel.map((person) => (
                                <button
                                  key={person.id}
                                  type="button"
                                  onClick={() => {
                                    form.setField("leadAssigneeId", person.id);
                                    if (form.fieldErrors.lead) {
                                      form.setFieldErrors((prev) => ({ ...prev, lead: undefined }));
                                    }
                                    setOpenDropdown(null);
                                  }}
                                  className={cn(
                                    "w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all duration-150 active:scale-[0.99]",
                                    form.formData.leadAssigneeId === person.id
                                      ? "font-semibold text-foreground bg-accent"
                                      : "text-foreground hover:bg-accent/70",
                                  )}
                                >
                                  <div>
                                    <div className="font-medium">{person.name}</div>
                                    <div className="text-[10px] text-muted-foreground">{person.role}</div>
                                  </div>
                                  {form.formData.leadAssigneeId === person.id && (
                                    <Check className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                  )}
                                </button>
                              ))
                            )}
                          </Popover.Popup>
                        </Popover.Positioner>
                      </Popover.Portal>
                    </div>
                  </Popover.Root>

                  {/* 3.3 Start Date Chip */}
                  <VietnameseDatePicker
                    value={form.formData.startDate}
                    onChange={(val) => form.setField("startDate", val)}
                    label="Bắt đầu:"
                    variant="chip"
                    icon={<Calendar className="size-3 text-muted-foreground" strokeWidth={1.5} />}
                    placeholder="dd/mm/yyyy"
                  />

                  {/* 3.4 Target Due Date Chip (P0 Field) */}
                  <VietnameseDatePicker
                    value={form.formData.dueDate}
                    required
                    onChange={(val) => {
                      form.setField("dueDate", val);
                      if (form.fieldErrors.dueDate) {
                        form.setFieldErrors((prev) => ({ ...prev, dueDate: undefined }));
                      }
                    }}
                    label="Hạn: *"
                    variant="chip"
                    error={Boolean(form.fieldErrors.dueDate)}
                    icon={
                      <CalendarClock
                        className={cn(
                          "size-3",
                          form.fieldErrors.dueDate ? "text-rose-500" : "text-muted-foreground",
                        )}
                        strokeWidth={1.5}
                      />
                    }
                    placeholder="dd/mm/yyyy"
                  />
                </div>

                {/* 4. Detailed Description / Canvas */}
                <div className="pt-0.5 flex-1 flex flex-col min-h-[120px]">
                  <label htmlFor="create-task-description" className="sr-only">
                    Mô tả chi tiết nhiệm vụ
                  </label>
                  <textarea
                    id="create-task-description"
                    ref={descriptionTextareaRef}
                    value={form.formData.description}
                    onChange={(e) => form.setField("description", e.target.value)}
                    placeholder="Mô tả nội dung chỉ đạo, căn cứ pháp lý, yêu cầu kỹ thuật hoặc tiêu chí nghiệm thu..."
                    rows={4}
                    className="w-full flex-1 min-h-[100px] resize-none bg-transparent border-0 p-0 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 leading-relaxed"
                  />
                </div>
              </div>

              {/* ── Modal Bottom Footer ──────────────────────── */}
              <footer className="flex items-center justify-between px-5 sm:px-6 py-2.5 border-t border-border/60 bg-muted/20 shrink-0">
                {/* Shortcut Hint */}
                <div className="text-[11px] text-muted-foreground select-none hidden sm:inline-flex items-center gap-1">
                  <kbd className="font-mono bg-background border border-border px-1 py-0.2 rounded text-[10px] text-foreground shadow-2xs">
                    ⌘ / Ctrl
                  </kbd>
                  <span>+</span>
                  <kbd className="font-mono bg-background border border-border px-1 py-0.2 rounded text-[10px] text-foreground shadow-2xs">
                    Enter
                  </kbd>
                  <span>{initialParentTaskId ? "để giao việc" : "để tạo"}</span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 ml-auto">
                  <Dialog.Close
                    className="h-7.5 px-3 text-xs font-medium text-foreground hover:bg-accent rounded-md transition-colors cursor-pointer"
                    disabled={form.isSubmitting}
                  >
                    Hủy
                  </Dialog.Close>

                  <button
                    type="button"
                    onClick={handleFormSubmit}
                    disabled={form.isSubmitting || !form.formData.title.trim()}
                    className="h-7.5 px-3.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    {form.isSubmitting ? (
                      <>
                        <span className="size-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin inline-block" />
                        <span>{initialParentTaskId ? "Đang giao việc..." : "Đang tạo..."}</span>
                      </>
                    ) : (
                      <span>{initialParentTaskId ? "Giao việc con" : "Tạo nhiệm vụ"}</span>
                    )}
                  </button>
                </div>
              </footer>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>

        <Dialog.Description className="sr-only">
          Biểu mẫu tạo nhiệm vụ mới
        </Dialog.Description>
      </Dialog.Root>

      {/* ── Confirm Discard AlertDialog ──────────────────────── */}
      <AlertDialog.Root
        open={showConfirmClose}
        onOpenChange={(open) => {
          if (!open) setShowConfirmClose(false);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-60 bg-background/80 backdrop-blur-xs" />
          <AlertDialog.Popup className="fixed inset-0 z-60 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-2xl border border-border max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="size-4" strokeWidth={1.5} />
                </div>
                <div className="space-y-1">
                  <AlertDialog.Title className="text-sm font-semibold text-foreground">
                    Bản nháp có thay đổi chưa lưu
                  </AlertDialog.Title>
                  <AlertDialog.Description className="text-xs text-muted-foreground leading-relaxed">
                    Biểu mẫu tạo nhiệm vụ đang có dữ liệu chưa lưu. Bạn muốn lưu tạm bản nháp trong phiên làm việc hay hủy bỏ hoàn toàn?
                  </AlertDialog.Description>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-border/60">
                <AlertDialog.Close
                  render={<Button variant="outline" size="sm" className="w-full sm:w-auto text-xs h-8" />}
                >
                  Tiếp tục soạn thảo
                </AlertDialog.Close>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleConfirmDiscard}
                  className="w-full sm:w-auto text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                >
                  Hủy và xóa nháp
                </Button>
              </div>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}

export default CreateTaskModal;
