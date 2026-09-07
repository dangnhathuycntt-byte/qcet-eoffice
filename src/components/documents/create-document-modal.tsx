"use client";

import * as React from "react";
import { X, Send, FileText, Building2, User, AlertCircle, Plus } from "lucide-react";
import { OfficialDocument, DocumentType, DocumentUrgency } from "@/types/document";
import { Button } from "@/components/ui/button";

interface CreateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newDoc: OfficialDocument) => void;
}

export function CreateDocumentModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateDocumentModalProps) {
  const [docType, setDocType] = React.useState<DocumentType>("submission");
  const [documentNumber, setDocumentNumber] = React.useState("");
  const [issuingAuthority, setIssuingAuthority] = React.useState("");
  const [leadDepartment, setLeadDepartment] = React.useState("Phòng Đào tạo");
  const [signatory, setSignatory] = React.useState("");
  const [urgency, setUrgency] = React.useState<DocumentUrgency>("normal");
  const [summary, setSummary] = React.useState("");
  const [fileName, setFileName] = React.useState("");

  // ESC handler
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim() || !documentNumber.trim()) {
      alert("Vui lòng điền đầy đủ Số / Ký hiệu và Trích yếu nội dung văn bản.");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const newDoc: OfficialDocument = {
      id: `DOC-${Date.now()}`,
      type: docType,
      documentNumber: documentNumber.trim(),
      issuedDate: today,
      receivedDate: docType === "inbox" ? today : undefined,
      issuingAuthority:
        issuingAuthority.trim() ||
        (docType === "outbox"
          ? "Trường CĐ Kỹ thuật Công nghệ Quy Nhơn"
          : "Đơn vị trực thuộc QCET"),
      summary: summary.trim(),
      urgency,
      status: docType === "submission" ? "pending_assignment" : "processing",
      leadDepartment,
      signatory: signatory.trim() || "Cán bộ lập phiếu",
      fileAttachment: fileName.trim()
        ? {
            name: fileName.trim(),
            size: "1.5 MB",
          }
        : undefined,
    };

    onSubmit(newDoc);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-doc-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-card border border-border/70 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/60 bg-muted/20">
          <div>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider block mb-0.5">
              Nghị định 30/2020/NĐ-CP
            </span>
            <h2
              id="create-doc-title"
              className="text-base sm:text-lg font-bold text-foreground tracking-tight"
            >
              Soạn Thảo & Đăng Ký Văn Bản Mới
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0 cursor-pointer"
          >
            <X className="size-4.5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Document Type Selector */}
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">
              Loại hình văn bản <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDocType("inbox")}
                className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-colors cursor-pointer ${
                  docType === "inbox"
                    ? "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold shadow-xs"
                    : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                }`}
              >
                Văn bản đến
              </button>
              <button
                type="button"
                onClick={() => setDocType("outbox")}
                className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-colors cursor-pointer ${
                  docType === "outbox"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold shadow-xs"
                    : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                }`}
              >
                Văn bản đi
              </button>
              <button
                type="button"
                onClick={() => setDocType("submission")}
                className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-colors cursor-pointer ${
                  docType === "submission"
                    ? "border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold shadow-xs"
                    : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                }`}
              >
                Tờ trình duyệt
              </button>
            </div>
          </div>

          {/* Document Number & Urgency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Số / Ký hiệu văn bản <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder={
                  docType === "submission"
                    ? "VD: 18/TTr-CNTT"
                    : docType === "outbox"
                    ? "VD: 156/CĐKTCN-ĐT"
                    : "VD: 258/UBND-VX"
                }
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-border/70 bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Mức độ khẩn
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as DocumentUrgency)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-border/70 bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30"
              >
                <option value="normal">Thường</option>
                <option value="urgent">Khẩn</option>
                <option value="top_urgent">Thượng khẩn</option>
                <option value="flash">Hỏa tốc</option>
              </select>
            </div>
          </div>

          {/* Issuing Authority & Signatory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                {docType === "inbox" ? "Cơ quan ban hành" : "Đơn vị đề xuất / Ban hành"}
              </label>
              <input
                type="text"
                placeholder={docType === "inbox" ? "VD: UBND Tỉnh Bình Định" : "VD: Khoa CNTT"}
                value={issuingAuthority}
                onChange={(e) => setIssuingAuthority(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-border/70 bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Người ký ban hành
              </label>
              <input
                type="text"
                placeholder="VD: TS. Nguyễn Văn Hiệu (PHT)"
                value={signatory}
                onChange={(e) => setSignatory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-border/70 bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Lead Department */}
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Đơn vị chủ trì tiếp nhận / xử lý
            </label>
            <select
              value={leadDepartment}
              onChange={(e) => setLeadDepartment(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-border/70 bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30"
            >
              <option value="Phòng Đào tạo">Phòng Đào tạo</option>
              <option value="Khoa CNTT">Khoa Công nghệ thông tin</option>
              <option value="Khoa Cơ khí">Khoa Cơ khí</option>
              <option value="Khoa Điện - Điện tử">Khoa Điện - Điện tử</option>
              <option value="Phòng TCKT">Phòng Tài chính - Kế toán</option>
              <option value="Phòng TCHC">Phòng Tổ chức - Hành chính</option>
              <option value="Ban Giám Hiệu">Ban Giám Hiệu</option>
            </select>
          </div>

          {/* Summary */}
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Trích yếu nội dung văn bản <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="VD: V/v ban hành quy định đánh giá sinh viên thực tập doanh nghiệp học kỳ 1 năm học 2026-2027..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-border/70 bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 leading-relaxed"
            />
          </div>

          {/* File attachment name */}
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Tên tệp đính kèm điện tử (tùy chọn)
            </label>
            <input
              type="text"
              placeholder="VD: 156_CDKTCN_DT_QuyDinhThucTap.pdf"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-border/70 bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs rounded-xl"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              className="gap-1.5 text-xs rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-3.5" strokeWidth={1.5} />
              <span>Lưu & Đăng ký văn bản</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
