/**
 * CANONICAL AVAILABLE ACTIONS COMPUTATION
 *
 * Architecture & Governance Reference:
 * - Vietnamese Higher Vocational Education Law (Luật Giáo dục nghề nghiệp)
 * - Administrative Procedure & Clerical Decree (Nghị định 30/2020/NĐ-CP)
 * - System Invariant 1: One Capability, One Implementation (No parallel UI matrix)
 * - System Invariant 3: Server Truth Wins (availableActions is purely UI hinting;
 *   server mutations independently re-evaluate authorization)
 */

import type { AuthorizationContext } from './authorization-context';
import type { CapabilityAction } from './capability';
import type { AuthorizationResource } from './resource';
import { authorize } from './authorization-engine';

// ============================================================================
// CANONICAL CANDIDATE ACTION LISTS
// ============================================================================

export const CANONICAL_MEETING_ACTIONS: CapabilityAction[] = [
  'meeting.read',
  'meeting.update',
  'meeting.manage_participants',
  'meeting.draft_minutes',
  'meeting.confirm_minutes',
  'meeting.create_resolution',
  'meeting.publish_resolution',
];

export const CANONICAL_DOCUMENT_ACTIONS: CapabilityAction[] = [
  'document.read',
  'document.read_restricted',
  'document.register',
  'document.direct',
  'document.assign_unit',
  'document.review_content',
  'document.review_format',
  'document.sign',
  'document.assign_number',
  'document.organization_sign',
  'document.issue',
  'document.archive',
];

export const CANONICAL_TASK_ACTIONS: CapabilityAction[] = [
  'task.read',
  'task.create',
  'task.review',
  'task.approve',
  'task.reassign',
  'task.monitor',
];

/**
 * Resolves default candidate actions for a given resource type if none are explicitly provided.
 */
export function getCandidateActionsForResource(resource: AuthorizationResource): CapabilityAction[] {
  if (!resource || !resource.type) {
    return [];
  }

  const type = resource.type.toLowerCase();
  if (type === 'meeting') {
    return CANONICAL_MEETING_ACTIONS;
  }
  if (type === 'document' || type === 'document_incoming' || type === 'document_outgoing') {
    return CANONICAL_DOCUMENT_ACTIONS;
  }
  if (type === 'task') {
    return CANONICAL_TASK_ACTIONS;
  }

  return [];
}

/**
 * Computes permitted actions for a user against a target resource.
 *
 * CRITICAL ARCHITECTURAL INVARIANTS:
 * 1. Must use the canonical authorize() engine under the hood. No parallel UI logic or ad-hoc role checking.
 * 2. Result is strictly for client UI hinting (e.g. enabling/disabling buttons).
 *    All server mutations must re-evaluate authorization independently.
 */
export function computeAvailableActions(
  context: AuthorizationContext,
  resource: AuthorizationResource,
  candidateActions?: CapabilityAction[],
  now: Date = new Date()
): CapabilityAction[] {
  if (!context || !resource) {
    return [];
  }

  const candidates = candidateActions && candidateActions.length > 0
    ? candidateActions
    : getCandidateActionsForResource(resource);

  const available: CapabilityAction[] = [];

  for (const action of candidates) {
    const decision = authorize(context, action, resource, now);
    if (decision.allowed) {
      available.push(action);
    }
  }

  return available;
}

/**
 * Helper to build canonical document AuthorizationResource from a Document record or DTO.
 */
export function buildDocumentResource(doc: any): AuthorizationResource {
  if (!doc) {
    return { type: 'document', id: '' };
  }

  let resourceType: 'document' | 'document_incoming' | 'document_outgoing' = 'document';
  const rawType = (doc.type || '').toString().toUpperCase();
  if (rawType === 'VAN_BAN_DEN' || rawType === 'DOCUMENT_INCOMING' || rawType === 'INCOMING') {
    resourceType = 'document_incoming';
  } else if (rawType === 'VAN_BAN_DI' || rawType === 'DOCUMENT_OUTGOING' || rawType === 'OUTGOING') {
    resourceType = 'document_outgoing';
  }

  const creatorId = doc.creatorId || doc.createdById || undefined;
  const leadUnitId = doc.leadUnitId || doc.leadDepartmentId || undefined;
  const draftingUnitId = doc.draftingUnitId || doc.draftingDeptId || undefined;
  const unitId = doc.unitId || doc.departmentId || leadUnitId || draftingUnitId || undefined;

  return {
    ...doc,
    type: resourceType,
    id: doc.id,
    securityLevel: doc.securityLevel ?? undefined,
    classification: doc.classification ?? undefined,
    status: doc.status ?? undefined,
    creatorId,
    createdById: creatorId,
    leadUnitId,
    draftingUnitId,
    unitId,
    leadDepartmentId: leadUnitId,
    draftingDeptId: draftingUnitId,
    departmentId: doc.departmentId || unitId,
    registeredById: doc.registeredById || undefined,
    signerId: doc.signerId || undefined,
    signerName: doc.signerName || undefined,
    drafterId: doc.drafterId || doc.draftingUserId || undefined,
    leadUserId: doc.leadUserId || undefined,
    primaryOwnerId: doc.primaryOwnerId || doc.leadUserId || undefined,
    targetUserId: doc.targetUserId || undefined,
  };
}
