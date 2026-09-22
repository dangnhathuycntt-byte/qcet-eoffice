/**
 * QCET E-Office — Meeting State Machine (WI-6.1a / Issue #75)
 *
 * Formal state transition engine for institutional meetings:
 * DRAFT_AGENDA -> INVITED -> HELD -> MINUTES_DRAFT -> MINUTES_CONFIRMED
 * Terminal States: MINUTES_CONFIRMED, CANCELLED
 *
 * Invariants:
 * - Pure domain entity: Zero external framework imports (No React, Next.js, or UI libs).
 * - Forward-only workflow through canonical meeting stages.
 * - Any non-terminal state may transition to CANCELLED.
 * - Terminal states (MINUTES_CONFIRMED, CANCELLED) are strictly immutable.
 */

export const MEETING_STATUSES = [
  "DRAFT_AGENDA",
  "INVITED",
  "HELD",
  "MINUTES_DRAFT",
  "MINUTES_CONFIRMED",
  "CANCELLED",
] as const;

export type MeetingStatus = (typeof MEETING_STATUSES)[number];

/**
 * Canonical meeting transition matrix.
 * Every forward transition is strictly defined; CANCELLED is reachable from all active states.
 */
export const ALLOWED_MEETING_TRANSITIONS: Record<MeetingStatus, readonly MeetingStatus[]> = {
  DRAFT_AGENDA: ["INVITED", "CANCELLED"],
  INVITED: ["HELD", "CANCELLED"],
  HELD: ["MINUTES_DRAFT", "CANCELLED"],
  MINUTES_DRAFT: ["MINUTES_CONFIRMED", "CANCELLED"],
  MINUTES_CONFIRMED: [],
  CANCELLED: [],
};

export const TERMINAL_MEETING_STATUSES: readonly MeetingStatus[] = [
  "MINUTES_CONFIRMED",
  "CANCELLED",
] as const;

export class InvalidMeetingStateTransitionError extends Error {
  public readonly code = "INVALID_WORKFLOW_STATE";
  public readonly statusCode = 400;
  public readonly from: string;
  public readonly to: string;

  constructor(from: string, to: string) {
    super(`Không thể chuyển trạng thái cuộc họp từ '${from}' sang '${to}'.`);
    this.name = "InvalidMeetingStateTransitionError";
    this.from = from;
    this.to = to;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class FinalizedMeetingError extends Error {
  public readonly code = "INVALID_WORKFLOW_STATE";
  public readonly statusCode = 400;
  public readonly status: string;

  constructor(status: string, action?: string) {
    super(
      action
        ? `Không thể thực hiện '${action}' vì cuộc họp đã kết thúc ở trạng thái '${status}'.`
        : `Cuộc họp đã kết thúc ở trạng thái '${status}', không thể thay đổi.`
    );
    this.name = "FinalizedMeetingError";
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Check whether a meeting transition from one status to another is permitted.
 */
export function canTransition(
  from: MeetingStatus | string,
  to: MeetingStatus | string
): boolean {
  const allowed = ALLOWED_MEETING_TRANSITIONS[from as MeetingStatus];
  if (!allowed) {
    return false;
  }
  return allowed.includes(to as MeetingStatus);
}

/**
 * Check if the meeting has reached a terminal / finalized state.
 */
export function isMeetingFinalized(status: MeetingStatus | string): boolean {
  return status === "MINUTES_CONFIRMED" || status === "CANCELLED";
}

/**
 * Assert that a status transition is permitted, throwing InvalidMeetingStateTransitionError if invalid.
 */
export function assertTransition(
  from: MeetingStatus | string,
  to: MeetingStatus | string
): void {
  if (!canTransition(from, to)) {
    throw new InvalidMeetingStateTransitionError(from, to);
  }
}

/**
 * Assert that the meeting has not reached a finalized state, throwing FinalizedMeetingError if it has.
 */
export function assertMeetingNotFinalized(
  status: MeetingStatus | string,
  action?: string
): void {
  if (isMeetingFinalized(status)) {
    throw new FinalizedMeetingError(status, action);
  }
}

/**
 * Static facade class for object-style usage
 */
export class MeetingStateMachine {
  static readonly STATUSES = MEETING_STATUSES;
  static readonly TRANSITIONS = ALLOWED_MEETING_TRANSITIONS;
  static readonly TERMINAL_STATUSES = TERMINAL_MEETING_STATUSES;

  static canTransition(from: MeetingStatus | string, to: MeetingStatus | string): boolean {
    return canTransition(from, to);
  }

  static assertTransition(from: MeetingStatus | string, to: MeetingStatus | string): void {
    assertTransition(from, to);
  }

  static isFinalized(status: MeetingStatus | string): boolean {
    return isMeetingFinalized(status);
  }

  static assertNotFinalized(status: MeetingStatus | string, action?: string): void {
    assertMeetingNotFinalized(status, action);
  }
}
