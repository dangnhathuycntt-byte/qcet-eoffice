/**
 * Create-task form utilities — extracted from dashboard/create-task-modal.tsx
 *
 * Pure functions for form validation, identity resolution, submission
 * orchestration, and dirty-checking. Shared between dashboard and tasks
 * create modals.
 */

import type { TaskCategory, SchoolTask } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import type { DepartmentOption } from "@/hooks/use-department-list";
import type { TaskPriorityInput } from "@/contracts/tasks";
import {
  submitCreateTask,
  type CreateTaskSubmitResult,
} from "@/lib/adapters/create-task-mapper";
import { canAssignStaffTask } from "@/lib/dacum-workflow-engine";
import {
  type TaskLevel,
  type CreateTaskMode,
  getCanonicalDbRole,
} from "@/domain/tasks/create-task-policy";

/* ── Types ─────────────────────────────────────────────────────────── */

export interface CreateTaskFormData {
  level: TaskLevel;
  category: TaskCategory;
  title: string;
  summary?: string;
  leadAssigneeName: string;
  coAssignees: string[];
  startDate?: string;
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

export interface CreateTaskPersonnelRef {
  id: string;
  name: string;
  departmentId?: string | null;
}

export type CreateTaskIdentityResult =
  | { ok: true; assigneeId: string; departmentId: string }
  | { ok: false; field: "leadAssigneeName" | "form"; message: string };

export type CreateTaskSubmissionStatus = "created" | "rejected" | "unknown";

export interface CreateTaskSubmissionOutcome {
  status: CreateTaskSubmissionStatus;
  message?: string;
  result: CreateTaskSubmitResult;
}

/* ── Initial form data ─────────────────────────────────────────────── */

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

/* ── Constants ─────────────────────────────────────────────────────── */

/**
 * Honesty disclosure (SK-04 / D11): the current canonical create contract does
 * not persist the advanced institutional metadata collected by this form
 * (VTVL, lĩnh vực công tác, hạn chót nội bộ, sản phẩm đầu ra, nghiệm thu).
 * Surfaced in the UI so the user is never asked to enter a value that is
 * silently discarded by the adapter.
 */
export const ADVANCED_METADATA_PERSISTENCE_NOTICE =
  "Tùy chọn nâng cao (VTVL, lĩnh vực công tác, hạn chót nội bộ, sản phẩm đầu ra, nghiệm thu) hiện chưa được lưu vào hợp đồng tạo nhiệm vụ.";

export const PRIORITY_OPTIONS: {
  value: TaskPriorityInput;
  label: string;
  iconColor: string;
}[] = [
  { value: "LOW", label: "Thấp", iconColor: "text-muted-foreground" },
  { value: "MEDIUM", label: "Bình thường", iconColor: "text-blue-500" },
  { value: "HIGH", label: "Cao", iconColor: "text-amber-500" },
  { value: "URGENT", label: "Khẩn cấp", iconColor: "text-rose-500" },
];

/* ── Role & assignee guards ────────────────────────────────────────── */

/** Lookup department by member name from the departments list. */
export function findDeptForMember(
  memberName: string,
  departments: DepartmentOption[],
): DepartmentOption | undefined {
  if (!memberName) return undefined;
  const clean = memberName
    .replace(/^(ThS\.|TS\.|CN\.|BS\.|PGS\.|GS\.|KS\.|GVC\.)\s*/i, "")
    .trim()
    .toLowerCase();
  return departments.find((dept) =>
    dept.personnel?.some((m) => {
      const mClean = m.name
        .replace(/^(ThS\.|TS\.|CN\.|BS\.|PGS\.|GS\.|KS\.|GVC\.)\s*/i, "")
        .trim()
        .toLowerCase();
      return m.name.toLowerCase() === memberName.toLowerCase() || mClean === clean;
    }),
  );
}

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

/* ── Identity resolution ───────────────────────────────────────────── */

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

/* ── Date helpers ──────────────────────────────────────────────────── */

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

/* ── Form validation ───────────────────────────────────────────────── */

export function validateTaskForm(
  data: CreateTaskFormData,
  parentSchoolTask?: SchoolTask,
  currentUser?: AuthUser,
  explicitParentDueDate?: string,
  departments?: DepartmentOption[],
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
      const dept = findDeptForMember(data.leadAssigneeName, departments || []);
      if (dept) {
        const targetDepartmentCode = dept.code;
        const currentDepartmentCode = currentUser.departmentCode;
        const isSameDepartment = targetDepartmentCode === currentDepartmentCode;
        if (["MANAGER", "TRUONG_PHONG"].includes(getCanonicalDbRole(currentUser)) && !isSameDepartment) {
          errors.leadAssigneeName =
            "Trưởng đơn vị chỉ được giao việc cho nhân sự thuộc cùng đơn vị. Phiếu yêu cầu phối hợp là bắt buộc khi cần liên đơn vị.";
        } else {
          const check = canRoleSelectAssignee(currentUser, targetDepartmentCode, false, data.leadAssigneeName);
          if (!check.allowed) {
            errors.leadAssigneeName =
              check.message || "Không có thẩm quyền phân công cho nhân sự này";
          }
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

/* ── Form snapshot & dirty check ───────────────────────────────────── */

export function takeFormSnapshot(formData: CreateTaskFormData): CreateTaskFormData {
  return {
    ...formData,
    coAssignees: [...(formData.coAssignees || [])],
  };
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

/* ── Combobox navigation helpers ───────────────────────────────────── */

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

/* ── Submission ────────────────────────────────────────────────────── */

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
