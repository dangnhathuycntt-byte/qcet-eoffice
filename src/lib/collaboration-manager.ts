import type { AuthUser } from "../types/auth";
import type { CollaborationRequest, StaffTask } from "../types/dashboard";

/**
 * Tạo phiếu yêu cầu phối hợp liên phòng ban mới
 */
export function createCollaborationRequest(
  params: Omit<CollaborationRequest, "id" | "createdAt" | "status">
): CollaborationRequest {
  const id = `collab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  return {
    ...params,
    id,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Tiếp nhận phiếu phối hợp từ phòng ban khác, phân công nhân sự nội bộ và sinh sub-tasks
 */
export function acceptCollaborationRequest(
  req: CollaborationRequest,
  _manager: AuthUser,
  assignedStaffIds: string[]
): {
  request: CollaborationRequest;
  subTasksToCreate: Partial<StaffTask>[];
} {
  const updatedRequest: CollaborationRequest = {
    ...req,
    status: "ACCEPTED",
    assignedStaffIds,
  };

  const subTasksToCreate: Partial<StaffTask>[] = assignedStaffIds.map(() => ({
    title: `[Phối hợp: ${req.fromDeptName}] ${req.description}`,
    parentSchoolTaskId: req.schoolTaskId,
    dueDate: req.dueDate,
    internalDueDate: req.dueDate,
    status: "NEW",
    requiresReview: true,
    deliverableDescription: `Sản phẩm yêu cầu: ${req.requiredDeliverables}`,
    updatedAt: new Date().toISOString(),
  }));

  return {
    request: updatedRequest,
    subTasksToCreate,
  };
}

/**
 * Từ chối phiếu yêu cầu phối hợp kèm lý do cụ thể
 */
export function rejectCollaborationRequest(
  req: CollaborationRequest,
  reason: string
): CollaborationRequest {
  return {
    ...req,
    status: "REJECTED",
    rejectionReason: reason,
  };
}

/**
 * Lọc danh sách phiếu phối hợp theo phòng ban (chiều đến hoặc chiều đi)
 */
export function getCollaborationRequestsForDepartment(
  requests: CollaborationRequest[],
  deptCode: string,
  mode: "incoming" | "outgoing"
): CollaborationRequest[] {
  if (!Array.isArray(requests) || !deptCode) {
    return [];
  }
  const normalizedDept = deptCode.trim();
  if (mode === "incoming") {
    return requests.filter((r) => r.toDeptCode === normalizedDept);
  }
  return requests.filter((r) => r.fromDeptCode === normalizedDept);
}
