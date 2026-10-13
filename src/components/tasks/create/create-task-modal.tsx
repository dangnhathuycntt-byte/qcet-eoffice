"use client";

import * as React from "react";
import {
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  User,
  CalendarClock,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { PrioritySignalBars } from "@/components/tasks/priority-signal-bars";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Popover } from "@base-ui/react/popover";
import { Dialog } from "@base-ui/react/dialog";
import { getPlatformModifierKey } from "@/lib/shortcuts/platform";
import type { CreateTaskLevel } from "@/lib/adapters/create-task-mapper";
import {
  useCreateTaskForm,
  type CreateTaskPriority,
} from "@/hooks/use-create-task-form";
import { Pressable } from "@/components/ui/pressable";
import { SheetKeyboardSync } from "@/components/ui/menu";
import { useIsPhone } from "@/hooks/use-is-phone";
import { useFeedback } from "@/components/ui/feedback-layer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { foldVietnamese } from "@/lib/search/vietnamese-search";
import { InlineAlert } from "@/components/ui/inline-alert";
import { MenuSheetHeader, SHEET_BACKDROP_CLASS, SHEET_POPUP_CLASS, SHEET_POSITIONER_CLASS } from "@/components/ui/menu";
import { SourceDocumentChip, linkTaskToDocument, type SourceDocumentOption } from "@/components/tasks/create/source-document-chip";

// Re-export types for downstream consumers
export type { CreateTaskPriority } from "@/hooks/use-create-task-form";

// ─── Visual Config ─────────────────────────────────────────────
const PRIORITY_CONFIG: Record<
  CreateTaskPriority,
  { label: string; color: string; bg: string; border: string; iconColor: string }
> = {
  URGENT: {
    label: "Khẩn cấp",
    color: "text-destructive",
    bg: "bg-danger-soft",
    border: "border-destructive/20",
    iconColor: "text-destructive",
  },
  HIGH: {
    label: "Cao",
    color: "text-foreground",
    bg: "bg-muted/40",
    border: "border-border",
    iconColor: "text-foreground/70",
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

// Khớp CreateTaskInputSchema (title tối đa 255): dán dài hơn bị cắt, nên báo trước khi chạm giới hạn
const TITLE_MAX_LENGTH = 255;
const TITLE_COUNTER_FROM = 200;

// Biểu mẫu dùng MEDIUM, bảng dùng NORMAL: chuẩn hóa để icon tín hiệu khớp với bảng danh sách
const toSignalPriority = (p: CreateTaskPriority) => (p === "MEDIUM" ? "NORMAL" : p);

// ─── Props ─────────────────────────────────────────────────────
export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess?: (task: unknown) => void;
  /** Nhận nhiệm vụ vừa tạo từ server (có `id`), dùng khi cần liên kết ngay sau khi tạo. */
  onCreated?: (task: { id: string }) => void;
  /** Mở từ chính văn bản (văn bản tự gắn sau khi tạo): không hiện chip chọn văn bản nguồn. */
  hideSourceDocument?: boolean;
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
  onCreated,
  hideSourceDocument = false,
  onSubmit,
  initialDepartmentCode,
  initialTitle,
  initialLevel,
  initialParentTaskId,
  initialParentTaskTitle,
  initialLeadAssigneeId,
  initialDueDate,
}: CreateTaskModalProps) {
  // Văn bản nguồn chọn trong hộp: gắn vào nhiệm vụ ngay sau khi tạo xong (hộp đóng ngay nên đọc qua ref)
  const [sourceDocument, setSourceDocument] = React.useState<SourceDocumentOption | null>(null);
  const sourceDocumentRef = React.useRef<SourceDocumentOption | null>(null);
  sourceDocumentRef.current = sourceDocument;
  const { showToast } = useFeedback();
  React.useEffect(() => {
    if (!isOpen) setSourceDocument(null);
  }, [isOpen]);
  const form = useCreateTaskForm({
    isOpen,
    initialLevel,
    initialTitle,
    initialAssigneeId: initialLeadAssigneeId,
    initialDueDate,
    initialDepartmentCode,
    parentTaskId: initialParentTaskId,
    onSuccess: (task) => {
      const created = task as { id: string };
      const doc = sourceDocumentRef.current;
      if (doc) {
        void linkTaskToDocument(doc.id, created.id).then((ok) => {
          if (ok) return;
          showToast({
            variant: "warning",
            message: `Đã tạo nhiệm vụ nhưng chưa gắn được văn bản ${doc.number}. Văn bản có thể đã gắn nhiệm vụ khác hoặc bạn chưa có quyền.`,
            action: { label: "Mở nhiệm vụ", onClick: () => window.location.assign(`/tasks/${created.id}`) },
          });
        });
      }
      onCreated?.(created);
    },
  });

  // ── Local UI state ──────────────────────────────────────────
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);
  const [personQuery, setPersonQuery] = React.useState("");
  const isPhone = useIsPhone();
  // Điện thoại: mở menu ưu tiên/đơn vị (không có ô nhập) thì bỏ focus ô đang gõ để bàn phím không che menu.
  // Menu chủ trì có ô tìm riêng nên giữ nguyên.
  React.useEffect(() => {
    if (!isPhone || !openDropdown || openDropdown === "dri" || openDropdown === "document") return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.matches("input, textarea")) active.blur();
  }, [isPhone, openDropdown]);
  // Đọc nền tảng sau khi mount để không lệch HTML giữa server và client
  const [modKey, setModKey] = React.useState<"⌘" | "Ctrl">("Ctrl");
  React.useEffect(() => setModKey(getPlatformModifierKey()), []);

  const titleInputRef = React.useRef<HTMLTextAreaElement>(null);
  const descriptionTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const leadTriggerRef = React.useRef<HTMLButtonElement>(null);

  // Tên dài (tiếng Việt thường 100+ ký tự) xuống dòng thay vì cuộn ngang trong ô một dòng
  const fitTitleHeight = React.useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  // Hộp mở sau khi gắn: ô chỉ có mặt khi Popup đã mount, nên đo cả lúc gắn ref (bản nháp khôi phục) lẫn khi gõ
  const setTitleRef = React.useCallback(
    (el: HTMLTextAreaElement | null) => {
      titleInputRef.current = el;
      fitTitleHeight(el);
    },
    [fitTitleHeight],
  );
  React.useLayoutEffect(() => fitTitleHeight(titleInputRef.current), [form.formData.title, fitTitleHeight]);
  // Xoay màn hình hoặc đổi cỡ cửa sổ làm đổi chỗ ngắt dòng: đo lại để không cắt dòng cuối
  React.useEffect(() => {
    if (!isOpen) return;
    const refit = () => fitTitleHeight(titleInputRef.current);
    window.addEventListener("resize", refit);
    return () => window.removeEventListener("resize", refit);
  }, [isOpen, fitTitleHeight]);

  // Autofocus title input when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => titleInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Cmd/Ctrl+Enter to submit. Trình nghe gắn một lần khi mở nên gọi qua ref: closure lúc mở còn giữ form rỗng.
  const submitRef = React.useRef<() => void>(() => {});
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        submitRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // ── Handlers ────────────────────────────────────────────────
  const handleRequestClose = React.useCallback(() => {
    if (form.isSubmitting) return;
    // Đóng (nhấn ra ngoài hoặc Esc) = bỏ luôn nội dung đang soạn, không giữ bản nháp
    if (form.isDirty) form.handleClearDraft();
    onClose();
  }, [form, onClose]);

  // Kiểm tra không qua thì đưa focus tới ô sai đầu tiên (người dùng bàn phím/đọc màn hình không thấy chip đổi màu)
  const handleFormSubmit = React.useCallback(async () => {
    const errors = await form.handleSubmit();
    if (!errors) return;
    if (errors.title) titleInputRef.current?.focus();
    else if (errors.lead) leadTriggerRef.current?.focus();
    else if (errors.startDate) document.getElementById("create-task-start-date")?.focus();
    else if (errors.dueDate) document.getElementById("create-task-due-date")?.focus();
  }, [form]);
  submitRef.current = handleFormSubmit;

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

  const leadAssigneeAvatarUrl = React.useMemo(
    () => form.availablePersonnel.find((p) => p.id === form.formData.leadAssigneeId)?.avatarUrl ?? null,
    [form.availablePersonnel, form.formData.leadAssigneeId],
  );

  const currentDeptName = React.useMemo(() => {
    const dept = form.availableDepartments.find((d) => d.code === form.formData.selectedDeptCode);
    if (dept) return dept.name;
    // Danh sách rỗng sau khi đã tải xong (tài khoản chưa gắn đơn vị, hoặc tải lỗi) không phải đang tải
    return form.isLoadingDepartments ? "Đang tải…" : "Chưa có đơn vị";
  }, [form.availableDepartments, form.formData.selectedDeptCode, form.isLoadingDepartments]);

  const fieldErrorText = [form.fieldErrors.lead, form.fieldErrors.startDate, form.fieldErrors.dueDate]
    .filter(Boolean)
    .join(" ");

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
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
          />
          <Dialog.Popup
            className="group/dlg pointer-events-none fixed inset-0 z-50 flex items-start justify-center pt-[10vh] p-2 sm:p-4 md:p-6 outline-none max-md:p-3 max-md:pt-[calc(env(safe-area-inset-top,0px)+47px)] max-md:pb-[max(calc(env(safe-area-inset-bottom,0px)+47px),calc(var(--keyboard-height,0px)+8px))]"
          >
            {/* Điện thoại: đẩy hộp lên khi bàn phím ảo hiện (như sheet chọn thuộc tính) */}
            {isOpen ? <SheetKeyboardSync /> : null}
            {/* Outer Card: Compact task composer */}
            <div
              data-slot="create-task-modal"
              className={cn(
                "pointer-events-auto relative flex flex-col bg-card rounded-2xl shadow-2xl border-0 overflow-hidden",
                "w-full max-w-[680px] min-h-[360px] max-h-[85vh]",
                // Điện thoại: thẻ cao gần hết màn hình như hộp tạo mới của Linear
                "max-md:h-full max-md:max-h-none max-md:min-h-0",
                "animate-in fade-in zoom-in-95",
                // Điện thoại: trượt lên từ đáy như sheet (dự án không nạp tw-animate nên dùng data-starting-style của Dialog)
                "max-md:transition-[translate,opacity] max-md:duration-[var(--motion-duration-panel)] max-md:ease-[var(--motion-ease-enter)] max-md:group-data-[starting-style]/dlg:translate-y-10 max-md:group-data-[starting-style]/dlg:opacity-0 max-md:group-data-[ending-style]/dlg:translate-y-10 max-md:group-data-[ending-style]/dlg:opacity-0 max-md:group-data-[ending-style]/dlg:duration-[var(--motion-duration-normal)] max-md:group-data-[ending-style]/dlg:ease-[var(--motion-ease-exit)] motion-reduce:max-md:transition-none",
              )}
            >
              {/* ── Modal Top Header ──────────────────────────── */}
              <header className="flex items-center justify-between gap-2 px-5 sm:px-6 py-2.5 border-b border-border/60 bg-card shrink-0">
                {/* Breadcrumb & Unit Selector */}
                <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="size-3.5 shrink-0 text-muted-foreground/70" />

                  {/* Department selector */}
                  {form.availableDepartments.length > 1 ? (
                    <Popover.Root
                      open={openDropdown === "dept"}
                      onOpenChange={(open) => setOpenDropdown(open ? "dept" : null)}
                    >
                      <div className="relative inline-block min-w-0 text-left">
                        <Popover.Trigger
                          type="button"
                          className={cn(
                            "inline-flex max-w-full items-center gap-1 font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1.5 py-0.5 cursor-pointer",
                            openDropdown === "dept"
                              ? "text-foreground bg-accent shadow-2xs"
                              : "text-foreground hover:text-foreground/80 hover:bg-accent/50",
                          )}
                        >
                          <span className="truncate max-md:max-w-[200px]">{currentDeptName}</span>
                          <ChevronDown
                            className={cn(
                              "size-3 shrink-0 text-muted-foreground transition-transform duration-200 ease-out",
                              openDropdown === "dept" && "rotate-180 text-foreground",
                            )}
                          />
                        </Popover.Trigger>

                        <Popover.Portal>
                          <Popover.Backdrop className={SHEET_BACKDROP_CLASS} />
                          <Popover.Positioner className={cn("z-50", SHEET_POSITIONER_CLASS)} align="start" sideOffset={4} collisionPadding={12}>
                            <Popover.Popup
                              style={{ maxWidth: "var(--available-width)", maxHeight: "var(--available-height)", overflowY: "auto" }}
                              className={cn("w-64 p-1 space-y-0.5 rounded-xl border border-border bg-popover shadow-2xl", SHEET_POPUP_CLASS, "max-md:border-0")}
                              aria-label="Chọn đơn vị phòng ban"
                            >
                              <MenuSheetHeader title="Đơn vị" />
                              {form.availableDepartments.map((dept) => (
                                <Pressable
                                  key={dept.code}
                                  onClick={() => {
                                    form.setField("selectedDeptCode", dept.code);
                                    form.setField("leadAssigneeId", "");
                                    setOpenDropdown(null);
                                  }}
                                  className={cn(
                                    "w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all duration-150 active:scale-[0.99] max-md:min-h-10 max-md:text-compact",
                                    form.formData.selectedDeptCode === dept.code
                                      ? "font-semibold text-foreground bg-accent"
                                      : "text-foreground hover:bg-accent/70",
                                  )}
                                >
                                  <span className="truncate">{dept.name}</span>
                                </Pressable>
                              ))}
                            </Popover.Popup>
                          </Popover.Positioner>
                        </Popover.Portal>
                      </div>
                    </Popover.Root>
                  ) : (
                    <span className="min-w-0 truncate font-semibold text-foreground px-1.5 py-0.5 rounded bg-accent/40 max-md:max-w-[200px]">
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
                  <Dialog.Title className="shrink-0 text-muted-foreground font-medium text-xs whitespace-nowrap">
                    {initialParentTaskId ? "Giao việc con" : "Tạo nhiệm vụ"}
                  </Dialog.Title>
                </div>

                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleRequestClose}
                  aria-label="Đóng"
                  title="Đóng (Esc)"
                  className="shrink-0 max-md:size-8"
                >
                  <X />
                </Button>
              </header>

              {/* ── Restored Draft Banner ────────────────────── */}
              {form.hasRestoredDraft && (
                <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-1.5 bg-muted/40 border-b border-border/60 text-xs text-muted-foreground shrink-0">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                    <span>Đã tự động khôi phục bản nháp chưa lưu từ phiên làm việc trước.</span>
                  </div>
                  <Pressable
                    onClick={form.handleClearDraft}
                    className="inline-flex shrink-0 items-center whitespace-nowrap max-md:min-h-11 text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2"
                  >
                    Xóa bản nháp
                  </Pressable>
                </div>
              )}

              {/* Lỗi gửi: nằm ngoài vùng cuộn để luôn thấy dù đang cuộn mô tả dài */}
              {errorMessage && (
                <div className="px-5 sm:px-6 pt-3 shrink-0">
                  <InlineAlert variant="error" aria-live="assertive">
                    {errorMessage}
                  </InlineAlert>
                </div>
              )}

              {/* ── Modal Scrollable Form Area ───────────────── */}
              <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 flex flex-col space-y-2.5 min-h-0">

                {/* 1. Task Title (P0 Field) */}
                <div className="space-y-0.5 shrink-0">
                  <label htmlFor="create-task-title" className="sr-only">
                    {initialParentTaskId ? "Tên việc con" : "Tên nhiệm vụ"}
                  </label>
                  {/* design-lint-ignore no-raw-control: tiêu đề không viền hòa vào trang, ui/Textarea ép nền, đệm và bộ đếm */}
                  <textarea
                    id="create-task-title"
                    ref={setTitleRef}
                    rows={1}
                    name="task-title"
                    autoComplete="off"
                    value={form.formData.title}
                    maxLength={TITLE_MAX_LENGTH}
                    aria-required="true"
                    aria-invalid={Boolean(form.fieldErrors.title)}
                    aria-describedby={form.fieldErrors.title ? "create-task-title-error" : undefined}
                    onChange={(e) => {
                      form.setField("title", e.target.value.replace(/\s*\n+\s*/g, " "));
                      if (form.fieldErrors.title) {
                        form.setFieldErrors((prev) => ({ ...prev, title: undefined }));
                      }
                    }}
                    onKeyDown={(e) => {
                      // Gõ Telex/IME: Enter chốt âm tiết đang soạn, không phải lệnh chuyển ô
                      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        descriptionTextareaRef.current?.focus();
                      }
                    }}
                    placeholder={initialParentTaskId ? "Tên việc con" : "Tên nhiệm vụ"}
                    className={cn(
                      "block w-full resize-none overflow-hidden text-lg font-semibold text-foreground placeholder:text-muted-foreground/60 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 leading-snug max-md:text-base",
                      form.fieldErrors.title && "placeholder:text-destructive/60 text-destructive",
                    )}
                  />
                  {form.fieldErrors.title && (
                    <p id="create-task-title-error" role="alert" className="text-xs text-destructive font-medium">
                      {form.fieldErrors.title}
                    </p>
                  )}
                  {form.formData.title.length >= TITLE_COUNTER_FROM && (
                    <p
                      aria-live="polite"
                      className={cn(
                        "text-xs tabular-nums",
                        form.formData.title.length >= TITLE_MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {form.formData.title.length}/{TITLE_MAX_LENGTH} ký tự
                    </p>
                  )}
                </div>

                {/* 4. Detailed Description / Canvas */}
                <div className="pt-1 flex-1 flex flex-col min-h-[160px]">
                  <label htmlFor="create-task-description" className="sr-only">
                    Mô tả chi tiết nhiệm vụ
                  </label>
                  <textarea
                    id="create-task-description"
                    ref={descriptionTextareaRef}
                    value={form.formData.description}
                    onChange={(e) => form.setField("description", e.target.value)}
                    placeholder="Nội dung chỉ đạo, căn cứ pháp lý, yêu cầu kỹ thuật hoặc tiêu chí nghiệm thu"
                    rows={4}
                    className="w-full flex-1 min-h-[140px] resize-none bg-transparent border-0 p-0 text-compact text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-0 leading-relaxed"
                  />
                </div>
              </div>

              {/* 3. Thuộc tính: dưới phần soạn, luôn thấy kể cả khi mô tả dài */}
              <div className="flex flex-wrap items-center gap-1.5 px-5 sm:px-6 pb-3 shrink-0 max-md:gap-2">
                {/* 3.1 Priority Chip */}
                <Popover.Root
                  open={openDropdown === "priority"}
                  onOpenChange={(open) => setOpenDropdown(open ? "priority" : null)}
                >
                  <div className="relative">
                    <Popover.Trigger
                      type="button"
                      aria-label={`Mức ưu tiên: ${PRIORITY_CONFIG[form.formData.priority].label}`}
                      title={`Mức ưu tiên: ${PRIORITY_CONFIG[form.formData.priority].label}`}
                      className={cn(
                        "inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium border transition-all duration-150 cursor-pointer select-none",
                        "max-md:size-7 max-md:justify-center max-md:gap-0 max-md:rounded-full max-md:px-0",
                        openDropdown === "priority"
                          ? "border-border bg-accent text-foreground shadow-2xs"
                          : "border-transparent bg-muted/60 hover:bg-accent text-foreground",
                      )}
                    >
                      <PrioritySignalBars priority={toSignalPriority(form.formData.priority)} className="shrink-0" />
                      <span className="max-md:hidden">{PRIORITY_CONFIG[form.formData.priority].label}</span>
                      <ChevronDown
                        className={cn(
                          "size-2.5 text-muted-foreground transition-transform duration-200 ease-out max-md:hidden",
                          openDropdown === "priority" && "rotate-180 text-foreground",
                        )}
                      />
                    </Popover.Trigger>

                    <Popover.Portal>
                      <Popover.Backdrop className={SHEET_BACKDROP_CLASS} />
                      <Popover.Positioner className={cn("z-50", SHEET_POSITIONER_CLASS)} align="start" sideOffset={4} collisionPadding={12}>
                        <Popover.Popup
                          style={{ maxWidth: "var(--available-width)", maxHeight: "var(--available-height)", overflowY: "auto" }}
                          className={cn("w-40 p-1 space-y-0.5 rounded-xl border border-border bg-popover shadow-2xl", SHEET_POPUP_CLASS, "max-md:border-0")}
                          aria-label="Chọn mức độ ưu tiên"
                        >
                          <MenuSheetHeader title="Mức ưu tiên" />
                          {PRIORITY_KEYS.map((p) => (
                            <Pressable
                              key={p}
                              onClick={() => {
                                form.setField("priority", p);
                                setOpenDropdown(null);
                              }}
                              className={cn(
                                "w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all duration-150 active:scale-[0.99] max-md:min-h-10 max-md:text-compact",
                                form.formData.priority === p
                                  ? "bg-accent font-medium text-foreground"
                                  : "text-foreground hover:bg-accent",
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <PrioritySignalBars priority={toSignalPriority(p)} className="shrink-0" />
                                <span>{PRIORITY_CONFIG[p].label}</span>
                              </div>
                            </Pressable>
                          ))}
                        </Popover.Popup>
                      </Popover.Positioner>
                    </Popover.Portal>
                  </div>
                </Popover.Root>

                {/* 3.2 Lead Assignee (DRI) Chip (P0 Field) */}
                <Popover.Root
                  open={openDropdown === "dri"}
                  onOpenChange={(open) => {
                    setOpenDropdown(open ? "dri" : null);
                    if (!open) setPersonQuery("");
                  }}
                >
                  <div className="relative">
                    <Popover.Trigger
                      ref={leadTriggerRef}
                      type="button"
                      aria-required="true"
                      aria-invalid={Boolean(form.fieldErrors.lead)}
                      aria-label={leadAssigneeDisplayName ? undefined : "Chủ trì"}
                      className={cn(
                        "inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium border transition-all duration-150 cursor-pointer select-none",
                        !leadAssigneeDisplayName && "max-md:size-7 max-md:justify-center max-md:gap-0 max-md:rounded-full max-md:px-0",
                        form.fieldErrors.lead
                          ? "border-transparent bg-danger-soft text-destructive"
                          : openDropdown === "dri"
                            ? "border-border bg-accent text-foreground shadow-2xs"
                            : "border-transparent bg-muted/60 hover:bg-accent text-foreground",
                      )}
                    >
                      {leadAssigneeDisplayName ? (
                        <UserAvatar name={leadAssigneeDisplayName} avatarUrl={leadAssigneeAvatarUrl} size="xs" />
                      ) : (
                        <User className={cn("size-3 max-md:size-3.5", form.fieldErrors.lead ? "text-destructive" : "text-muted-foreground")} />
                      )}
                      <span className={cn("max-w-[110px] truncate", !leadAssigneeDisplayName && "max-md:hidden")} title={leadAssigneeDisplayName ? `Chủ trì: ${leadAssigneeDisplayName}` : undefined}>
                        {leadAssigneeDisplayName || "Chủ trì"}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-2.5 text-muted-foreground transition-transform duration-200 ease-out",
                          !leadAssigneeDisplayName && "max-md:hidden",
                          openDropdown === "dri" && "rotate-180 text-foreground",
                        )}
                      />
                    </Popover.Trigger>

                    <Popover.Portal>
                      <Popover.Backdrop className={SHEET_BACKDROP_CLASS} />
                      <Popover.Positioner className={cn("z-50", SHEET_POSITIONER_CLASS)} align="start" sideOffset={4} collisionPadding={12}>
                        <Popover.Popup
                          style={{ maxWidth: "var(--available-width)", maxHeight: "var(--available-height)", overflowY: "auto" }}
                          className={cn("w-60 p-1 rounded-xl border border-border bg-popover shadow-2xl", SHEET_POPUP_CLASS, "max-md:border-0")}
                          aria-label="Chọn người chủ trì"
                        >
                          <MenuSheetHeader title="Người chủ trì" />
                          <Input
                            compact
                            value={personQuery}
                            onChange={(e) => setPersonQuery(e.target.value)}
                            placeholder="Tìm người…"
                            aria-label="Tìm người chủ trì"
                            className="mb-1 text-xs max-md:h-8"
                          />
                          <div className="max-h-56 space-y-0.5 overflow-y-auto overscroll-contain">
                            {form.availablePersonnel.length === 0 ? (
                              <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                                {form.isLoadingDepartments ? "Đang tải danh sách…" : "Chưa có nhân sự trong đơn vị này"}
                              </div>
                            ) : (
                              (() => {
                                // Gõ không dấu vẫn tìm ra ("hung" → "Hùng")
                                const q = foldVietnamese(personQuery);
                                const list = q
                                  ? form.availablePersonnel.filter((p) =>
                                      [p.name, p.email].some((t) => foldVietnamese(t).includes(q)),
                                    )
                                  : form.availablePersonnel;
                                if (list.length === 0) {
                                  return (
                                    <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                                      Không tìm thấy người phù hợp
                                    </div>
                                  );
                                }
                                return list.map((person) => (
                                  <Pressable
                                    key={person.id}
                                    onClick={() => {
                                      form.setField("leadAssigneeId", person.id);
                                      if (form.fieldErrors.lead) {
                                        form.setFieldErrors((prev) => ({ ...prev, lead: undefined }));
                                      }
                                      setPersonQuery("");
                                      setOpenDropdown(null);
                                    }}
                                    className={cn(
                                      "w-full text-left px-2 py-1 rounded-lg text-xs flex items-center gap-2 transition-colors max-md:min-h-10 max-md:text-compact",
                                      form.formData.leadAssigneeId === person.id
                                        ? "bg-accent font-medium"
                                        : "hover:bg-accent/70",
                                    )}
                                  >
                                    <UserAvatar name={person.name} avatarUrl={person.avatarUrl} size="sm" />
                                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground max-md:text-compact">
                                      {person.name}
                                    </span>
                                  </Pressable>
                                ));
                              })()
                            )}
                          </div>
                        </Popover.Popup>
                      </Popover.Positioner>
                    </Popover.Portal>
                  </div>
                </Popover.Root>

                {/* 3.3 Start Date Chip */}
                <VietnameseDatePicker
                  id="create-task-start-date"
                  value={form.formData.startDate}
                  onChange={(val) => form.setField("startDate", val)}
                  label={form.formData.startDate ? "Bắt đầu:" : undefined}
                  variant="chip"
                  triggerClassName="h-7"
                  compactWhenEmpty
                  error={Boolean(form.fieldErrors.startDate)}
                  icon={<Calendar className="size-3 text-muted-foreground max-md:size-3.5" />}
                  placeholder="Bắt đầu"
                />

                {/* 3.4 Target Due Date Chip (P0 Field) */}
                <VietnameseDatePicker
                  id="create-task-due-date"
                  value={form.formData.dueDate}
                  required
                  onChange={(val) => {
                    form.setField("dueDate", val);
                    if (form.fieldErrors.dueDate) {
                      form.setFieldErrors((prev) => ({ ...prev, dueDate: undefined }));
                    }
                  }}
                  label={form.formData.dueDate ? "Hạn:" : undefined}
                  variant="chip"
                  triggerClassName="h-7"
                  compactWhenEmpty
                  error={Boolean(form.fieldErrors.dueDate)}
                  icon={
                    <CalendarClock
                      className={cn(
                        "size-3 max-md:size-3.5",
                        form.fieldErrors.dueDate ? "text-destructive" : "text-muted-foreground",
                      )}
                    />
                  }
                  placeholder="Hạn hoàn thành"
                />

                {/* 3.5 Văn bản nguồn (chỉ nhiệm vụ gốc, và khi không mở từ chính văn bản) */}
                {!hideSourceDocument && !initialParentTaskId ? (
                  <SourceDocumentChip
                    value={sourceDocument}
                    onChange={setSourceDocument}
                    open={openDropdown === "document"}
                    onOpenChange={(open) => setOpenDropdown(open ? "document" : null)}
                  />
                ) : null}
              </div>
              {fieldErrorText && (
                <p role="alert" className="px-5 sm:px-6 pb-3 -mt-1 shrink-0 text-xs font-medium text-destructive">
                  {fieldErrorText}
                </p>
              )}

              {/* ── Modal Bottom Footer ──────────────────────── */}
              <footer className="flex items-center justify-between px-5 sm:px-6 py-2.5 border-t border-border/60 bg-muted/20 shrink-0">
                {/* Chỉ nút chính; đóng bằng Esc hoặc nhấn ra ngoài */}
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    size="sm"
                    onClick={handleFormSubmit}
                    loading={form.isSubmitting}
                    disabled={!form.formData.title.trim()}
                    aria-keyshortcuts="Meta+Enter Control+Enter"
                    title={`${modKey} + Enter`}
                    className="max-md:px-4"
                  >
                    <span>{form.isSubmitting ? (initialParentTaskId ? "Đang giao việc…" : "Đang tạo…") : initialParentTaskId ? "Giao việc con" : "Tạo nhiệm vụ"}</span>
                    {/* Phím tắt nằm gọn trong nút, nhạt hơn nhãn */}
                    {form.isSubmitting ? null : (
                      <kbd className="hidden sm:inline font-sans text-xs text-primary-foreground/60" aria-hidden="true">
                        {modKey === "⌘" ? "⌘↵" : "Ctrl ↵"}
                      </kbd>
                    )}
                  </Button>

                </div>
              </footer>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>

        <Dialog.Description className="sr-only">
          Biểu mẫu tạo nhiệm vụ mới
        </Dialog.Description>
      </Dialog.Root>
    </>
  );
}

export default CreateTaskModal;
