import type { AuthUser, UserRole } from "../types/auth";
import type {
  StaffTask,
  SchoolTask,
  DeliverableItem,
  TaskStatus,
} from "../types/dashboard";

export interface AssignmentCheckResult {
  allowed: boolean;
  reason?: string;
  isBypassWarning?: boolean;
}

export function canAssignStaffTask(
  actor: AuthUser,
  targetUserDeptCode: string,
  isEmergencyBypass: boolean = false
): AssignmentCheckResult {
  if (actor.role === "ADMIN") {
    return {
      allowed: true,
      isBypassWarning: isEmergencyBypass,
      reason: isEmergencyBypass
        ? "Chỉ đạo khẩn cấp từ Ban Giám hiệu: Hệ thống sẽ tự động gửi thông báo tới Lãnh đạo đơn vị quản lý nhân sự."
        : undefined,
    };
  }

  if (actor.role === "MANAGER") {
    if (actor.departmentCode === targetUserDeptCode) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason:
        "Theo Nghị định 232 và quy chế điều hành, Trưởng phòng không được giao việc trực tiếp cho nhân viên phòng khác. Vui lòng tạo Phiếu yêu cầu phối hợp gửi tới Lãnh đạo đơn vị tương ứng.",
    };
  }

  return {
    allowed: false,
    reason: "Chuyên viên/Nhân viên không có quyền giao việc.",
  };
}

export function validateDueDate(
  internalDueDate: string,
  schoolTaskDueDate: string
): { valid: boolean; error?: string } {
  if (!internalDueDate || !schoolTaskDueDate) {
    return { valid: true };
  }

  const internalTime = new Date(internalDueDate).getTime();
  const schoolTime = new Date(schoolTaskDueDate).getTime();

  if (internalTime > schoolTime) {
    return {
      valid: false,
      error: `Hạn chót công việc nội bộ (${internalDueDate}) không được vượt quá hạn chót của Nhiệm vụ cấp Trường (${schoolTaskDueDate}).`,
    };
  }

  return { valid: true };
}

export function validateDeliverableSubmission(
  task: StaffTask,
  deliverables: DeliverableItem[],
  notes?: string
): { valid: boolean; error?: string } {
  const hasItems = deliverables && deliverables.length > 0;
  const hasNotes = Boolean(notes && notes.trim().length > 0);

  if (!hasItems && !hasNotes) {
    return {
      valid: false,
      error:
        "Theo chuẩn DACUM và Nghị định 232, bắt buộc phải có sản phẩm minh chứng (đường dẫn tài liệu, tệp đính kèm hoặc mô tả kết quả) trước khi nộp duyệt.",
    };
  }

  return { valid: true };
}

export function transitionStaffTaskStatus(
  task: StaffTask,
  newStatus: TaskStatus,
  actor: AuthUser,
  payload?: {
    rejectionReason?: string;
    blockedReason?: string;
    deliverables?: DeliverableItem[];
    notes?: string;
  }
): { success: boolean; updatedTask?: StaffTask; error?: string } {
  const role = actor.role;

  // Rule 1: STAFF cannot directly complete task
  if (newStatus === "COMPLETED" && role === "STAFF") {
    return {
      success: false,
      error:
        "Chỉ Trưởng phòng hoặc BGH mới có quyền nghiệm thu hoàn thành công việc. Viên chức vui lòng nộp minh chứng để chuyển sang Chờ duyệt (NEEDS_REVIEW).",
    };
  }

  // Rule 2: Submitting to NEEDS_REVIEW requires deliverables
  if (newStatus === "NEEDS_REVIEW") {
    const deliverables = payload?.deliverables || task.deliverables || [];
    const notes = payload?.notes || task.deliverableDescription;
    const check = validateDeliverableSubmission(task, deliverables, notes);
    if (!check.valid) {
      return { success: false, error: check.error };
    }
  }

  // Rule 3: Rejection from NEEDS_REVIEW back to IN_PROGRESS requires reason
  if (task.status === "NEEDS_REVIEW" && newStatus === "IN_PROGRESS") {
    if (role !== "ADMIN" && role !== "MANAGER") {
      return {
        success: false,
        error: "Chỉ người quản lý mới có quyền trả lại công việc yêu cầu sửa đổi.",
      };
    }
  }

  const updatedTask: StaffTask = {
    ...task,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };

  if (payload?.rejectionReason) {
    updatedTask.rejectionReason = payload.rejectionReason;
  }
  if (payload?.blockedReason) {
    updatedTask.blockedReason = payload.blockedReason;
  }
  if (payload?.deliverables) {
    updatedTask.deliverables = payload.deliverables;
  }
  if (payload?.notes) {
    updatedTask.deliverableDescription = payload.notes;
  }

  return { success: true, updatedTask };
}

export function calculateSchoolTaskRollup(schoolTask: SchoolTask): {
  progressPercent: number;
  completedSubTasks: number;
  totalSubTasks: number;
  calculatedStatus: "IN_PROGRESS" | "PENDING_EXECUTIVE_APPROVAL" | "COMPLETED";
} {
  const subTasks = schoolTask.subTasks || [];
  const totalSubTasks = subTasks.length;

  if (totalSubTasks === 0) {
    return {
      progressPercent: schoolTask.status === "COMPLETED" ? 100 : 0,
      completedSubTasks: 0,
      totalSubTasks: 0,
      calculatedStatus: schoolTask.status,
    };
  }

  const completedSubTasks = subTasks.filter(
    (st) => st.status === "COMPLETED"
  ).length;
  const progressPercent = Math.round((completedSubTasks / totalSubTasks) * 100);

  let calculatedStatus: "IN_PROGRESS" | "PENDING_EXECUTIVE_APPROVAL" | "COMPLETED" =
    schoolTask.status;

  if (progressPercent === 100) {
    calculatedStatus =
      schoolTask.status === "COMPLETED"
        ? "COMPLETED"
        : "PENDING_EXECUTIVE_APPROVAL";
  } else {
    calculatedStatus = "IN_PROGRESS";
  }

  return {
    progressPercent,
    completedSubTasks,
    totalSubTasks,
    calculatedStatus,
  };
}
