"use client";

import * as React from "react";
import { StandardDialog } from "@/components/ui/dialog";
import { useModalDirtyGuard } from "@/hooks/use-modal-dirty-guard";
import { Select } from "@/components/ui/select";
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle2,
  UploadCloud,
  File,
  Send,
} from "lucide-react";
import type {
  DocumentType,
  DocumentUrgency,
  DocumentSecurityLevel,
  DocumentItem,
} from "@/types/document";
import { useAuth } from "@/lib/auth-context";
import { useDepartmentList } from "@/hooks/use-department-list";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { formatIsoDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DocumentQuickEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newDoc: DocumentItem) => void;
  defaultType?: DocumentType;
  departments?: Array<{ id: string; name: string; shortName?: string; code?: string }>;
}

const COMMON_AUTHORITIES = [
  "UBND Tỉnh Bình Định",
  "Bộ Lao động - Thương binh và Xã hội",
  "Tổng cục Giáo dục Nghề nghiệp",
  "Sở Lao động - Thương binh và Xã hội",
  "Sở Giáo dục và Đào tạo",
  "Trường CĐ Kỹ thuật Công nghệ Quy Nhơn",
];

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

export function DocumentQuickEntryModal({
  isOpen,
  onClose,
  onSuccess,
  defaultType = "VAN_BAN_DEN",
  departments: propDepartments = [],
}: DocumentQuickEntryModalProps) {
  const { user } = useAuth();
  const { departments: fetchedDepartments, isLoading: isDepartmentsLoading } = useDepartmentList({
    enabled: isOpen,
  });

  const departmentList =
    propDepartments && propDepartments.length > 0
      ? propDepartments
      : fetchedDepartments;

  const [docType, setDocType] = React.useState<DocumentType>(defaultType);
  const [originalNumber, setOriginalNumber] = React.useState<string>("");
  const [issuedDate, setIssuedDate] = React.useState<string>(() => {
    return formatIsoDate(new Date());
  });
  const [issuingAuthority, setIssuingAuthority] = React.useState<string>("");
  const [category, setCategory] = React.useState<string>("Công văn");
  const [summary, setSummary] = React.useState<string>("");
  const [urgency, setUrgency] = React.useState<DocumentUrgency>("THUONG");
  const [securityLevel, setSecurityLevel] = React.useState<DocumentSecurityLevel>("THUONG");
  const [leadUnitId, setLeadUnitId] = React.useState<string>(departmentList[0]?.id || "");
  const [dueDate, setDueDate] = React.useState<string>("");

  // Outgoing specific
  const [signerName, setSignerName] = React.useState<string>("");
  const [signerTitle, setSignerTitle] = React.useState<string>("Hiệu trưởng");
  const [recipientList, setRecipientList] = React.useState<string>("");

  // Attachment mock state
  const [attachmentFile, setAttachmentFile] = React.useState<{
    name: string;
    size: number;
    url: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const firstInputRef = React.useRef<HTMLInputElement>(null);
  const issuingAuthorityRef = React.useRef<HTMLInputElement>(null);
  const summaryRef = React.useRef<HTMLTextAreaElement>(null);
  const [fieldErrors, setFieldErrors] = React.useState<QuickEntryFieldErrors>({});
  const clearFieldError = (key: keyof QuickEntryFieldErrors) =>
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const isDirty = Boolean(
    originalNumber.trim() ||
    issuingAuthority.trim() ||
    summary.trim() ||
    dueDate ||
    signerName.trim() ||
    recipientList.trim() ||
    attachmentFile ||
    docType !== defaultType ||
    category !== "Công văn" ||
    urgency !== "THUONG"
  );

  const { handleOpenChange } = useModalDirtyGuard({
    isDirty,
    onConfirmClose: onClose,
  });

  // Auto-select initial department when list becomes available
  React.useEffect(() => {
    if (isOpen && departmentList.length > 0 && !leadUnitId) {
      setLeadUnitId(departmentList[0].id);
    }
  }, [isOpen, departmentList, leadUnitId]);

  // Sync default type when opened
  React.useEffect(() => {
    if (isOpen) {
      setDocType(defaultType);
      setErrorMessage(null);
      setSuccessMessage(null);
      setFieldErrors({});
      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, defaultType]);

  const handleAddDaysToDueDate = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    setDueDate(target.toISOString().split("T")[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setAttachmentFile({
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file),
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Kiểm tra theo đúng thứ tự cũ; báo lỗi cạnh từng trường và đưa focus về trường đầu tiên còn thiếu
    const errors: QuickEntryFieldErrors = {};
    if (!originalNumber.trim()) errors.originalNumber = "Vui lòng nhập Số ký hiệu văn bản gốc.";
    if (!issuingAuthority.trim()) errors.issuingAuthority = "Vui lòng nhập Cơ quan ban hành.";
    if (!summary.trim()) errors.summary = "Vui lòng nhập Trích yếu nội dung văn bản.";
    const firstError = errors.originalNumber ?? errors.issuingAuthority ?? errors.summary;
    if (firstError) {
      setFieldErrors(errors);
      setErrorMessage(firstError);
      if (errors.originalNumber) firstInputRef.current?.focus();
      else if (errors.issuingAuthority) issuingAuthorityRef.current?.focus();
      else summaryRef.current?.focus();
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: any = {
        type: docType,
        originalNumber: originalNumber.trim(),
        issuedDate: new Date(issuedDate).toISOString(),
        issuingAuthority: issuingAuthority.trim(),
        category: category.trim(),
        summary: summary.trim(),
        urgency,
        securityLevel,
        leadUnitId: docType === "VAN_BAN_DEN" ? leadUnitId || undefined : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      };

      if (docType === "VAN_BAN_DI") {
        payload.signerName = signerName.trim() || undefined;
        payload.signerTitle = signerTitle.trim() || undefined;
        payload.recipientList = recipientList.trim() || undefined;
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Không thể lưu văn bản vào hệ thống");
      }

      const data = await res.json();
      setSuccessMessage("Đã vào sổ văn bản thành công!");

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

  const selectedUrgencyObj = URGENCY_CHOICES.find((u) => u.value === urgency);
  const selectedDeptObj = departmentList.find((d) => d.id === leadUnitId);

  return (
    <StandardDialog
      compact
      open={isOpen}
      onOpenChange={handleOpenChange}
      title="Vào sổ văn bản cấp tốc (<60s)"
      description="Chuẩn hóa quy trình đăng ký văn bản theo Nghị định 30/2020/NĐ-CP"
      size="lg"
      className="max-h-[90vh] flex flex-col overflow-hidden sm:max-w-2xl"
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 min-h-0 -mx-6 -mb-6 mt-2">
        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
          {/* Document Type Toggle */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Loại sổ văn bản
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Button
                type="button"
                size="sm"
                variant={docType === "VAN_BAN_DEN" ? "secondary" : "ghost"}
                aria-pressed={docType === "VAN_BAN_DEN"}
                onClick={() => setDocType("VAN_BAN_DEN")}
                className={cn(docType === "VAN_BAN_DEN" ? "bg-selected text-foreground" : "text-muted-foreground")}
              >
                <ArrowDownLeft className="text-sky-600" strokeWidth={1.5} />
                <span>Văn bản đến</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={docType === "VAN_BAN_DI" ? "secondary" : "ghost"}
                aria-pressed={docType === "VAN_BAN_DI"}
                onClick={() => setDocType("VAN_BAN_DI")}
                className={cn(docType === "VAN_BAN_DI" ? "bg-selected text-foreground" : "text-muted-foreground")}
              >
                <ArrowUpRight className="text-emerald-600" strokeWidth={1.5} />
                <span>Văn bản đi</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={docType === "TO_TRINH_NOI_BO" ? "secondary" : "ghost"}
                aria-pressed={docType === "TO_TRINH_NOI_BO"}
                onClick={() => setDocType("TO_TRINH_NOI_BO")}
                className={cn('col-span-2 sm:col-span-1', docType === "TO_TRINH_NOI_BO" ? "bg-selected text-foreground" : "text-muted-foreground")}
              >
                <FileText className="text-amber-600" strokeWidth={1.5} />
                <span>Tờ trình nội bộ</span>
              </Button>
            </div>
          </div>

          {/* Core Row 1: Original Number & Issued Date */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FormField label="Số ký hiệu văn bản gốc" error={fieldErrors.originalNumber}>
                <Input
                  compact
                  ref={firstInputRef}
                  type="text"
                  value={originalNumber}
                  onChange={(e) => {
                    setOriginalNumber(e.target.value);
                    clearFieldError("originalNumber");
                  }}
                  placeholder="VD: 125/TCGDNN-VP hoặc 89/CĐKTCN-ĐT"
                  className="mt-1.5 w-full"
                  required
                />
              </FormField>
            </div>

            <div>
              <label htmlFor="qe-issued-date" className="block text-xs font-medium text-muted-foreground mb-1.5">
                Ngày ban hành <span className="text-rose-500">*</span>
              </label>
              <VietnameseDatePicker
                id="qe-issued-date"
                clearable={false}
                value={issuedDate}
                onChange={(val) => setIssuedDate(val)}
                required
                variant="input"
                triggerClassName="h-11 sm:h-7 rounded-md px-2"
                className="w-full"
              />
            </div>
          </div>

          {/* Issuing Authority with Quick Presets */}
          <div>
            <FormField label="Cơ quan ban hành" error={fieldErrors.issuingAuthority} className="gap-1.5">
              <Input
                compact
                ref={issuingAuthorityRef}
                type="text"
                value={issuingAuthority}
                onChange={(e) => {
                  setIssuingAuthority(e.target.value);
                  clearFieldError("issuingAuthority");
                }}
                placeholder="Nhập hoặc chọn cơ quan ban hành..."
                list="common-authorities-list"
                required
              />
            </FormField>
            <span className="-mt-1 mb-1.5 block text-right text-xs text-muted-foreground">Gợi ý nhanh</span>
            <datalist id="common-authorities-list">
              {COMMON_AUTHORITIES.map((auth) => (
                <option key={auth} value={auth} />
              ))}
            </datalist>

            {/* Quick chips */}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {COMMON_AUTHORITIES.slice(0, 3).map((auth) => (
                <button
                  key={auth}
                  type="button"
                  onClick={() => setIssuingAuthority(auth)}
                  className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  {auth}
                </button>
              ))}
            </div>
          </div>

          {/* Category & Urgency */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Loại văn bản (Thể loại)
              </label>
              <Select
                compact
                positionerClassName="z-50"
                aria-label="Loại văn bản"
                placeholder="Chọn thể loại"
                options={COMMON_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
                value={category || null}
                onValueChange={(val) => {
                  if (val) setCategory(val);
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Mức độ khẩn
              </label>
              <Select
                compact
                positionerClassName="z-50"
                aria-label="Mức độ khẩn"
                options={URGENCY_CHOICES.map((opt) => ({ value: opt.value, label: opt.label }))}
                value={urgency}
                onValueChange={(val) => {
                  if (val) setUrgency(val as DocumentUrgency);
                }}
              />
            </div>
          </div>

          {/* Summary Input */}
          <div>
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
                placeholder="VD: Về việc hướng dẫn kiểm định chất lượng chương trình đào tạo nghề..."
                className="mt-1.5"
                required
              />
            </FormField>
          </div>

          {/* Department & Due Date */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {docType === "VAN_BAN_DI" ? "Đơn vị soạn thảo" : "Đơn vị xử lý / chủ trì"}
              </label>
              <Select
                compact
                positionerClassName="z-50"
                aria-label="Đơn vị xử lý / chủ trì"
                placeholder={isDepartmentsLoading ? "Đang tải danh sách đơn vị..." : "— Chọn đơn vị —"}
                options={[{ value: "", label: "— Chọn đơn vị —" }, ...departmentList.map((dept) => ({ value: dept.id, label: dept.name }))]}
                value={leadUnitId}
                onValueChange={(val) => setLeadUnitId(val || "")}
                disabled={isDepartmentsLoading}
              />
              {isDepartmentsLoading && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 animate-pulse">
                  <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-ping" />
                  <span>Đang tải danh sách đơn vị từ hệ thống...</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Hạn giải quyết (nếu có)
              </label>
              <VietnameseDatePicker
                value={dueDate}
                onChange={(val) => setDueDate(val)}
                variant="input"
                triggerClassName="h-11 sm:h-7 rounded-md px-2"
                className="w-full"
              />
              {/* Quick Due Date buttons */}
              <div className="mt-1 flex gap-1">
                <button
                  type="button"
                  onClick={() => handleAddDaysToDueDate(3)}
                  className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/80 cursor-pointer"
                >
                  +3d
                </button>
                <button
                  type="button"
                  onClick={() => handleAddDaysToDueDate(5)}
                  className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/80 cursor-pointer"
                >
                  +5d
                </button>
                <button
                  type="button"
                  onClick={() => handleAddDaysToDueDate(7)}
                  className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/80 cursor-pointer"
                >
                  +7d
                </button>
              </div>
            </div>
          </div>

          {/* Outgoing specific fields */}
          {docType === "VAN_BAN_DI" && (
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Người ký
                </label>
                <Input compact
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="TS. Lê Doãn Cường"
                  className="mt-1 w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Chức vụ người ký
                </label>
                <Input compact
                  type="text"
                  value={signerTitle}
                  onChange={(e) => setSignerTitle(e.target.value)}
                  placeholder="Hiệu trưởng"
                  className="mt-1 w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Nơi nhận
                </label>
                <Input compact
                  type="text"
                  value={recipientList}
                  onChange={(e) => setRecipientList(e.target.value)}
                  placeholder="Tổng cục GDNN; UBND Tỉnh..."
                  className="mt-1 w-full"
                />
              </div>
            </div>
          )}

          {/* Attachment Scan File Dropzone */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Tệp quét PDF đính kèm (Scan có dấu đỏ)
            </label>
            <div className="relative rounded-lg border-2 border-dashed border-border p-4 text-center hover:border-primary/60 transition-colors">
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Tải lên tệp PDF"
              />
              {attachmentFile ? (
                <div className="flex items-center justify-center gap-2 text-xs text-emerald-600">
                  <File className="h-5 w-5" strokeWidth={1.5} />
                  <span className="font-medium">{attachmentFile.name}</span>
                  <span className="text-muted-foreground">
                    ({(attachmentFile.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
                  <UploadCloud className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-xs font-medium">
                    Bấm để chọn tệp PDF quét
                  </span>
                  <span className="text-xs text-muted-foreground">Chỉ nhận tệp PDF</span>
                </div>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Tệp đã chọn chỉ dùng để xem trước, chưa được lưu cùng văn bản.</p>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div role="alert" className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div role="status" className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3 bg-muted/20">
          <Button type="button" variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
            Hủy
          </Button>

          <Button type="submit" size="sm" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? (
              <>
                <Clock strokeWidth={1.5} />
                <span>Đang lưu văn bản...</span>
              </>
            ) : (
              <>
                <Send strokeWidth={1.5} />
                <span>Đăng ký vào sổ</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </StandardDialog>
  );
}
