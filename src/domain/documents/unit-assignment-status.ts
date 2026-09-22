/**
 * QCET E-Office — UnitWorkAssignment Controlled Vocabulary & State Management (WI-7.3 / Issue #88)
 *
 * Implements controlled vocabulary for UnitWorkAssignment.status:
 * - ASSIGNED: Đã phân công chuyên viên thụ lý (bước 4 quy trình văn bản đến).
 * - IN_PROGRESS: Chuyên viên đang thực hiện (hoặc đã sinh nhiệm vụ liên kết).
 * - RESOLVED: Đã giải quyết xong văn bản / hoàn thành nhiệm vụ.
 * - CANCELLED: Đã hủy phân công hoặc chuyển giao đơn vị khác.
 */

import { ValidationError, InvalidTransitionError } from "@/server/api/errors";

export const UNIT_WORK_ASSIGNMENT_STATUSES = [
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CANCELLED",
] as const;

export type UnitWorkAssignmentStatus = (typeof UNIT_WORK_ASSIGNMENT_STATUSES)[number];

export const UnitWorkAssignmentStatusValues = {
  ASSIGNED: "ASSIGNED" as const,
  IN_PROGRESS: "IN_PROGRESS" as const,
  RESOLVED: "RESOLVED" as const,
  CANCELLED: "CANCELLED" as const,
};

/**
 * Valid transitions for UnitWorkAssignment
 */
export const ALLOWED_UNIT_ASSIGNMENT_TRANSITIONS: Record<
  UnitWorkAssignmentStatus,
  readonly UnitWorkAssignmentStatus[]
> = {
  ASSIGNED: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["RESOLVED", "CANCELLED"],
  RESOLVED: [], // Terminal
  CANCELLED: [], // Terminal
};

export const TERMINAL_UNIT_ASSIGNMENT_STATUSES: readonly UnitWorkAssignmentStatus[] = [
  "RESOLVED",
  "CANCELLED",
];

/**
 * Check if a status string belongs to the controlled vocabulary
 */
export function isValidUnitWorkAssignmentStatus(
  status: unknown
): status is UnitWorkAssignmentStatus {
  return (
    typeof status === "string" &&
    UNIT_WORK_ASSIGNMENT_STATUSES.includes(status as UnitWorkAssignmentStatus)
  );
}

/**
 * Assert that status is valid, throwing ValidationError if not
 */
export function assertUnitWorkAssignmentStatus(
  status: unknown,
  fieldName = "status"
): UnitWorkAssignmentStatus {
  if (!isValidUnitWorkAssignmentStatus(status)) {
    throw new ValidationError(
      `Trạng thái phân công '${status}' không hợp lệ. Các trạng thái được phép: ${UNIT_WORK_ASSIGNMENT_STATUSES.join(
        ", "
      )}`,
      { [fieldName]: [`Giá trị phải thuộc danh mục: ${UNIT_WORK_ASSIGNMENT_STATUSES.join(", ")}`] },
      "INVALID_UNIT_ASSIGNMENT_STATUS"
    );
  }
  return status;
}

/**
 * Check if a transition between statuses is permitted
 */
export function canTransitionUnitAssignment(
  from: UnitWorkAssignmentStatus,
  to: UnitWorkAssignmentStatus
): boolean {
  const allowed = ALLOWED_UNIT_ASSIGNMENT_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Assert that transition is permitted, throwing InvalidTransitionError if not
 */
export function assertUnitAssignmentTransition(
  from: string,
  to: string,
  assignmentId?: string
): void {
  const validFrom = assertUnitWorkAssignmentStatus(from, "fromStatus");
  const validTo = assertUnitWorkAssignmentStatus(to, "toStatus");

  if (!canTransitionUnitAssignment(validFrom, validTo)) {
    const idMsg = assignmentId ? ` của phân công [${assignmentId}]` : "";
    throw new InvalidTransitionError(
      `Không thể chuyển trạng thái phân công công việc${idMsg} từ '${from}' sang '${to}'.`
    );
  }
}
