import type { AuthUser, UserRole } from "../types/auth";
import type {
  StaffTask,
  SchoolTask,
  DeliverableItem,
  TaskStatus,
  AIRiskStatus,
  AISuggestedAction,
  AIFlagItem,
  AIReviewSummary,
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

  if (Number.isNaN(internalTime) || Number.isNaN(schoolTime)) {
    return { valid: false, error: "Định dạng ngày tháng không hợp lệ." };
  }

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

  // Rule 1: STAFF cannot directly complete task if it requires review (Nhiệm vụ trọng điểm / DACUM)
  if (newStatus === "COMPLETED" && role === "STAFF" && task.requiresReview) {
    return {
      success: false,
      error:
        "Nhiệm vụ này yêu cầu nghiệm thu sản phẩm (DACUM). Chỉ Trưởng phòng hoặc BGH mới có quyền nghiệm thu và hoàn thành nhiệm vụ. Viên chức vui lòng nộp minh chứng để chuyển sang Chờ duyệt (NEEDS_REVIEW).",
    };
  }

  // Rule 2: Submitting to NEEDS_REVIEW requires deliverables
  if (newStatus === "NEEDS_REVIEW") {
    const deliverables =
      payload?.deliverables !== undefined
        ? payload.deliverables
        : task.deliverables || [];
    const notes =
      payload?.notes !== undefined
        ? payload.notes
        : task.deliverables && task.deliverables.length > 0
        ? task.deliverableDescription
        : "";
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
    if (!payload?.rejectionReason || !payload.rejectionReason.trim()) {
      return {
        success: false,
        error: "Lý do trả lại yêu cầu chỉnh sửa bắt buộc phải được ghi rõ.",
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

export function screenDeliverablesWithAI(
  task: StaffTask,
  schoolTask?: SchoolTask,
  now: Date = new Date()
): AIReviewSummary {
  const deliverables = task.deliverables || [];
  const desc = (task.deliverableDescription || "").trim();
  const flags: AIFlagItem[] = [];
  const dacumCriteriaMatched: string[] = [];

  let complianceScore = 50;

  // Rule 1: Check physical attachments / links
  const validAttachments = deliverables.filter(
    (d) => d.url && d.url.trim().length > 0
  );
  if (validAttachments.length > 0) {
    complianceScore += 25;
    dacumCriteriaMatched.push(
      `Đính kèm ${validAttachments.length} tệp minh chứng có đường dẫn hợp lệ`
    );
  } else {
    flags.push({
      type: "CRITICAL",
      message: "Thiếu tệp minh chứng hoặc liên kết kiểm tra sản phẩm.",
    });
  }

  // Rule 2: Check narrative richness
  if (desc.length >= 30) {
    complianceScore += 15;
    dacumCriteriaMatched.push("Bản mô tả kết quả bàn giao đầy đủ chi tiết");
  } else if (desc.length === 0) {
    flags.push({
      type: "WARNING",
      message: "Chưa có phần thuyết minh tóm tắt sản phẩm.",
    });
  } else {
    flags.push({
      type: "INFO",
      message: "Phần thuyết minh sản phẩm còn ngắn gọn.",
    });
  }

  // Rule 3: Match DACUM keywords
  const textContent = `${task.title} ${desc} ${deliverables.map((d) => d.name).join(" ")}`.toLowerCase();
  const dacumKeywords = [
    { kw: "giáo trình", label: "Chuẩn hóa giáo trình môn học" },
    { kw: "đề cương", label: "Đề cương chi tiết học phần" },
    { kw: "nghiệm thu", label: "Biên bản nghiệm thu chuyên môn" },
    { kw: "báo cáo", label: "Báo cáo tiến độ và kết quả" },
    { kw: "ngân hàng đề", label: "Ngân hàng câu hỏi/đề thi chuẩn đầu ra" },
    { kw: "kế hoạch", label: "Kế hoạch giảng dạy/thực hành" },
  ];

  for (const { kw, label } of dacumKeywords) {
    if (textContent.includes(kw)) {
      dacumCriteriaMatched.push(label);
      complianceScore += 5;
    }
  }

  // Rule 4: Check deadline proximity to school task
  if (schoolTask?.dueDate && task.dueDate) {
    const schoolDue = new Date(schoolTask.dueDate).getTime();
    const diffHours = (schoolDue - now.getTime()) / (1000 * 3600);

    if (diffHours >= 0 && diffHours <= 24) {
      flags.push({
        type: "WARNING",
        message: "Thời hạn hoàn thành cận kề hạn chót của Nhiệm vụ cấp Trường (dưới 24h).",
      });
      complianceScore = Math.max(0, complianceScore - 10);
    }
  }

  complianceScore = Math.min(100, Math.max(0, complianceScore));

  let status: AIRiskStatus = "CLEAN";
  let suggestedAction: AISuggestedAction = "QUICK_APPROVE";

  if (complianceScore < 60 || flags.some((f) => f.type === "CRITICAL")) {
    status = "HIGH_RISK";
    suggestedAction = "REQUEST_CHANGES";
  } else if (complianceScore < 85 || flags.some((f) => f.type === "WARNING")) {
    status = "NEEDS_ATTENTION";
    suggestedAction = "MANUAL_INSPECT";
  }

  let executiveSummary = "";
  if (status === "CLEAN") {
    executiveSummary = `Hồ sơ sản phẩm đầy đủ ${deliverables.length} minh chứng, đáp ứng chuẩn kỹ năng DACUM (Điểm tuân thủ: ${complianceScore}%). Đề xuất Lãnh đạo nghiệm thu.`;
  } else if (status === "NEEDS_ATTENTION") {
    executiveSummary = `Hồ sơ cơ bản hoàn thành nhưng có điểm cần lưu ý (${flags.map((f) => f.message).join("; ")}). Đề xuất Lãnh đạo kiểm tra trước khi duyệt.`;
  } else {
    executiveSummary = `Hồ sơ chưa đạt yêu cầu do thiếu minh chứng hoặc thông tin cốt lõi. Đề xuất Lãnh đạo yêu cầu bổ sung chỉnh sửa.`;
  }

  return {
    status,
    executiveSummary,
    complianceScore,
    dacumCriteriaMatched,
    flags,
    suggestedAction,
    analyzedAt: now.toISOString(),
    suggestedFeedback:
      status === "HIGH_RISK"
        ? "Yêu cầu viên chức bổ sung đường dẫn minh chứng và biên bản nghiệm thu theo đúng quy định."
        : undefined,
  };
}
