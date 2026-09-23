"use client";

import * as React from "react";
import {
  X,
  FilePlus,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Building2,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  UploadCloud,
  File,
  Sparkles,
  Send,
  ShieldAlert
} from "lucide-react";
import type {
  DocumentType,
  DocumentUrgency,
  DocumentSecurityLevel,
  DocumentItem
} from "@/types/document";
import { useAuth } from "@/lib/auth-context";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";

export interface DocumentQuickEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newDoc: DocumentItem) => void;
  defaultType?: DocumentType;
  departments?: Array<{ id: string; name: string; shortName?: string }>;
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

export function DocumentQuickEntryModal({
  isOpen,
  onClose,
  onSuccess,
  defaultType = "VAN_BAN_DEN",
  departments = [],
}: DocumentQuickEntryModalProps) {
  const { user } = useAuth();
  const [docType, setDocType] = React.useState<DocumentType>(defaultType);
  const [originalNumber, setOriginalNumber] = React.useState<string>("");
  const [issuedDate, setIssuedDate] = React.useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [issuingAuthority, setIssuingAuthority] = React.useState<string>("");
  const [category, setCategory] = React.useState<string>("Công văn");
  const [summary, setSummary] = React.useState<string>("");
  const [urgency, setUrgency] = React.useState<DocumentUrgency>("THUONG");
  const [securityLevel, setSecurityLevel] = React.useState<DocumentSecurityLevel>("THUONG");
  // Phase 9: đơn vị chủ trì canonical là `OrganizationalUnit.id` — không hardcode
  // mã legacy ("DT"); mặc định lấy đơn vị đầu tiên trong danh sách đã tải.
  const [leadUnitId, setLeadUnitId] = React.useState<string>(departments[0]?.id || "");
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

  // Sync default type when opened
  React.useEffect(() => {
    if (isOpen) {
      setDocType(defaultType);
      setErrorMessage(null);
      setSuccessMessage(null);
      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, defaultType]);

  // Keyboard Escape listener
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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

    if (!originalNumber.trim()) {
      setErrorMessage("Vui lòng nhập Số ký hiệu văn bản gốc.");
      firstInputRef.current?.focus();
      return;
    }

    if (!issuingAuthority.trim()) {
      setErrorMessage("Vui lòng nhập Cơ quan ban hành.");
      return;
    }

    if (!summary.trim()) {
      setErrorMessage("Vui lòng nhập Trích yếu nội dung văn bản.");
      return;
    }

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
        leadUnitId: leadUnitId || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        registeredById: user?.id || "system",
      };

      if (docType === "VAN_BAN_DI") {
        payload.signerName = signerName.trim() || "Ban Giám hiệu";
        payload.signerTitle = signerTitle.trim() || "Hiệu trưởng";
        payload.recipientList = recipientList.trim() || "Các đơn vị toàn trường";
      }

      if (attachmentFile) {
        payload.attachments = [
          {
            fileName: attachmentFile.name,
            fileUrl: attachmentFile.url,
            fileSize: attachmentFile.size,
            mimeType: "application/pdf",
            isOriginal: true,
          },
        ];
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const errDesc = json.errors ? json.errors.join("; ") : json.error;
        throw new Error(errDesc || "Đăng ký văn bản thất bại.");
      }

      setSuccessMessage("Đã đăng ký văn bản thành công vào hệ thống.");

      if (onSuccess) {
        onSuccess(json.data || json.document);
      }

      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || "Đã xảy ra lỗi khi đăng ký văn bản.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-entry-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-xl border border-border bg-card shadow-2xl text-foreground overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <FilePlus className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <h2 id="quick-entry-modal-title" className="text-base font-semibold">
                Vào sổ văn bản cấp tốc (&lt;60s)
              </h2>
              <p className="text-xs text-muted-foreground">
                Chuẩn hóa quy trình đăng ký văn bản theo Nghị định 30/2020/NĐ-CP
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-muted-foreground"
            aria-label="Đóng biểu mẫu"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Document Type Toggle */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Loại sổ văn bản
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setDocType("VAN_BAN_DEN")}
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-colors ${
                  docType === "VAN_BAN_DEN"
                    ? "border-sky-500 bg-sky-50 text-sky-700"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <ArrowDownLeft className="h-4 w-4 shrink-0 text-sky-500" strokeWidth={1.5} />
                <span>Văn bản đến</span>
              </button>

              <button
                type="button"
                onClick={() => setDocType("VAN_BAN_DI")}
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-colors ${
                  docType === "VAN_BAN_DI"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-500" strokeWidth={1.5} />
                <span>Văn bản đi</span>
              </button>

              <button
                type="button"
                onClick={() => setDocType("TO_TRINH_NOI_BO")}
                className={`col-span-2 sm:col-span-1 flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-colors ${
                  docType === "TO_TRINH_NOI_BO"
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <FileText className="h-4 w-4 shrink-0 text-amber-500" strokeWidth={1.5} />
                <span>Tờ trình nội bộ</span>
              </button>
            </div>
          </div>

          {/* Core Row 1: Original Number & Issued Date */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Số ký hiệu văn bản gốc <span className="text-rose-500">*</span>
              </label>
              <input
                ref={firstInputRef}
                type="text"
                value={originalNumber}
                onChange={(e) => setOriginalNumber(e.target.value)}
                placeholder="VD: 125/TCGDNN-VP hoặc 89/CĐKTCN-ĐT"
                className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Ngày ban hành <span className="text-rose-500">*</span>
              </label>
              <VietnameseDatePicker
                value={issuedDate}
                onChange={(val) => setIssuedDate(val)}
                required
                variant="input"
                className="w-full"
              />
            </div>
          </div>

          {/* Issuing Authority with Quick Presets */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-muted-foreground">
                Cơ quan ban hành <span className="text-rose-500">*</span>
              </label>
              <span className="text-xs text-muted-foreground">Gợi ý nhanh</span>
            </div>
            <input
              type="text"
              value={issuingAuthority}
              onChange={(e) => setIssuingAuthority(e.target.value)}
              placeholder="Nhập hoặc chọn cơ quan ban hành..."
              list="common-authorities-list"
              className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              required
            />
            <datalist id="common-authorities-list">
              {COMMON_AUTHORITIES.map((auth) => (
                <option key={auth} value={auth} />
              ))}
            </datalist>

            {/* Quick chips for Issuing Authority */}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {COMMON_AUTHORITIES.slice(0, 4).map((auth) => (
                <button
                  key={auth}
                  type="button"
                  onClick={() => setIssuingAuthority(auth)}
                  className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  {auth}
                </button>
              ))}
            </div>
          </div>

          {/* Category & Urgency */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Thể loại văn bản <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {COMMON_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Mức độ khẩn
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as DocumentUrgency)}
                className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="THUONG">Thường</option>
                <option value="KHAN">Khẩn</option>
                <option value="THUONG_KHAN">Thượng khẩn</option>
                <option value="HOA_TOC">Hỏa tốc / Hẹn giờ</option>
              </select>
            </div>
          </div>

          {/* Summary Input */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground">
              Trích yếu nội dung <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="VD: Về việc hướng dẫn kiểm định chất lượng chương trình đào tạo nghề..."
              className="mt-1.5 w-full rounded-lg border border-border bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              required
            />
          </div>

          {/* Department & Due Date */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                {docType === "VAN_BAN_DI" ? "Đơn vị soạn thảo" : "Đơn vị xử lý / chủ trì"}
              </label>
              <select
                value={leadUnitId}
                onChange={(e) => setLeadUnitId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Hạn giải quyết (nếu có)
              </label>
              <VietnameseDatePicker
                value={dueDate}
                onChange={(val) => setDueDate(val)}
                variant="input"
                className="w-full"
              />
              {/* Quick Due Date buttons */}
              <div className="mt-1 flex gap-1">
                <button
                  type="button"
                  onClick={() => handleAddDaysToDueDate(3)}
                  className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  +3d
                </button>
                <button
                  type="button"
                  onClick={() => handleAddDaysToDueDate(5)}
                  className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  +5d
                </button>
                <button
                  type="button"
                  onClick={() => handleAddDaysToDueDate(7)}
                  className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  +7d
                </button>
              </div>
            </div>
          </div>

          {/* Outgoing specific fields */}
          {docType === "VAN_BAN_DI" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 border-t border-border pt-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Người ký ban hành
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="TS. Lê Doãn Cường"
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:border-ring focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Chức vụ người ký
                </label>
                <input
                  type="text"
                  value={signerTitle}
                  onChange={(e) => setSignerTitle(e.target.value)}
                  placeholder="Hiệu trưởng"
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:border-ring focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Nơi nhận
                </label>
                <input
                  type="text"
                  value={recipientList}
                  onChange={(e) => setRecipientList(e.target.value)}
                  placeholder="Tổng cục GDNN; UBND Tỉnh..."
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:border-ring focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Attachment Scan File Dropzone */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Tệp quét PDF đính kèm (Scan có dấu đỏ)
            </label>
            <div className="relative rounded-lg border-2 border-dashed border-border p-4 text-center hover:border-indigo-400 transition-colors">
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
                    Kéo thả tệp PDF hoặc bấm để chọn tệp quét
                  </span>
                  <span className="text-xs text-muted-foreground">Hỗ trợ PDF tối đa 25MB</span>
                </div>
              )}
            </div>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-3.5 bg-muted/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Clock className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                <span>Đang lưu văn bản...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" strokeWidth={1.5} />
                <span>Đăng ký vào sổ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
