"use client";

import * as React from "react";
import { CalendarClock, FileText, FileUp, Lock, Plus, X, Zap } from "lucide-react";
import { StandardDialog, DialogBreadcrumb, DialogClose, DialogFooter, DialogForm, FieldError } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useModalDirtyGuard } from "@/hooks/use-modal-dirty-guard";
import { DRAFT_FILE_ACCEPT, describeDraftRejections, partitionDraftFiles } from "@/lib/documents/draft-files";
import { formatBytes } from "@/lib/pwa/storage-manager";
import { getPlatformModifierKey } from "@/lib/shortcuts/platform";
import { cn } from "@/lib/utils";
import type { DocumentSecurityLevel, DocumentUrgency } from "@qcet/contracts/types/document";
import { FileTypeIcon } from "./file-type-icon";
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

const SUMMARY_MAX_LENGTH = 2000;

const optionLabel = (options: { value: string; label: string }[], value: string) => options.find((o) => o.value === value)?.label ?? value;

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
 * Soạn văn bản đi (dự thảo), bố cục như hộp Tạo cuộc họp/Tạo nhiệm vụ: trích yếu là dòng tiêu đề, thuộc tính là hàng chip
 * (Hình thức, Độ khẩn, Độ mật, Hạn xử lý), ghi chú là phần thân như soạn thư, tệp dự thảo bắt buộc như VNPT iOffice nằm ở khối
 * đính kèm cuối thân (kéo thả vào bất cứ đâu trong hộp). Số và ngày ban hành do văn thư
 * cấp khi phát hành nên không có ở đây; nơi nhận chọn lúc phát hành (ADR-015).
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
  const [isDragging, setIsDragging] = React.useState(false);
  const summaryRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Nút "+" của khối Tệp dự thảo: nhận focus khi thiếu tệp
  const attachRef = React.useRef<HTMLButtonElement>(null);

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
    setIsDragging(false);
    setModKey(getPlatformModifierKey());
    const timer = setTimeout(() => summaryRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  const canEditFiles = !savedWithoutFiles && !isSubmitting;

  // Chọn từ hộp thoại hay kéo thả đều qua đây: `accept` của ô chọn tệp không áp cho tệp kéo vào
  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    const { accepted, rejected } = partitionDraftFiles(incoming, files);
    if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted]);
    setFieldErrors((prev) => ({ ...prev, files: describeDraftRejections(rejected) }));
  };

  const handleFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    addFiles(picked);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (savedWithoutFiles) {
      onClose();
      return;
    }
    // Trích yếu là một dòng tiêu đề: dán nhiều dòng thì gộp thành một
    const text = summary.replace(/\s*\n+\s*/g, " ").trim();
    const errors: FieldErrors = {};
    if (text.length < 3) errors.summary = "Nhập trích yếu, ít nhất 3 ký tự.";
    if (files.length === 0) errors.files = "Đính kèm tệp dự thảo (PDF hoặc Word, tối đa 10MB).";
    if (errors.summary || errors.files) {
      setFieldErrors(errors);
      if (errors.summary) summaryRef.current?.focus();
      else attachRef.current?.focus();
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

  const urgencyLabel = optionLabel(URGENCY_OPTIONS, urgency);
  const securityLabel = optionLabel(SECURITY_OPTIONS, securityLevel);
  // Tín hiệu bằng token: khẩn = destructive, mật = warning; mặc định "Thường" ghi tên thuộc tính bằng chữ mờ
  const urgencyTone = urgency === "THUONG" ? undefined : "text-destructive";
  const securityTone = securityLevel === "THUONG" ? undefined : "text-warning";

  return (
    <StandardDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Soạn văn bản đi"
      showHeader={false}
      size="lg"
      className="gap-0 bg-background p-0 sm:p-0 max-md:pb-0!"
    >
      <DialogForm onSubmit={() => void handleSubmit()} className="min-h-0 flex-1 gap-0">
        {/* Kéo tệp vào bất cứ đâu trong hộp là đính kèm; khung báo phủ lên hộp không bắt chuột (pointer-events-none) để con trỏ
            nằm trên nó không làm khối này nhận dragleave rồi tắt khung */}
        <div
          className="relative flex min-h-0 flex-1 flex-col"
          onDragOver={(e) => {
            if (!canEditFiles || !e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false);
          }}
          onDrop={(e) => {
            if (!canEditFiles) return;
            e.preventDefault();
            setIsDragging(false);
            addFiles(Array.from(e.dataTransfer.files));
          }}
        >
          <header className="flex shrink-0 items-center justify-between gap-2 px-5 pt-5 max-md:pt-3 md:pl-6">
            <DialogBreadcrumb items={["Văn bản đi", "Soạn dự thảo"]} />
            <DialogClose render={<Button variant="ghost" size="icon-xs" aria-label="Đóng" title="Đóng (Esc)" className="shrink-0 rounded-full max-md:size-8" />}>
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

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-4 md:px-6">
            <div className="flex shrink-0 flex-col gap-0.5">
              <label htmlFor="compose-outgoing-summary" className="sr-only">
                Trích yếu
              </label>
              <Textarea
                id="compose-outgoing-summary"
                ref={summaryRef}
                variant="bare"
                compact
                autoResize
                rows={1}
                value={summary}
                maxLength={SUMMARY_MAX_LENGTH}
                countOnlyNearLimit
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.summary) || undefined}
                aria-describedby={fieldErrors.summary ? "compose-outgoing-summary-error" : undefined}
                disabled={savedWithoutFiles}
                onChange={(e) => {
                  setSummary(e.target.value);
                  if (fieldErrors.summary) setFieldErrors((prev) => ({ ...prev, summary: undefined }));
                }}
                onKeyDown={(e) => {
                  // Trích yếu là một dòng tiêu đề: Enter gửi như ô tên của các hộp tạo khác. Shift+Enter xuống dòng;
                  // Cmd/Ctrl+Enter do biểu mẫu xử lý; bỏ qua khi bộ gõ Telex/IME đang soạn chữ
                  if (e.key !== "Enter" || e.shiftKey || e.metaKey || e.ctrlKey || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }}
                placeholder="Trích yếu"
                className="min-h-0 py-0 text-2xl font-semibold leading-normal placeholder:text-muted-foreground/60 aria-invalid:text-foreground aria-invalid:placeholder:text-destructive/60 max-md:text-xl sm:min-h-0"
              />
              {fieldErrors.summary ? <FieldError id="compose-outgoing-summary-error">{fieldErrors.summary}</FieldError> : null}
            </div>

            {/* Hàng chip thuộc tính như hộp Tạo nhiệm vụ (đo 22/10/2026): cách tên 10px, chip cách nhau 8px; điện thoại tự xuống dòng */}
            <div className="mt-2.5 flex shrink-0 flex-wrap items-center gap-2">
              <Select
                variant="pill"
                icon={<FileText className="text-muted-foreground" />}
                title="Hình thức văn bản"
                sheetTitle="Hình thức"
                aria-label={`Hình thức: ${category}`}
                positionerClassName="z-50"
                popupClassName="w-52"
                options={DOCUMENT_FORMS}
                value={category}
                onValueChange={(value) => value && setCategory(value)}
                disabled={savedWithoutFiles}
              />
              <Select
                variant="pill"
                icon={<Zap className={urgencyTone ?? "text-muted-foreground"} />}
                title="Độ khẩn"
                sheetTitle="Độ khẩn"
                aria-label={`Độ khẩn: ${urgencyLabel}`}
                className={urgencyTone}
                positionerClassName="z-50"
                options={URGENCY_OPTIONS}
                idleValue="THUONG"
                idleLabel="Độ khẩn"
                value={urgency}
                onValueChange={(value) => value && setUrgency(value as DocumentUrgency)}
                disabled={savedWithoutFiles}
              />
              <Select
                variant="pill"
                icon={<Lock className={securityTone ?? "text-muted-foreground"} />}
                title="Độ mật"
                sheetTitle="Độ mật"
                aria-label={`Độ mật: ${securityLabel}`}
                className={securityTone}
                positionerClassName="z-50"
                options={SECURITY_OPTIONS}
                idleValue="THUONG"
                idleLabel="Độ mật"
                value={securityLevel}
                onValueChange={(value) => value && setSecurityLevel(value as DocumentSecurityLevel)}
                disabled={savedWithoutFiles}
              />
              <VietnameseDatePicker
                id="compose-outgoing-due"
                variant="pill"
                periodPicker={false}
                // Bọc inline-block lệch dòng 1px so với các chip khác trong hàng flex
                className="flex"
                value={dueDate}
                onChange={setDueDate}
                label={dueDate ? "Hạn xử lý:" : undefined}
                placeholder="Hạn xử lý"
                title="Hạn xử lý"
                icon={<CalendarClock className="text-muted-foreground" />}
                disabled={savedWithoutFiles}
              />
            </div>

            {/* Như soạn thư: dưới đường kẻ là phần thân (ghi chú) rồi khối tệp đính kèm. Khoảng cách như phần mô tả của hộp Tạo
                nhiệm vụ: cách chip 20px, đệm trên 24px, đệm dưới 16px */}
            <div className="mt-5 flex flex-col gap-4 border-t border-border/60 pt-6 pb-4">
              <label htmlFor="compose-outgoing-notes" className="sr-only">
                Ghi chú
              </label>
              <Textarea
                id="compose-outgoing-notes"
                variant="bare"
                compact
                autoResize
                rows={1}
                value={notes}
                maxLength={2000}
                countOnlyNearLimit
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi chú (không bắt buộc)"
                disabled={savedWithoutFiles}
                className="min-h-16 text-sm leading-relaxed sm:min-h-16"
              />

              {/* Tệp dự thảo: bắt buộc, nhiều tệp, tải lên sau khi bản nháp được tạo. Khối như "Việc con" của hộp Tạo nhiệm vụ:
                  hàng đầu 40px tên khối + nút thêm tròn, mỗi tệp một hàng 36px, lỗi ở dòng cuối khối */}
              <section
                aria-label="Tệp dự thảo"
                className={cn(
                  "shrink-0 rounded-lg border bg-background",
                  fieldErrors.files && files.length === 0 ? "border-destructive/60" : "border-border/70",
                )}
              >
                <input type="file"
                  ref={fileInputRef}
                  multiple
                  accept={DRAFT_FILE_ACCEPT}
                  onChange={handleFilesPicked}
                  className="sr-only"
                  aria-label="Chọn tệp dự thảo"
                  tabIndex={-1}
                />
                <div className="flex h-10 items-center gap-2 pr-1.5 pl-3">
                  <h3 className="shrink-0 text-compact text-foreground">Tệp dự thảo</h3>
                  {/* Không ghi ràng buộc thường trực (đọc mãi thành chữ thừa): bộ lọc của hộp chọn tệp, khung kéo thả, tooltip
                      nút + và lỗi cụ thể đã nói PDF/Word, 10MB đúng lúc cần */}
                  {files.length > 0 ? <span className="text-xs tabular-nums text-muted-foreground">{files.length}</span> : null}
                  {canEditFiles ? (
                    <Button
                      ref={attachRef}
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Đính kèm tệp dự thảo"
                      title="Đính kèm tệp (PDF hoặc Word, tối đa 10MB)"
                      // Đỏ chỉ khi còn thiếu tệp; có tệp rồi mà vài tệp bị từ chối thì chỉ báo ở dòng cuối khối
                      aria-invalid={(Boolean(fieldErrors.files) && files.length === 0) || undefined}
                      aria-describedby={fieldErrors.files ? "compose-outgoing-files-error" : undefined}
                      className="ml-auto rounded-full max-md:size-8"
                    >
                      <Plus />
                    </Button>
                  ) : null}
                </div>
                {files.length > 0 ? (
                  <ul className="border-t border-border/60">
                    {files.map((file) => (
                      <li key={`${file.name}-${file.size}`} className="group flex h-9 min-w-0 items-center gap-2 pr-1.5 pl-3">
                        <FileTypeIcon fileName={file.name} mimeType={file.type} className="size-4" />
                        <span className="min-w-0 flex-1 truncate text-compact text-foreground" title={file.name}>{file.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatBytes(file.size)}</span>
                        {canEditFiles ? (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Bỏ tệp ${file.name}`}
                            title="Bỏ tệp"
                            onClick={() => setFiles((prev) => prev.filter((f) => f !== file))}
                            className="shrink-0 rounded-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
                          >
                            <X />
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {fieldErrors.files ? (
                  <p id="compose-outgoing-files-error" role="alert" className="border-t border-border/60 px-3 py-2 text-xs text-destructive">
                    {fieldErrors.files}
                  </p>
                ) : null}
              </section>
            </div>
          </div>

          <DialogFooter className="shrink-0 items-center border-t border-border/60 px-5 py-3 max-md:pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
            {savedWithoutFiles ? null : (
              <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
                Hủy
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              loading={isSubmitting}
              aria-keyshortcuts="Meta+Enter Control+Enter"
              title={savedWithoutFiles ? undefined : `${modKey} + Enter`}
              className="max-md:px-4"
            >
              <span>{savedWithoutFiles ? "Đóng" : isSubmitting ? "Đang lưu…" : "Lưu bản nháp"}</span>
              {isSubmitting || savedWithoutFiles ? null : (
                <kbd className="hidden font-sans text-xs text-primary-foreground/60 sm:inline" aria-hidden="true">
                  {modKey === "⌘" ? "⌘↵" : "Ctrl ↵"}
                </kbd>
              )}
            </Button>
          </DialogFooter>
          {isDragging ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-primary/60 bg-background/90"
            >
              <FileUp className="size-4 text-primary" />
              <p className="text-compact font-medium text-foreground">Thả tệp dự thảo vào đây</p>
              <p className="text-xs text-muted-foreground">PDF hoặc Word, tối đa 10MB mỗi tệp</p>
            </div>
          ) : null}
        </div>
      </DialogForm>
    </StandardDialog>
  );
}
