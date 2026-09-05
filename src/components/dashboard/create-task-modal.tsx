"use client";

import * as React from "react";
import {
  X,
  User,
  Users,
  Building2,
  Calendar,
  Tag,
  Link2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import type { TaskCategory, SchoolTask } from "@/types/dashboard";
import type { UserRole } from "@/types/auth";
import { useAuth } from "@/lib/auth-context";
import { QCET_PERSONNEL } from "@/lib/mock-dashboard-data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TaskLevel = "TRUONG" | "DON_VI";

export function getAllowedTaskLevelsForRole(role: UserRole): TaskLevel[] {
  if (role === "ADMIN") return ["TRUONG", "DON_VI"];
  if (role === "MANAGER") return ["DON_VI"];
  return [];
}

export function getDefaultTaskLevelForRole(role: UserRole): TaskLevel {
  if (role === "ADMIN") return "TRUONG";
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
    errors.title = "Vui lòng nhập tên công việc";
  }
  if (!data.leadAssigneeName || data.leadAssigneeName.trim().length === 0) {
    errors.leadAssigneeName = "Vui lòng chọn người chủ trì";
  }
  if (!data.dueDate || data.dueDate.trim().length === 0) {
    errors.dueDate = "Vui lòng chọn hạn hoàn thành";
  }
  return errors;
}

export const CATEGORY_OPTIONS: { id: TaskCategory; label: string; color: string }[] = [
  { id: "CHUYEN_DOI_SO", label: "Chuyển đổi số", color: "bg-blue-500" },
  { id: "TRUYEN_THONG", label: "Truyền thông & Tuyển sinh", color: "bg-purple-500" },
  { id: "CNTT", label: "Hạ tầng & CNTT", color: "bg-emerald-500" },
  { id: "ATTT", label: "An toàn thông tin", color: "bg-rose-500" },
  { id: "THU_VIEN", label: "Thư viện & Học liệu", color: "bg-amber-500" },
  { id: "BAO_CAO", label: "Báo cáo & Tổng hợp", color: "bg-cyan-500" },
  { id: "KHAC", label: "Khác", color: "bg-slate-500" },
];

export interface DepartmentPersonnelGroup {
  department: string;
  code: string;
  icon: string;
  members: { name: string; title: string; role: string }[];
}

export const QCET_DEPARTMENT_GROUPS: DepartmentPersonnelGroup[] = [
  {
    department: "Ban Giám hiệu",
    code: "BGH",
    icon: "",
    members: [
      { name: "Nguyễn Minh Tuấn", title: "TS. Nguyễn Minh Tuấn", role: "Hiệu trưởng" },
      { name: "Lê Thành Đạt", title: "ThS. Lê Thành Đạt", role: "Phó Hiệu trưởng" },
      { name: "Hoàng Thị Kim Cúc", title: "ThS. Hoàng Thị Kim Cúc", role: "Phó Hiệu trưởng" },
    ],
  },
  {
    department: "Khoa Công nghệ thông tin",
    code: "CNTT",
    icon: "",
    members: [
      { name: "Nguyễn Ngọc Vinh", title: "TS. Nguyễn Ngọc Vinh", role: "Trưởng khoa (CĐS)" },
      { name: "Trần Hùng", title: "ThS. Trần Hùng", role: "Phó Trưởng khoa (ATTT)" },
      { name: "Phan Đình Khôi", title: "ThS. Phan Đình Khôi", role: "Giảng viên CNTT" },
    ],
  },
  {
    department: "Phòng Đào tạo & Quản lý Khoa học",
    code: "DAO_TAO",
    icon: "",
    members: [
      { name: "Đỗ Quang Trung", title: "ThS. Đỗ Quang Trung", role: "Trưởng phòng" },
      { name: "Võ Minh Trí", title: "ThS. Võ Minh Trí", role: "Phó Trưởng phòng" },
      { name: "Nguyễn Thị Bích Thủy", title: "CN. Nguyễn Thị Bích Thủy", role: "Chuyên viên" },
    ],
  },
  {
    department: "Trung tâm Truyền thông & Số hóa (DCC)",
    code: "TRUYEN_THONG",
    icon: "",
    members: [
      { name: "Mai Đinh Thị Xuân", title: "ThS. Mai Đinh Thị Xuân", role: "Giám đốc TT" },
      { name: "Dương Quang Huy", title: "CN. Dương Quang Huy", role: "Chuyên viên CNTT" },
      { name: "Hoàng Thùy Linh", title: "CN. Hoàng Thùy Linh", role: "Chuyên viên nội dung" },
    ],
  },
  {
    department: "Phòng Hành chính - Quản trị",
    code: "HANH_CHINH",
    icon: "",
    members: [
      { name: "Phan Văn Thanh", title: "ThS. Phan Văn Thanh", role: "Trưởng phòng" },
      { name: "Lê Hoàng Nam", title: "ThS. Lê Hoàng Nam", role: "Phó Trưởng phòng" },
      { name: "Trương Thị Hồng Nhung", title: "CN. Trương Thị Hồng Nhung", role: "Văn thư" },
    ],
  },
  {
    department: "Phòng Khảo thí & Đảm bảo chất lượng",
    code: "KHAO_THI",
    icon: "",
    members: [
      { name: "Nguyễn Công Minh", title: "ThS. Nguyễn Công Minh", role: "Trưởng phòng" },
      { name: "Đặng Văn Hậu", title: "ThS. Đặng Văn Hậu", role: "Phó Trưởng phòng" },
      { name: "Lê Thị Diễm My", title: "ThS. Lê Thị Diễm My", role: "Chuyên viên" },
    ],
  },
  {
    department: "Trung tâm Ngoại ngữ - Tin học & Thư viện",
    code: "THU_VIEN",
    icon: "",
    members: [
      { name: "Chu Đình Thắng", title: "ThS. Chu Đình Thắng", role: "Giám đốc TT" },
      { name: "Phạm Thị Thu", title: "CN. Phạm Thị Thu", role: "Phụ trách Thư viện" },
      { name: "Trần Bảo Ngọc", title: "ThS. Trần Bảo Ngọc", role: "Giảng viên" },
    ],
  },
  {
    department: "Khoa Kinh tế - Quản trị",
    code: "KINH_TE",
    icon: "",
    members: [
      { name: "Lê Thị Ánh Tuyết", title: "ThS. Lê Thị Ánh Tuyết", role: "Trưởng khoa" },
      { name: "Đỗ Hoàng Sơn", title: "ThS. Đỗ Hoàng Sơn", role: "Phó Trưởng khoa" },
      { name: "Nguyễn Hồng Phượng", title: "ThS. Nguyễn Hồng Phượng", role: "Giảng viên" },
    ],
  },
  {
    department: "Khoa Kỹ thuật - Công nghệ",
    code: "KY_THUAT",
    icon: "",
    members: [
      { name: "Đinh Quốc Cường", title: "TS. Đinh Quốc Cường", role: "Trưởng khoa" },
      { name: "Vũ Mạnh Hùng", title: "ThS. Vũ Mạnh Hùng", role: "Phó Trưởng khoa" },
      { name: "Trần Bá Lộc", title: "ThS. Trần Bá Lộc", role: "Giảng viên" },
    ],
  },
  {
    department: "Phòng Kế hoạch - Tài chính",
    code: "TAI_CHINH",
    icon: "",
    members: [
      { name: "Trần Thị Mai Loan", title: "ThS. Trần Thị Mai Loan", role: "Trưởng ph��ng" },
      { name: "Hà Thanh Vân", title: "ThS. Hà Thanh Vân", role: "Kế toán trưởng" },
      { name: "Bùi Văn Hào", title: "CN. Bùi Văn Hào", role: "Kế toán viên" },
    ],
  },
  {
    department: "Phòng Công tác học sinh sinh viên",
    code: "CTHSSV",
    icon: "",
    members: [
      { name: "Huỳnh Công Tuấn", title: "ThS. Huỳnh Công Tuấn", role: "Trưởng phòng" },
      { name: "Nguyễn Thị Thanh Hà", title: "ThS. Nguyễn Thị Thanh Hà", role: "Phó Trưởng phòng" },
      { name: "Lâm Vĩnh Phúc", title: "CN. Lâm Vĩnh Phúc", role: "Chuyên viên" },
    ],
  },
];

export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTaskFormData) => void;
  schoolTasks?: SchoolTask[];
  initialLevel?: TaskLevel;
  initialParentTaskId?: string;
  initialDueDate?: string;
  initialLeadAssigneeName?: string;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onSubmit,
  schoolTasks = [],
  initialLevel = "TRUONG",
  initialParentTaskId,
  initialDueDate,
  initialLeadAssigneeName,
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
    leadAssigneeName: initialLeadAssigneeName || "",
  }));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isCustomAssignee, setIsCustomAssignee] = React.useState(false);
  const [deptFilter, setDeptFilter] = React.useState<string>("ALL");
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  // Filter department groups based on deptFilter
  const filteredGroups = React.useMemo(() => {
    if (deptFilter === "ALL") return QCET_DEPARTMENT_GROUPS;
    return QCET_DEPARTMENT_GROUPS.filter((g) => g.code === deptFilter);
  }, [deptFilter]);

  // Sync state on open
  const prevIsOpen = React.useRef(false);
  React.useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      const effectiveLevel = isManager
        ? "DON_VI"
        : allowedLevels.includes(initialLevel)
        ? initialLevel
        : getDefaultTaskLevelForRole(user?.role ?? "ADMIN");

      setFormData({
        ...getInitialTaskFormData(effectiveLevel),
        parentTaskId: initialParentTaskId,
        dueDate: initialDueDate || "",
        leadAssigneeName: initialLeadAssigneeName || "",
      });
      setErrors({});
      setIsCustomAssignee(false);
      setDeptFilter("ALL");
      setTimeout(() => titleInputRef.current?.focus(), 80);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, initialLevel, initialParentTaskId, initialDueDate, initialLeadAssigneeName, isManager, allowedLevels, user?.role]);

  // Body scroll lock when drawer is open
  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Keyboard shortcuts: ESC to close, Ctrl+Enter or Cmd+Enter to submit
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit(e as unknown as React.FormEvent);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, formData, isStaff, allowedLevels]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isStaff || allowedLevels.length === 0) return;
    const validationErrors = validateTaskForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSubmit(formData);
    onClose();
  };

  const handleDatePreset = (days: number) => {
    const base = new Date();
    let dateStr: string;
    if (days === -1) {
      const endOfMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      dateStr = endOfMonth.toISOString().split("T")[0];
    } else {
      base.setDate(base.getDate() + days);
      dateStr = base.toISOString().split("T")[0];
    }
    setFormData((prev) => ({ ...prev, dueDate: dateStr }));
    if (errors.dueDate) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.dueDate;
        return next;
      });
    }
  };

  const clearError = (field: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const activeCategory = CATEGORY_OPTIONS.find((c) => c.id === formData.category);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel - Right Side Full Height */}
      <aside
        className="fixed inset-y-0 right-0 z-50 flex h-full w-full sm:max-w-xl md:max-w-2xl flex-col border-l border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl animate-in slide-in-from-right duration-300 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Top Header Bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-border/50 bg-card/90 backdrop-blur-xl gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="size-3.5" strokeWidth={1.5} />
            </span>
            <div>
              <span id="modal-title" className="text-xs font-bold uppercase tracking-wider text-foreground font-heading">
                {isManager
                  ? `Giao việc — ${user?.department || "Đơn vị"}`
                  : "Giao nhiệm vụ mới"}
              </span>
              <p className="text-[11px] text-muted-foreground font-medium">
                {formData.level === "TRUONG"
                  ? "Nhiệm vụ trọng tâm toàn trường"
                  : "Công việc phân công nội bộ đơn vị"}
              </p>
            </div>
          </div>

          {/* Right: Level Switcher Pill (BGH only) or Close */}
          <div className="flex items-center gap-2">
            {!isManager && !isStaff && (
              <div className="inline-flex rounded-lg bg-muted/70 p-0.5 border border-border/60 text-[11px]">
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, level: "TRUONG", parentTaskId: undefined }))}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer active:scale-95",
                    formData.level === "TRUONG"
                      ? "bg-card text-foreground font-semibold shadow-xs border border-border/50"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Building2 className="size-3 text-muted-foreground" strokeWidth={1.5} />
                  Cấp Trường
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, level: "DON_VI" }))}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer active:scale-95",
                    formData.level === "DON_VI"
                      ? "bg-card text-foreground font-semibold shadow-xs border border-border/50"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Users className="size-3 text-muted-foreground" strokeWidth={1.5} />
                  Cấp Đơn vị
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {/* Permission warning for STAFF */}
            {isStaff && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertCircle className="size-4 shrink-0 text-amber-600" strokeWidth={1.5} />
                <span>Chuyên viên không có quyền giao nhiệm vụ. Vui lòng liên hệ Trưởng đơn vị.</span>
              </div>
            )}

            {/* 1. Title Input (Large, Prominent, Auto-focused) */}
            <div className="space-y-1">
              <input
                ref={titleInputRef}
                type="text"
                placeholder="Tiêu đề nhiệm vụ cần giao..."
                value={formData.title}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, title: e.target.value }));
                  if (errors.title) clearError("title");
                }}
                className={cn(
                  "w-full bg-transparent text-base sm:text-lg font-bold text-foreground placeholder:text-muted-foreground/40 placeholder:font-normal focus:outline-none transition-all",
                  errors.title && "text-destructive"
                )}
              />
              {errors.title && (
                <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                  <AlertCircle className="size-3" strokeWidth={1.5} />
                  {errors.title}
                </p>
              )}
            </div>

            {/* 2. Description Textarea (Subtle, Clean) */}
            <div>
              <textarea
                rows={3}
                placeholder="Yêu cầu chi tiết, kết quả mong đợi, hoặc ghi chú thực hiện (tùy chọn)..."
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none resize-none leading-relaxed"
              />
            </div>

            {/* 3. Metadata Property Panel (Linear / Raycast Styled Card) */}
            <div className="rounded-xl border border-border/60 bg-muted/40 p-3.5 space-y-3">
              {/* Row A: Người chủ trì (Lead Assignee) */}
              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                    <User className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                    Người chủ trì <span className="text-destructive">*</span>
                  </span>
                  {/* Quick Department Filter to narrow down within 300 staff */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10.5px] text-muted-foreground">Khoa/Phòng:</span>
                    <select
                      aria-label="Lọc nhanh theo đơn vị"
                      value={deptFilter}
                      onChange={(e) => setDeptFilter(e.target.value)}
                      className="h-6 rounded-md border border-border/60 bg-background px-1.5 py-0 text-[11px] font-medium text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="ALL">Toàn trường (11 đơn vị)</option>
                      {QCET_DEPARTMENT_GROUPS.map((g) => (
                        <option key={g.code} value={g.code}>
                          {g.department}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isCustomAssignee ? (
                    <div className="relative flex-1">
                      <select
                        value={formData.leadAssigneeName}
                        onChange={(e) => {
                          if (e.target.value === "__CUSTOM__") {
                            setIsCustomAssignee(true);
                            setFormData((p) => ({ ...p, leadAssigneeName: "" }));
                          } else {
                            setFormData((p) => ({ ...p, leadAssigneeName: e.target.value }));
                          }
                          if (errors.leadAssigneeName) clearError("leadAssigneeName");
                        }}
                        className={cn(
                          "w-full h-8.5 pl-2.5 pr-7 rounded-lg border bg-card text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer truncate",
                          errors.leadAssigneeName ? "border-destructive ring-1 ring-destructive/30" : "border-border/70"
                        )}
                      >
                        <option value="">-- Chọn cán bộ chủ trì (Họ tên & Chức vụ) --</option>
                        {filteredGroups.map((group) => (
                          <optgroup key={group.code} label={group.department}>
                            {group.members.map((member) => (
                              <option key={member.name} value={member.name}>
                                {member.title} — {member.role}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        <option value="__CUSTOM__">+ Nhập cán bộ khác ngoài danh mục...</option>
                      </select>
                      <ChevronDown className="size-3.5 text-muted-foreground pointer-events-none absolute right-2.5 top-2.5" strokeWidth={1.5} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        placeholder="Họ và tên cán bộ (VD: Nguyễn Văn Tuấn)..."
                        value={formData.leadAssigneeName}
                        onChange={(e) => {
                          setFormData((p) => ({ ...p, leadAssigneeName: e.target.value }));
                          if (errors.leadAssigneeName) clearError("leadAssigneeName");
                        }}
                        className="w-full h-8.5 px-2.5 rounded-lg border border-border/70 bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomAssignee(false);
                          setFormData((p) => ({ ...p, leadAssigneeName: "" }));
                        }}
                        className="text-[11px] font-medium text-muted-foreground hover:text-foreground shrink-0 underline"
                      >
                        Chọn từ danh mục
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Row B: Lĩnh vực công tác (Category) */}
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground font-semibold shrink-0 min-w-[110px]">
                  <Tag className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                  Lĩnh vực
                </span>

                <div className="relative flex-1 sm:max-w-[280px]">
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value as TaskCategory }))}
                    className="w-full h-8 pl-2.5 pr-7 rounded-lg border border-border/70 bg-card text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer truncate"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="size-3.5 text-muted-foreground pointer-events-none absolute right-2 top-2.5" strokeWidth={1.5} />
                </div>
              </div>

              {/* Row C: Hạn hoàn thành (Due Date + Quick Presets) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground font-semibold shrink-0 min-w-[110px]">
                  <Calendar className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                  Hạn chót <span className="text-destructive">*</span>
                </span>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end flex-1 font-mono tabular-nums">
                  {/* Date Input */}
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => {
                      setFormData((p) => ({ ...p, dueDate: e.target.value }));
                      if (errors.dueDate) clearError("dueDate");
                    }}
                    className={cn(
                      "h-8 px-2 rounded-lg border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono tabular-nums",
                      errors.dueDate ? "border-destructive ring-1 ring-destructive/30" : "border-border/70"
                    )}
                  />

                  {/* Inline Quick Presets */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDatePreset(0)}
                      className="rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[10.5px] font-medium text-foreground hover:bg-secondary hover:border-border cursor-pointer transition-all active:scale-95"
                    >
                      Hôm nay
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDatePreset(3)}
                      className="rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[10.5px] font-medium text-foreground hover:bg-secondary hover:border-border cursor-pointer transition-all active:scale-95"
                    >
                      +3 ngày
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDatePreset(7)}
                      className="rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[10.5px] font-medium text-foreground hover:bg-secondary hover:border-border cursor-pointer transition-all active:scale-95"
                    >
                      +1 tuần
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDatePreset(-1)}
                      className="rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[10.5px] font-medium text-foreground hover:bg-secondary hover:border-border cursor-pointer transition-all active:scale-95"
                    >
                      Cuối tháng
                    </button>
                  </div>
                </div>
              </div>

              {/* Row D: Thuộc nhiệm vụ cấp Trường (nếu là việc Đơn vị) */}
              {formData.level === "DON_VI" && schoolTasks.length > 0 && (
                <div className="flex items-center justify-between gap-3 text-xs pt-1 border-t border-border/40">
                  <span className="flex items-center gap-1.5 text-muted-foreground font-semibold shrink-0 min-w-[110px]">
                    <Link2 className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                    Nhiệm vụ cha
                  </span>

                  <div className="relative flex-1 sm:max-w-[280px]">
                    <select
                      value={formData.parentTaskId || ""}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, parentTaskId: e.target.value || undefined }))
                      }
                      className="w-full h-8 pl-2.5 pr-7 rounded-lg border border-border/70 bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer truncate"
                    >
                      <option value="">— Độc lập (Không liên kết) —</option>
                      {schoolTasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="size-3.5 text-muted-foreground pointer-events-none absolute right-2 top-2.5" strokeWidth={1.5} />
                  </div>
                </div>
              )}
            </div>

            {/* Validation Errors Summary (if any) */}
            {(errors.leadAssigneeName || errors.dueDate) && (
              <div className="text-[11px] text-destructive space-y-0.5">
                {errors.leadAssigneeName && <p>• {errors.leadAssigneeName}</p>}
                {errors.dueDate && <p>• {errors.dueDate}</p>}
              </div>
            )}
          </div>

          {/* Sticky Bottom Actions Bar */}
          <div className="sticky bottom-0 z-10 flex items-center justify-between px-5 sm:px-6 py-3.5 border-t border-border/50 bg-card/95 backdrop-blur-md shrink-0">
            {/* Keyboard hint */}
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <kbd className="rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold">
                Ctrl
              </kbd>
              <span>+</span>
              <kbd className="rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold">
                Enter
              </kbd>
              <span className="ml-0.5">để giao việc</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="h-8.5 rounded-xl px-3.5 text-xs font-medium cursor-pointer active:scale-95 transition-all"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isStaff || allowedLevels.length === 0}
                className={cn(
                  "h-8.5 rounded-xl px-4 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5",
                  (isStaff || allowedLevels.length === 0) && "opacity-50 cursor-not-allowed"
                )}
              >
                <CheckCircle2 className="size-3.5" strokeWidth={1.5} />
                <span>Giao việc</span>
              </Button>
            </div>
          </div>
        </form>
      </aside>
    </>
  );
}
