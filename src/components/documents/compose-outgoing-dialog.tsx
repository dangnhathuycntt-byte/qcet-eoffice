"use client";

import * as React from "react";
import { ChevronRight, FileText, Paperclip, X } from "lucide-react";
import { StandardDialog, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Pressable } from "@/components/ui/pressable";
import { useModalDirtyGuard } from "@/hooks/use-modal-dirty-guard";
import { getPlatformModifierKey } from "@/lib/shortcuts/platform";
import { cn } from "@/lib/utils";
import type { DocumentSecurityLevel, DocumentUrgency } from "@/types/document";
import { attachFileToDocument } from "./workspace/document-edit";

/**
 * Hình thức văn bản theo danh mục của VNPT iOffice (modal "Thông tin văn bản đi", xem 15/10/2026):
 * Công văn đứng đầu (mặc định), "Khác" cuối, còn lại xếp theo chữ cái.
 */
const DOCUMENT_FORMS = [
  "Công văn",
  ...[
    "Báo cáo", "Báo cáo tuần", "Biên bản", "Chỉ thị", "Chương trình", "Công điện", "Giấy mời", "Hợp đồng", "Hợp đồng lao động",
    "Hướng dẫn", "Kế hoạch", "Kết luận", "Nghị định", "Nghị quyết", "Phiếu trình", "Quy định", "Quyết định", "Thông báo", "Thông tư",
    "Thông tư liên tịch", "Tờ trình",
  ].sort((a, b) => a.localeCompare(b, "vi")),
  "Khác",
].map((form) => ({ value: form, label: form }));

const URGENCY_OPTIONS: { value: DocumentUrgency; label: string }[] = [
  { value: "THUONG", label: "Thường" },
  { value: "KHAN", label: "Khẩn" },
  { value: "THUONG_KHAN", label: "Thượng khẩn" },
  { value: "HOA_TOC", label: "Hỏa tốc" },
];

const SECURITY_OPTIONS: { value: DocumentSecurityLevel; label: string }[] = [
  { value: "THUONG", label: "Thường" },
  { value: "MAT", label: "Mật" },
  { value: "TOI_MAT", label: "Tối mật" },
  { value: "TUYET_MAT", label: "Tuyệt mật" },
];

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SUMMARY_MAX_LENGTH = 2000;

type FieldErrors = Partial<Record<"summary" | "files", string>>;

export interface ComposeOutgoingDialogProps {
  open: boolean;
  onClose: () => void;
  /** Bản nháp vừa tạo (kể cả khi tệp chưa đính kèm được) để sổ tải lại và mở văn bản. */
  onCreated?: (document: { id: string }) => void;
}

const errorMessageOf = (json: unknown): string | null => {
  const body = json as { detail?: unknown; error?: unknown; message?: unknown } | null;
  for (const value of [body?.detail, body?.error, body?.message]) if (typeof value === "string" && value) return value;
  return null;
};

/**
 * Soạn văn bản đi (dự thảo), bố cục như hộp tạo nhiệm vụ: trích yếu là dòng tiêu đề, thuộc tính xếp thành lưới nhãn–giá trị,
 * tệp dự thảo bắt buộc như VNPT iOffice. Số và ngày ban hành do văn thư cấp khi phát hành nên không có ở đây.
 * Chưa có (cần thêm cột): Lĩnh vực, Loại văn bản (mới/thu hồi/thay thế), Hình thức sao, VB nội/ngoại tỉnh, Văn bản liên quan, Đơn vị soạn thảo.
 */
export function ComposeOutgoingDialog({ open, onClose, onCreated }: ComposeOutgoingDialogProps) {
  const [summary, setSummary] = React.useState("");
  const [category, setCategory] = React.useState("Công văn");
  const [urgency, setUrgency] = React.useState<DocumentUrgency>("THUONG");
  const [securityLevel, setSecurityLevel] = React.useState<DocumentSecurityLevel>("THUONG");
  const [dueDate, setDueDate] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [notes, setNotes] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // Bản nháp đã lưu nhưng có tệp chưa đính kèm được: giữ modal để báo, nút chính thành "Đóng"
  const [savedWithoutFiles, setSavedWithoutFiles] = React.useState(false);
  const [modKey, setModKey] = React.useState<"⌘" | "Ctrl">("Ctrl");
  const summaryRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isDirty = Boolean(
    summary.trim() ||
      notes.trim() ||
      dueDate ||
      files.length > 0 ||
      category !== "Công văn" ||
      urgency !== "THUONG" ||
      securityLevel !== "THUONG",
  );
  const { handleOpenChange } = useModalDirtyGuard({ isDirty: isDirty && !savedWithoutFiles, onConfirmClose: onClose });

  // Mỗi lần mở là một bản nháp mới
  React.useEffect(() => {
    if (!open) return;
    setSummary("");
    setCategory("Công văn");
    setUrgency("THUONG");
    setSecurityLevel("THUONG");
    setDueDate("");
    setFiles([]);
    setNotes("");
    setFieldErrors({});
    setErrorMessage(null);
    setSavedWithoutFiles(false);
    setModKey(getPlatformModifierKey());
    const timer = setTimeout(() => summaryRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  // Trích yếu tự giãn theo nội dung
  React.useLayoutEffect(() => {
    const el = summaryRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [summary, open]);

  const handleFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    const tooLarge = picked.filter((f) => f.size > MAX_FILE_BYTES);
    const accepted = picked.filter((f) => f.size <= MAX_FILE_BYTES);
    if (accepted.length > 0) {
      // Chọn lại cùng tệp thì không thêm lần nữa
      setFiles((prev) => [...prev, ...accepted.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))]);
    }
    setFieldErrors((prev) => ({
      ...prev,
      files: tooLarge.length > 0 ? `${tooLarge.map((f) => `"${f.name}"`).join(", ")} vượt quá 10MB.` : undefined,
    }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (savedWithoutFiles) {
      onClose();
      return;
    }
    const text = summary.trim();
    const errors: FieldErrors = {};
    if (text.length < 3) errors.summary = "Nhập trích yếu, ít nhất 3 ký tự.";
    if (files.length === 0) errors.files = "Đính kèm tệp dự thảo văn bản.";
    if (errors.summary || errors.files) {
      setFieldErrors(errors);
      if (errors.summary) summaryRef.current?.focus();
      return;
    }
    setFieldErrors({});
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/documents/outgoing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          // API bắt buộc `title` (tối đa 255 ký tự) nhưng chỉ lưu `summary`: gửi trích yếu ở cả hai
          title: text.slice(0, 255),
          summary: text,
          category,
          urgency,
          securityLevel,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessageOf(json) ?? "Không lưu được bản nháp. Vui lòng thử lại.");
      const created = (json as { document?: { id?: string } } | null)?.document;
      if (!created?.id) throw new Error("Không lưu được bản nháp. Vui lòng thử lại.");

      const failed: string[] = [];
      for (const file of files) {
        try {
          await attachFileToDocument(created.id, file);
        } catch (err) {
          failed.push(err instanceof Error ? err.message : `Không tải lên được "${file.name}".`);
        }
      }
      onCreated?.({ id: created.id });
      if (failed.length > 0) {
        setSavedWithoutFiles(true);
        setErrorMessage(`Đã lưu bản nháp nhưng còn tệp chưa đính kèm được: ${failed.join(" ")} Mở văn bản và dùng "Thêm tệp".`);
        return;
      }
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Không lưu được bản nháp. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const labelClass = "text-xs text-muted-foreground";
  const fieldClass = "w-full sm:w-auto sm:min-w-40";

  return (
    <StandardDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Soạn văn bản đi"
      showHeader={false}
      size="lg"
      className="gap-0 p-0 sm:max-w-[680px] sm:p-0 max-md:pb-0!"
    >
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        onKeyDown={(e) => {
          // Cmd/Ctrl+Enter lưu; bỏ qua khi bộ gõ Telex/IME đang soạn chữ
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void handleSubmit();
          }
        }}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-5 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="size-3.5 shrink-0" aria-hidden />
            <span className="font-medium text-foreground">Văn bản đi</span>
            <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" aria-hidden />
            <span>Soạn dự thảo</span>
          </div>
          <DialogClose render={<Button variant="ghost" size="icon-xs" aria-label="Đóng" title="Đóng (Esc)" className="shrink-0 max-md:size-8" />}>
            <X />
          </DialogClose>
        </header>

        {errorMessage ? (
          <div className="shrink-0 px-5 pt-3 sm:px-6">
            <InlineAlert variant={savedWithoutFiles ? "warning" : "error"} aria-live="assertive">
              {errorMessage}
            </InlineAlert>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6">
          <div className="space-y-1">
            <label htmlFor="compose-outgoing-summary" className="sr-only">
              Trích yếu
            </label>
            {/* design-lint-ignore no-raw-control: trích yếu là dòng tiêu đề không viền như hộp tạo nhiệm vụ, ui/Textarea ép nền và đệm */}
            <textarea
              id="compose-outgoing-summary"
              ref={summaryRef}
              rows={1}
              value={summary}
              maxLength={SUMMARY_MAX_LENGTH}
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.summary)}
              aria-describedby={fieldErrors.summary ? "compose-outgoing-summary-error" : undefined}
              disabled={savedWithoutFiles}
              onChange={(e) => {
                setSummary(e.target.value);
                if (fieldErrors.summary) setFieldErrors((prev) => ({ ...prev, summary: undefined }));
              }}
              placeholder="Trích yếu: V/v …"
              className={cn(
                "block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-base font-semibold leading-snug text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0",
                fieldErrors.summary && "placeholder:text-destructive/60",
              )}
            />
            {fieldErrors.summary ? (
              <p id="compose-outgoing-summary-error" role="alert" className="text-xs font-medium text-destructive">
                {fieldErrors.summary}
              </p>
            ) : null}
          </div>

          {/* Lưới nhãn–giá trị căn thẳng cột; điện thoại xếp một cột */}
          <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:grid-cols-[88px_minmax(0,1fr)_72px_minmax(0,1fr)]">
            <span id="compose-outgoing-form-label" className={labelClass}>Hình thức</span>
            <Select
              compact
              className={fieldClass}
              positionerClassName="z-50"
              aria-label="Hình thức"
              options={DOCUMENT_FORMS}
              value={category}
              onValueChange={(value) => value && setCategory(value)}
              disabled={savedWithoutFiles}
            />
            <span className={labelClass}>Độ khẩn</span>
            <Select
              compact
              className={fieldClass}
              positionerClassName="z-50"
              aria-label="Độ khẩn"
              options={URGENCY_OPTIONS}
              value={urgency}
              onValueChange={(value) => value && setUrgency(value as DocumentUrgency)}
              disabled={savedWithoutFiles}
            />
            <label htmlFor="compose-outgoing-due" className={labelClass}>Hạn xử lý</label>
            <VietnameseDatePicker
              id="compose-outgoing-due"
              value={dueDate}
              onChange={setDueDate}
              variant="input"
              placeholder="Không đặt hạn"
              triggerClassName="h-8 w-full rounded-control px-2 font-sans sm:h-7"
              className={fieldClass}
            />
            <span className={labelClass}>Độ mật</span>
            <Select
              compact
              className={fieldClass}
              positionerClassName="z-50"
              aria-label="Độ mật"
              options={SECURITY_OPTIONS}
              value={securityLevel}
              onValueChange={(value) => value && setSecurityLevel(value as DocumentSecurityLevel)}
              disabled={savedWithoutFiles}
            />
          </div>

          {/* Tệp dự thảo: bắt buộc, nhiều tệp, tải lên sau khi bản nháp được tạo */}
          <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-x-3">
            <span className={cn(labelClass, "pt-1.5")}>Tệp dự thảo</span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <input type="file"
                ref={fileInputRef}
                multiple
                accept=".pdf,.doc,.docx,application/pdf"
                onChange={handleFilesPicked}
                className="sr-only"
                aria-label="Chọn tệp dự thảo"
                tabIndex={-1}
              />
              {files.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {files.map((file) => (
                    <li key={`${file.name}-${file.size}`} className="flex h-7 min-w-0 items-center gap-1.5 rounded-md bg-secondary pl-2 pr-1 text-xs text-foreground">
                      <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate" title={file.name}>{file.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                      {!savedWithoutFiles ? (
                        <Pressable
                          aria-label={`Bỏ tệp ${file.name}`}
                          onClick={() => setFiles((prev) => prev.filter((f) => f !== file))}
                          className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <X className="size-3" />
                        </Pressable>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {!savedWithoutFiles ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="-ml-2"
                    aria-invalid={Boolean(fieldErrors.files) || undefined}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip />
                    {files.length > 0 ? "Thêm tệp" : "Đính kèm tệp"}
                  </Button>
                  <span className="text-xs text-muted-foreground">PDF hoặc Word, tối đa 10MB mỗi tệp</span>
                </div>
              ) : null}
              {fieldErrors.files ? (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {fieldErrors.files}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-x-3">
            <label htmlFor="compose-outgoing-notes" className={cn(labelClass, "pt-1.5")}>Ghi chú</label>
            <Textarea
              id="compose-outgoing-notes"
              compact
              rows={2}
              value={notes}
              maxLength={2000}
              countOnlyNearLimit
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ý kiến gửi kèm cho người xử lý tiếp theo (không bắt buộc)"
              disabled={savedWithoutFiles}
            />
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-5 py-2.5 sm:px-6 max-md:pb-[calc(env(safe-area-inset-bottom,0px)+10px)]">
          <p className="min-w-0 text-xs text-muted-foreground max-sm:hidden">Số và ngày ban hành do văn thư cấp khi phát hành.</p>
          <Button
            type="submit"
            size="sm"
            loading={isSubmitting}
            aria-keyshortcuts="Meta+Enter Control+Enter"
            title={savedWithoutFiles ? undefined : `${modKey} + Enter`}
            className="ml-auto max-md:px-4"
          >
            <span>{savedWithoutFiles ? "Đóng" : isSubmitting ? "Đang lưu…" : "Lưu bản nháp"}</span>
            {isSubmitting || savedWithoutFiles ? null : (
              <kbd className="hidden font-sans text-xs text-primary-foreground/60 sm:inline" aria-hidden="true">
                {modKey === "⌘" ? "⌘↵" : "Ctrl ↵"}
              </kbd>
            )}
          </Button>
        </footer>
      </form>
    </StandardDialog>
  );
}
