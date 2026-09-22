/**
 * Work Dossier State Machine & Archival Lifecycle Engine (WI-6.2a / Issue #77)
 *
 * Implements official institutional records management and archival state machine
 * adhering to Nghị định 30/2020/NĐ-CP & Luật Lưu trữ:
 *
 * State Transition Matrix:
 * - OPEN -> [ACTIVE, CLOSED]
 * - ACTIVE -> [CLOSED, READY_FOR_ARCHIVE]
 * - CLOSED -> [ACTIVE, READY_FOR_ARCHIVE]
 * - READY_FOR_ARCHIVE -> [SUBMITTED_TO_ARCHIVE, ACTIVE]
 * - SUBMITTED_TO_ARCHIVE -> [ACCEPTED, READY_FOR_ARCHIVE]
 * - ACCEPTED -> [ARCHIVED]
 * - ARCHIVED -> [] (terminal)
 *
 * Invariants Enforced:
 * - Pure Domain Entity: Decoupled from external UI frameworks.
 * - Immutability: Dossiers in CLOSED, READY_FOR_ARCHIVE, SUBMITTED_TO_ARCHIVE, ACCEPTED, or ARCHIVED
 *   state reject structural and content modifications (adding/removing items).
 * - Terminal State Protection: ARCHIVED dossiers are permanent historical records with zero outgoing transitions.
 */

import { InvalidTransitionError } from '@/server/api/errors';

export type DossierStatus =
  | 'OPEN'
  | 'ACTIVE'
  | 'CLOSED'
  | 'READY_FOR_ARCHIVE'
  | 'SUBMITTED_TO_ARCHIVE'
  | 'ACCEPTED'
  | 'ARCHIVED';

export const DossierStatus = {
  OPEN: 'OPEN',
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
  READY_FOR_ARCHIVE: 'READY_FOR_ARCHIVE',
  SUBMITTED_TO_ARCHIVE: 'SUBMITTED_TO_ARCHIVE',
  ACCEPTED: 'ACCEPTED',
  ARCHIVED: 'ARCHIVED',
} as const;

/**
 * Valid state transitions for Work Dossier lifecycle
 */
export const DOSSIER_TRANSITIONS: Record<DossierStatus, readonly DossierStatus[]> = {
  OPEN: ['ACTIVE', 'CLOSED'],
  ACTIVE: ['CLOSED', 'READY_FOR_ARCHIVE'],
  CLOSED: ['ACTIVE', 'READY_FOR_ARCHIVE'],
  READY_FOR_ARCHIVE: ['SUBMITTED_TO_ARCHIVE', 'ACTIVE'],
  SUBMITTED_TO_ARCHIVE: ['ACCEPTED', 'READY_FOR_ARCHIVE'],
  ACCEPTED: ['ARCHIVED'],
  ARCHIVED: [],
} as const;

/**
 * Terminal states in the dossier lifecycle.
 * Once reached, no further transitions are permitted.
 */
export const TERMINAL_DOSSIER_STATUSES: readonly DossierStatus[] = [
  'ARCHIVED',
] as const;

/**
 * Immutable states in the dossier lifecycle.
 * Content and items cannot be added or removed in these states.
 */
export const IMMUTABLE_DOSSIER_STATUSES: readonly DossierStatus[] = [
  'CLOSED',
  'READY_FOR_ARCHIVE',
  'SUBMITTED_TO_ARCHIVE',
  'ACCEPTED',
  'ARCHIVED',
] as const;

/**
 * Check whether a state transition from `from` to `to` is permitted.
 */
export function canTransition(from: DossierStatus, to: DossierStatus): boolean {
  const allowed = DOSSIER_TRANSITIONS[from];
  if (!allowed) {
    return false;
  }
  return allowed.includes(to);
}

/**
 * Assert that a state transition is valid or throw an InvalidTransitionError.
 */
export function assertTransition(
  from: DossierStatus,
  to: DossierStatus,
  context?: { dossierId?: string; details?: string }
): void {
  if (!canTransition(from, to)) {
    const contextMsg = context?.dossierId ? ` cho hồ sơ ${context.dossierId}` : '';
    const detailsMsg = context?.details ? `: ${context.details}` : '';
    throw new InvalidTransitionError(
      `Không thể chuyển trạng thái hồ sơ công việc từ '${from}' sang '${to}'${contextMsg}${detailsMsg}. Chuyển đổi không hợp lệ theo quy trình quản lý hồ sơ và lưu trữ.`,
      'INVALID_TRANSITION',
      { fromStatus: from, toStatus: to }
    );
  }
}

/**
 * Check if a dossier in the given status is immutable (cannot add/remove items).
 */
export function isDossierImmutable(status: DossierStatus): boolean {
  return IMMUTABLE_DOSSIER_STATUSES.includes(status);
}

/**
 * Assert that a dossier is not in an immutable status or throw an InvalidTransitionError.
 */
export function assertDossierNotImmutable(
  status: DossierStatus,
  actionDescription = 'thay đổi'
): void {
  if (isDossierImmutable(status)) {
    throw new InvalidTransitionError(
      `Không thể ${actionDescription} hồ sơ đã đóng hoặc đã nộp lưu trữ (Trạng thái: ${status})`,
      'INVALID_TRANSITION',
      { fromStatus: status }
    );
  }
}

/**
 * Check if a dossier status is a terminal state.
 */
export function isTerminalState(status: DossierStatus): boolean {
  return TERMINAL_DOSSIER_STATUSES.includes(status);
}
