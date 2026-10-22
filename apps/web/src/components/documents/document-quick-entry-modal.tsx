"use client";

import * as React from "react";
import { StandardDialog } from "@/components/ui/dialog";
import { useModalDirtyGuard } from "@/hooks/use-modal-dirty-guard";
import { Select } from "@/components/ui/select";
import { ChevronRight, AlertCircle, CheckCircle2, Paperclip, X } from "lucide-react";
import { Collapsible } from "@base-ui/react/collapsible";
import { attachFileToDocument } from "./workspace/document-edit";
import type {
  DocumentUrgency,
  DocumentSecurityLevel,
  DocumentItem,
} from "@qcet/contracts/types/document";
import { useDepartmentList } from "@/hooks/use-department-list";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { formatIsoDate } from "@/lib/format";
import { Pressable } from "@/components/ui/pressable";

export interface DocumentQuickEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newDoc: DocumentItem) => void;
  departments?: Array<{ id: string; name: string; shortName?: string; code?: string }>;
}

const COMMON_CATEGORIES = [
  "Công văn",
  "Quyết định",
  "Thông báo",
  "Kế hoạch",
  "Tờ trình",
  "Báo cáo",
  "Hướng dẫn",
  "Giấy mời",
  "Quy chế",
];

const URGENCY_CHOICES: { value: DocumentUrgency; label: string }[] = [
  { value: "THUONG", label: "Thường" },
  { value: "KHAN", label: "Khẩn" },
  { value: "THUONG_KHAN", label: "Thượng khẩn" },
  { value: "HOA_TOC", label: "Hỏa tốc / Hẹn giờ" },
];

type QuickEntryFieldErrors = Partial<Record<"originalNumber" | "issuingAuthority" | "summary", string>>;

/**
 * Soạn tờ trình nội bộ (sổ Tờ trình). Văn bản đi soạn bằng `ComposeOutgoingDialog`; văn bản đến không tạo được
 * vì QCET chỉ gửi nhận trong trường, văn bản đến phát sinh khi đơn vị khác phát hành văn bản đi (ADR-015).
 */
export function DocumentQuickEntryModal({
  isOpen,
  onClose,
  onSuccess,
  departments: propDepartments = [],
}: DocumentQuickEntryModalProps) {
  const { departments: fetchedDepartments, isLoading: isDepartmentsLoading } = useDepartmentList({
    enabled: isOpen,
  });

  const departmentList =
    propDepartments && propDepartments.length > 0
      ? propDepartments
      : fetchedDepartments;

  const [originalNumber, setOriginalNumber] = React.useState<string>("");
  const [issuedDate, setIssuedDate] = React.useState<string>(() => {
    return formatIsoDate(new Date());
  });
  const [issuingAuthority, setIssuingAuthority] = React.useState<string>("");
  const [category, setCategory] = React.useState<string>("Công văn");
  const [summary, setSummary] = React.useState<string>("");
  const [urgency, setUrgency] = React.useState<DocumentUrgency>("THUONG");
  const securityLevel: DocumentSecurityLevel = "THUONG";
  const [dueDate, setDueDate] = React.useState<string>("");

  const [attachmentFile, setAttachmentFile] = React.useState<File | null>(null);
  // Văn bản đã vào sổ nhưng tệp chưa đính kèm được: modal giữ lại để báo, nút chính thành "Đóng"
  const [savedWithoutFile, setSavedWithoutFile] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const firstInputRef = React.useRef<HTMLInputElement>(null);
  // Bọc ô chọn Đơn vị đề xuất: Select không nhận ref, thiếu đơn vị thì đưa focus vào nút mở danh sách bên trong.
  const issuingAuthorityRef = React.useRef<HTMLDivElement>(null);
  const summaryRef = React.useRef<HTMLTextAreaElement>(null);
  const [fieldErrors, setFieldErrors] = React.useState<QuickEntryFieldErrors>({});
  const clearFieldError = (key: keyof QuickEntryFieldErrors) =>
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const isDirty = Boolean(
    originalNumber.trim() ||
    issuingAuthority.trim() ||
    summary.trim() ||
    dueDate ||
    attachmentFile ||
    category !== "Công văn" ||
    urgency !== "THUONG"
  );

  const { handleOpenChange } = useModalDirtyGuard({
    isDirty,
    onConfirmClose: onClose,
  });

  // Mở lại hộp: xóa thông báo của lần trước
  React.useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setFieldErrors({});
      setSavedWithoutFile(false);
      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleAddDaysToDueDate = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    setDueDate(target.toISOString().split("T")[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAttachmentFile(file);
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (savedWithoutFile) {
      onClose();
      return;
    }

    // Kiểm tra theo đúng thứ tự cũ; báo lỗi cạnh từng trường và đưa focus về trường đầu tiên còn thiếu
    const errors: QuickEntryFieldErrors = {};
    if (!originalNumber.trim()) errors.originalNumber = "Vui lòng nhập Số ký hiệu văn bản gốc.";
    if (!issuingAuthority.trim()) errors.issuingAuthority = "Vui lòng chọn Đơn vị đề xuất.";
    if (!summary.trim()) errors.summary = "Vui lòng nhập Trích yếu nội dung văn bản.";
    const firstError = errors.originalNumber ?? errors.issuingAuthority ?? errors.summary;
    if (firstError) {
      setFieldErrors(errors);
      setErrorMessage(firstError);
      if (errors.originalNumber) firstInputRef.current?.focus();
      else if (errors.issuingAuthority) issuingAuthorityRef.current?.querySelector<HTMLElement>("button")?.focus();
      else summaryRef.current?.focus();
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        type: "TO_TRINH_NOI_BO",
        originalNumber: originalNumber.trim(),
        issuedDate: new Date(issuedDate).toISOString(),
        issuingAuthority: issuingAuthority.trim(),
        category: category.trim(),
        summary: summary.trim(),
        urgency,
        securityLevel,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      };

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.detail || "Không thể lưu tờ trình vào hệ thống");
      }

      const data = await res.json();

      // Tệp đính kèm (nếu có) được lưu cùng văn bản vừa tạo
      if (attachmentFile && data.document?.id) {
        try {
          await attachFileToDocument(data.document.id, attachmentFile);
        } catch (err) {
          onSuccess?.(data.document);
          setSavedWithoutFile(true);
          setErrorMessage(
            `Văn bản đã được lưu nhưng chưa đính kèm được tệp: ${err instanceof Error ? err.message : "lỗi không xác định"}. Mở văn bản và dùng "Thêm tệp".`
          );
          return;
        }
      }
      setSuccessMessage("Đã lưu tờ trình.");

      setTimeout(() => {
        if (onSuccess && data.document) {
          onSuccess(data.document);
        }
        onClose();
      }, 600);
    } catch (err: any) {
      setErrorMessage(err.message || "Đã xảy ra lỗi khi tạo văn bản.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const LABEL_CLASS = "text-xs font-medium text-foreground";
  const OPTIONAL_HINT = <span className="ml-1.5 font-normal text-muted-foreground">(không bắt buộc)</span>;
  const dateTriggerClass = "h-11 w-full rounded-md px-2 font-sans sm:h-7";

  return (
    <StandardDialog
      compact
      open={isOpen}
      onOpenChange={handleOpenChange}
      title="Tạo tờ trình nội bộ"
      size="lg"
      className="max-h-[90vh] flex flex-col overflow-hidden sm:max-w-xl"
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 min-h-0 -mx-6 -mb-6 mt-2">
        <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Số, ký hiệu" error={fieldErrors.originalNumber}>
              <Input
                compact
                ref={firstInputRef}
                type="text"
                value={originalNumber}
                onChange={(e) => {
                  setOriginalNumber(e.target.value);
                  clearFieldError("originalNumber");
                }}
                placeholder="VD: 125/TCGDNN-VP"
                className="w-full"
                required
              />
            </FormField>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="qe-issued-date" className={LABEL_CLASS}>Ngày ban hành</label>
              <VietnameseDatePicker
                id="qe-issued-date"
                clearable={false}
                value={issuedDate}
                onChange={(val) => setIssuedDate(val)}
                required
                variant="input"
                triggerClassName={dateTriggerClass}
                className="w-full"
              />
            </div>
          </div>

          <div ref={issuingAuthorityRef} className="flex flex-col gap-1.5">
            <span className={LABEL_CLASS}>Đơn vị đề xuất</span>
            <Select
              compact
              positionerClassName="z-50"
              aria-label="Đơn vị đề xuất"
              placeholder={isDepartmentsLoading ? "Đang tải danh sách đơn vị…" : "Chọn đơn vị đề xuất"}
              // Giá trị là mã đơn vị (tên có thể trùng), gửi đi vẫn là tên đơn vị như trước
              options={departmentList.map((d) => ({ value: d.id, label: d.name }))}
              value={departmentList.find((d) => d.name === issuingAuthority)?.id ?? null}
              onValueChange={(val) => {
                const unit = departmentList.find((d) => d.id === val);
                if (unit) {
                  setIssuingAuthority(unit.name);
                  clearFieldError("issuingAuthority");
                }
              }}
              disabled={isDepartmentsLoading}
            />
            {fieldErrors.issuingAuthority ? <p role="alert" className="text-xs text-destructive">{fieldErrors.issuingAuthority}</p> : null}
          </div>

          <FormField label="Trích yếu nội dung" error={fieldErrors.summary}>
            <Textarea
              compact
              ref={summaryRef}
              rows={2}
              value={summary}
              onChange={(e) => {
                setSummary(e.target.value);
                clearFieldError("summary");
              }}
              placeholder="VD: Về việc hướng dẫn kiểm định chất lượng chương trình đào tạo nghề"
              required
            />
          </FormField>

          {/* Tệp đính kèm lưu cùng văn bản sau khi tạo */}
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,application/pdf" onChange={handleFileChange} className="sr-only" aria-label="Chọn tệp đính kèm" tabIndex={-1} />
            {attachmentFile ? (
              <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md bg-secondary pl-2 pr-1 text-xs text-foreground">
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 truncate" title={attachmentFile.name}>{attachmentFile.name}</span>
                <span className="shrink-0 text-muted-foreground">{Math.max(1, Math.round(attachmentFile.size / 1024))} KB</span>
                <Pressable
                  aria-label="Bỏ tệp đính kèm"
                  onClick={() => setAttachmentFile(null)}
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="size-3" />
                </Pressable>
              </span>
            ) : (
              <Button size="sm" variant="ghost" className="-ml-2" onClick={() => fileInputRef.current?.click()}>
                <Paperclip />
                Đính kèm tệp
              </Button>
            )}
            {!attachmentFile ? <span className="text-xs text-muted-foreground">PDF hoặc Word, tối đa 10MB</span> : null}
          </div>

          {/* Thông tin ít dùng: thu gọn mặc định để modal gọn, không phải cuộn */}
          <Collapsible.Root className="group/more">
            <Collapsible.Trigger className="-ml-2 flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronRight className="size-3.5 transition-transform group-data-[open]/more:rotate-90" aria-hidden />
              Thêm thông tin
            </Collapsible.Trigger>
            <Collapsible.Panel className="space-y-4 pt-3">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <span className={LABEL_CLASS}>Thể loại{OPTIONAL_HINT}</span>
                  <Select
                    compact
                    positionerClassName="z-50"
                    aria-label="Thể loại"
                    placeholder="Chọn thể loại"
                    options={COMMON_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
                    value={category || null}
                    onValueChange={(val) => {
                      if (val) setCategory(val);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className={LABEL_CLASS}>Mức khẩn{OPTIONAL_HINT}</span>
                  <Select
                    compact
                    positionerClassName="z-50"
                    aria-label="Mức khẩn"
                    options={URGENCY_CHOICES.map((opt) => ({ value: opt.value, label: opt.label }))}
                    value={urgency}
                    onValueChange={(val) => {
                      if (val) setUrgency(val as DocumentUrgency);
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>Hạn giải quyết{OPTIONAL_HINT}</span>
                <VietnameseDatePicker
                  value={dueDate}
                  onChange={(val) => setDueDate(val)}
                  variant="input"
                  triggerClassName={dateTriggerClass}
                  className="w-full"
                />
                <div className="flex gap-1">
                  {[3, 5, 7].map((days) => (
                    <Pressable
                      key={days}
                      onClick={() => handleAddDaysToDueDate(days)}
                      className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/80"
                    >
                      +{days} ngày
                    </Pressable>
                  ))}
                </div>
              </div>

            </Collapsible.Panel>
          </Collapsible.Root>

          {errorMessage && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div role="status" className="flex items-center gap-2 rounded-lg bg-secondary p-3 text-xs text-foreground">
              <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3">
          {!savedWithoutFile && (
            <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
              Hủy
            </Button>
          )}
          <Button type="submit" size="sm" disabled={isSubmitting} aria-busy={isSubmitting}>
            {savedWithoutFile ? "Đóng" : isSubmitting ? "Đang lưu…" : "Tạo tờ trình"}
          </Button>
        </div>
      </form>
    </StandardDialog>
  );
}
