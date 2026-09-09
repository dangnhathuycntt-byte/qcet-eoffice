"use client";

import * as React from "react";
import { createPortal } from "react-dom";
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
  Briefcase,
  FileCheck,
  Clock,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import type { TaskCategory, SchoolTask } from "@/types/dashboard";
import type { UserRole, AuthUser } from "@/types/auth";
import { useAuth } from "@/lib/auth-context";
import { canAssignStaffTask, validateDueDate } from "@/lib/dacum-workflow-engine";
import {
  type DepartmentPersonnelGroup,
  QCET_DEPARTMENT_GROUPS,
  getDepartmentForMember,
} from "@/lib/departments";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TaskLevel = "TRUONG" | "DON_VI";

export function getAllowedTaskLevelsForRole(role: UserRole): TaskLevel[] {
  if (role === "ADMIN") return ["TRUONG", "DON_VI"];
  if (role === "MANAGER") return ["DON_VI"];
  if (role === "STAFF") return [];
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
  internalDueDate?: string;
  description: string;
  parentTaskId?: string;
  requiredDeliverables?: string;
  vtvlRole?: string;
  isBypassWarning?: boolean;
  requiresReview?: boolean;
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
    internalDueDate: "",
    description: "",
    parentTaskId: undefined,
    requiredDeliverables: "",
    vtvlRole: "",
    isBypassWarning: false,
    requiresReview: false,
  };
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

export interface ApiPersonnel {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId: string | null;
  department: { id: string; name: string; shortName: string | null } | null;
  title: string | null;
  avatarUrl: string | null;
}

export {
  type DepartmentPersonnelGroup,
  QCET_DEPARTMENT_GROUPS,
  getDepartmentForMember,
};

export function canRoleSelectAssignee(
  user: AuthUser,
  targetDeptCode: string,
  isEmergencyBypass?: boolean,
  targetUserName?: string
): { allowed: boolean; message?: string; isBypassWarning?: boolean } {
  // Staff cannot assign tasks to others
  if (user.role === "STAFF") {
    if (
      targetUserName &&
      user.name &&
      targetUserName.trim().toLowerCase() === user.name.trim().toLowerCase()
    ) {
      return { allowed: true };
    }
    return {
      allowed: false,
      message: "Giảng viên / Nhân sự không có thẩm quyền giao việc cho người khác.",
    };
  }

  const isDirectToOtherDept =
    user.role === "ADMIN" &&
    targetDeptCode !== "BGH" &&
    targetDeptCode !== user.departmentCode;
  const bypass = isEmergencyBypass ?? isDirectToOtherDept;
  const result = canAssignStaffTask(user, targetDeptCode, bypass, targetUserName);
  return {
    allowed: result.allowed,
    message: result.reason,
    isBypassWarning: result.isBypassWarning,
  };
}

export function formatDetailDateDisplay(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const clean = dateStr.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function validateSubtaskDueDate(
  parentDueDate: string,
  subtaskDueDate: string
): boolean {
  if (!parentDueDate || !subtaskDueDate) return true;
  const parentTime = new Date(parentDueDate).getTime();
  const subtaskTime = new Date(subtaskDueDate).getTime();
  if (Number.isNaN(parentTime) || Number.isNaN(subtaskTime)) return false;
  return subtaskTime <= parentTime;
}

export function validateSubtaskAssignment(
  leadAssigneeId: string,
  collaboratorIds: string[] = []
): { valid: boolean; error?: string } {
  if (!leadAssigneeId || leadAssigneeId.trim().length === 0) {
    return {
      valid: false,
      error: "Nhiệm vụ bắt buộc phải có đúng 1 Người phụ trách chính (Single DRI).",
    };
  }
  const trimmedLead = leadAssigneeId.trim().toLowerCase();
  const hasDuplicate = collaboratorIds.some(
    (cId) => cId && cId.trim().toLowerCase() === trimmedLead
  );
  if (hasDuplicate) {
    return {
      valid: false,
      error: "Người phụ trách chính không thể đồng thời là cán bộ phối hợp thực hiện.",
    };
  }
  return { valid: true };
}

export function validateTaskForm(
  data: CreateTaskFormData,
  parentSchoolTask?: SchoolTask,
  currentUser?: AuthUser,
  explicitParentDueDate?: string
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.title || data.title.trim().length === 0) {
    errors.title = "Vui lòng nhập tên công việc";
  }
  if (!data.leadAssigneeName || data.leadAssigneeName.trim().length === 0) {
    errors.leadAssigneeName = "Vui lòng chọn người thực hiện";
  } else if (currentUser) {
    if (currentUser.role === "STAFF") {
      const isSelf = data.leadAssigneeName.trim().toLowerCase() === currentUser.name.trim().toLowerCase();
      if (!isSelf) {
        errors.leadAssigneeName = "Giảng viên / Nhân sự chỉ có thể tự tạo công việc cho chính mình.";
      }
    } else {
      const dept = getDepartmentForMember(data.leadAssigneeName);
      if (dept) {
        const check = canRoleSelectAssignee(currentUser, dept.code, false, data.leadAssigneeName);
        if (!check.allowed) {
          errors.leadAssigneeName =
            check.message || "Không có thẩm quyền phân công cho nhân sự này";
        }
      }
    }
  }

  // Single DRI & collaborator validation
  if (data.leadAssigneeName && data.coAssignees && data.coAssignees.length > 0) {
    const assignCheck = validateSubtaskAssignment(data.leadAssigneeName, data.coAssignees);
    if (!assignCheck.valid && assignCheck.error) {
      errors.coAssignees = assignCheck.error;
    }
  }

  if (!data.dueDate || data.dueDate.trim().length === 0) {
    errors.dueDate = "Vui lòng chọn hạn hoàn thành";
  }
  if (
    data.level === "DON_VI" &&
    data.requiresReview &&
    (!data.requiredDeliverables || data.requiredDeliverables.trim().length === 0)
  ) {
    errors.requiredDeliverables =
      "Sản phẩm đầu ra đo lường được bắt buộc đối với nhiệm vụ cấp đơn vị yêu cầu nghiệm thu (theo Nghị định 232/DACUM).";
  }
  if (data.internalDueDate && data.dueDate) {
    if (new Date(data.internalDueDate).getTime() > new Date(data.dueDate).getTime()) {
      errors.internalDueDate =
        "Hạn chót nội bộ cấp 1 không được muộn hơn hạn chót hoàn thành của nhiệm vụ.";
    }
  }

  const effectiveParentDueDate = explicitParentDueDate || parentSchoolTask?.dueDate;
  if (effectiveParentDueDate) {
    const formattedDate = formatDetailDateDisplay(effectiveParentDueDate);
    if (data.internalDueDate) {
      if (!validateSubtaskDueDate(effectiveParentDueDate, data.internalDueDate)) {
        errors.internalDueDate = `Hạn chót nội bộ không được muộn hơn hạn chót nhiệm vụ cha (${formattedDate}) (không được vượt quá hạn chót của Nhiệm vụ cấp Trường).`;
      }
    }
    if (data.dueDate) {
      if (!validateSubtaskDueDate(effectiveParentDueDate, data.dueDate)) {
        errors.dueDate = `Hạn chót của nhiệm vụ con không được muộn hơn hạn chót nhiệm vụ cha (${formattedDate}) (không được vượt quá hạn chót của Nhiệm vụ cấp Trường).`;
      }
    }
  }
  return errors;
}

export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTaskFormData) => void;
  onOpenCollaborationRequest?: (targetDeptCode?: string) => void;
  schoolTasks?: SchoolTask[];
  initialLevel?: TaskLevel;
  initialParentTaskId?: string;
  initialParentTaskTitle?: string;
  initialParentTaskDueDate?: string;
  initialDueDate?: string;
  initialLeadAssigneeName?: string;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onSubmit,
  onOpenCollaborationRequest,
  schoolTasks = [],
  initialLevel = "TRUONG",
  initialParentTaskId,
  initialParentTaskTitle,
  initialParentTaskDueDate,
  initialDueDate,
  initialLeadAssigneeName,
}: CreateTaskModalProps) {
  const { user } = useAuth();
  const allowedLevels = getAllowedTaskLevelsForRole(user?.role ?? "ADMIN");
  const isStaff = user?.role === "STAFF";
  const isManager = user?.role === "MANAGER";
  const isSubtaskMode = Boolean(initialParentTaskId);

  const getEffectiveLevel = React.useCallback(
    (requestedLevel: TaskLevel): TaskLevel => {
      if (initialParentTaskId || isManager || isStaff) return "DON_VI";
      if (allowedLevels.includes(requestedLevel)) return requestedLevel;
      return getDefaultTaskLevelForRole(user?.role ?? "ADMIN");
    },
    [initialParentTaskId, isManager, isStaff, allowedLevels, user?.role]
  );

  const [formData, setFormData] = React.useState<CreateTaskFormData>(() => ({
    ...getInitialTaskFormData(getEffectiveLevel(initialLevel)),
    parentTaskId: initialParentTaskId,
    dueDate: initialDueDate || "",
    leadAssigneeName: initialLeadAssigneeName || (isStaff ? (user?.name || "") : ""),
    vtvlRole: isStaff ? (user?.roleLabel || "Giảng viên") : "",
  }));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isCustomAssignee, setIsCustomAssignee] = React.useState(false);
  const [deptFilter, setDeptFilter] = React.useState<string>("ALL");
  const [mounted, setMounted] = React.useState(false);
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  const [personnelList, setPersonnelList] = React.useState<ApiPersonnel[]>([]);

  React.useEffect(() => {
    setMounted(true);
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.users)) {
          setPersonnelList(data.users);
        }
      })
      .catch((err) => console.error("Error loading assignees:", err));
  }, []);

  const departmentGroups = React.useMemo<DepartmentPersonnelGroup[]>(() => {
    if (personnelList.length === 0) {
      return QCET_DEPARTMENT_GROUPS;
    }
    const groupMap = new Map<string, DepartmentPersonnelGroup>();
    for (const p of personnelList) {
      const deptName = p.department?.name || "Đơn vị khác";
      const deptCode = p.department?.shortName || p.departmentId || "KHAC";
      if (!groupMap.has(deptCode)) {
        groupMap.set(deptCode, {
          id: deptCode.toLowerCase(),
          name: deptName,
          department: deptName,
          code: deptCode,
          icon: "",
          personnel: [],
          members: [],
        });
      }
      const grp = groupMap.get(deptCode)!;
      grp.members.push({
        name: p.name,
        title: p.title || p.name,
        role: p.role,
      });
      grp.personnel.push({
        name: p.name,
        title: p.title || p.name,
        role: p.role,
      });
    }
    return Array.from(groupMap.values());
  }, [personnelList]);

  // Filter department groups based on deptFilter
  const filteredGroups = React.useMemo(() => {
    if (deptFilter === "ALL") return departmentGroups;
    return departmentGroups.filter((g) => g.code === deptFilter);
  }, [deptFilter, departmentGroups]);

  // Selected assignee department & delegation checks
  const selectedAssigneeDept = React.useMemo(() => {
    if (personnelList.length > 0) {
      const p = personnelList.find(
        (u) => u.name.trim().toLowerCase() === formData.leadAssigneeName.trim().toLowerCase()
      );
      if (p && p.department) {
        return {
          department: p.department.name,
          code: p.department.shortName || p.departmentId || "KHAC",
          icon: "",
          members: [],
        };
      }
    }
    return getDepartmentForMember(formData.leadAssigneeName);
  }, [personnelList, formData.leadAssigneeName]);

  const isExternalDeptBlocked = React.useMemo(() => {
    if (isStaff) {
      if (!formData.leadAssigneeName || !user?.name) return false;
      return formData.leadAssigneeName.trim().toLowerCase() !== user.name.trim().toLowerCase();
    }
    if (!isManager || !selectedAssigneeDept || !user) return false;
    return selectedAssigneeDept.code !== user.departmentCode;
  }, [isStaff, isManager, selectedAssigneeDept, user, formData.leadAssigneeName]);

  const isAdminBypassActive = React.useMemo(() => {
    if (user?.role !== "ADMIN" || !selectedAssigneeDept) return false;
    return selectedAssigneeDept.code !== "BGH";
  }, [user?.role, selectedAssigneeDept]);

  const handleAssigneeSelect = React.useCallback(
    (assigneeName: string) => {
      let targetDeptCode: string | undefined;
      let autoVtvl = formData.vtvlRole;

      if (personnelList.length > 0) {
        const p = personnelList.find(
          (u) => u.name.trim().toLowerCase() === assigneeName.trim().toLowerCase()
        );
        if (p) {
          targetDeptCode = p.department?.shortName || p.departmentId || undefined;
          if (!formData.vtvlRole || formData.vtvlRole.trim().length === 0) {
            autoVtvl = p.title || p.role;
          }
        }
      }

      if (!targetDeptCode) {
        const targetDept = getDepartmentForMember(assigneeName);
        if (targetDept) {
          targetDeptCode = targetDept.code;
          const member = targetDept.members.find((m) => m.name === assigneeName);
          if (member && (!formData.vtvlRole || formData.vtvlRole.trim().length === 0)) {
            autoVtvl = member.role;
          }
        }
      }

      const isAdminBypass =
        user?.role === "ADMIN" &&
        targetDeptCode !== undefined &&
        targetDeptCode !== "BGH";

      setFormData((prev) => ({
        ...prev,
        leadAssigneeName: assigneeName,
        vtvlRole: autoVtvl,
        isBypassWarning: isAdminBypass,
      }));

      if (errors.leadAssigneeName) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.leadAssigneeName;
          return next;
        });
      }
    },
    [personnelList, formData.vtvlRole, user?.role, errors.leadAssigneeName]
  );

  // Sync state on open
  const prevIsOpen = React.useRef(false);
  const parentTask = React.useMemo(() => {
    return schoolTasks.find((t) => t.id === (formData.parentTaskId || initialParentTaskId));
  }, [schoolTasks, formData.parentTaskId, initialParentTaskId]);

  const effectiveParentTitle = initialParentTaskTitle || parentTask?.title;
  const effectiveParentDueDate = initialParentTaskDueDate || parentTask?.dueDate;

  React.useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      const effectiveLevel = getEffectiveLevel(initialLevel);

      setFormData({
        ...getInitialTaskFormData(effectiveLevel),
        parentTaskId: initialParentTaskId,
        dueDate: initialDueDate || "",
        leadAssigneeName: initialLeadAssigneeName || (isStaff ? (user?.name || "") : ""),
        vtvlRole: isStaff ? (user?.roleLabel || "Giảng viên") : "",
      });
      setErrors({});
      setIsCustomAssignee(false);
      setDeptFilter("ALL");
      setTimeout(() => titleInputRef.current?.focus(), 80);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, initialLevel, initialParentTaskId, initialDueDate, initialLeadAssigneeName, isStaff, getEffectiveLevel, user?.name, user?.roleLabel]);

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
  }, [isOpen, formData, isStaff, allowedLevels, isExternalDeptBlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (allowedLevels.length === 0 || isExternalDeptBlocked) return;

    const validationErrors = validateTaskForm(
      formData,
      parentTask,
      user || undefined,
      effectiveParentDueDate
    );

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    let targetDeptCode: string | undefined;
    if (personnelList.length > 0) {
      const p = personnelList.find(
        (u) => u.name.trim().toLowerCase() === formData.leadAssigneeName.trim().toLowerCase()
      );
      if (p) {
        targetDeptCode = p.department?.shortName || p.departmentId || undefined;
      }
    }
    if (!targetDeptCode) {
      const targetDept = getDepartmentForMember(formData.leadAssigneeName);
      if (targetDept) {
        targetDeptCode = targetDept.code;
      }
    }

    const isAdminBypass =
      user?.role === "ADMIN" &&
      targetDeptCode !== undefined &&
      targetDeptCode !== "BGH";

    const cleanCollaborators = (formData.coAssignees || []).filter(
      (name) => name && name.trim().toLowerCase() !== formData.leadAssigneeName.trim().toLowerCase()
    );

    onSubmit({
      ...formData,
      parentTaskId: formData.parentTaskId || initialParentTaskId,
      leadAssigneeName: formData.leadAssigneeName,
      coAssignees: cleanCollaborators,
      isBypassWarning: formData.isBypassWarning || isAdminBypass,
    });
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
    if (effectiveParentDueDate) {
      const pDate = effectiveParentDueDate.split("T")[0];
      if (dateStr > pDate) {
        dateStr = pDate;
      }
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

  if (!isOpen) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200 !m-0"
    >
      {/* Full-screen Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity !m-0"
        aria-hidden="true"
      />

      {/* Centered Modal Card Container */}
      <div
        className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border/70 bg-card/98 backdrop-blur-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-border/50 bg-card/90 backdrop-blur-xl gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="size-3.5" strokeWidth={1.5} />
            </span>
            <div>
              <span id="modal-title" className="text-xs font-bold uppercase tracking-wider text-foreground font-heading">
                {isStaff
                  ? "Tạo việc mới (Cá nhân)"
                  : isManager
                  ? `Tạo việc / Phân công — ${user?.department || "Đơn vị"}`
                  : "Tạo việc & Giao nhiệm vụ"}
              </span>
              <p className="text-xs text-muted-foreground font-medium">
                {isStaff
                  ? "Tự lên kế hoạch và theo dõi tiến độ công việc cá nhân"
                  : formData.level === "TRUONG"
                  ? "Nhiệm vụ trọng tâm toàn trường"
                  : "Công việc phân công nội bộ đơn vị hoặc cá nhân"}
              </p>
            </div>
          </div>

          {/* Right: Level Switcher Pill (BGH only) or Subtask locked badge or Close */}
          <div className="flex items-center gap-2">
            {isSubtaskMode ? (
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-muted/80 px-2.5 py-1 border border-border/60 text-xs font-semibold text-primary">
                <Users className="size-3 text-primary" strokeWidth={1.5} />
                <span>Nhiệm vụ con (Cấp Đơn vị)</span>
              </div>
            ) : !isManager && !isStaff ? (
              <div className="inline-flex rounded-lg bg-muted/70 p-0.5 border border-border/60 text-xs">
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
            ) : null}

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
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 thin-scrollbar">
            {/* Informational Subtask Decomposition Banner */}
            {isSubtaskMode && (
              <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
                <Link2 className="size-4 text-primary shrink-0 mt-0.5" strokeWidth={1.5} />
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary">Nhiệm vụ cha (Khóa liên kết):</span>
                    {(parentTask?.code || parentTask?.taskCode) && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary font-mono">
                        {parentTask?.code || parentTask?.taskCode}
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-foreground truncate">
                    {effectiveParentTitle || initialParentTaskId}
                  </p>
                  {effectiveParentDueDate && (
                    <p className="text-xs text-muted-foreground">
                      Hạn chót nhiệm vụ cha: <span className="font-semibold text-foreground">{formatDetailDateDisplay(effectiveParentDueDate)}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Informational Mode Banner for STAFF */}
            {isStaff && (
              <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs text-primary">
                <CheckCircle2 className="size-4 shrink-0 text-primary" strokeWidth={1.5} />
                <span>
                  Chế độ tạo việc cá nhân: Công việc sẽ được gán cho chính bạn (<strong>{user?.name || "Giảng viên"}</strong>) để chủ động lập kế hoạch và báo cáo tiến độ.
                </span>
              </div>
            )}

            {/* 1. Title Input (Large, Prominent, Auto-focused) */}
            <div className="space-y-1">
              <label htmlFor="task-title-input" className="sr-only">
                {isStaff ? "Tên công việc hoặc kế hoạch cá nhân" : "Tiêu đề nhiệm vụ cần tạo hoặc giao"}
              </label>
              <input
                id="task-title-input"
                ref={titleInputRef}
                type="text"
                placeholder={isStaff ? "Tên công việc hoặc kế hoạch cá nhân..." : "Tiêu đề nhiệm vụ cần tạo / giao..."}
                value={formData.title}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, title: e.target.value }));
                  if (errors.title) clearError("title");
                }}
                className={cn(
                  "w-full bg-transparent text-base sm:text-lg font-bold text-foreground placeholder:text-muted-foreground/75 placeholder:font-normal focus:outline-none transition-all",
                  errors.title && "text-destructive"
                )}
              />
              {errors.title && (
                <p className="text-xs font-medium text-destructive flex items-center gap-1">
                  <AlertCircle className="size-3" strokeWidth={1.5} />
                  {errors.title}
                </p>
              )}
            </div>

            {/* 2. Description Textarea (Subtle, Clean) */}
            <div>
              <label htmlFor="task-description-input" className="sr-only">
                Yêu cầu chi tiết hoặc mô tả nhiệm vụ
              </label>
              <textarea
                id="task-description-input"
                rows={3}
                placeholder="Yêu cầu chi tiết, kết quả mong đợi, hoặc ghi chú thực hiện (tùy chọn)..."
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/75 focus:outline-none resize-none leading-relaxed"
              />
            </div>

            {/* 3. Metadata Property Panel (Linear / Raycast Styled Card) */}
            <div className="rounded-xl border border-border/60 bg-muted/40 p-3.5 space-y-3">
              {/* Row A: Người phụ trách chính (Lead Assignee - Single DRI) */}
              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                    <User className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                    Người phụ trách chính (Chịu trách nhiệm toàn diện - Single DRI) <span className="text-destructive">*</span>
                  </span>
                  {/* Quick Department Filter to narrow down within 300 staff */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Khoa/Phòng:</span>
                    <select
                      aria-label="Lọc nhanh theo đơn vị"
                      value={deptFilter}
                      onChange={(e) => setDeptFilter(e.target.value)}
                      className="h-6 rounded-md border border-border/60 bg-background px-1.5 py-0 text-xs font-medium text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="ALL">Toàn trường ({departmentGroups.length} đơn vị)</option>
                      {departmentGroups.map((g) => (
                        <option key={g.code} value={g.code}>
                          {g.department}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isStaff ? (
                    <div className="flex-1 h-8.5 px-3 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between text-xs font-semibold text-primary">
                      <span>{user?.name || "Bạn"} (Chính bạn — {user?.roleLabel || "Giảng viên"})</span>
                      <span className="text-xs text-muted-foreground font-normal">Tự thực hiện</span>
                    </div>
                  ) : !isCustomAssignee ? (
                    <div className="relative flex-1">
                      <select
                        value={formData.leadAssigneeName}
                        onChange={(e) => {
                          if (e.target.value === "__CUSTOM__") {
                            setIsCustomAssignee(true);
                            handleAssigneeSelect("");
                          } else {
                            handleAssigneeSelect(e.target.value);
                          }
                        }}
                        className={cn(
                          "w-full h-8.5 pl-2.5 pr-7 rounded-lg border bg-card text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer truncate",
                          errors.leadAssigneeName || isExternalDeptBlocked ? "border-destructive ring-1 ring-destructive/30" : "border-border/70"
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
                        aria-label="Họ và tên cán bộ chủ trì"
                        placeholder="Họ và tên cán bộ (VD: Nguyễn Văn Tuấn)..."
                        value={formData.leadAssigneeName}
                        onChange={(e) => handleAssigneeSelect(e.target.value)}
                        className="w-full h-8.5 px-2.5 rounded-lg border border-border/70 bg-card text-xs text-foreground placeholder:text-muted-foreground/75 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomAssignee(false);
                          handleAssigneeSelect("");
                        }}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground shrink-0 underline cursor-pointer"
                      >
                        Chọn từ danh mục
                      </button>
                    </div>
                  )}
                </div>

                {/* Manager Cross-Department Guard Banner */}
                {isExternalDeptBlocked && selectedAssigneeDept && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-xs text-amber-900 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="size-4 shrink-0 text-amber-600 mt-0.5" strokeWidth={1.5} />
                      <div className="space-y-1 leading-relaxed">
                        <p className="font-bold">Không thể giao việc trực tiếp ngoài đơn vị</p>
                        <p className="text-xs opacity-90">
                          Theo Nghị định 232/2026/NĐ-CP và quy chế điều hành, Trưởng phòng không được giao việc trực tiếp cho nhân sự thuộc {selectedAssigneeDept.department}.
                        </p>
                        <p className="text-xs opacity-90">
                          Vui lòng tạo Phiếu yêu cầu phối hợp để Lãnh đạo đơn vị tương ứng tiếp nhận và phân công.
                        </p>
                      </div>
                    </div>
                    {onOpenCollaborationRequest && (
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenCollaborationRequest(selectedAssigneeDept.code);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors cursor-pointer active:scale-95"
                        >
                          <span>Tạo phiếu phối hợp</span>
                          <ArrowRight className="size-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Admin Direct Assignment Bypass Notification */}
                {isAdminBypassActive && selectedAssigneeDept && (
                  <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/80 p-2.5 text-xs text-blue-900">
                    <ShieldAlert className="size-4 shrink-0 text-blue-600 mt-0.5" strokeWidth={1.5} />
                    <p className="text-xs leading-relaxed">
                      <span className="font-bold">Chỉ đạo trực tiếp Ban Giám hiệu:</span> Hệ thống sẽ tự động gửi thông báo gắn cờ [CHỈ ĐẠO BGH] tới Lãnh đạo {selectedAssigneeDept.department} để phối hợp quản lý nhân sự.
                    </p>
                  </div>
                )}
              </div>

              {/* Row: Cán bộ phối hợp thực hiện (Collaborators) */}
              <div className="flex flex-col gap-1.5 text-xs pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                    <Users className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                    Cán bộ phối hợp thực hiện
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {formData.coAssignees.length > 0 ? `${formData.coAssignees.length} cán bộ` : "Tùy chọn"}
                  </span>
                </div>

                {/* Selected Collaborator Badges */}
                {formData.coAssignees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 py-1">
                    {formData.coAssignees.map((collabName) => (
                      <span
                        key={collabName}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2 py-1 text-xs font-medium text-foreground shadow-2xs"
                      >
                        <User className="size-3 text-muted-foreground" strokeWidth={1.5} />
                        <span>{collabName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((p) => ({
                              ...p,
                              coAssignees: p.coAssignees.filter((c) => c !== collabName),
                            }));
                          }}
                          className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                          aria-label={`Xóa cán bộ phối hợp ${collabName}`}
                        >
                          <X className="size-3" strokeWidth={1.5} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add Collaborator Dropdown */}
                <div className="relative">
                  <select
                    value=""
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (selected && !formData.coAssignees.includes(selected)) {
                        setFormData((p) => ({
                          ...p,
                          coAssignees: [...p.coAssignees, selected],
                        }));
                        if (errors.coAssignees) clearError("coAssignees");
                      }
                    }}
                    className="w-full h-8.5 pl-2.5 pr-7 rounded-lg border border-border/70 bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer truncate"
                    aria-label="Thêm cán bộ phối hợp"
                  >
                    <option value="">+ Thêm cán bộ phối hợp thực hiện...</option>
                    {filteredGroups.map((group) => {
                      const availableMembers = group.members.filter(
                        (m) =>
                          m.name !== formData.leadAssigneeName &&
                          !formData.coAssignees.includes(m.name)
                      );
                      if (availableMembers.length === 0) return null;
                      return (
                        <optgroup key={group.code} label={group.department}>
                          {availableMembers.map((member) => (
                            <option key={member.name} value={member.name}>
                              {member.title} — {member.role}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                  <ChevronDown className="size-3.5 text-muted-foreground pointer-events-none absolute right-2.5 top-2.5" strokeWidth={1.5} />
                </div>
                {errors.coAssignees && (
                  <p className="text-xs font-medium text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3 shrink-0" strokeWidth={1.5} />
                    <span>{errors.coAssignees}</span>
                  </p>
                )}
              </div>

              {/* Row: Vị trí việc làm (VTVL - NĐ 232) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs pt-1 border-t border-border/40">
                <span className="flex items-center gap-1.5 text-muted-foreground font-semibold shrink-0 min-w-[130px]">
                  <Briefcase className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                  Vị trí việc làm (VTVL)
                </span>

                <div className="relative flex-1 sm:max-w-[280px]">
                  <input
                    type="text"
                    aria-label="Vị trí việc làm (VTVL)"
                    placeholder="VD: Chuyên viên Quản lý Đào tạo, Giảng viên CNTT..."
                    value={formData.vtvlRole || ""}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, vtvlRole: e.target.value }))
                    }
                    className="w-full h-8 px-2.5 rounded-lg border border-border/70 bg-card text-xs text-foreground placeholder:text-muted-foreground/75 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
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

              {/* Row: Cấu hình quy trình phê duyệt (Việc Thường quy vs Trọng điểm DACUM) */}
              {formData.level === "DON_VI" && (
                <div className="flex flex-col gap-2 text-xs pt-1 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                      <CheckCircle2 className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                      Quy trình phê duyệt
                    </span>
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.requiresReview || false}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData((p) => ({ ...p, requiresReview: checked }));
                          if (!checked && errors.requiredDeliverables) {
                            clearError("requiredDeliverables");
                          }
                        }}
                        className="size-3.5 rounded border-border text-primary focus:ring-primary/30"
                      />
                      <span className="text-xs font-medium text-foreground">
                        Bắt buộc Trưởng phòng nghiệm thu (DACUM)
                      </span>
                    </label>
                  </div>
                  {formData.requiresReview ? (
                    <p className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
                      Nhiệm vụ trọng điểm: Viên chức phải nộp sản phẩm minh chứng để chuyển sang Chờ duyệt. Trưởng phòng trực tiếp nghiệm thu.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg">
                      Việc thường quy: Viên chức tự bấm hoàn thành nhiệm vụ (1-click) khi xong. Trưởng phòng theo dõi và hậu kiểm.
                    </p>
                  )}
                </div>
              )}

              {/* Row: Sản phẩm đầu ra đo lường được (Nghị định 232/DACUM) */}
              <div className="flex flex-col gap-1.5 text-xs pt-1 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                    <FileCheck className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                    Sản phẩm đầu ra đo lường được (DACUM)
                    {formData.level === "DON_VI" && formData.requiresReview && (
                      <span className="text-destructive">*</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formData.requiresReview ? "Bắt buộc theo NĐ 232" : "Tùy chọn"}
                  </span>
                </div>

                <textarea
                  rows={2}
                  placeholder={
                    formData.requiresReview
                      ? "Bắt buộc: Mô tả kết quả/minh chứng cụ thể (VD: Dự thảo Quy chế PDF, Báo cáo kỹ thuật...)"
                      : "Mô tả kết quả/minh chứng cụ thể (tùy chọn)..."
                  }
                  value={formData.requiredDeliverables || ""}
                  onChange={(e) => {
                    setFormData((p) => ({ ...p, requiredDeliverables: e.target.value }));
                    if (errors.requiredDeliverables) clearError("requiredDeliverables");
                  }}
                  className={cn(
                    "w-full rounded-lg border bg-card p-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed",
                    errors.requiredDeliverables ? "border-destructive ring-1 ring-destructive/30" : "border-border/70"
                  )}
                />
                {errors.requiredDeliverables && (
                  <p className="text-xs font-medium text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3 shrink-0" strokeWidth={1.5} />
                    <span>{errors.requiredDeliverables}</span>
                  </p>
                )}
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
                    max={effectiveParentDueDate ? effectiveParentDueDate.split("T")[0] : undefined}
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
                  <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                    <button
                      type="button"
                      onClick={() => handleDatePreset(0)}
                      className="rounded-md border border-border/60 bg-card/60 px-2 py-1 text-xs font-medium text-foreground hover:bg-secondary hover:border-border cursor-pointer transition-all active:scale-95 whitespace-nowrap shrink-0"
                    >
                      Hôm nay
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDatePreset(3)}
                      className="rounded-md border border-border/60 bg-card/60 px-2 py-1 text-xs font-medium text-foreground hover:bg-secondary hover:border-border cursor-pointer transition-all active:scale-95 whitespace-nowrap shrink-0"
                    >
                      +3 ngày
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDatePreset(7)}
                      className="rounded-md border border-border/60 bg-card/60 px-2 py-1 text-xs font-medium text-foreground hover:bg-secondary hover:border-border cursor-pointer transition-all active:scale-95 whitespace-nowrap shrink-0"
                    >
                      +1 tuần
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDatePreset(-1)}
                      className="rounded-md border border-border/60 bg-card/60 px-2 py-1 text-xs font-medium text-foreground hover:bg-secondary hover:border-border cursor-pointer transition-all active:scale-95 whitespace-nowrap shrink-0"
                    >
                      Cuối tháng
                    </button>
                  </div>
                </div>
              </div>
              {errors.dueDate && (
                <p className="text-xs font-medium text-destructive flex items-center gap-1">
                  <AlertCircle className="size-3 shrink-0" strokeWidth={1.5} />
                  <span>{errors.dueDate}</span>
                </p>
              )}

              {/* Row: Hạn chót nội bộ (Internal Due Date) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs pt-1 border-t border-border/40">
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5 text-muted-foreground font-semibold shrink-0 min-w-[130px]">
                    <Clock className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                    Hạn chót nội bộ
                  </span>
                  <span className="text-xs text-muted-foreground">Nghiệm thu cấp 1 trước khi trình BGH</span>
                </div>

                <div className="flex items-center gap-2 justify-end flex-1 font-mono tabular-nums">
                  <input
                    type="date"
                    value={formData.internalDueDate || ""}
                    onChange={(e) => {
                      setFormData((p) => ({ ...p, internalDueDate: e.target.value }));
                      if (errors.internalDueDate) clearError("internalDueDate");
                    }}
                    className={cn(
                      "h-8 px-2 rounded-lg border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono tabular-nums",
                      errors.internalDueDate ? "border-destructive ring-1 ring-destructive/30" : "border-border/70"
                    )}
                  />
                </div>
              </div>
              {errors.internalDueDate && (
                <p className="text-xs font-medium text-destructive flex items-center gap-1">
                  <AlertCircle className="size-3 shrink-0" strokeWidth={1.5} />
                  <span>{errors.internalDueDate}</span>
                </p>
              )}

              {/* Row D: Thuộc nhiệm vụ cấp Trường (nếu là việc Đơn vị) */}
              {formData.level === "DON_VI" && (
                isSubtaskMode ? (
                  <div className="flex items-center justify-between gap-3 text-xs pt-1 border-t border-border/40">
                    <span className="flex items-center gap-1.5 text-muted-foreground font-semibold shrink-0 min-w-[110px]">
                      <Link2 className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                      Nhiệm vụ cha
                    </span>
                    <div className="flex-1 sm:max-w-[280px] text-xs font-semibold text-primary bg-primary/5 border border-primary/20 rounded-lg px-2.5 py-1.5 truncate">
                      {effectiveParentTitle || initialParentTaskId} (Đã khóa liên kết)
                    </div>
                  </div>
                ) : schoolTasks.length > 0 ? (
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
                ) : null
              )}
            </div>

            {/* Validation Errors Summary (if any) */}
            {(errors.leadAssigneeName || errors.coAssignees || errors.dueDate || errors.internalDueDate || errors.requiredDeliverables) && (
              <div className="text-xs text-destructive space-y-0.5">
                {errors.leadAssigneeName && <p>• {errors.leadAssigneeName}</p>}
                {errors.coAssignees && <p>• {errors.coAssignees}</p>}
                {errors.dueDate && <p>• {errors.dueDate}</p>}
                {errors.internalDueDate && <p>• {errors.internalDueDate}</p>}
                {errors.requiredDeliverables && <p>• {errors.requiredDeliverables}</p>}
              </div>
            )}
          </div>

          {/* Sticky Bottom Actions Bar */}
          <div className="sticky bottom-0 z-10 flex items-center justify-between px-5 sm:px-6 py-3.5 border-t border-border/50 bg-card/95 backdrop-blur-md shrink-0 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            {/* Keyboard hint */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <kbd className="rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-xs font-bold">
                Ctrl
              </kbd>
              <span>+</span>
              <kbd className="rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-xs font-bold">
                Enter
              </kbd>
              <span className="ml-0.5">để {isStaff ? "tạo việc" : "hoàn tất"}</span>
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
                disabled={allowedLevels.length === 0 || isExternalDeptBlocked}
                className={cn(
                  "h-8.5 rounded-xl px-4 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-1.5",
                  (allowedLevels.length === 0 || isExternalDeptBlocked) && "opacity-50 cursor-not-allowed"
                )}
              >
                <CheckCircle2 className="size-3.5" strokeWidth={1.5} />
                <span>
                  {isStaff
                    ? "Tạo việc mới"
                    : formData.level === "TRUONG"
                    ? "Tạo việc cấp Trường"
                    : formData.leadAssigneeName && formData.leadAssigneeName !== user?.name
                    ? "Giao việc"
                    : "Tạo việc mới"}
                </span>
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  if (mounted && typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
