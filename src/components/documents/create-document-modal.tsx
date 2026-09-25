"use client";

import * as React from "react";
import { StandardDialog } from "@/components/ui/dialog";
import { useModalDirtyGuard } from "@/hooks/use-modal-dirty-guard";
import { Select } from "@base-ui/react/select";
import { Send, FileText, Building2, User, AlertCircle, Plus, Check, ChevronDown, Loader2 } from "lucide-react";
import { OfficialDocument, DocumentType, DocumentUrgency } from "@/types/document";
import { Button } from "@/components/ui/button";
import { usePersonnelList } from "@/hooks/use-personnel-list";
import { useDepartmentList } from "@/hooks/use-department-list";
import { formatIsoDate } from "@/lib/format";
import { cn } from "@/lib/utils";

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
    setSubmitError(null);

    if (!summary.trim()) {
      setSubmitError("Vui lòng điền Trích yếu nội dung văn bản.");
      return;
    }
    if (docType !== "outbox" && !documentNumber.trim()) {
      setSubmitError("Vui lòng điền Số / Ký hiệu văn bản.");
      return;
    }

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
        };

        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
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

  const selectedUrgencyLabel =
    URGENCY_OPTIONS.find((opt) => opt.value === urgency)?.label ?? "Thường";

  const selectedSigner = personnel.find((p) => p.id === authorizedSignerId);

  return (
    <StandardDialog
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
        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
          {/* Type Selector Tabs */}
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">
              Phân loại luồng văn bản
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDocType("inbox")}
                className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-colors cursor-pointer ${
                  docType === "inbox"
                    ? "border-sky-500 bg-sky-500/10 text-sky-700 font-semibold shadow-xs"
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
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 font-semibold shadow-xs"
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
                    ? "border-violet-500 bg-violet-500/10 text-violet-700 font-semibold shadow-xs"
                    : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                }`}
              >
                Tờ trình nội bộ
              </button>
            </div>
          </div>

          {/* Document Number + Urgency (ẩn với văn bản đi) */}
          {docType !== "outbox" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Số / Ký hiệu văn bản <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: 156/CDKTCN-ĐT"
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
                <Select.Root
                  value={urgency}
                  onValueChange={(val) => {
                    if (val) setUrgency(val as DocumentUrgency);
                  }}
                >
                  <Select.Trigger
                    aria-label="Mức độ khẩn"
                    className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 cursor-pointer"
                  >
                    <Select.Value>{selectedUrgencyLabel}</Select.Value>
                    <Select.Icon>
                      <ChevronDown className="size-3.5 text-muted-foreground/60" strokeWidth={1.5} />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Positioner className="z-50" side="bottom" align="start" sideOffset={4}>
                      <Select.Popup className="w-48 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none transition-[opacity,transform] duration-150 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95">
                        <Select.List>
                          {URGENCY_OPTIONS.map((opt) => (
                            <Select.Item
                              key={opt.value}
                              value={opt.value}
                              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs outline-none data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:text-primary"
                            >
                              <Select.ItemText>{opt.label}</Select.ItemText>
                              <Select.ItemIndicator>
                                <Check className="size-3.5 text-primary" strokeWidth={1.5} />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.List>
                      </Select.Popup>
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>
              </div>
            </div>
          )}

          {/* Urgency riêng cho văn bản đi */}
          {docType === "outbox" && (
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Mức độ khẩn
              </label>
              <Select.Root
                value={urgency}
                onValueChange={(val) => {
                  if (val) setUrgency(val as DocumentUrgency);
                }}
              >
                <Select.Trigger
                  aria-label="Mức độ khẩn"
                  className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 cursor-pointer"
                >
                  <Select.Value>{selectedUrgencyLabel}</Select.Value>
                  <Select.Icon>
                    <ChevronDown className="size-3.5 text-muted-foreground/60" strokeWidth={1.5} />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner className="z-50" side="bottom" align="start" sideOffset={4}>
                    <Select.Popup className="w-48 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none transition-[opacity,transform] duration-150 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95">
                      <Select.List>
                        {URGENCY_OPTIONS.map((opt) => (
                          <Select.Item
                            key={opt.value}
                            value={opt.value}
                            className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs outline-none data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:text-primary"
                          >
                            <Select.ItemText>{opt.label}</Select.ItemText>
                            <Select.ItemIndicator>
                              <Check className="size-3.5 text-primary" strokeWidth={1.5} />
                            </Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.List>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </div>
          )}

          {/* Issuing Authority + Date (chỉ hiện cho văn bản đến / tờ trình) */}
          {docType !== "outbox" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    {docType === "inbox" ? "Cơ quan ban hành" : "Đơn vị đề xuất / Ban hành"}
                  </label>
                  {docType === "submission" ? (
                    <Select.Root
                      value={issuingAuthority}
                      onValueChange={(val) => {
                        if (val) setIssuingAuthority(val);
                      }}
                      disabled={departmentsLoading}
                    >
                      <Select.Trigger
                        aria-label="Đơn vị đề xuất / Ban hành"
                        className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 disabled:opacity-50 cursor-pointer"
                      >
                        <Select.Value>
                          {departmentsLoading ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5 animate-pulse">
                              <Loader2 className="size-3 animate-spin text-muted-foreground" strokeWidth={1.5} />
                              Đang tải danh sách đơn vị...
                            </span>
                          ) : (
                            issuingAuthority || "— Chọn đơn vị đề xuất —"
                          )}
                        </Select.Value>
                        <Select.Icon>
                          <ChevronDown className="size-3.5 text-muted-foreground/60" strokeWidth={1.5} />
                        </Select.Icon>
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Positioner className="z-50" side="bottom" align="start" sideOffset={4}>
                          <Select.Popup className="w-80 max-h-60 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none transition-[opacity,transform] duration-150 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95">
                            <Select.List>
                              {departmentsLoading ? (
                                <div className="p-3 text-center text-xs text-muted-foreground animate-pulse flex items-center justify-center gap-2">
                                  <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
                                  <span>Đang tải danh sách đơn vị...</span>
                                </div>
                              ) : (
                                departments.map((d) => (
                                  <Select.Item
                                    key={d.id}
                                    value={d.name}
                                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs outline-none data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:text-primary"
                                  >
                                    <Select.ItemText>{d.name}</Select.ItemText>
                                    <Select.ItemIndicator>
                                      <Check className="size-3.5 text-primary" strokeWidth={1.5} />
                                    </Select.ItemIndicator>
                                  </Select.Item>
                                ))
                              )}
                            </Select.List>
                          </Select.Popup>
                        </Select.Positioner>
                      </Select.Portal>
                    </Select.Root>
                  ) : (
                    <input
                      type="text"
                      placeholder="VD: UBND Tỉnh Bình Định"
                      value={issuingAuthority}
                      onChange={(e) => setIssuingAuthority(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-border/70 bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30"
                    />
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Ngày ban hành
                  </label>
                  <input
                    type="date"
                    value={issuedDate}
                    onChange={(e) => setIssuedDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border/70 bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              {/* Đơn vị chủ trì xử lý (cho văn bản đến) */}
              {docType === "inbox" && (
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Đơn vị chủ trì xử lý (tùy chọn)
                  </label>
                  <Select.Root
                    value={leadUnitId}
                    onValueChange={(val) => {
                      setLeadUnitId(val ?? "");
                    }}
                    disabled={departmentsLoading}
                  >
                    <Select.Trigger
                      aria-label="Đơn vị chủ trì xử lý"
                      className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 disabled:opacity-50 cursor-pointer"
                    >
                      <Select.Value>
                        {departmentsLoading ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5 animate-pulse">
                            <Loader2 className="size-3 animate-spin text-muted-foreground" strokeWidth={1.5} />
                            Đang tải danh sách đơn vị...
                          </span>
                        ) : (
                          departments.find((d) => d.id === leadUnitId)?.name || "— Chưa phân công đơn vị chủ trì —"
                        )}
                      </Select.Value>
                      <Select.Icon>
                        <ChevronDown className="size-3.5 text-muted-foreground/60" strokeWidth={1.5} />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner className="z-50" side="bottom" align="start" sideOffset={4}>
                        <Select.Popup className="w-80 max-h-60 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none transition-[opacity,transform] duration-150 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95">
                          <Select.List>
                            <Select.Item
                              value=""
                              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs outline-none data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:text-primary"
                            >
                              <Select.ItemText>— Chưa phân công —</Select.ItemText>
                              <Select.ItemIndicator>
                                <Check className="size-3.5 text-primary" strokeWidth={1.5} />
                              </Select.ItemIndicator>
                            </Select.Item>
                            {departments.map((dept) => (
                              <Select.Item
                                key={dept.id}
                                value={dept.id}
                                className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs outline-none data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:text-primary"
                              >
                                <Select.ItemText>{dept.name}</Select.ItemText>
                                <Select.ItemIndicator>
                                  <Check className="size-3.5 text-primary" strokeWidth={1.5} />
                                </Select.ItemIndicator>
                              </Select.Item>
                            ))}
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
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
            <div className="space-y-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <p className="text-xs font-semibold text-emerald-700">
                Thông tin văn bản đi — Dự thảo DRAFT sẽ được khởi tạo kèm quy trình ký duyệt
              </p>

              {/* Người ký thẩm quyền */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Người ký thẩm quyền (tùy chọn)
                </label>
                <Select.Root
                  value={authorizedSignerId}
                  onValueChange={(val) => {
                    setAuthorizedSignerId(val ?? "");
                  }}
                  disabled={personnelLoading}
                >
                  <Select.Trigger
                    aria-label="Người ký thẩm quyền"
                    className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 disabled:opacity-50 cursor-pointer"
                  >
                    <Select.Value>
                      {selectedSigner
                        ? `${selectedSigner.title ? `${selectedSigner.title} — ` : ""}${selectedSigner.name}${selectedSigner.departmentName ? ` (${selectedSigner.departmentName})` : ""}`
                        : "— Chọn người ký thẩm quyền —"}
                    </Select.Value>
                    <Select.Icon>
                      <ChevronDown className="size-3.5 text-muted-foreground/60" strokeWidth={1.5} />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Positioner className="z-50" side="bottom" align="start" sideOffset={4}>
                      <Select.Popup className="w-80 max-h-60 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none transition-[opacity,transform] duration-150 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95">
                        <Select.List>
                          <Select.Item
                            value=""
                            className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs outline-none data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:text-primary"
                          >
                            <Select.ItemText>— Bỏ chọn —</Select.ItemText>
                            <Select.ItemIndicator>
                              <Check className="size-3.5 text-primary" strokeWidth={1.5} />
                            </Select.ItemIndicator>
                          </Select.Item>
                          {personnel.map((p) => (
                            <Select.Item
                              key={p.id}
                              value={p.id}
                              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs outline-none data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:text-primary"
                            >
                              <Select.ItemText>
                                {p.title ? `${p.title} — ` : ""}{p.name}
                                {p.departmentName ? ` (${p.departmentName})` : ""}
                              </Select.ItemText>
                              <Select.ItemIndicator>
                                <Check className="size-3.5 text-primary" strokeWidth={1.5} />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.List>
                      </Select.Popup>
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>
                {personnelLoading && (
                  <p className="text-xs text-muted-foreground mt-1">Đang tải danh sách nhân sự...</p>
                )}
              </div>

              {/* Danh sách nơi nhận */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Danh sách nơi nhận (tùy chọn)
                </label>
                <textarea
                  rows={2}
                  placeholder="VD: Sở GD&ĐT Bình Định; Phòng ĐT QCET; Lưu VT..."
                  value={recipientList}
                  onChange={(e) => setRecipientList(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border/70 bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 leading-relaxed"
                />
              </div>
            </div>
          )}

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

          {/* Error message */}
          {submitError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
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
              className="text-xs rounded-xl cursor-pointer"
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              className="gap-1.5 text-xs rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
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
