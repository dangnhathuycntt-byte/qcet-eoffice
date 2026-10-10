"use client";

import * as React from "react";
import { StandardDialog } from "@/components/ui/dialog";
import { useModalDirtyGuard } from "@/hooks/use-modal-dirty-guard";
import { Select } from "@/components/ui/select";
import { Send, FileText, Building2, User, AlertCircle, Plus } from "lucide-react";
import { OfficialDocument, DocumentType, DocumentUrgency } from "@/types/document";
import { Button } from "@/components/ui/button";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { usePersonnelList } from "@/hooks/use-personnel-list";
import { useDepartmentList } from "@/hooks/use-department-list";
import { formatIsoDate } from "@/lib/format";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  DUPLICATE_SUSPECT_CODE,
  describeDuplicates,
  fetchDuplicateMatches,
} from "@/lib/documents/duplicate-check-client";

interface CreateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newDoc: OfficialDocument) => void;
}

const URGENCY_OPTIONS: { value: DocumentUrgency; label: string }[] = [
  { value: "normal", label: "Thường" },
  { value: "urgent", label: "Khẩn" },
  { value: "top_urgent", label: "Thượng khẩn" },
  { value: "flash", label: "Hỏa tốc" },
];

// Map API response về OfficialDocument (dùng cho cả VAN_BAN_DEN / TO_TRINH_NOI_BO / VAN_BAN_DI)
function mapApiResponseToOfficial(
  data: any,
  docType: DocumentType,
  urgency: DocumentUrgency,
  assignedDepartmentName?: string
): OfficialDocument {
  const today = formatIsoDate(new Date());
  const id =
    data?.id ||
    data?.document?.id ||
    `DOC-${Date.now()}`;
  const summary = data?.summary || data?.document?.summary || "";
  const originalNumber =
    data?.originalNumber ||
    data?.document?.originalNumber ||
    data?.id ||
    `DRAFT-${Date.now()}`;
  const issuedDate =
    (data?.issuedDate || data?.document?.issuedDate || "")?.split("T")[0] || today;
  const issuingAuthority =
    data?.issuingAuthority ||
    data?.document?.issuingAuthority ||
    (docType === "outbox"
      ? "Trường CĐ Kỹ thuật Công nghệ Quy Nhơn"
      : "Đơn vị trực thuộc QCET");

  const leadDepartment =
    data?.leadUnitName ||
    data?.document?.leadUnitName ||
    data?.leadDepartment ||
    data?.document?.leadDepartment ||
    assignedDepartmentName ||
    "Chưa phân công";

  return {
    id,
    type: docType,
    documentNumber: originalNumber,
    issuedDate,
    receivedDate: docType === "inbox" ? today : undefined,
    issuingAuthority,
    summary,
    urgency,
    status: docType === "submission" ? "pending_assignment" : "processing",
    leadDepartment,
    signatory: "Lãnh đạo đơn vị",
  };
}

export function CreateDocumentModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateDocumentModalProps) {
  const [docType, setDocType] = React.useState<DocumentType>("submission");
  const [documentNumber, setDocumentNumber] = React.useState("");
  const [issuingAuthority, setIssuingAuthority] = React.useState("");
  const [urgency, setUrgency] = React.useState<DocumentUrgency>("normal");
  const [leadUnitId, setLeadUnitId] = React.useState<string>("");
  const [summary, setSummary] = React.useState("");
  const [issuedDate, setIssuedDate] = React.useState(() =>
    formatIsoDate(new Date())
  );

  // Fields dành riêng cho văn bản đi
  const [authorizedSignerId, setAuthorizedSignerId] = React.useState("");
  const [recipientList, setRecipientList] = React.useState("");

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  // Cảnh báo trùng số ký hiệu: gắn với cặp số/cơ quan đã kiểm; sửa một trong hai thì cảnh báo ẩn.
  const [duplicate, setDuplicate] = React.useState<{ key: string; message: string } | null>(null);
  const duplicateKey = `${documentNumber.trim()}|${issuingAuthority.trim()}`;
  const duplicateAcknowledged = docType === "inbox" && duplicate?.key === duplicateKey;
  const [fieldErrors, setFieldErrors] = React.useState<{ documentNumber?: string; summary?: string }>({});
  const documentNumberRef = React.useRef<HTMLInputElement>(null);
  const summaryRef = React.useRef<HTMLTextAreaElement>(null);

  // Dynamic department list
  const { departments, isLoading: departmentsLoading } = useDepartmentList({
    enabled: isOpen,
  });

  // Chỉ tải personnel list khi chọn văn bản đi
  const { personnel, isLoading: personnelLoading } = usePersonnelList({
    enabled: docType === "outbox",
  });

  const isDirty = Boolean(
    documentNumber.trim() ||
    issuingAuthority.trim() ||
    summary.trim() ||
    authorizedSignerId ||
    recipientList.trim() ||
    leadUnitId ||
    urgency !== "normal" ||
    docType !== "submission"
  );

  const { handleOpenChange } = useModalDirtyGuard({
    isDirty,
    onConfirmClose: onClose,
  });

  // Reset error when opened
  React.useEffect(() => {
    if (isOpen) {
      setSubmitError(null);
      setFieldErrors({});
      setDuplicate(null);
      const timer = setTimeout(() => (documentNumberRef.current ?? summaryRef.current)?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const apiUrgency =
    urgency === "flash"
      ? "HOA_TOC"
      : urgency === "top_urgent"
      ? "THUONG_KHAN"
      : urgency === "urgent"
      ? "KHAN"
      : "THUONG";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError(null);

    // Giữ các trường bắt buộc; báo lỗi cạnh trường và đưa focus theo thứ tự hiển thị của form
    const errors: { documentNumber?: string; summary?: string } = {};
    if (!summary.trim()) errors.summary = "Vui lòng điền Trích yếu nội dung văn bản.";
    if (docType !== "outbox" && !documentNumber.trim()) errors.documentNumber = "Vui lòng điền Số / Ký hiệu văn bản.";
    const firstError = errors.documentNumber ?? errors.summary;
    if (firstError) {
      setFieldErrors(errors);
      setSubmitError(firstError);
      if (errors.documentNumber) documentNumberRef.current?.focus();
      else summaryRef.current?.focus();
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    try {
      if (docType === "outbox") {
        // Văn bản đi: gọi POST /api/documents với type VAN_BAN_DI
        const body: Record<string, unknown> = {
          type: "VAN_BAN_DI",
          summary: summary.trim(),
          title: summary.trim(),
          urgency: apiUrgency,
          recipientList: recipientList.trim() || undefined,
          authorizedSignerId: authorizedSignerId || undefined,
        };

        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error || "Không thể tạo văn bản đi. Vui lòng thử lại.");
        }

        const created = json?.data || json?.document || json;
        onSubmit(mapApiResponseToOfficial(created, "outbox", urgency));
      } else {
        // Văn bản đến / Tờ trình nội bộ
        const apiType =
          docType === "inbox" ? "VAN_BAN_DEN" : "TO_TRINH_NOI_BO";

        const body: Record<string, unknown> = {
          type: apiType,
          originalNumber: documentNumber.trim(),
          issuedDate: issuedDate || new Date().toISOString().split("T")[0],
          issuingAuthority: issuingAuthority.trim() || (docType === "submission" ? "Đơn vị trực thuộc QCET" : "Cơ quan ban hành"),
          category: "Công văn",
          summary: summary.trim(),
          urgency: apiUrgency,
          leadUnitId: docType === "inbox" && leadUnitId ? leadUnitId : undefined,
          acknowledgeDuplicate: duplicateAcknowledged || undefined,
        };

        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          if (json?.code === DUPLICATE_SUSPECT_CODE) {
            const matches = await fetchDuplicateMatches(String(body.originalNumber), String(body.issuingAuthority));
            setDuplicate({ key: duplicateKey, message: describeDuplicates(matches) });
            return;
          }
          throw new Error(json?.error || "Không thể đăng ký văn bản. Vui lòng thử lại.");
        }

        const created = json?.data || json?.document || json;
        const selectedDept = departments.find((d) => d.id === leadUnitId);
        onSubmit(mapApiResponseToOfficial(created, docType, urgency, selectedDept?.name));
      }

      onClose();
    } catch (err: any) {
      setSubmitError(err.message || "Đã xảy ra lỗi không xác định.");
    } finally {
      setIsSubmitting(false);
    }
  };


  const selectedSigner = personnel.find((p) => p.id === authorizedSignerId);

  return (
    <StandardDialog
      compact
      open={isOpen}
      onOpenChange={handleOpenChange}
      title={
        docType === "outbox"
          ? "Tạo dự thảo văn bản đi"
          : docType === "inbox"
          ? "Đăng ký văn bản đến"
          : "Tạo tờ trình nội bộ"
      }
      description="Theo quy chuẩn Nghị định 30/2020/NĐ-CP"
      size="lg"
      className="max-h-[90vh] flex flex-col overflow-hidden sm:max-w-xl"
    >
      <div className="flex flex-col flex-1 min-h-0 -mx-6 -mb-6 mt-2">
        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
          {/* Type Selector Tabs */}
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">
              Phân loại luồng văn bản
            </label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                size="sm"
                variant={docType === "inbox" ? "secondary" : "ghost"}
                aria-pressed={docType === "inbox"}
                onClick={() => setDocType("inbox")}
                className={docType === "inbox" ? "bg-selected text-foreground" : "text-muted-foreground"}
              >
                Văn bản đến
              </Button>
              <Button
                type="button"
                size="sm"
                variant={docType === "outbox" ? "secondary" : "ghost"}
                aria-pressed={docType === "outbox"}
                onClick={() => setDocType("outbox")}
                className={docType === "outbox" ? "bg-selected text-foreground" : "text-muted-foreground"}
              >
                Văn bản đi
              </Button>
              <Button
                type="button"
                size="sm"
                variant={docType === "submission" ? "secondary" : "ghost"}
                aria-pressed={docType === "submission"}
                onClick={() => setDocType("submission")}
                className={docType === "submission" ? "bg-selected text-foreground" : "text-muted-foreground"}
              >
                Tờ trình nội bộ
              </Button>
            </div>
          </div>

          {/* Document Number + Urgency (ẩn với văn bản đi) */}
          {docType !== "outbox" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <FormField label="Số / Ký hiệu văn bản" error={fieldErrors.documentNumber}>
                  <Input
                    compact
                    ref={documentNumberRef}
                    type="text"
                    placeholder="VD: 156/CDKTCN-ĐT"
                    value={documentNumber}
                    onChange={(e) => {
                      setDocumentNumber(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, documentNumber: undefined }));
                    }}
                    required
                    className="w-full font-mono"
                  />
                </FormField>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Mức độ khẩn
                </label>
                <Select
                  compact
                  positionerClassName="z-50"
                  aria-label="Mức độ khẩn"
                  options={URGENCY_OPTIONS}
                  value={urgency}
                  onValueChange={(val) => {
                    if (val) setUrgency(val as DocumentUrgency);
                  }}
                />
              </div>
            </div>
          )}

          {/* Urgency riêng cho văn bản đi */}
          {docType === "outbox" && (
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Mức độ khẩn
              </label>
              <Select
                compact
                positionerClassName="z-50"
                aria-label="Mức độ khẩn"
                options={URGENCY_OPTIONS}
                value={urgency}
                onValueChange={(val) => {
                  if (val) setUrgency(val as DocumentUrgency);
                }}
              />
            </div>
          )}

          {/* Issuing Authority + Date (chỉ hiện cho văn bản đến / tờ trình) */}
          {docType !== "outbox" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    {docType === "inbox" ? "Cơ quan ban hành" : "Đơn vị đề xuất / Ban hành"}
                  </label>
                  {docType === "submission" ? (
                      <Select
                        compact
                        positionerClassName="z-50"
                        aria-label="Đơn vị đề xuất / Ban hành"
                        placeholder={departmentsLoading ? "Đang tải danh sách đơn vị..." : "— Chọn đơn vị đề xuất —"}
                        options={departments.map((d) => ({ value: d.name, label: d.name }))}
                        value={issuingAuthority || null}
                        onValueChange={(val) => {
                          if (val) setIssuingAuthority(val);
                        }}
                        disabled={departmentsLoading}
                      />
                  ) : (
                    <Input
                      compact
                      type="text"
                      placeholder="VD: UBND Tỉnh Bình Định"
                      value={issuingAuthority}
                      onChange={(e) => setIssuingAuthority(e.target.value)}
                      className="w-full"
                    />
                  )}
                </div>

                <div>
                  <label htmlFor="create-document-issued-date" className="text-xs font-medium text-foreground block mb-1">
                    Ngày ban hành
                  </label>
                  <VietnameseDatePicker
                    id="create-document-issued-date"
                    clearable={false}
                    variant="input"
                    value={issuedDate}
                    onChange={(value) => setIssuedDate(value || "")}
                    triggerClassName="h-11 sm:h-7 w-full rounded-md px-2"
                  />
                </div>
              </div>

              {/* Đơn vị chủ trì xử lý (cho văn bản đến) */}
              {docType === "inbox" && (
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Đơn vị chủ trì xử lý (tùy chọn)
                  </label>
                  <Select
                    compact
                    positionerClassName="z-50"
                    aria-label="Đơn vị chủ trì xử lý"
                    placeholder={departmentsLoading ? "Đang tải danh sách đơn vị..." : "— Chưa phân công đơn vị chủ trì —"}
                    options={[{ value: "", label: "— Chưa phân công —" }, ...departments.map((dept) => ({ value: dept.id, label: dept.name }))]}
                    value={leadUnitId}
                    onValueChange={(val) => setLeadUnitId(val ?? "")}
                    disabled={departmentsLoading}
                  />
                  {departmentsLoading && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 animate-pulse">
                      <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-ping" />
                      <span>Đang tải danh sách đơn vị từ hệ thống...</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Panel dành riêng cho văn bản đi */}
          {docType === "outbox" && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                Dự thảo được khởi tạo kèm quy trình ký duyệt
              </p>

              {/* Người ký thẩm quyền */}
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Người ký thẩm quyền (tùy chọn)
                </label>
                <Select
                  compact
                  positionerClassName="z-50"
                  aria-label="Người ký thẩm quyền"
                  placeholder="— Chọn người ký thẩm quyền —"
                  options={[
                    { value: "", label: "— Bỏ chọn —" },
                    ...personnel.map((p) => ({
                      value: p.id,
                      label: `${p.title ? `${p.title} — ` : ""}${p.name}${p.departmentName ? ` (${p.departmentName})` : ""}`,
                    })),
                  ]}
                  value={authorizedSignerId}
                  onValueChange={(val) => setAuthorizedSignerId(val ?? "")}
                  disabled={personnelLoading}
                />
                {personnelLoading && (
                  <p className="text-xs text-muted-foreground mt-1">Đang tải danh sách nhân sự...</p>
                )}
              </div>

              {/* Danh sách nơi nhận */}
              <div>
                <label htmlFor="cd-recipient-list" className="text-xs font-medium text-foreground block mb-1">
                  Danh sách nơi nhận (tùy chọn)
                </label>
                <Textarea
                  compact
                  id="cd-recipient-list"
                  rows={2}
                  placeholder="VD: Sở GD&ĐT Bình Định; Phòng ĐT QCET; Lưu VT..."
                  value={recipientList}
                  onChange={(e) => setRecipientList(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Summary */}
          <FormField label="Trích yếu nội dung văn bản" error={fieldErrors.summary}>
            <Textarea
              compact
              ref={summaryRef}
              rows={3}
              placeholder="VD: V/v ban hành quy định đánh giá sinh viên thực tập doanh nghiệp học kỳ 1 năm học 2026-2027..."
              value={summary}
              onChange={(e) => {
                setSummary(e.target.value);
                setFieldErrors((prev) => ({ ...prev, summary: undefined }));
              }}
              required
            />
          </FormField>

          {duplicateAcknowledged && duplicate && (
            <InlineAlert variant="warning">{duplicate.message}</InlineAlert>
          )}

          {/* Error message */}
          {submitError && (
            <div role="alert" className="flex items-start gap-2 px-3 py-2 rounded-lg bg-danger-soft text-destructive text-xs">
              <AlertCircle className="size-4 shrink-0 mt-0.5" strokeWidth={1.5} />
              <span>{submitError}</span>
            </div>
          )}

          {/* Footer Submit */}
          <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              className="cursor-pointer"
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              className="gap-1.5 cursor-pointer"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span>Đang xử lý...</span>
              ) : (
                <>
                  <Plus className="size-3.5" strokeWidth={1.5} />
                  <span>
                    {docType === "outbox"
                      ? "Tạo dự thảo văn bản đi"
                      : "Lưu & Đăng ký văn bản"}
                  </span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </StandardDialog>
  );
}
