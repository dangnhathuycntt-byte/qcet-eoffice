"use client";

import * as React from "react";
import {
  PenTool,
  CheckCircle2,
  Clock,
  Building2,
  Users,
  AlertCircle,
  Sparkles,
  Calendar,
  Send,
  X,
  Plus
} from "lucide-react";
import type { DocumentItem } from "@/types/document";

export interface QuickDirectivePreset {
  id: string;
  label: string;
  description: string;
  defaultDeptId: string;
  defaultDeptName: string;
  template: string;
  offsetDays: number;
  priority?: "NORMAL" | "HIGH" | "URGENT";
}

export const QUICK_DIRECTIVE_PRESETS: QuickDirectivePreset[] = [
  {
    id: "giao-dao-tao",
    label: "Giao P. Đào tạo",
    description: "Chủ trì rà soát chuyên môn, đào tạo & QLKH",
    defaultDeptId: "DT",
    defaultDeptName: "Phòng Đào tạo",
    template: "Giao Phòng Đào tạo chủ trì, phối hợp các đơn vị liên quan nghiên cứu tham mưu triển khai trước hạn.",
    offsetDays: 5,
    priority: "HIGH",
  },
  {
    id: "giao-tc-hc",
    label: "Giao P. TCHC",
    description: "Tổ chức hành chính, nhân sự, tổng hợp",
    defaultDeptId: "TCHC",
    defaultDeptName: "Phòng Tổ chức - Hành chính",
    template: "Giao Phòng Tổ chức - Hành chính chủ trì phối hợp giải quyết theo đúng quy định.",
    offsetDays: 3,
    priority: "NORMAL",
  },
  {
    id: "giao-kh-tc",
    label: "Giao P. KHTC",
    description: "Thẩm định dự toán tài chính, kế hoạch ngân sách",
    defaultDeptId: "KHTC",
    defaultDeptName: "Phòng Kế hoạch - Tài chính",
    template: "Giao Phòng Kế hoạch - Tài chính thẩm định dự toán và báo cáo BGH.",
    offsetDays: 3,
    priority: "NORMAL",
  },
  {
    id: "giao-cntt",
    label: "Giao Khoa CNTT",
    description: "Hạ tầng kỹ thuật số, phần mềm e-office",
    defaultDeptId: "CNTT",
    defaultDeptName: "Khoa Công nghệ Thông tin",
    template: "Giao Khoa Công nghệ Thông tin nghiên cứu triển khai giải pháp kỹ thuật.",
    offsetDays: 5,
    priority: "NORMAL",
  },
  {
    id: "pho-bien-toan-truong",
    label: "Phổ biến toàn trường",
    description: "Thông báo các đơn vị triển khai đến toàn thể CB-GV",
    defaultDeptId: "TCHC",
    defaultDeptName: "Phòng Tổ chức - Hành chính",
    template: "Chuyển các phòng, khoa, đơn vị trực thuộc phổ biến cán bộ, giảng viên, nhân viên thực hiện.",
    offsetDays: 7,
    priority: "NORMAL",
  },
];

export const DEFAULT_QCET_DEPARTMENTS = [
  { id: "DT", name: "Phòng Đào tạo", shortName: "P.ĐT" },
  { id: "TCHC", name: "Phòng Tổ chức - Hành chính", shortName: "P.TCHC" },
  { id: "KHTC", name: "Phòng Kế hoạch - Tài chính", shortName: "P.KHTC" },
  { id: "CNTT", name: "Khoa Công nghệ Thông tin", shortName: "K.CNTT" },
  { id: "KTCN", name: "Khoa Kỹ thuật Công nghệ", shortName: "K.KTCN" },
  { id: "QLCL", name: "Phòng Quản lý chất lượng", shortName: "P.QLCL" },
  { id: "CTHSSV", name: "Phòng Công tác HSSV", shortName: "P.CTHSSV" },
  { id: "HTDN", name: "Trung tâm Đào tạo & HTDN", shortName: "TT.HTDN" },
];

export interface AppliedDirectivePreset {
  instruction: string;
  assignedDeptId: string;
  deadline?: string;
  priority?: "NORMAL" | "HIGH" | "URGENT";
}

/**
 * Applies a quick directive preset and computes statutory deadline based on offset.
 */
export function applyPresetToDirective(
  presetId: string,
  baseDateStr?: string
): AppliedDirectivePreset {
  const preset = QUICK_DIRECTIVE_PRESETS.find((p) => p.id === presetId);
  if (!preset) {
    return {
      instruction: "",
      assignedDeptId: "DT",
      deadline: undefined,
    };
  }

  const baseDate = baseDateStr ? new Date(baseDateStr) : new Date();
  const validBase = isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const deadlineDate = new Date(validBase.getTime() + preset.offsetDays * 24 * 60 * 60 * 1000);

  return {
    instruction: preset.template,
    assignedDeptId: preset.defaultDeptId,
    deadline: deadlineDate.toISOString(),
    priority: preset.priority,
  };
}

export interface DirectiveActionPanelProps {
  document: DocumentItem;
  currentUser?: { id: string; name: string; role: string };
  departments?: Array<{ id: string; name: string; shortName?: string }>;
  onDirectiveSuccess?: (result: any) => void;
  onSuccess?: (result: any) => void;
  onCancel?: () => void;
  className?: string;
}

export function DirectiveActionPanel({
  document,
  currentUser,
  departments = DEFAULT_QCET_DEPARTMENTS,
  onDirectiveSuccess,
  onSuccess,
  onCancel,
  className = "",
}: DirectiveActionPanelProps) {
  const [selectedPresetId, setSelectedPresetId] = React.useState<string | null>(null);
  const [instruction, setInstruction] = React.useState<string>("");
  const [assignedDeptId, setAssignedDeptId] = React.useState<string>(
    document.leadDepartmentId || "DT"
  );
  const [collaboratorIds, setCollaboratorIds] = React.useState<string[]>([]);
  const [deadline, setDeadline] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Helper to format ISO or Date to YYYY-MM-DD for date input
  const formatDateForInput = (dateInput: Date | string): string => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  };

  // 1-touch preset handler
  const handleSelectPreset = (preset: QuickDirectivePreset) => {
    setSelectedPresetId(preset.id);
    const applied = applyPresetToDirective(preset.id);
    setInstruction(applied.instruction);
    setAssignedDeptId(applied.assignedDeptId);
    if (applied.deadline) {
      setDeadline(formatDateForInput(applied.deadline));
    }
    setErrorMessage(null);
  };

  // Quick deadline adder (+days from today)
  const handleAddDaysToDeadline = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    setDeadline(formatDateForInput(target));
  };

  // Toggle collaborator
  const handleToggleCollaborator = (deptId: string) => {
    if (deptId === assignedDeptId) return;
    setCollaboratorIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  // Submit directive to API
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!instruction.trim()) {
      setErrorMessage("Vui lòng nhập nội dung bút phê chỉ đạo.");
      return;
    }

    if (!assignedDeptId) {
      setErrorMessage("Vui lòng chọn đơn vị chủ trì thực hiện.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        instruction: instruction.trim(),
        assignedDeptId,
        collaboratorIds: collaboratorIds.length > 0 ? collaboratorIds : null,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        leaderId: currentUser?.id,
      };

      const res = await fetch(`/api/documents/${document.id}/directives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Không thể ban hành bút phê. Vui lòng thử lại.");
      }

      setSuccessMessage("Bút phê đã được ban hành thành công và đồng bộ tạo Nhiệm vụ trường.");

      if (onDirectiveSuccess) {
        onDirectiveSuccess(json.data || json);
      }
      if (onSuccess) {
        onSuccess(json.data || json);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Đã xảy ra lỗi khi gửi yêu cầu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
      data-testid="directive-action-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <PenTool className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Hộp Bút phê BGH 1-chạm
            </h3>
            <p className="text-xs text-slate-500">
              Ghi ý kiến chỉ đạo điện tử & liên thông sinh Nhiệm vụ trường (Điều 23 NĐ 30/2020)
            </p>
          </div>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Target Document Context Box */}
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-700">
            Văn bản số: {document.originalNumber || `#${document.registrationNumber}/${document.documentYear}`}
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-600">
            {document.issuingAuthority}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-slate-600 italic">
          &quot;{document.summary}&quot;
        </p>
      </div>

      {/* 1-Touch Preset Chips */}
      <div className="mt-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" strokeWidth={1.5} />
          <span>Mẫu bút phê chỉ đạo nhanh 1-chạm (Quick Presets):</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_DIRECTIVE_PRESETS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-slate-50"
                }`}
              >
                <span>{preset.label}</span>
                <span className="text-xs text-slate-400">
                  (+{preset.offsetDays}d)
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* Instruction Textarea */}
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Nội dung bút phê chỉ đạo <span className="text-rose-500">*</span>
          </label>
          <textarea
            name="instruction"
            rows={3}
            value={instruction}
            onChange={(e) => {
              setInstruction(e.target.value);
              setErrorMessage(null);
            }}
            placeholder="Ghi ý kiến chỉ đạo của Ban Giám hiệu (Ví dụ: Giao Phòng Đào tạo chủ trì, rà soát chương trình đào tạo nghề trọng điểm trước ngày 15/09...)"
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
        </div>

        {/* Assigned Department (Lead) & Collaborators */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Main Department */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <Building2 className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.5} />
              <span>Đơn vị chủ trì thực hiện</span>
              <span className="text-rose-500">*</span>
            </label>
            <select
              value={assignedDeptId}
              onChange={(e) => {
                const newDept = e.target.value;
                setAssignedDeptId(newDept);
                // Remove from collaborators if previously checked
                setCollaboratorIds((prev) => prev.filter((id) => id !== newDept));
              }}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} {dept.shortName ? `(${dept.shortName})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Deadline & Quick Buttons */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <Calendar className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.5} />
              <span>Hạn xử lý / Báo cáo hoàn thành</span>
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {/* Quick buttons */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleAddDaysToDeadline(1)}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                +1 ngày
              </button>
              <button
                type="button"
                onClick={() => handleAddDaysToDeadline(3)}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                +3 ngày
              </button>
              <button
                type="button"
                onClick={() => handleAddDaysToDeadline(5)}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                +5 ngày
              </button>
              <button
                type="button"
                onClick={() => handleAddDaysToDeadline(7)}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                +1 tuần
              </button>
            </div>
          </div>
        </div>

        {/* Collaborating Departments Checkboxes */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <Users className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.5} />
            <span>Đơn vị phối hợp thực hiện (tùy chọn)</span>
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {departments
              .filter((d) => d.id !== assignedDeptId)
              .map((dept) => {
                const isChecked = collaboratorIds.includes(dept.id);
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => handleToggleCollaborator(dept.id)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                      isChecked
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>{dept.shortName || dept.name}</span>
                    {isChecked && <CheckCircle2 className="h-3 w-3" strokeWidth={2} />}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Status Alerts */}
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

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Hủy bỏ
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Clock className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                <span>Đang xử lý & tạo nhiệm vụ...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" strokeWidth={1.5} />
                <span>Ban hành Bút phê & Tạo Nhiệm vụ</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
