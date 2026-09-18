"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { fadeVariants, dialogVariants } from "@/lib/motion/variants";
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
  Search,
  Check,
} from "lucide-react";
import type { TaskCategory, SchoolTask } from "@/types/dashboard";
import type { UserRole, AuthUser } from "@/types/auth";
import { useAuth } from "@/lib/auth-context";
import { useVirtualKeyboard, scrollActiveInputIntoView } from "@/hooks/use-virtual-keyboard";
import { canAssignStaffTask, validateDueDate } from "@/lib/dacum-workflow-engine";
import {
  type DepartmentPersonnelGroup,
  QCET_DEPARTMENT_GROUPS,
  getDepartmentForMember,
} from "@/lib/departments";
import { Button } from "@/components/ui/button";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { cn } from "@/lib/utils";
import type { TaskPriorityInput } from "@/contracts/tasks";
import {
  submitCreateTask,
  type CreateTaskSubmitResult,
} from "@/lib/adapters/create-task-mapper";

export type TaskLevel = "TRUONG" | "DON_VI" | "STAFF";

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
  /** Canonical priority (T22). Optional; the server defaults to MEDIUM. */
  priority?: TaskPriorityInput;
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
    priority: "MEDIUM",
  };
}

/**
 * Honesty disclosure (SK-04 / D11): the current canonical create contract does
 * not persist the advanced institutional metadata collected by this form
 * (VTVL, lĩnh vực công tác, hạn chót nội bộ, sản phẩm đầu ra, nghiệm thu).
 * Surfaced in the UI so the user is never asked to enter a value that is
 * silently discarded by the adapter.
 */
export const ADVANCED_METADATA_PERSISTENCE_NOTICE =
  "Tùy chọn nâng cao (VTVL, lĩnh vực công tác, hạn chót nội bộ, sản phẩm đầu ra, nghiệm thu) hiện chưa được lưu vào hợp đồng tạo nhiệm vụ.";

export const CATEGORY_OPTIONS: { id: TaskCategory; label: string; color: string }[] = [
  { id: "CHUYEN_DOI_SO", label: "Chuyển đổi số", color: "bg-blue-500" },
  { id: "TRUYEN_THONG", label: "Truyền thông & Tuyển sinh", color: "bg-purple-500" },
  { id: "CNTT", label: "Hạ tầng & CNTT", color: "bg-emerald-500" },
  { id: "ATTT", label: "An toàn thông tin", color: "bg-rose-500" },
  { id: "THU_VIEN", label: "Thư viện & Học liệu", color: "bg-amber-500" },
  { id: "BAO_CAO", label: "Báo cáo & Tổng hợp", color: "bg-cyan-500" },
  { id: "KHAC", label: "Khác", color: "bg-muted-foreground" },
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

/**
 * Canonical create-task policy (T06 / D5 / §9).
 *
 * One product policy that decides whether the create form may be opened and in
 * which mode:
 * - INSTITUTIONAL: the actor holds institutional levels (ADMIN -> cấp Trường /
 *   Đơn vị, MANAGER -> cấp Đơn vị) and may delegate work to personnel.
 * - PERSONAL: an actor without an institutional level creates an INDIVIDUAL
 *   (cấp cá nhân) task for themselves. This mirrors server truth: the server
 *   `canCreateTask` (server/policies/task-policy.ts) permits any authenticated
 *   user to create a personal task, and `canUserCreateTask`
 *   (server/tasks/task-policy.ts) allows INDIVIDUAL scope for non-privileged
 *   users.
 *
 * It is derived entirely from the existing role/policy helpers and must remain
 * the single gate for the create form (no ad-hoc role branching in the JSX).
 */
export type CreateTaskMode = "INSTITUTIONAL" | "PERSONAL";

export interface CreateTaskPolicy {
  canCreate: boolean;
  mode: CreateTaskMode;
  /** Institutional levels the actor may author (empty for personal-only actors). */
  institutionalLevels: TaskLevel[];
  defaultLevel: TaskLevel;
}

export function resolveCreateTaskPolicy(user?: AuthUser | null): CreateTaskPolicy {
  const institutionalLevels = getAllowedTaskLevelsForRole(user?.role ?? "ADMIN");
  if (!user) {
    return {
      canCreate: false,
      mode: "INSTITUTIONAL",
      institutionalLevels,
      defaultLevel: "DON_VI",
    };
  }

  const hasInstitutionalScope = institutionalLevels.length > 0;
  const canSelfAssign = canRoleSelectAssignee(
    user,
    user.departmentCode ?? "",
    false,
    user.name
  ).allowed;

  return {
    canCreate: hasInstitutionalScope || canSelfAssign,
    mode: hasInstitutionalScope ? "INSTITUTIONAL" : "PERSONAL",
    institutionalLevels,
    defaultLevel: hasInstitutionalScope ? getDefaultTaskLevelForRole(user.role) : "STAFF",
  };
}

/**
 * Stable-identity resolution for the create command (T24 / D5 / SK-03).
 *
 * The canonical API persists a task's DRI by stable user id and requires a unit
 * (`departmentId`); a display name alone cannot satisfy both the strict
 * `CreateTaskInputSchema` and the server `createTask` guard. This pure resolver
 * is the single gate deciding whether the current draft can be submitted:
 * - INSTITUTIONAL: the selected DRI must exist in the personnel directory so an
 *   id (and its unit) can be derived. A free-text name outside the directory is
 *   rejected BEFORE any request is issued, instead of failing server-side.
 * - PERSONAL: the actor is the DRI; their own directory record supplies the unit.
 *
 * It never invents ids: an unresolvable assignee or unit is a hard failure.
 */
export interface CreateTaskPersonnelRef {
  id: string;
  name: string;
  departmentId?: string | null;
}

export type CreateTaskIdentityResult =
  | { ok: true; assigneeId: string; departmentId: string }
  | { ok: false; field: "leadAssigneeName" | "form"; message: string };

export function resolveCreateTaskIdentity(
  data: Pick<CreateTaskFormData, "leadAssigneeName">,
  personnel: readonly CreateTaskPersonnelRef[] | undefined,
  actor?: { id?: string; name?: string } | null,
  mode: CreateTaskMode = "INSTITUTIONAL"
): CreateTaskIdentityResult {
  const directory = Array.isArray(personnel) ? personnel : [];
  if (directory.length === 0) {
    return {
      ok: false,
      field: "form",
      message:
        "Chưa tải được danh mục nhân sự nên không thể xác định mã định danh cán bộ/đơn vị. Vui lòng thử lại sau.",
    };
  }

  if (mode === "PERSONAL") {
    const actorName = (actor?.name ?? "").trim().toLowerCase();
    const self = actor
      ? directory.find((p) => p.id === actor.id) ??
        directory.find((p) => p.name.trim().toLowerCase() === actorName)
      : undefined;
    if (!self || !self.departmentId) {
      return {
        ok: false,
        field: "form",
        message:
          "Không xác định được đơn vị công tác của bạn trong danh mục nhân sự. Vui lòng liên hệ quản trị để bổ sung hồ sơ.",
      };
    }
    return { ok: true, assigneeId: self.id, departmentId: self.departmentId };
  }

  const name = (data.leadAssigneeName ?? "").trim().toLowerCase();
  if (!name) {
    return {
      ok: false,
      field: "leadAssigneeName",
      message: "Vui lòng chọn người thực hiện",
    };
  }
  const match = directory.find((p) => p.name.trim().toLowerCase() === name);
  if (!match) {
    return {
      ok: false,
      field: "leadAssigneeName",
      message:
        "Người phụ trách không có trong danh mục nhân sự. Vui lòng chọn cán bộ từ danh mục để xác định mã định danh.",
    };
  }
  if (!match.departmentId) {
    return {
      ok: false,
      field: "form",
      message:
        "Không xác định được đơn vị của người phụ trách. Vui lòng liên hệ quản trị để cập nhật hồ sơ nhân sự.",
    };
  }
  return { ok: true, assigneeId: match.id, departmentId: match.departmentId };
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

export function takeFormSnapshot(formData: CreateTaskFormData): CreateTaskFormData {
  return {
    ...formData,
    coAssignees: [...(formData.coAssignees || [])],
  };
}

/**
 * Pure combobox keyboard navigation helper (Task 4 — bàn phím).
 *
 * Tính activeOptionIndex mới từ phím bấm và tổng số kết quả.
 * Không chọn khi danh sách rỗng hoặc đang IME composition.
 *
 * @returns next index (số nguyên trong [0, total-1]), hoặc null nếu không thay đổi.
 */
export function resolveComboboxNavigation(
  key: "ArrowDown" | "ArrowUp",
  currentIndex: number,
  total: number
): number | null {
  if (total === 0) return null;
  if (key === "ArrowDown") return (currentIndex + 1) % total;
  return (currentIndex - 1 + total) % total;
}

/**
 * Pure guard: kiểm tra điều kiện để chọn option bằng Enter trong combobox.
 *
 * Trả về false nếu:
 *   - Đang IME composition (sẽ confirm chữ tiếng Trung/Nhật/Hàn, không phải chọn option)
 *   - Không có kết quả nào trong danh sách
 *   - activeIndex nằm ngoài danh sách
 *
 * @param isComposing  giá trị từ nativeEvent.isComposing
 * @param total        số kết quả hiện tại (flatSearchedMembers.length)
 * @param activeIndex  chỉ số option đang focus
 */
export function canSelectOnEnter(
  isComposing: boolean,
  total: number,
  activeIndex: number
): boolean {
  if (isComposing) return false;
  if (total === 0) return false;
  if (activeIndex < 0 || activeIndex >= total) return false;
  return true;
}

export function isFormDirty(
  current: CreateTaskFormData,
  baseline: CreateTaskFormData
): boolean {
  if ((current.title || "").trim() !== (baseline.title || "").trim()) return true;
  if ((current.leadAssigneeName || "").trim() !== (baseline.leadAssigneeName || "").trim()) return true;
  if ((current.dueDate || "") !== (baseline.dueDate || "")) return true;
  if ((current.description || "").trim() !== (baseline.description || "").trim()) return true;
  if ((current.level || "DON_VI") !== (baseline.level || "DON_VI")) return true;
  if ((current.category || "CHUYEN_DOI_SO") !== (baseline.category || "CHUYEN_DOI_SO")) return true;
  if ((current.internalDueDate || "") !== (baseline.internalDueDate || "")) return true;
  if ((current.parentTaskId || "") !== (baseline.parentTaskId || "")) return true;
  if ((current.requiredDeliverables || "").trim() !== (baseline.requiredDeliverables || "").trim()) return true;
  if ((current.vtvlRole || "").trim() !== (baseline.vtvlRole || "").trim()) return true;
  if (Boolean(current.requiresReview) !== Boolean(baseline.requiresReview)) return true;
  if ((current.priority || "MEDIUM") !== (baseline.priority || "MEDIUM")) return true;

  const currentCo = (current.coAssignees || []).map((s) => s.trim()).filter(Boolean).sort();
  const baselineCo = (baseline.coAssignees || []).map((s) => s.trim()).filter(Boolean).sort();
  if (currentCo.length !== baselineCo.length) return true;
  for (let i = 0; i < currentCo.length; i++) {
    if (currentCo[i] !== baselineCo[i]) return true;
  }

  return false;
}

/**
 * Pure create-submission orchestrator (C1 / T26 / T27 / T73).
 *
 * Wraps the canonical F3 adapter (`submitCreateTask`) so the UI has one
 * testable outcome:
 * - `created`: server-confirmed. The only state that may be treated as success.
 * - `rejected`: the server refused the mutation (validation / authorization).
 * - `unknown`: transport failure / timeout. The request may or may not have been
 *   applied. Callers MUST preserve the draft and reuse the SAME idempotency key
 *   on any retry rather than declaring failure or resending with a fresh key.
 */
export type CreateTaskSubmissionStatus = "created" | "rejected" | "unknown";

export interface CreateTaskSubmissionOutcome {
  status: CreateTaskSubmissionStatus;
  message?: string;
  result: CreateTaskSubmitResult;
}

export async function performCreateTaskSubmission(
  draft: CreateTaskFormData,
  options: Parameters<typeof submitCreateTask>[1] = {}
): Promise<CreateTaskSubmissionOutcome> {
  const result = await submitCreateTask(draft, options);
  if (result.ok) {
    return { status: "created", result };
  }
  if (result.reason === "unknown") {
    return { status: "unknown", message: result.error, result };
  }
  return { status: "rejected", message: result.error, result };
}

export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: CreateTaskFormData, result?: CreateTaskSubmitResult) => void | Promise<void>;
  onSubmitSuccess?: () => void;
  onOpenCollaborationRequest?: (targetDeptCode?: string) => void;
  schoolTasks?: SchoolTask[];
  initialLevel?: TaskLevel;
  initialTitle?: string;
  initialParentTaskId?: string;
  initialParentTaskTitle?: string;
  initialParentTaskDueDate?: string;
  initialDueDate?: string;
  initialLeadAssigneeName?: string;
}

function normalizeVietnameseText(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onSubmit,
  onSubmitSuccess,
  onOpenCollaborationRequest,
  schoolTasks = [],
  initialLevel = "TRUONG",
  initialTitle,
  initialParentTaskId,
  initialParentTaskTitle,
  initialParentTaskDueDate,
  initialDueDate,
  initialLeadAssigneeName,
}: CreateTaskModalProps) {
  const { user } = useAuth();
  const { isKeyboardOpen, keyboardHeight } = useVirtualKeyboard();
  const createPolicy = React.useMemo(() => resolveCreateTaskPolicy(user), [user]);
  const allowedLevels = createPolicy.institutionalLevels;
  const isStaff = createPolicy.mode === "PERSONAL";
  const isManager = user?.role === "MANAGER";
  const isSubtaskMode = Boolean(initialParentTaskId);

  const getEffectiveLevel = React.useCallback(
    (requestedLevel: TaskLevel): TaskLevel => {
      if (createPolicy.mode === "PERSONAL") return "STAFF";
      if (initialParentTaskId || isManager) return "DON_VI";
      if (allowedLevels.includes(requestedLevel)) return requestedLevel;
      return createPolicy.defaultLevel;
    },
    [createPolicy, initialParentTaskId, isManager, allowedLevels]
  );

  const [formData, setFormData] = React.useState<CreateTaskFormData>(() => ({
    ...getInitialTaskFormData(getEffectiveLevel(initialLevel)),
    title: initialTitle || "",
    parentTaskId: initialParentTaskId,
    dueDate: initialDueDate || "",
    leadAssigneeName: initialLeadAssigneeName || (isStaff ? (user?.name || "") : ""),
    vtvlRole: isStaff ? (user?.roleLabel || "Giảng viên") : "",
  }));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [deptFilter, setDeptFilter] = React.useState<string>("ALL");
  const [mounted, setMounted] = React.useState(false);
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const baselineSnapshotRef = React.useRef<CreateTaskFormData | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = React.useState(false);
  const comboboxTriggerRef = React.useRef<HTMLButtonElement>(null);
  const continueButtonRef = React.useRef<HTMLButtonElement>(null);
  const [activeOptionIndex, setActiveOptionIndex] = React.useState(0);

  // Searchable Assignee Combobox state
  const [isComboboxOpen, setIsComboboxOpen] = React.useState(false);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = React.useState("");
  const comboboxRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Collaborator search state
  const [isCollabDropdownOpen, setIsCollabDropdownOpen] = React.useState(false);
  const [collabSearchQuery, setCollabSearchQuery] = React.useState("");
  const collabDropdownRef = React.useRef<HTMLDivElement>(null);

  const [personnelList, setPersonnelList] = React.useState<ApiPersonnel[]>([]);

  // Submission lifecycle (T26 / T27 / T73): the form never closes or clears on a
  // rejection or an unproven timeout; success is only declared for a server DTO.
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submissionStatus, setSubmissionStatus] = React.useState<
    CreateTaskSubmissionStatus | "idle" | "submitting"
  >("idle");
  const [submissionMessage, setSubmissionMessage] = React.useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const idempotencyKeyRef = React.useRef<string | null>(null);
  const errorSummaryRef = React.useRef<HTMLDivElement>(null);

  // Child task mode: level is DON_VI or STAFF, or linked to a parent task
  const isChildTaskMode =
    isSubtaskMode ||
    formData.level === "DON_VI" ||
    (formData.level as string) === "STAFF" ||
    Boolean(formData.parentTaskId);

  // Strict Single DRI rule: child tasks must have exactly 1 assignee, clear collaborators
  React.useEffect(() => {
    if (isChildTaskMode && formData.coAssignees && formData.coAssignees.length > 0) {
      setFormData((prev) => ({ ...prev, coAssignees: [] }));
    }
  }, [isChildTaskMode, formData.coAssignees]);

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
      return QCET_DEPARTMENT_GROUPS.map((g) => {
        const seen = new Set<string>();
        const uniqueMembers = g.members.filter((m) => {
          const key = m.name.trim().toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const uniquePersonnel = g.personnel.filter((p) => {
          const key = p.name.trim().toLowerCase();
          return seen.has(key);
        });
        return {
          ...g,
          members: uniqueMembers,
          personnel: uniquePersonnel,
        };
      });
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
      const isDuplicate = grp.members.some(
        (m) => m.name.trim().toLowerCase() === p.name.trim().toLowerCase()
      );
      if (!isDuplicate) {
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
    }
    return Array.from(groupMap.values());
  }, [personnelList]);

  // Filter department groups based on deptFilter
  const filteredGroups = React.useMemo(() => {
    if (deptFilter === "ALL") return departmentGroups;
    return departmentGroups.filter((g) => g.code === deptFilter);
  }, [deptFilter, departmentGroups]);

  // Search filtered personnel list for Combobox
  const searchedPersonnel = React.useMemo(() => {
    const query = normalizeVietnameseText(assigneeSearchQuery);
    return filteredGroups
      .map((g) => {
        const matchingMembers = g.members.filter((m) => {
          if (!query) return true;
          const nameMatch = normalizeVietnameseText(m.name).includes(query);
          const titleMatch = normalizeVietnameseText(m.title).includes(query);
          const roleMatch = normalizeVietnameseText(m.role).includes(query);
          const deptMatch = normalizeVietnameseText(g.department).includes(query);
          const codeMatch = normalizeVietnameseText(g.code).includes(query);
          return nameMatch || titleMatch || roleMatch || deptMatch || codeMatch;
        });
        return {
          ...g,
          members: matchingMembers,
        };
      })
      .filter((g) => g.members.length > 0);
  }, [filteredGroups, assigneeSearchQuery]);

  const flatSearchedMembers = React.useMemo(() => {
    const list: { name: string; title: string; role: string; department: string; code: string }[] = [];
    for (const group of searchedPersonnel) {
      for (const member of group.members) {
        list.push({ ...member, department: group.department, code: group.code });
      }
    }
    return list;
  }, [searchedPersonnel]);

  React.useEffect(() => {
    setActiveOptionIndex(0);
  }, [assigneeSearchQuery, isComboboxOpen]);

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

      setIsComboboxOpen(false);
      setAssigneeSearchQuery("");

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

  // Close combobox when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsComboboxOpen(false);
      }
      if (collabDropdownRef.current && !collabDropdownRef.current.contains(event.target as Node)) {
        setIsCollabDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync state on open
  const prevIsOpen = React.useRef(false);
  const parentTask = React.useMemo(() => {
    return schoolTasks.find((t) => t.id === (formData.parentTaskId || initialParentTaskId));
  }, [schoolTasks, formData.parentTaskId, initialParentTaskId]);

  const effectiveParentTitle = initialParentTaskTitle || parentTask?.title;
  const effectiveParentDueDate = initialParentTaskDueDate || parentTask?.dueDate;

  const forceClose = React.useCallback(() => {
    setIsComboboxOpen(false);
    setIsCollabDropdownOpen(false);
    setShowDiscardConfirm(false);
    onClose();
  }, [onClose]);

  const handleRequestClose = React.useCallback(() => {
    if (isSubmitting) return;
    if (isComboboxOpen) {
      setIsComboboxOpen(false);
      comboboxTriggerRef.current?.focus();
      return;
    }
    if (isCollabDropdownOpen) {
      setIsCollabDropdownOpen(false);
      return;
    }
    if (showDiscardConfirm) {
      setShowDiscardConfirm(false);
      return;
    }
    const dirty = baselineSnapshotRef.current
      ? isFormDirty(formData, baselineSnapshotRef.current)
      : false;
    if (dirty) {
      setShowDiscardConfirm(true);
    } else {
      forceClose();
    }
  }, [isSubmitting, isComboboxOpen, isCollabDropdownOpen, showDiscardConfirm, formData, forceClose]);

  React.useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      const effectiveLevel = getEffectiveLevel(initialLevel);
      const initialBaseline: CreateTaskFormData = {
        ...getInitialTaskFormData(effectiveLevel),
        title: initialTitle || "",
        parentTaskId: initialParentTaskId,
        dueDate: initialDueDate || "",
        leadAssigneeName: initialLeadAssigneeName || (isStaff ? (user?.name || "") : ""),
        vtvlRole: isStaff ? (user?.roleLabel || "Giảng viên") : "",
      };

      baselineSnapshotRef.current = initialBaseline;
      setFormData(initialBaseline);
      setErrors({});
      setDeptFilter("ALL");
      setIsComboboxOpen(false);
      setAssigneeSearchQuery("");
      setIsSubmitting(false);
      setSubmissionStatus("idle");
      setSubmissionMessage(null);
      setShowAdvanced(false);
      setShowDiscardConfirm(false);
      idempotencyKeyRef.current = null;
      setTimeout(() => titleInputRef.current?.focus(), 80);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, initialLevel, initialTitle, initialParentTaskId, initialDueDate, initialLeadAssigneeName, isStaff, getEffectiveLevel, user?.name, user?.roleLabel]);

  // Body scroll lock when modal is open
  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Focus Continue button when discard confirm dialog opens
  React.useEffect(() => {
    if (showDiscardConfirm) {
      const timer = setTimeout(() => {
        continueButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showDiscardConfirm]);

  // Keyboard shortcuts: ESC to close, Ctrl+Enter or Cmd+Enter to submit
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleRequestClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit(e as unknown as React.FormEvent);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, formData, isStaff, allowedLevels, isExternalDeptBlocked, isComboboxOpen, isCollabDropdownOpen, isSubmitting, handleRequestClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusFieldWithError = React.useCallback(
    (targetId: string, isAdvanced?: boolean) => {
      if (isAdvanced && !showAdvanced) {
        setShowAdvanced(true);
        requestAnimationFrame(() => {
          setTimeout(() => {
            const el = document.getElementById(targetId);
            if (el instanceof HTMLElement) {
              el.focus();
              scrollActiveInputIntoView();
            }
          }, 60);
        });
        return;
      }
      const el = document.getElementById(targetId);
      if (el instanceof HTMLElement) {
        el.focus();
        scrollActiveInputIntoView();
      }
    },
    [showAdvanced]
  );

  const focusFirstError = React.useCallback(
    (fieldErrors: Record<string, string>) => {
      const focusOrder: { key: string; targetId: string; isAdvanced?: boolean }[] = [
        { key: "title", targetId: "task-title-input" },
        { key: "leadAssigneeName", targetId: "task-assignee-field" },
        { key: "dueDate", targetId: "task-due-date-input" },
        { key: "internalDueDate", targetId: "task-internal-due-input", isAdvanced: true },
        { key: "requiredDeliverables", targetId: "task-deliverables-input", isAdvanced: true },
        { key: "coAssignees", targetId: "task-collaborators-input", isAdvanced: true },
      ];
      const first = focusOrder.find((entry) => fieldErrors[entry.key]);
      if (!first) {
        errorSummaryRef.current?.focus();
        return;
      }
      focusFieldWithError(first.targetId, first.isAdvanced);
    },
    [focusFieldWithError]
  );

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!createPolicy.canCreate || isExternalDeptBlocked || isSubmitting) return;

    const validationErrors = validateTaskForm(
      formData,
      parentTask,
      user || undefined,
      effectiveParentDueDate
    );

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setSubmissionStatus("idle");
      setSubmissionMessage(null);
      focusFirstError(validationErrors);
      return;
    }

    // T24 / D5 / SK-03: resolve a stable assignee id + unit BEFORE any request.
    // An unresolvable DRI (e.g. a free-text name outside the directory) is a
    // hard stop, never a guaranteed server-side validation failure.
    const identity = resolveCreateTaskIdentity(
      formData,
      personnelList,
      user,
      createPolicy.mode
    );
    if (!identity.ok) {
      const identityErrors = { [identity.field]: identity.message };
      setErrors(identityErrors);
      setSubmissionStatus("idle");
      setSubmissionMessage(null);
      focusFirstError(identityErrors);
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

    const cleanCollaborators = isChildTaskMode
      ? []
      : (formData.coAssignees || []).filter(
          (name) => name && name.trim().toLowerCase() !== formData.leadAssigneeName.trim().toLowerCase()
        );

    const draft: CreateTaskFormData = {
      ...formData,
      parentTaskId: formData.parentTaskId || initialParentTaskId,
      leadAssigneeName: formData.leadAssigneeName,
      coAssignees: cleanCollaborators,
      isBypassWarning: formData.isBypassWarning || isAdminBypass,
    };

    // Stable per-create idempotency key: generated once and reused for any safe
    // retry, so a lost response (T27/T72) can never double-submit.
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = `task-create-${
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      }`;
    }

    setErrors({});
    setSubmissionMessage(null);
    setSubmissionStatus("submitting");
    setIsSubmitting(true);

    try {
      const outcome = await performCreateTaskSubmission(draft, {
        personnel: personnelList.map((p) => ({
          id: p.id,
          name: p.name,
          departmentId: p.departmentId,
        })),
        assigneeId: identity.assigneeId,
        departmentId: identity.departmentId,
        idempotencyKey: idempotencyKeyRef.current,
      });

      if (outcome.status === "created") {
        idempotencyKeyRef.current = null;
        setSubmissionStatus("idle");
        setIsSubmitting(false);
        forceClose();
        if (onSubmit) {
          await onSubmit(draft, outcome.result);
        }
        onSubmitSuccess?.();
        return;
      }

      if (outcome.status === "unknown") {
        // Unproven, not failed (T27): keep the draft, keep the key for a safe retry.
        setSubmissionStatus("unknown");
        setIsSubmitting(false);
        setSubmissionMessage(
          "Chưa xác nhận được kết quả từ máy chủ. Nhiệm vụ có thể đã được tạo. Nội dung đã nhập vẫn được giữ nguyên, có thể thử lại an toàn bằng cùng một mã yêu cầu."
        );
        return;
      }

      // Server-confirmed refusal: preserve all input and surface field feedback.
      setSubmissionStatus("rejected");
      setIsSubmitting(false);
      setSubmissionMessage(outcome.message || "Máy chủ từ chối tạo nhiệm vụ.");
      setErrors({ form: outcome.message || "Máy chủ từ chối tạo nhiệm vụ." });
      errorSummaryRef.current?.focus();
    } catch {
      // Defensive: the adapter reports transport failures as `unknown`; an
      // unexpected throw must never be mistaken for a proven failure.
      setSubmissionStatus("unknown");
      setIsSubmitting(false);
      setSubmissionMessage(
        "Chưa xác nhận được kết quả từ máy chủ. Nội dung đã nhập vẫn được giữ nguyên."
      );
    }
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

  const getAssigneeInitials = (fullName: string) => {
    if (!fullName) return "QC";
    const parts = fullName.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  if (!isOpen && !mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden !m-0"
        >
          {/* Backdrop */}
          <m.div
            key="create-task-backdrop"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={handleRequestClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs !m-0"
            aria-hidden="true"
          />

          {/* Modal Container: Linear-style fast task composer */}
          <m.div
            key="create-task-dialog"
            variants={dialogVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={
              isKeyboardOpen && keyboardHeight > 0
                ? { height: `calc(100dvh - ${keyboardHeight}px)`, maxHeight: `calc(100dvh - ${keyboardHeight}px)` }
                : undefined
            }
            className="relative z-10 w-full h-[100dvh] sm:h-auto max-w-none sm:max-w-2xl max-h-[100dvh] sm:max-h-[90dvh] flex flex-col rounded-none sm:rounded-xl border-0 sm:border border-border/80 bg-card shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Header Bar: Minimal, Linear-style breadcrumb */}
            <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-2.5 border-b border-border/50 bg-card shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span id="modal-title" className="text-xs font-semibold text-foreground truncate">
                  {isStaff
                    ? "Tạo việc cá nhân"
                    : isSubtaskMode
                    ? "Giao việc con"
                    : formData.level === "TRUONG"
                    ? "Giao việc cấp Trường"
                    : "Giao việc đơn vị"}
                </span>

                {/* Parent task or context indicator */}
                {isSubtaskMode && effectiveParentTitle && (
                  <>
                    <span className="text-xs text-muted-foreground/40">/</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={effectiveParentTitle}>
                      {effectiveParentTitle}
                    </span>
                  </>
                )}

                {/* Level switcher: Subtle text segmented control for Admin */}
                {!isSubtaskMode && !isManager && !isStaff && (
                  <div className="hidden sm:inline-flex items-center rounded-md bg-muted/60 p-0.5 text-xs ml-2">
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, level: "TRUONG", parentTaskId: undefined }))}
                      className={cn(
                        "rounded px-2 py-0.5 font-medium transition-colors cursor-pointer",
                        formData.level === "TRUONG"
                          ? "bg-card text-foreground shadow-2xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Toàn trường
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, level: "DON_VI", coAssignees: [] }))}
                      className={cn(
                        "rounded px-2 py-0.5 font-medium transition-colors cursor-pointer",
                        formData.level === "DON_VI"
                          ? "bg-card text-foreground shadow-2xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Đơn vị
                    </button>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleRequestClose}
                aria-label="Đóng"
                className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 thin-scrollbar">
                {/* 1. Title Input (Linear-style: prominent, borderless) */}
                <div>
                  <label htmlFor="task-title-input" className="sr-only">
                    {isStaff ? "Tên công việc hoặc kế hoạch cá nhân" : "Tiêu đề nhiệm vụ cần tạo hoặc giao"}
                  </label>
                  <input
                    id="task-title-input"
                    ref={titleInputRef}
                    type="text"
                    placeholder={isStaff ? "Tên công việc cá nhân..." : "Tên nhiệm vụ..."}
                    value={formData.title}
                    aria-invalid={Boolean(errors.title)}
                    aria-describedby={errors.title ? "task-title-error" : undefined}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, title: e.target.value }));
                      if (errors.title) clearError("title");
                    }}
                    onFocus={() => scrollActiveInputIntoView()}
                    className={cn(
                      "w-full bg-transparent text-base sm:text-lg font-semibold text-foreground placeholder:text-muted-foreground/40 placeholder:font-normal focus:outline-none py-0.5",
                      errors.title && "text-destructive"
                    )}
                  />
                  {errors.title && (
                    <p id="task-title-error" className="text-xs font-medium text-destructive mt-1">
                      {errors.title}
                    </p>
                  )}
                </div>

                {/* 2. Description (Border-free canvas) */}
                <div>
                  <label htmlFor="create-task-description" className="sr-only">
                    Mô tả chi tiết
                  </label>
                  <textarea
                    id="create-task-description"
                    rows={2}
                    placeholder="Thêm mô tả chi tiết hoặc kết quả mong đợi (tùy chọn)..."
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    onFocus={() => scrollActiveInputIntoView()}
                    className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none resize-none leading-relaxed py-0.5 min-h-[48px]"
                  />
                </div>

                {/* 3. Core Properties Grid (2 columns, compact, no cards) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 pt-3 border-t border-border/50">
                  {/* Property: Cán bộ phụ trách (Single DRI) */}
                  <div className="space-y-1" ref={comboboxRef}>
                    <label id="task-assignee-label" htmlFor="task-assignee-field" className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                      <span>Phụ trách <span className="text-destructive">*</span></span>
                      {selectedAssigneeDept && (
                        <span className="text-xs text-muted-foreground/70">{selectedAssigneeDept.department}</span>
                      )}
                    </label>

                    {isStaff ? (
                      <div className="h-9 px-2.5 rounded-lg border border-border/60 bg-muted/30 flex items-center text-xs font-medium text-foreground">
                        {user?.name || "Bạn"} ({user?.roleLabel || "Cá nhân"})
                      </div>
                    ) : (
                      <div className="relative">
                        <button
                          ref={comboboxTriggerRef}
                          type="button"
                          id="task-assignee-field"
                          role="combobox"
                          aria-haspopup="listbox"
                          aria-expanded={isComboboxOpen}
                          aria-controls="task-assignee-listbox"
                          aria-invalid={Boolean(errors.leadAssigneeName)}
                          aria-describedby={errors.leadAssigneeName ? "task-assignee-error" : undefined}
                          aria-labelledby="task-assignee-label"
                          onClick={() => {
                            setIsComboboxOpen((prev) => !prev);
                            setTimeout(() => searchInputRef.current?.focus(), 60);
                          }}
                          className={cn(
                            "w-full h-9 px-2.5 rounded-lg border bg-background text-left text-xs font-medium text-foreground flex items-center justify-between gap-2 hover:border-border transition-colors cursor-pointer",
                            errors.leadAssigneeName || isExternalDeptBlocked
                              ? "border-destructive ring-1 ring-destructive/30"
                              : "border-border/70"
                          )}
                        >
                          {formData.leadAssigneeName ? (
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="size-5 rounded-full bg-muted flex items-center justify-center font-bold text-xs text-muted-foreground shrink-0">
                                {getAssigneeInitials(formData.leadAssigneeName)}
                              </span>
                              <span className="truncate">{formData.leadAssigneeName}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">Chọn cán bộ phụ trách...</span>
                          )}
                          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                        </button>

                        {/* Combobox Dropdown Popover */}
                        {isComboboxOpen && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border/80 bg-card shadow-lg overflow-hidden">
                            <div className="p-2 border-b border-border/50 bg-muted/30">
                              <div className="relative flex items-center">
                                <Search className="size-3.5 text-muted-foreground absolute left-2 pointer-events-none" strokeWidth={1.5} />
                                <input
                                  ref={searchInputRef}
                                  type="text"
                                  role="searchbox"
                                  aria-label="Tìm kiếm nhân sự"
                                  placeholder="Tìm họ tên, chức danh..."
                                  value={assigneeSearchQuery}
                                  onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                                  onFocus={() => scrollActiveInputIntoView()}
                                  onKeyDown={(e) => {
                                    const isComposing = Boolean(e.nativeEvent.isComposing);
                                    if (isComposing) return;
                                    if (e.key === "ArrowDown") {
                                      e.preventDefault();
                                      const next = resolveComboboxNavigation(
                                        "ArrowDown",
                                        activeOptionIndex,
                                        flatSearchedMembers.length
                                      );
                                      if (next !== null) setActiveOptionIndex(next);
                                    } else if (e.key === "ArrowUp") {
                                      e.preventDefault();
                                      const next = resolveComboboxNavigation(
                                        "ArrowUp",
                                        activeOptionIndex,
                                        flatSearchedMembers.length
                                      );
                                      if (next !== null) setActiveOptionIndex(next);
                                    } else if (e.key === "Enter") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (canSelectOnEnter(isComposing, flatSearchedMembers.length, activeOptionIndex)) {
                                        handleAssigneeSelect(flatSearchedMembers[activeOptionIndex].name);
                                        comboboxTriggerRef.current?.focus();
                                      }
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setIsComboboxOpen(false);
                                      comboboxTriggerRef.current?.focus();
                                    }
                                  }}
                                  aria-autocomplete="list"
                                  aria-controls="task-assignee-listbox"
                                  aria-activedescendant={
                                    flatSearchedMembers[activeOptionIndex]
                                      ? `assignee-option-${flatSearchedMembers[activeOptionIndex].code}-${flatSearchedMembers[activeOptionIndex].name.replace(/\s+/g, "-")}`
                                      : undefined
                                  }
                                  className="w-full h-8 pl-7 pr-2.5 rounded-md border border-border/60 bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>

                              {/* Department Filter Chips */}
                              <div className="flex items-center gap-1 mt-1.5 overflow-x-auto thin-scrollbar pb-0.5">
                                <button
                                  type="button"
                                  onClick={() => setDeptFilter("ALL")}
                                  className={cn(
                                    "rounded px-2 py-0.5 text-xs font-medium shrink-0 transition-colors cursor-pointer",
                                    deptFilter === "ALL"
                                      ? "bg-primary text-primary-foreground font-semibold"
                                      : "bg-background text-muted-foreground hover:text-foreground border border-border/50"
                                  )}
                                >
                                  Tất cả
                                </button>
                                {departmentGroups.map((g, idx) => (
                                  <button
                                    key={`chip-${g.code}-${idx}`}
                                    type="button"
                                    onClick={() => setDeptFilter(g.code)}
                                    className={cn(
                                      "rounded px-2 py-0.5 text-xs font-medium shrink-0 transition-colors cursor-pointer",
                                      deptFilter === g.code
                                        ? "bg-primary text-primary-foreground font-semibold"
                                        : "bg-background text-muted-foreground hover:text-foreground border border-border/50"
                                    )}
                                  >
                                    {g.code}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Personnel Listbox */}
                            <div
                              id="task-assignee-listbox"
                              role="listbox"
                              aria-labelledby="task-assignee-label"
                              className="max-h-52 overflow-y-auto thin-scrollbar p-1 divide-y divide-border/20"
                            >
                              {searchedPersonnel.length > 0 ? (
                                searchedPersonnel.map((group, gIdx) => (
                                  <div key={`pop-grp-${group.code}-${gIdx}`} className="py-0.5">
                                    <div className="px-2 py-0.5 text-xs font-bold text-muted-foreground sticky top-0 bg-card/95">
                                      {group.department}
                                    </div>
                                    <div className="space-y-0.5">
                                      {group.members.map((member, idx) => {
                                        const isSelected =
                                          formData.leadAssigneeName.trim().toLowerCase() ===
                                          member.name.trim().toLowerCase();
                                        const flatIndex = flatSearchedMembers.findIndex(
                                          (m) => m.name === member.name && m.department === group.department
                                        );
                                        const isActive = flatIndex === activeOptionIndex;
                                        return (
                                          <button
                                            key={`pop-opt-${group.code}-${member.name}-${idx}`}
                                            type="button"
                                            role="option"
                                            id={`assignee-option-${group.code}-${member.name.replace(/\s+/g, "-")}`}
                                            aria-selected={isSelected}
                                            onClick={() => {
                                              handleAssigneeSelect(member.name);
                                              comboboxTriggerRef.current?.focus();
                                            }}
                                            onMouseEnter={() => {
                                              if (flatIndex >= 0) setActiveOptionIndex(flatIndex);
                                            }}
                                            className={cn(
                                              "w-full px-2 py-1.5 rounded-md text-left flex items-center justify-between gap-2 transition-colors cursor-pointer text-xs",
                                              isSelected
                                                ? "bg-primary/10 text-primary font-semibold"
                                                : isActive
                                                ? "bg-muted text-foreground"
                                                : "hover:bg-muted text-foreground"
                                            )}
                                          >
                                            <div className="flex items-center gap-2 min-w-0">
                                              <span className="size-5 rounded-full bg-muted flex items-center justify-center font-bold text-xs text-muted-foreground shrink-0">
                                                {getAssigneeInitials(member.name)}
                                              </span>
                                              <div className="min-w-0">
                                                <p className="truncate font-medium">{member.title}</p>
                                                <p className="text-muted-foreground truncate text-xs">{member.role}</p>
                                              </div>
                                            </div>
                                            {isSelected && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="p-3 text-center text-xs text-muted-foreground">
                                  Không tìm thấy nhân sự phù hợp
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {errors.leadAssigneeName && (
                      <p id="task-assignee-error" className="text-xs font-medium text-destructive mt-1">
                        {errors.leadAssigneeName}
                      </p>
                    )}

                    {/* Manager Cross-Department Guard */}
                    {isExternalDeptBlocked && selectedAssigneeDept && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 p-2 text-xs text-amber-800 mt-1.5 space-y-1">
                        <p className="font-semibold">Không thể giao việc trực tiếp ngoài đơn vị</p>
                        <p className="opacity-90">
                          Theo quy chế, Trưởng phòng không được giao việc trực tiếp cho nhân sự thuộc {selectedAssigneeDept.department}.
                        </p>
                        {onOpenCollaborationRequest && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenCollaborationRequest(selectedAssigneeDept.code);
                            }}
                            className="inline-flex items-center gap-1 font-semibold text-amber-700 hover:underline cursor-pointer pt-0.5"
                          >
                            <span>Tạo phiếu yêu cầu phối hợp</span>
                            <ArrowRight className="size-3" strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Admin Direct Assignment Note */}
                    {isAdminBypassActive && selectedAssigneeDept && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Chỉ đạo trực tiếp: Sẽ gắn cờ [CHỈ ĐẠO BGH] tới Lãnh đạo {selectedAssigneeDept.department}.
                      </p>
                    )}
                  </div>

                  {/* Property: Hạn hoàn thành (Due Date) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span>Hạn hoàn thành <span className="text-destructive">*</span></span>
                      {effectiveParentDueDate && (
                        <span className="text-muted-foreground/70">
                          Tối đa: {formatDetailDateDisplay(effectiveParentDueDate)}
                        </span>
                      )}
                    </div>

                    <VietnameseDatePicker
                      id="task-due-date-input"
                      value={formData.dueDate}
                      maxDate={effectiveParentDueDate ? effectiveParentDueDate.split("T")[0] : undefined}
                      error={Boolean(errors.dueDate)}
                      variant="input"
                      onChange={(val) => {
                        setFormData((p) => ({ ...p, dueDate: val }));
                        if (errors.dueDate) clearError("dueDate");
                      }}
                      placeholder="Chọn hạn (dd/mm/yyyy)..."
                      className="w-full"
                    />

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleDatePreset(0)}
                        className="rounded border border-border/50 bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      >
                        Hôm nay
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDatePreset(3)}
                        className="rounded border border-border/50 bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      >
                        +3 ngày
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDatePreset(7)}
                        className="rounded border border-border/50 bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      >
                        +1 tuần
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDatePreset(-1)}
                        className="rounded border border-border/50 bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      >
                        Cuối tháng
                      </button>
                    </div>

                    {errors.dueDate && (
                      <p id="task-due-date-error" className="text-xs font-medium text-destructive mt-1">
                        {errors.dueDate}
                      </p>
                    )}
                  </div>

                  {/* Property: Mức ưu tiên (Priority) */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground block">
                      Mức ưu tiên
                    </label>
                    <div className="relative">
                      <select
                        value={formData.priority || "MEDIUM"}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, priority: e.target.value as TaskPriorityInput }))
                        }
                        className="w-full h-9 pl-2.5 pr-7 rounded-lg border border-border/70 bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                      >
                        <option value="LOW">Thấp</option>
                        <option value="MEDIUM">Bình thường</option>
                        <option value="HIGH">Cao</option>
                        <option value="URGENT">Khẩn cấp</option>
                      </select>
                      <ChevronDown className="size-3.5 text-muted-foreground pointer-events-none absolute right-2.5 top-3" strokeWidth={1.5} />
                    </div>
                  </div>

                  {/* Property: Cán bộ phối hợp (Collaborators - Core Flow) */}
                  {!isChildTaskMode && (
                    <div className="space-y-1" ref={collabDropdownRef}>
                      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                        <span>Phối hợp thực hiện</span>
                        {formData.coAssignees.length > 0 && (
                          <span className="text-muted-foreground/70">{formData.coAssignees.length} cán bộ</span>
                        )}
                      </div>

                      {/* Selected Collaborators inline chips */}
                      {formData.coAssignees.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {formData.coAssignees.map((collabName) => (
                            <span
                              key={collabName}
                              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-xs text-foreground font-medium"
                            >
                              <span>{collabName}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData((p) => ({
                                    ...p,
                                    coAssignees: p.coAssignees.filter((c) => c !== collabName),
                                  }));
                                }}
                                className="text-muted-foreground hover:text-destructive cursor-pointer"
                                aria-label={`Xóa cán bộ phối hợp ${collabName}`}
                              >
                                <X className="size-3" strokeWidth={1.5} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Add collaborator selector */}
                      <div className="relative">
                        <select
                          value=""
                          id="task-collaborators-input"
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
                          className="w-full h-9 pl-2.5 pr-7 rounded-lg border border-border/70 bg-background text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                          aria-label="Thêm cán bộ phối hợp"
                        >
                          <option value="">+ Thêm cán bộ phối hợp...</option>
                          {filteredGroups.map((group, gIdx) => {
                            const availableMembers = group.members.filter(
                              (m) =>
                                m.name !== formData.leadAssigneeName &&
                                !formData.coAssignees.includes(m.name)
                            );
                            if (availableMembers.length === 0) return null;
                            return (
                              <optgroup key={`collab-grp-${group.code}-${gIdx}`} label={group.department}>
                                {availableMembers.map((member, idx) => (
                                  <option key={`collab-opt-${group.code}-${member.name}-${idx}`} value={member.name}>
                                    {member.title} - {member.role}
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}
                        </select>
                        <ChevronDown className="size-3.5 text-muted-foreground pointer-events-none absolute right-2.5 top-3" strokeWidth={1.5} />
                      </div>

                      {errors.coAssignees && (
                        <p className="text-xs font-medium text-destructive mt-1">
                          {errors.coAssignees}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. Progressive Disclosure: Tùy chọn nâng cao */}
                <div className="pt-2 border-t border-border/50">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((prev) => !prev)}
                    aria-expanded={showAdvanced}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1"
                  >
                    <ChevronDown
                      className={cn("size-3.5 transition-transform", !showAdvanced && "-rotate-90")}
                      strokeWidth={1.5}
                    />
                    <span>{showAdvanced ? "Ẩn tùy chọn nâng cao" : "Tùy chọn nâng cao"}</span>
                  </button>

                  {/* Advanced Fields Drawer */}
                  {showAdvanced && (
                    <div className="space-y-3.5 pt-2 pb-1 border-t border-border/40 mt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                        {/* Field: Vị trí việc làm (VTVL) */}
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground block">
                            Vị trí việc làm (VTVL)
                          </label>
                          <input
                            type="text"
                            aria-label="Vị trí việc làm (VTVL)"
                            placeholder="VD: Chuyên viên QLĐT, Giảng viên CNTT..."
                            value={formData.vtvlRole || ""}
                            onChange={(e) => setFormData((p) => ({ ...p, vtvlRole: e.target.value }))}
                            onFocus={() => scrollActiveInputIntoView()}
                            className="w-full h-9 px-2.5 rounded-lg border border-border/70 bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        {/* Field: Lĩnh vực công tác */}
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground block">
                            Lĩnh vực công tác
                          </label>
                          <div className="relative">
                            <select
                              value={formData.category}
                              onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value as TaskCategory }))}
                              className="w-full h-9 pl-2.5 pr-7 rounded-lg border border-border/70 bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                            >
                              {CATEGORY_OPTIONS.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="size-3.5 text-muted-foreground pointer-events-none absolute right-2.5 top-3" strokeWidth={1.5} />
                          </div>
                        </div>

                        {/* Field: Hạn chót nội bộ */}
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground block">
                            Hạn chót nội bộ
                          </label>
                          <VietnameseDatePicker
                            id="task-internal-due-input"
                            value={formData.internalDueDate || ""}
                            error={Boolean(errors.internalDueDate)}
                            variant="input"
                            onChange={(val) => {
                              setFormData((p) => ({ ...p, internalDueDate: val }));
                              if (errors.internalDueDate) clearError("internalDueDate");
                            }}
                            placeholder="Chọn hạn nội bộ (dd/mm/yyyy)..."
                            className="w-full"
                          />
                          {errors.internalDueDate && (
                            <p id="task-internal-due-error" className="text-xs font-medium text-destructive mt-1">
                              {errors.internalDueDate}
                            </p>
                          )}
                        </div>

                        {/* Field: Nhiệm vụ cấp Trường liên kết (chỉ khi level DON_VI và không ở subtask mode) */}
                        {formData.level === "DON_VI" && !isSubtaskMode && schoolTasks.length > 0 && (
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground block">
                              Nhiệm vụ cấp Trường liên kết
                            </label>
                            <div className="relative">
                              <select
                                value={formData.parentTaskId || ""}
                                onChange={(e) =>
                                  setFormData((p) => ({ ...p, parentTaskId: e.target.value || undefined }))
                                }
                                className="w-full h-9 pl-2.5 pr-7 rounded-lg border border-border/70 bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                              >
                                <option value="">Độc lập (Không liên kết)</option>
                                {schoolTasks.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.title}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="size-3.5 text-muted-foreground pointer-events-none absolute right-2.5 top-3" strokeWidth={1.5} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Field: Cấu hình nghiệm thu & Sản phẩm đầu ra (Level: DON_VI) */}
                      {formData.level === "DON_VI" && (
                        <div className="space-y-2 pt-2 border-t border-border/40">
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
                              className="size-4 rounded border-border text-primary focus:ring-primary/30 cursor-pointer"
                            />
                            <span className="text-xs font-medium text-foreground">
                              Bắt buộc Trưởng phòng nghiệm thu (NĐ 232)
                            </span>
                          </label>

                          <div className="space-y-1">
                            <textarea
                              rows={2}
                              id="task-deliverables-input"
                              placeholder={
                                formData.requiresReview
                                  ? "Bắt buộc: Mô tả sản phẩm đầu ra (PDF quy chế, báo cáo kỹ thuật...)"
                                  : "Mô tả kết quả hoặc minh chứng nghiệm thu (tùy chọn)..."
                              }
                              value={formData.requiredDeliverables || ""}
                              aria-invalid={Boolean(errors.requiredDeliverables)}
                              aria-describedby={errors.requiredDeliverables ? "task-deliverables-error" : undefined}
                              onChange={(e) => {
                                setFormData((p) => ({ ...p, requiredDeliverables: e.target.value }));
                                if (errors.requiredDeliverables) clearError("requiredDeliverables");
                              }}
                              onFocus={() => scrollActiveInputIntoView()}
                              className={cn(
                                "w-full min-h-[60px] rounded-lg border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed",
                                errors.requiredDeliverables ? "border-destructive ring-1 ring-destructive/30" : "border-border/70"
                              )}
                            />
                            {errors.requiredDeliverables && (
                              <p id="task-deliverables-error" className="text-xs font-medium text-destructive mt-1">
                                {errors.requiredDeliverables}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Validation feedback & error summary */}
                {submissionStatus === "unknown" && submissionMessage && (
                  <div
                    role="status"
                    className="rounded-lg border border-amber-500/30 bg-amber-50/50 p-2.5 text-xs text-amber-800 leading-relaxed"
                  >
                    {submissionMessage}
                  </div>
                )}

                {(errors.title ||
                  errors.leadAssigneeName ||
                  errors.coAssignees ||
                  errors.dueDate ||
                  errors.internalDueDate ||
                  errors.requiredDeliverables ||
                  errors.form) && (
                  <div
                    ref={errorSummaryRef}
                    tabIndex={-1}
                    role="alert"
                    className="text-xs text-destructive space-y-1 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 focus:outline-none"
                  >
                    <p className="font-semibold">Vui lòng kiểm tra lại:</p>
                    {errors.title && (
                      <button type="button" onClick={() => focusFieldWithError("task-title-input")} className="block text-left hover:underline cursor-pointer">
                        • {errors.title}
                      </button>
                    )}
                    {errors.leadAssigneeName && (
                      <button type="button" onClick={() => focusFieldWithError("task-assignee-field")} className="block text-left hover:underline cursor-pointer">
                        • {errors.leadAssigneeName}
                      </button>
                    )}
                    {errors.coAssignees && (
                      <button type="button" onClick={() => focusFieldWithError("task-collaborators-input")} className="block text-left hover:underline cursor-pointer">
                        • {errors.coAssignees}
                      </button>
                    )}
                    {errors.dueDate && (
                      <button type="button" onClick={() => focusFieldWithError("task-due-date-input")} className="block text-left hover:underline cursor-pointer">
                        • {errors.dueDate}
                      </button>
                    )}
                    {errors.internalDueDate && (
                      <button type="button" onClick={() => focusFieldWithError("task-internal-due-input", true)} className="block text-left hover:underline cursor-pointer">
                        • {errors.internalDueDate}
                      </button>
                    )}
                    {errors.requiredDeliverables && (
                      <button type="button" onClick={() => focusFieldWithError("task-deliverables-input", true)} className="block text-left hover:underline cursor-pointer">
                        • {errors.requiredDeliverables}
                      </button>
                    )}
                    {errors.form && <p>• {errors.form}</p>}
                  </div>
                )}
              </div>

              {/* Sticky Bottom Actions Dock */}
              <div className="sticky bottom-0 z-20 flex items-center justify-between px-5 py-3 border-t border-border/50 bg-card shrink-0">
                {/* Keyboard shortcut hint */}
                <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                  <kbd className="rounded border border-border/60 bg-muted px-1 py-0.5 font-mono text-xs">
                    Ctrl
                  </kbd>
                  <span>+</span>
                  <kbd className="rounded border border-border/60 bg-muted px-1 py-0.5 font-mono text-xs">
                    Enter
                  </kbd>
                  <span className="ml-1">để giao việc</span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 ml-auto w-full sm:w-auto justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRequestClose}
                    disabled={isSubmitting}
                    className="h-8 rounded-lg px-3 text-xs font-medium cursor-pointer"
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!createPolicy.canCreate || isExternalDeptBlocked || isSubmitting}
                    className={cn(
                      "h-8 rounded-lg px-4 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer",
                      (!createPolicy.canCreate || isExternalDeptBlocked || isSubmitting) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isSubmitting
                      ? "Đang giao việc..."
                      : isStaff
                      ? "Tạo việc cá nhân"
                      : formData.level === "TRUONG"
                      ? "Giao việc cấp Trường"
                      : "Giao việc"}
                  </Button>
                </div>
              </div>
            </form>
          </m.div>

          {/* Discard confirm dialog */}
          {showDiscardConfirm && (
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="discard-dialog-title"
              aria-describedby="discard-dialog-desc"
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full max-w-sm rounded-xl border border-border/80 bg-card p-4 shadow-xl space-y-3">
                <div className="space-y-1">
                  <h3 id="discard-dialog-title" className="text-sm font-semibold text-foreground">
                    Bỏ nội dung chưa lưu?
                  </h3>
                  <p id="discard-dialog-desc" className="text-xs text-muted-foreground leading-relaxed">
                    Nội dung bạn đang nhập sẽ bị mất nếu đóng lúc này.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowDiscardConfirm(false);
                      forceClose();
                    }}
                    className="text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                  >
                    Bỏ thay đổi
                  </Button>
                  <Button
                    ref={continueButtonRef}
                    type="button"
                    size="sm"
                    autoFocus
                    onClick={() => setShowDiscardConfirm(false)}
                    className="text-xs h-8 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  >
                    Tiếp tục nhập
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>
  );

  if (mounted && typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}

export default CreateTaskModal;
