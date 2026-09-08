"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  X,
  UploadCloud,
  Link as LinkIcon,
  FileText,
  Loader2,
  AlertCircle,
  Trash2,
  Paperclip,
  Send,
  CheckCircle2,
  FileSpreadsheet,
  FileArchive,
  ExternalLink,
} from "lucide-react";
import type { DeliverableSubmissionPayload } from "@/types/workspace";
import type { StaffTask } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ============================================================================
// 1. Constants & Helper Utilities
// ============================================================================

export const SUPPORTED_FILE_TYPES = [
  { id: "PDF", label: "Tệp PDF (.pdf)", ext: ".pdf" },
  { id: "DOCX", label: "Văn bản Word (.docx, .doc)", ext: ".docx,.doc" },
  { id: "XLSX", label: "Bảng tính Excel (.xlsx, .xls, .csv)", ext: ".xlsx,.xls,.csv" },
  { id: "ZIP", label: "Gói lưu trữ (.zip, .rar, .7z)", ext: ".zip,.rar,.7z" },
  { id: "LINK", label: "Liên kết trực tuyến (Drive, Web)", ext: "" },
  { id: "KHAC", label: "Định dạng khác", ext: "" },
] as const;

export type SupportedFileType = (typeof SUPPORTED_FILE_TYPES)[number]["id"];

export interface DeliverableDraft {
  deliverableName: string;
  url: string;
  fileType: string;
  note: string;
  updatedAt: string;
}

/**
 * Generate sessionStorage key for draft caching by taskId
 */
export function getDeliverableDraftKey(taskId: string): string {
  return `qcet_deliverable_draft_${taskId.trim()}`;
}

/**
 * Infer deliverable file type category from file name or URL
 */
export function inferFileType(filenameOrUrl: string): SupportedFileType {
  if (!filenameOrUrl) return "PDF";
  const clean = filenameOrUrl.trim().toLowerCase();

  if (clean.endsWith(".pdf")) return "PDF";
  if (clean.endsWith(".docx") || clean.endsWith(".doc")) return "DOCX";
  if (clean.endsWith(".xlsx") || clean.endsWith(".xls") || clean.endsWith(".csv")) return "XLSX";
  if (clean.endsWith(".zip") || clean.endsWith(".rar") || clean.endsWith(".7z") || clean.endsWith(".tar.gz")) return "ZIP";
  if (clean.startsWith("http://") || clean.startsWith("https://") || clean.includes("drive.google") || clean.includes("onedrive")) {
    return "LINK";
  }
  return "KHAC";
}

/**
 * Format bytes to readable string (KB, MB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validation logic for deliverable submission
 */
export function validateDeliverableSubmission(
  deliverableName: string,
  url?: string
): { isValid: boolean; error?: string } {
  const trimmedName = (deliverableName || "").trim();
  const trimmedUrl = (url || "").trim();

  if (!trimmedName) {
    return {
      isValid: false,
      error: "Vui lòng nhập tên minh chứng hoặc tải lên tệp đính kèm.",
    };
  }

  if (trimmedUrl) {
    try {
      const parsed = new URL(trimmedUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return {
          isValid: false,
          error: "Đường dẫn liên kết phải sử dụng giao thức http:// hoặc https://",
        };
      }
    } catch {
      return {
        isValid: false,
        error: "Đường dẫn liên kết không đúng định dạng URL hợp lệ",
      };
    }
  }

  return { isValid: true };
}

/**
 * Flexible check supporting either name or URL presence
 */
export function isValidSubmission(name: string, url: string = ""): boolean {
  return name.trim().length > 0 || url.trim().length > 0;
}

// ============================================================================
// 2. Component Props Interface
// ============================================================================

export interface SubmitDeliverableModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId?: string;
  taskTitle?: string;
  task?: StaffTask | null;
  onSubmit: (payload: DeliverableSubmissionPayload) => Promise<void> | void;
  isSubmitting?: boolean;
}

// ============================================================================
// 3. Main Modal Component
// ============================================================================

export function SubmitDeliverableModal({
  isOpen,
  onClose,
  taskId,
  taskTitle,
  task,
  onSubmit,
  isSubmitting = false,
}: SubmitDeliverableModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const effectiveTaskId = taskId || task?.id || "";
  const effectiveTaskTitle = taskTitle || task?.title || "Nhiệm vụ chuyên môn";

  // Form states
  const [deliverableName, setDeliverableName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [fileType, setFileType] = React.useState<string>("PDF");
  const [note, setNote] = React.useState("");
  const [selectedFile, setSelectedFile] = React.useState<{ name: string; size: number } | null>(null);

  // UI status states
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [hasDraftRestored, setHasDraftRestored] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [localSubmitting, setLocalSubmitting] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Restore draft from sessionStorage when modal opens with a valid taskId
  React.useEffect(() => {
    if (!isOpen || !effectiveTaskId) return;

    if (typeof window !== "undefined") {
      try {
        const draftKey = getDeliverableDraftKey(effectiveTaskId);
        const cached = window.sessionStorage.getItem(draftKey);
        if (cached) {
          const parsed = JSON.parse(cached) as DeliverableDraft;
          setDeliverableName(parsed.deliverableName || "");
          setUrl(parsed.url || "");
          setFileType(parsed.fileType || "PDF");
          setNote(parsed.note || "");
          setHasDraftRestored(true);
          return;
        }
      } catch {
        // Ignore JSON parsing errors
      }
    }

    // Default clean state
    setDeliverableName("");
    setUrl("");
    setFileType("PDF");
    setNote("");
    setSelectedFile(null);
    setErrorMessage(null);
    setHasDraftRestored(false);
  }, [isOpen, effectiveTaskId]);

  // Focus the input when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting && !localSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isSubmitting, localSubmitting]);

  // Auto-save draft to sessionStorage on field changes
  const saveDraft = React.useCallback(
    (nameVal: string, urlVal: string, typeVal: string, noteVal: string) => {
      if (typeof window === "undefined" || !effectiveTaskId) return;
      if (!nameVal && !urlVal && !noteVal) return;

      try {
        const draft: DeliverableDraft = {
          deliverableName: nameVal,
          url: urlVal,
          fileType: typeVal,
          note: noteVal,
          updatedAt: new Date().toISOString(),
        };
        window.sessionStorage.setItem(
          getDeliverableDraftKey(effectiveTaskId),
          JSON.stringify(draft)
        );
      } catch {
        // Storage full or quota exceeded
      }
    },
    [effectiveTaskId]
  );

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDeliverableName(val);
    if (errorMessage) setErrorMessage(null);
    saveDraft(val, url, fileType, note);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrl(val);
    if (errorMessage) setErrorMessage(null);

    // If file type is currently PDF but URL entered and no file selected, suggest LINK
    if (val && !selectedFile && fileType === "PDF") {
      setFileType("LINK");
    }
    saveDraft(deliverableName, val, fileType, note);
  };

  const handleFileTypeChange = (typeVal: string) => {
    setFileType(typeVal);
    saveDraft(deliverableName, url, typeVal, note);
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNote(val);
    saveDraft(deliverableName, url, fileType, val);
  };

  const handleClearDraft = () => {
    if (typeof window !== "undefined" && effectiveTaskId) {
      window.sessionStorage.removeItem(getDeliverableDraftKey(effectiveTaskId));
    }
    setDeliverableName("");
    setUrl("");
    setFileType("PDF");
    setNote("");
    setSelectedFile(null);
    setErrorMessage(null);
    setHasDraftRestored(false);
  };

  // Drag & drop file processing
  const processUploadedFile = (file: File) => {
    setSelectedFile({
      name: file.name,
      size: file.size,
    });

    // Auto fill deliverableName if empty or if previously named from another file
    if (!deliverableName.trim() || selectedFile) {
      setDeliverableName(file.name);
    }

    // Auto infer file type
    const inferred = inferFileType(file.name);
    setFileType(inferred);

    if (errorMessage) setErrorMessage(null);
    saveDraft(file.name, url, inferred, note);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processUploadedFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processUploadedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateDeliverableSubmission(deliverableName, url);
    if (!validation.isValid) {
      setErrorMessage(validation.error || "Vui lòng nhập tên minh chứng.");
      nameInputRef.current?.focus();
      return;
    }

    setErrorMessage(null);
    setLocalSubmitting(true);

    try {
      const payload: DeliverableSubmissionPayload = {
        taskId: effectiveTaskId,
        deliverableName: deliverableName.trim(),
        url: url.trim() || undefined,
        fileType: fileType || undefined,
        note: note.trim() || undefined,
      };

      await onSubmit(payload);

      // Clean up draft upon successful submission
      if (typeof window !== "undefined" && effectiveTaskId) {
        window.sessionStorage.removeItem(getDeliverableDraftKey(effectiveTaskId));
      }

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã xảy ra lỗi khi nộp minh chứng. Vui lòng thử lại.";
      setErrorMessage(msg);
    } finally {
      setLocalSubmitting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const submittingNow = isSubmitting || localSubmitting;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-deliverable-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={submittingNow ? undefined : onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-xl rounded-t-2xl sm:rounded-2xl bg-card border border-border/80 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden my-0 sm:my-auto animate-in zoom-in-95 duration-200">
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 sm:px-6 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <UploadCloud className="size-5" strokeWidth={1.5} />
            </div>
            <div>
              <h2
                id="submit-deliverable-modal-title"
                className="text-base sm:text-lg font-semibold text-foreground tracking-tight"
              >
                Nộp Minh Chứng Hoàn Thành
              </h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 line-clamp-1 max-w-sm sm:max-w-md">
                <span>Nhiệm vụ:</span>
                <span className="font-semibold text-foreground truncate">
                  {effectiveTaskTitle}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submittingNow}
            aria-label="Đóng cửa sổ"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="p-5 sm:p-6 space-y-4">
            {/* Restored Draft Alert */}
            {hasDraftRestored && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3.5 py-2.5 text-xs text-blue-700 flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-blue-600 shrink-0" strokeWidth={1.5} />
                  <span>Đã khôi phục nội dung bản nháp lưu tạm trước đó.</span>
                </div>
                <button
                  type="button"
                  onClick={handleClearDraft}
                  className="font-medium underline hover:text-blue-900 cursor-pointer shrink-0"
                >
                  Xóa nháp
                </button>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive flex items-center gap-2 animate-in fade-in"
              >
                <AlertCircle className="size-4 shrink-0" strokeWidth={1.5} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Drag & Drop Upload Zone */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Tải lên tệp minh chứng</span>
                <span className="text-xs font-normal text-muted-foreground">Tùy chọn đính kèm</span>
              </label>

              <div
                role="button"
                tabIndex={0}
                aria-label="Khu vực tải lên tệp minh chứng. Bấm hoặc kéo thả tệp vào đây"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={cn(
                  "relative flex flex-col items-center justify-center p-4 sm:p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  isDragging
                    ? "border-primary bg-primary/5 scale-[0.99]"
                    : "border-border/70 hover:border-primary/50 hover:bg-muted/30 bg-muted/10"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileInputChange}
                  className="hidden"
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.zip,.rar,.7z"
                />

                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <UploadCloud className="size-5" strokeWidth={1.5} />
                </div>
                <p className="text-xs font-medium text-foreground">
                  Kéo thả tệp minh chứng vào đây hoặc <span className="text-primary underline">bấm để chọn</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Hỗ trợ định dạng PDF, DOCX, XLSX, ZIP (tối đa 50MB)
                </p>
              </div>

              {/* Selected File Chip */}
              {selectedFile && (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border/80 bg-muted/30 text-xs mt-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
                    <span className="font-medium text-foreground truncate">{selectedFile.name}</span>
                    <span className="text-muted-foreground text-xs shrink-0 font-mono">
                      ({formatFileSize(selectedFile.size)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile();
                    }}
                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    title="Bỏ chọn tệp"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              )}
            </div>

            {/* Field 1: Deliverable Name (Required) */}
            <div className="space-y-1.5">
              <label
                htmlFor="deliverable-name-input"
                className="text-xs font-semibold text-foreground flex items-center gap-1.5"
              >
                <FileText className="size-3.5 text-primary" strokeWidth={1.5} />
                <span>Tên minh chứng / Sản phẩm bàn giao <span className="text-destructive">*</span></span>
              </label>
              <input
                ref={nameInputRef}
                id="deliverable-name-input"
                type="text"
                value={deliverableName}
                onChange={handleNameChange}
                placeholder="Ví dụ: Báo cáo tổng kết đề tài khoa học K48.pdf"
                className={cn(
                  "w-full rounded-xl border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-ring focus:ring-1 focus:ring-ring",
                  errorMessage && !deliverableName.trim()
                    ? "border-destructive focus:border-destructive focus:ring-destructive/30"
                    : "border-border/70"
                )}
              />
              {errorMessage && !deliverableName.trim() && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3" strokeWidth={1.5} />
                  <span>Vui lòng nhập tên minh chứng hoặc tải lên tệp đính kèm.</span>
                </p>
              )}
            </div>

            {/* Field 2 & 3: File Type Dropdown & Online URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* File Type */}
              <div className="space-y-1.5">
                <label
                  htmlFor="file-type-select"
                  className="text-xs font-semibold text-foreground"
                >
                  Loại định dạng
                </label>
                <select
                  id="file-type-select"
                  value={fileType}
                  onChange={(e) => handleFileTypeChange(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring cursor-pointer"
                >
                  {SUPPORTED_FILE_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Online URL */}
              <div className="space-y-1.5">
                <label
                  htmlFor="url-input"
                  className="text-xs font-semibold text-foreground flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <LinkIcon className="size-3 text-muted-foreground" strokeWidth={1.5} />
                    <span>Đường dẫn minh chứng</span>
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">Tùy chọn</span>
                </label>
                <input
                  id="url-input"
                  type="text"
                  value={url}
                  onChange={handleUrlChange}
                  placeholder="https://drive.google.com/..."
                  className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring font-mono"
                />
              </div>
            </div>

            {/* Field 4: Note / Message */}
            <div className="space-y-1.5">
              <label
                htmlFor="deliverable-note"
                className="text-xs font-semibold text-foreground flex items-center justify-between"
              >
                <span>Nội dung giải trình / Ghi chú gửi cấp phê duyệt</span>
                <span className="text-xs font-normal text-muted-foreground">Tùy chọn</span>
              </label>
              <textarea
                id="deliverable-note"
                rows={3}
                value={note}
                onChange={handleNoteChange}
                placeholder="Tóm tắt nội dung hoàn thành, giải trình các điểm nổi bật hoặc lưu ý khi thẩm định..."
                className="w-full rounded-xl border border-border/70 bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 border-t border-border/60 px-5 py-3.5 sm:px-6 bg-muted/20 mt-auto pb-safe">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submittingNow}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-[38px] text-xs rounded-xl"
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submittingNow}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-[38px] text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {submittingNow ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
                  <span>Đang nộp minh chứng...</span>
                </>
              ) : (
                <>
                  <Send className="size-3.5" strokeWidth={1.5} />
                  <span>Gửi hồ sơ thẩm định</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default SubmitDeliverableModal;
