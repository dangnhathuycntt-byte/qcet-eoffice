"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  X,
  ShieldAlert,
  Calendar,
  UserCheck,
  Plus,
  AlertCircle,
  Trash2,
} from "lucide-react";
import type { DelegationRule, DelegationScope } from "@/types/delegation";
import { QCET_DEPARTMENTS, type DepartmentNode } from "@/components/org/organization-tree";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ============================================================================
// 1. Data Helpers & Constants
// ============================================================================

export interface DelegationScopeConfig {
  id: DelegationScope;
  label: string;
  shortLabel: string;
  description: string;
}

export const DELEGATION_SCOPES: DelegationScopeConfig[] = [
  {
    id: "DACUM_REVIEW_STEP1",
    label: "Nghiệm thu hồ sơ DACUM (Bước 1)",
    shortLabel: "Thẩm định DACUM",
    description: "Thẩm định và xác nhận hồ sơ kỹ năng DACUM cấp đơn vị trước khi trình Hội đồng nhà trường.",
  },
  {
    id: "TASK_ASSIGNMENT",
    label: "Phân công & điều phối nhiệm vụ",
    shortLabel: "Phân công việc",
    description: "Giao việc, đôn đốc và điều phối các nhiệm vụ nội bộ thuộc thẩm quyền Trưởng đơn vị.",
  },
  {
    id: "FULL_DEPARTMENT_APPROVAL",
    label: "Toàn quyền phê duyệt cấp Đơn vị",
    shortLabel: "Toàn quyền Đơn vị",
    description: "Toàn quyền điều hành, phê duyệt nhiệm vụ và ký thay Trưởng đơn vị trong thời gian ủy quyền.",
  },
];

export function findDepartment(code: string): DepartmentNode | undefined {
  if (!code) return undefined;
  const norm = code.trim().toUpperCase();
  return (
    QCET_DEPARTMENTS.find((d) => d.code.toUpperCase() === norm) ||
    QCET_DEPARTMENTS.find((d) => d.id.toUpperCase() === norm) ||
    QCET_DEPARTMENTS.find((d) => {
      const pureCode = d.code.toUpperCase().replace(/^(K_|P_|TT_)/, "");
      const pureNorm = norm.replace(/^(K_|P_|TT_)/, "");
      return (
        pureCode === pureNorm ||
        (norm === "CNTT" && d.code === "K_CNTT") ||
        (norm === "KHOA_CNTT" && d.code === "K_CNTT") ||
        d.code.toUpperCase().includes(norm) ||
        norm.includes(d.code.toUpperCase())
      );
    })
  );
}

export interface DelegationFormData {
  granteeName: string;
  granteeRole: "STAFF" | "MANAGER";
  scope: DelegationScope;
  startDate: string;
  endDate: string;
  reason: string;
}

export function validateDelegationForm(
  data: DelegationFormData,
  grantorName: string
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.granteeName || data.granteeName.trim().length === 0) {
    errors.granteeName = "Vui lòng nhập hoặc chọn người được ủy quyền.";
  } else if (
    grantorName &&
    data.granteeName.trim().toLowerCase() === grantorName.trim().toLowerCase()
  ) {
    errors.granteeName =
      "Người ủy quyền không thể tự ủy quyền cho chính mình (theo nguyên tắc phân lập thẩm quyền).";
  }

  if (!data.startDate) {
    errors.startDate = "Vui lòng chọn ngày bắt đầu hiệu lực.";
  }

  if (!data.endDate) {
    errors.endDate = "Vui lòng chọn ngày kết thúc hiệu lực.";
  }

  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    errors.endDate = "Ngày kết thúc không được sớm hơn ngày bắt đầu hiệu lực.";
  }

  if (!data.reason || data.reason.trim().length < 5) {
    errors.reason = "Vui lòng nhập căn cứ hoặc lý do ủy quyền chi tiết (tối thiểu 5 ký tự).";
  }

  return errors;
}

// ============================================================================
// 2. Component Props & Main Modal
// ============================================================================

export interface DelegationManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentCode: string;
  delegations: DelegationRule[];
  onSaveDelegation: (rule: Omit<DelegationRule, "id" | "createdAt">) => void;
  onRevokeDelegation: (ruleId: string) => void;
}

export function DelegationManagementModal({
  isOpen,
  onClose,
  departmentCode,
  delegations,
  onSaveDelegation,
  onRevokeDelegation,
}: DelegationManagementModalProps) {
  const [mounted, setMounted] = React.useState(false);

  // Department metadata
  const dept = React.useMemo(() => {
    return findDepartment(departmentCode) ?? QCET_DEPARTMENTS.find((d) => d.code === departmentCode);
  }, [departmentCode]);

  const effectiveDeptCode = dept?.code || departmentCode;
  const grantorName = dept?.leaderName || "Trưởng đơn vị";
  const grantorRole: "ADMIN" | "MANAGER" = dept?.category === "BGH" || dept?.code === "BGH" ? "ADMIN" : "MANAGER";

  // Form states
  const todayStr = React.useMemo(() => new Date().toISOString().split("T")[0], []);
  const [granteeName, setGranteeName] = React.useState("");
  const [granteeRole, setGranteeRole] = React.useState<"STAFF" | "MANAGER">("STAFF");
  const [scope, setScope] = React.useState<DelegationScope>("DACUM_REVIEW_STEP1");
  const [startDate, setStartDate] = React.useState(todayStr);
  const [endDate, setEndDate] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Filter delegations for current department
  const currentDeptDelegations = React.useMemo(() => {
    const norm = effectiveDeptCode.trim().toUpperCase();
    return delegations.filter((d) => {
      const dCode = d.departmentCode?.trim().toUpperCase();
      if (dCode === norm) return true;
      if (dept && (dCode === dept.code.toUpperCase() || dCode === dept.id.toUpperCase())) return true;
      const pureDept = norm.replace(/^(K_|P_|TT_)/, "");
      const pureDel = dCode?.replace(/^(K_|P_|TT_)/, "");
      return pureDept && pureDel && pureDept === pureDel;
    });
  }, [delegations, effectiveDeptCode, dept]);

  // Handle ESC key to close
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Quick pick member from department
  const handleSelectMember = (memberName: string, memberRole: string) => {
    setGranteeName(memberName);
    const isLeadOrDeputy = /trưởng|phó/i.test(memberRole);
    setGranteeRole(isLeadOrDeputy ? "MANAGER" : "STAFF");
    if (errors.granteeName) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.granteeName;
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formData: DelegationFormData = {
      granteeName,
      granteeRole,
      scope,
      startDate,
      endDate,
      reason,
    };

    const validationErrors = validateDelegationForm(formData, grantorName);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const granteeId =
      dept?.members.find((m) => m.name === granteeName.trim())?.id ||
      `grantee-${Date.now()}`;

    const newRule: Omit<DelegationRule, "id" | "createdAt"> = {
      grantorId: dept ? `leader-${dept.code.toLowerCase()}` : "grantor-dept-leader",
      grantorName,
      grantorRole,
      granteeId,
      granteeName: granteeName.trim(),
      granteeRole,
      departmentCode: effectiveDeptCode,
      scope,
      startDate,
      endDate,
      status: "ACTIVE",
      reason: reason.trim(),
    };

    onSaveDelegation(newRule);

    // Reset form after saving
    setGranteeName("");
    setGranteeRole("STAFF");
    setScope("DACUM_REVIEW_STEP1");
    setStartDate(todayStr);
    setEndDate("");
    setReason("");
    setIsSubmitting(false);
    setSuccessMessage("Quyết định ủy quyền đã được kích hoạt thành công!");
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delegation-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 sm:px-6 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <ShieldAlert className="size-5" strokeWidth={1.5} />
            </div>
            <div>
              <h2
                id="delegation-modal-title"
                className="text-base sm:text-lg font-semibold text-foreground tracking-tight"
              >
                Quản lý Quyết định Ủy quyền Thẩm quyền
              </h2>
              <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                <span>Đơn vị:</span>
                <span className="font-semibold text-foreground">
                  {dept?.name || effectiveDeptCode}
                </span>
                <span className="font-mono tabular-nums px-1.5 py-0.2 rounded border border-border/70 bg-muted/50 text-xs">
                  {effectiveDeptCode}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Success Alert Banner */}
        {successMessage && (
          <div className="mx-5 mt-4 sm:mx-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <UserCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* Modal Body: Split 2 columns (Form & List) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 thin-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Form Tạo Ủy Quyền (5 cols) */}
            <div className="lg:col-span-5 space-y-4 rounded-xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                <Plus className="size-4 text-primary" strokeWidth={1.5} />
                <h3 className="text-sm font-semibold text-foreground">
                  Thiết lập Quyết định Ủy quyền Mới
                </h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                {/* 1. Người ủy quyền (Readonly) */}
                <div className="space-y-1.5">
                  <label className="font-medium text-muted-foreground">
                    Người ủy quyền (Trưởng đơn vị)
                  </label>
                  <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-foreground">
                    <span className="font-medium">{grantorName}</span>
                    <span className="font-mono tabular-nums text-xs text-muted-foreground">
                      {grantorRole}
                    </span>
                  </div>
                </div>

                {/* 2. Tên người được ủy quyền */}
                <div className="space-y-1.5">
                  <label className="font-medium text-foreground">
                    Người được ủy quyền
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập họ và tên cán bộ..."
                    value={granteeName}
                    onChange={(e) => {
                      setGranteeName(e.target.value);
                      if (errors.granteeName) {
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.granteeName;
                          return next;
                        });
                      }
                    }}
                    className={cn(
                      "w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
                      errors.granteeName && "border-destructive focus:border-destructive focus:ring-destructive"
                    )}
                  />
                  {errors.granteeName && (
                    <p className="text-xs font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" strokeWidth={1.5} />
                      {errors.granteeName}
                    </p>
                  )}

                  {/* Suggestion list from department members */}
                  {dept && dept.members && dept.members.length > 0 && (
                    <div className="pt-1">
                      <p className="text-xs text-muted-foreground mb-1">
                        Cán bộ gợi ý từ danh bạ đơn vị:
                      </p>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {dept.members
                          .filter((m) => m.name !== grantorName)
                          .map((member) => (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => handleSelectMember(member.name, member.role)}
                              className={cn(
                                "text-xs rounded px-2 py-0.5 border border-border/60 bg-muted/40 hover:bg-primary/10 hover:border-primary/40 text-foreground transition-colors cursor-pointer active:scale-95",
                                granteeName === member.name && "bg-primary/15 border-primary text-primary font-medium"
                              )}
                            >
                              {member.name}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Vai trò người được ủy quyền */}
                <div className="space-y-1.5">
                  <label className="font-medium text-foreground">
                    Vai trò cán bộ
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGranteeRole("STAFF")}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-center font-medium transition-all cursor-pointer active:scale-95",
                        granteeRole === "STAFF"
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border/60 bg-background text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      STAFF (Viên chức)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGranteeRole("MANAGER")}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-center font-medium transition-all cursor-pointer active:scale-95",
                        granteeRole === "MANAGER"
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border/60 bg-background text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      MANAGER (Phó đơn vị)
                    </button>
                  </div>
                </div>

                {/* 4. Phạm vi ủy quyền */}
                <div className="space-y-1.5">
                  <label className="font-medium text-foreground">
                    Phạm vi thẩm quyền ủy quyền
                  </label>
                  <div className="space-y-2">
                    {DELEGATION_SCOPES.map((s) => (
                      <label
                        key={s.id}
                        className={cn(
                          "flex items-start gap-2.5 rounded-lg border p-2.5 transition-all cursor-pointer",
                          scope === s.id
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border/60 bg-background text-muted-foreground hover:bg-muted/30"
                        )}
                      >
                        <input
                          type="radio"
                          name="scope"
                          value={s.id}
                          checked={scope === s.id}
                          onChange={() => setScope(s.id)}
                          className="mt-0.5 text-primary focus:ring-primary"
                        />
                        <div className="space-y-0.5 leading-tight">
                          <p className="font-medium text-foreground text-xs">{s.label}</p>
                          <p className="text-xs text-muted-foreground">{s.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 5. Thời hạn hiệu lực: Từ ngày - Đến ngày */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-medium text-foreground flex items-center gap-1">
                      <Calendar className="size-3 text-muted-foreground" strokeWidth={1.5} />
                      Từ ngày
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={cn(
                        "w-full font-mono tabular-nums rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
                        errors.startDate && "border-destructive"
                      )}
                    />
                    {errors.startDate && (
                      <p className="text-xs text-destructive">{errors.startDate}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-foreground flex items-center gap-1">
                      <Calendar className="size-3 text-muted-foreground" strokeWidth={1.5} />
                      Đến ngày
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={cn(
                        "w-full font-mono tabular-nums rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
                        errors.endDate && "border-destructive"
                      )}
                    />
                    {errors.endDate && (
                      <p className="text-xs text-destructive">{errors.endDate}</p>
                    )}
                  </div>
                </div>

                {/* 6. Căn cứ / Lý do ủy quyền */}
                <div className="space-y-1.5">
                  <label className="font-medium text-foreground">
                    Căn cứ / Lý do ủy quyền
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ví dụ: Đi công tác dài ngày, nghỉ phép, đào tạo nâng cao..."
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      if (errors.reason) {
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.reason;
                          return next;
                        });
                      }
                    }}
                    className={cn(
                      "w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none",
                      errors.reason && "border-destructive"
                    )}
                  />
                  {errors.reason && (
                    <p className="text-xs font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" strokeWidth={1.5} />
                      {errors.reason}
                    </p>
                  )}
                </div>

                {/* Submit button */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full font-medium active:scale-95 cursor-pointer"
                >
                  <UserCheck className="size-4" strokeWidth={1.5} />
                  <span>Ký & Kích hoạt ủy quyền</span>
                </Button>
              </form>
            </div>

            {/* Right Column: Danh sách ủy quyền hiện hữu (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-muted-foreground" strokeWidth={1.5} />
                  <h3 className="text-sm font-semibold text-foreground">
                    Quyết định Ủy quyền của Đơn vị
                  </h3>
                </div>
                <span className="font-mono tabular-nums text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                  {currentDeptDelegations.length} quyết định
                </span>
              </div>

              {currentDeptDelegations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-8 text-center space-y-2">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
                    <ShieldAlert className="size-5" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Chưa có quyết định ủy quyền nào
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Hiện tại chưa có quyết định ủy quyền thẩm quyền nào được ban hành cho đơn vị {effectiveDeptCode}. Sử dụng biểu mẫu bên trái để khởi tạo.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentDeptDelegations.map((del) => {
                    const scopeInfo = DELEGATION_SCOPES.find((s) => s.id === del.scope);
                    const isRevoked = del.status === "REVOKED";
                    const isExpired = del.status === "EXPIRED";
                    const isActive = del.status === "ACTIVE";

                    return (
                      <div
                        key={del.id}
                        className={cn(
                          "rounded-xl border p-4 transition-all space-y-3 bg-card",
                          isActive
                            ? "border-border/80 shadow-xs hover:border-primary/30"
                            : "border-border/50 opacity-80 bg-muted/10"
                        )}
                      >
                        {/* Header: Grantee, Role, Status, Revoke action */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-foreground">
                                {del.granteeName}
                              </span>
                              <Badge
                                variant={del.granteeRole === "MANAGER" ? "sapphire" : "secondary"}
                                className="font-mono tabular-nums text-xs"
                              >
                                {del.granteeRole}
                              </Badge>
                              <Badge
                                variant={
                                  isActive
                                    ? "emerald"
                                    : isExpired
                                    ? "amber"
                                    : "destructive"
                                }
                                className="text-xs"
                              >
                                {isActive
                                  ? "Đang hiệu lực"
                                  : isExpired
                                  ? "Hết hiệu lực"
                                  : "Đã thu hồi"}
                              </Badge>
                            </div>
                            <p className="text-xs font-medium text-primary">
                              {scopeInfo?.label || del.scope}
                            </p>
                          </div>

                          {/* Revoke button */}
                          {isActive && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="xs"
                              onClick={() => onRevokeDelegation(del.id)}
                              className="active:scale-95 text-xs gap-1 cursor-pointer shrink-0"
                            >
                              <Trash2 className="size-3" strokeWidth={1.5} />
                              <span>Thu hồi</span>
                            </Button>
                          )}
                        </div>

                        {/* Metadata Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <UserCheck className="size-3.5 shrink-0" strokeWidth={1.5} />
                            <span>Người ký:</span>
                            <span className="font-medium text-foreground">
                              {del.grantorName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Calendar className="size-3.5 shrink-0" strokeWidth={1.5} />
                            <span>Hiệu lực:</span>
                            <span className="font-mono tabular-nums text-foreground">
                              {del.startDate} - {del.endDate}
                            </span>
                          </div>
                        </div>

                        {/* Reason */}
                        <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                          <span className="font-medium text-foreground">Căn cứ: </span>
                          <span>{del.reason}</span>
                        </div>

                        {/* Rule ID and Department Code */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                          <span className="font-mono tabular-nums">
                            Mã: {del.id}
                          </span>
                          <span className="font-mono tabular-nums">
                            Đơn vị: {del.departmentCode}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/60 px-5 py-3 sm:px-6 bg-muted/10 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ShieldAlert className="size-3.5 text-primary" strokeWidth={1.5} />
            Hệ thống phân quyền ủy quyền chuẩn Stanford / QCET E-Office
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="cursor-pointer active:scale-95"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
