"use client";

import * as React from "react";
import {
  X,
  Plus,
  Calendar,
  User,
  Users,
  Building2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Tag,
  ChevronDown,
} from "lucide-react";
import type { TaskCategory, SchoolTask } from "@/types/dashboard";
import type { UserRole } from "@/types/auth";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TaskLevel = "TRUONG" | "DON_VI";

export function getAllowedTaskLevelsForRole(role: UserRole): TaskLevel[] {
  if (role === "ADMIN") {
    return ["TRUONG", "DON_VI"];
  }
  if (role === "MANAGER") {
    return ["DON_VI"];
  }
  return [];
}

export function getDefaultTaskLevelForRole(role: UserRole): TaskLevel {
  if (role === "ADMIN") {
    return "TRUONG";
  }
  return "DON_VI";
}

export interface CreateTaskFormData {
  level: TaskLevel;
  category: TaskCategory;
  title: string;
  leadAssigneeName: string;
  coAssignees: string[];
  dueDate: string;
  description: string;
  parentTaskId?: string;
}

export function getInitialTaskFormData(
  defaultLevel: TaskLevel = "TRUONG"
): CreateTaskFormData {
  return {
    level: defaultLevel,
    category: "CHUYEN_DOI_SO",
    title: "",
    leadAssigneeName: "",
    coAssignees: [],
    dueDate: "",
    description: "",
    parentTaskId: undefined,
  };
}

export function validateTaskForm(
  data: CreateTaskFormData
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.title || data.title.trim().length === 0) {
    errors.title = "Tiêu đề nhiệm vụ không được để trống";
  }

  if (!data.leadAssigneeName || data.leadAssigneeName.trim().length === 0) {
    errors.leadAssigneeName = "Vui lòng chỉ định người chủ trì";
  }

  if (!data.dueDate || data.dueDate.trim().length === 0) {
    errors.dueDate = "Vui lòng chọn hạn hoàn thành";
  }

  return errors;
}

export const CATEGORY_OPTIONS: { id: TaskCategory; label: string }[] = [
  { id: "CHUYEN_DOI_SO", label: "Chuyển đổi số" },
  { id: "TRUYEN_THONG", label: "Truyền thông & Tuyển sinh" },
  { id: "CNTT", label: "Hạ tầng & CNTT" },
  { id: "ATTT", label: "An toàn thông tin" },
  { id: "THU_VIEN", label: "Thư viện & Học liệu số" },
  { id: "BAO_CAO", label: "Báo cáo & Tổng hợp" },
  { id: "KHAC", label: "Khác" },
];

export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTaskFormData) => void;
  schoolTasks?: SchoolTask[];
  initialLevel?: TaskLevel;
  initialParentTaskId?: string;
  initialDueDate?: string;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onSubmit,
  schoolTasks = [],
  initialLevel = "TRUONG",
  initialParentTaskId,
  initialDueDate,
}: CreateTaskModalProps) {
  const { user } = useAuth();
  const allowedLevels = getAllowedTaskLevelsForRole(user?.role ?? "ADMIN");
  const isStaff = user?.role === "STAFF";
  const isManager = user?.role === "MANAGER";

  const getEffectiveLevel = React.useCallback(
    (requestedLevel: TaskLevel): TaskLevel => {
      if (isManager) return "DON_VI";
      if (allowedLevels.includes(requestedLevel)) return requestedLevel;
      return getDefaultTaskLevelForRole(user?.role ?? "ADMIN");
    },
    [isManager, allowedLevels, user?.role]
  );

  const [formData, setFormData] = React.useState<CreateTaskFormData>(() => ({
    ...getInitialTaskFormData(getEffectiveLevel(initialLevel)),
    parentTaskId: initialParentTaskId,
    dueDate: initialDueDate || "",
  }));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [coAssigneeInput, setCoAssigneeInput] = React.useState("");

  // Reset form when modal opens with initial values
  React.useEffect(() => {
    if (isOpen) {
      const effectiveLevel = getEffectiveLevel(initialLevel);
      setFormData({
        ...getInitialTaskFormData(effectiveLevel),
        parentTaskId: initialParentTaskId,
        dueDate: initialDueDate || "",
      });
      setErrors({});
      setCoAssigneeInput("");
    }
  }, [isOpen, initialLevel, initialParentTaskId, initialDueDate, getEffectiveLevel]);

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLevelChange = (level: TaskLevel) => {
    if (isManager && level === "TRUONG") return;
    setFormData((prev) => ({
      ...prev,
      level,
      // If switching to TRUONG, reset parentTaskId
      parentTaskId: level === "TRUONG" ? undefined : prev.parentTaskId,
    }));
  };

  const handleAddCoAssignee = () => {
    const trimmed = coAssigneeInput.trim();
    if (!trimmed) return;
    if (!formData.coAssignees.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        coAssignees: [...prev.coAssignees, trimmed],
      }));
    }
    setCoAssigneeInput("");
  };

  const handleRemoveCoAssignee = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      coAssignees: prev.coAssignees.filter((item) => item !== name),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isStaff || allowedLevels.length === 0) {
      return;
    }
    const validationErrors = validateTaskForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSubmit(formData);
    onClose();
  };

  const handleQuickPreset = (daysAhead: number) => {
    const base = new Date();
    base.setDate(base.getDate() + daysAhead);
    const dateStr = base.toISOString().split("T")[0];
    setFormData((prev) => ({ ...prev, dueDate: dateStr }));
    if (errors.dueDate) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.dueDate;
        return next;
      });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-xl rounded-xl border border-border bg-card text-card-foreground shadow-2xl transition-all duration-200 z-10 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-4 bg-muted/20">
          <div>
            <h2
              id="modal-title"
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              {isManager
                ? `Giao việc đơn vị - ${user.department || "Đơn vị"}`
                : "Giao nhiệm vụ mới"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isManager
                ? `Phân công nhiệm vụ nội bộ thuộc ${user.department || "đơn vị quản lý"}`
                : "Khởi tạo và phân công nhiệm vụ - QCET E-Office"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Permission Notice for STAFF */}
          {isStaff && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
            >
              <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold">Giới hạn phân quyền giao việc</p>
                <p className="mt-0.5">
                  Bạn không có quyền giao nhiệm vụ mới. Vui lòng liên hệ Trưởng đơn vị.
                </p>
              </div>
            </div>
          )}

          {/* Level Toggle / Context */}
          {isManager ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cấp độ nhiệm vụ
                </label>
                <Badge
                  variant="outline"
                  className="text-[11px] font-medium border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                >
                  Giao việc đơn vị - {user.department || "Đơn vị"}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/60 border border-border/60">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="text-xs font-semibold text-foreground">
                    Công việc Đơn vị ({user.department || "Đơn vị"})
                  </span>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  Đã khóa cấp độ
                </Badge>
              </div>
            </div>
          ) : isStaff ? null : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cấp độ nhiệm vụ
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-muted/60 border border-border/60">
                <button
                  type="button"
                  onClick={() => handleLevelChange("TRUONG")}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-all cursor-pointer",
                    formData.level === "TRUONG"
                      ? "bg-card text-foreground shadow-xs border border-border/80 font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Building2 className="size-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Nhiệm vụ cấp Trường</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLevelChange("DON_VI")}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-all cursor-pointer",
                    formData.level === "DON_VI"
                      ? "bg-card text-foreground shadow-xs border border-border/80 font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Users className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Công việc Đơn vị</span>
                </button>
              </div>
            </div>
          )}

          {/* Parent School Task (If Level is DON_VI) */}
          {formData.level === "DON_VI" && schoolTasks.length > 0 && (
            <div className="space-y-1.5">
              <label
                htmlFor="parentTaskId"
                className="text-xs font-semibold text-foreground flex items-center justify-between"
              >
                <span>Thuộc Nhiệm vụ cấp Trường</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  (Tùy chọn)
                </span>
              </label>
              <div className="relative">
                <select
                  id="parentTaskId"
                  value={formData.parentTaskId || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      parentTaskId: e.target.value || undefined,
                    }))
                  }
                  className="w-full h-9 px-3 pr-8 rounded-md border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all appearance-none"
                >
                  <option value="">-- Không liên kết nhiệm vụ cha --</option>
                  {schoolTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.leadAssigneeName})
                    </option>
                  ))}
                </select>
                <ChevronDown className="size-4 text-muted-foreground pointer-events-none absolute right-2.5 top-2.5" />
              </div>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label
              htmlFor="taskTitle"
              className="text-xs font-semibold text-foreground"
            >
              Tiêu đề nhiệm vụ <span className="text-destructive">*</span>
            </label>
            <input
              id="taskTitle"
              type="text"
              placeholder="VD: Triển khai kiểm tra ATTT định kỳ Quý 3..."
              value={formData.title}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, title: e.target.value }));
                if (errors.title) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.title;
                    return next;
                  });
                }
              }}
              className={cn(
                "w-full h-9 px-3 rounded-md border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all",
                errors.title
                  ? "border-destructive focus:border-destructive ring-destructive/10"
                  : "border-border focus:border-ring"
              )}
            />
            {errors.title && (
              <p className="text-[11px] font-medium text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="size-3" />
                {errors.title}
              </p>
            )}
          </div>

          {/* Category & Due Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div className="space-y-1.5">
              <label
                htmlFor="taskCategory"
                className="text-xs font-semibold text-foreground"
              >
                Lĩnh vực công tác
              </label>
              <div className="relative">
                <select
                  id="taskCategory"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      category: e.target.value as TaskCategory,
                    }))
                  }
                  className="w-full h-9 px-3 pr-8 rounded-md border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all appearance-none"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="size-4 text-muted-foreground pointer-events-none absolute right-2.5 top-2.5" />
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <label
                htmlFor="taskDueDate"
                className="text-xs font-semibold text-foreground"
              >
                Hạn hoàn thành <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  id="taskDueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      dueDate: e.target.value,
                    }));
                    if (errors.dueDate) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.dueDate;
                        return next;
                      });
                    }
                  }}
                  className={cn(
                    "w-full h-9 px-3 rounded-md border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all",
                    errors.dueDate
                      ? "border-destructive focus:border-destructive ring-destructive/10"
                      : "border-border focus:border-ring"
                  )}
                />
              </div>
              {/* Quick Due Date Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10.5px] text-muted-foreground font-medium">Nhanh:</span>
                <button
                  type="button"
                  onClick={() => handleQuickPreset(0)}
                  className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-secondary cursor-pointer transition-colors"
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset(3)}
                  className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-secondary cursor-pointer transition-colors"
                >
                  +3 ngày
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset(7)}
                  className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-secondary cursor-pointer transition-colors"
                >
                  +1 tuần
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const base = new Date();
                    const endOfMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0);
                    const dateStr = endOfMonth.toISOString().split("T")[0];
                    setFormData((prev) => ({ ...prev, dueDate: dateStr }));
                    if (errors.dueDate) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.dueDate;
                        return next;
                      });
                    }
                  }}
                  className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-secondary cursor-pointer transition-colors"
                >
                  Cuối tháng
                </button>
              </div>
              {errors.dueDate && (
                <p className="text-[11px] font-medium text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3" />
                  {errors.dueDate}
                </p>
              )}
            </div>
          </div>

          {/* Lead Assignee */}
          <div className="space-y-1.5">
            <label
              htmlFor="leadAssignee"
              className="text-xs font-semibold text-foreground"
            >
              Người chủ trì / Chịu trách nhiệm chính{" "}
              <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <input
                id="leadAssignee"
                type="text"
                placeholder="VD: TS. Trần Hùng (Trưởng TT CNTT & TT)..."
                value={formData.leadAssigneeName}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    leadAssigneeName: e.target.value,
                  }));
                  if (errors.leadAssigneeName) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.leadAssigneeName;
                      return next;
                    });
                  }
                }}
                className={cn(
                  "w-full h-9 pl-9 pr-3 rounded-md border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all",
                  errors.leadAssigneeName
                    ? "border-destructive focus:border-destructive ring-destructive/10"
                    : "border-border focus:border-ring"
                )}
              />
              <User className="size-4 text-muted-foreground pointer-events-none absolute left-3 top-2.5" />
            </div>
            {errors.leadAssigneeName && (
              <p className="text-[11px] font-medium text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="size-3" />
                {errors.leadAssigneeName}
              </p>
            )}
          </div>

          {/* Co-assignees Tag Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Cán bộ phối hợp thực hiện</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                (Tùy chọn)
              </span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Nhập tên cán bộ phối hợp và ấn Thêm..."
                  value={coAssigneeInput}
                  onChange={(e) => setCoAssigneeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCoAssignee();
                    }
                  }}
                  className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
                />
                <Users className="size-4 text-muted-foreground pointer-events-none absolute left-3 top-2.5" />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCoAssignee}
                className="h-9 px-3"
              >
                <Plus className="size-3.5" />
                <span>Thêm</span>
              </Button>
            </div>

            {/* Render Co-assignee Tags */}
            {formData.coAssignees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {formData.coAssignees.map((name) => (
                  <Badge
                    key={name}
                    variant="secondary"
                    className="gap-1 pl-2 pr-1.5 py-0.5 text-xs font-normal"
                  >
                    <span>{name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCoAssignee(name)}
                      className="rounded-full hover:bg-muted p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label
              htmlFor="taskDescription"
              className="text-xs font-semibold text-foreground flex items-center justify-between"
            >
              <span>Yêu cầu chi tiết / Ghi chú</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                (Tùy chọn)
              </span>
            </label>
            <textarea
              id="taskDescription"
              rows={3}
              placeholder="Nhập mục tiêu, kết quả đầu ra mong đợi hoặc hướng dẫn thực hiện..."
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className="w-full p-3 rounded-md border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 text-xs font-medium cursor-pointer"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={isStaff || allowedLevels.length === 0}
              title={
                isStaff
                  ? "Bạn không có quyền giao nhiệm vụ mới. Vui lòng liên hệ Trưởng đơn vị."
                  : undefined
              }
              className={cn(
                "h-9 px-4 text-xs font-medium bg-[#18181B] text-white hover:bg-[#27272A] dark:bg-[#FAFAFA] dark:text-[#18181B] dark:hover:bg-[#E4E4E7] cursor-pointer",
                (isStaff || allowedLevels.length === 0) &&
                  "opacity-50 cursor-not-allowed hover:bg-[#18181B] dark:hover:bg-[#FAFAFA]"
              )}
            >
              <CheckCircle2 className="size-3.5" />
              <span>Tạo nhiệm vụ</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
