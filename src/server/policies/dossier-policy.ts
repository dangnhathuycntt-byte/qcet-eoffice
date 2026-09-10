/**
 * DOSSIER POLICY ADAPTER
 *
 * Enforces authorization boundaries for WorkDossier and DossierItem resources.
 * Supports AuthenticatedUser and AuthorizationContext.
 */

import { type AuthenticatedUser, normalizeRole } from '@/server/api/request-context';
import type { AuthorizationContext } from '@/server/authorization/authorization-context';
import {
  canAccessClassification,
  type DocumentClassificationTarget,
} from '@/server/authorization/document-classification';

export interface DossierEntity {
  id: string;
  code?: string;
  owningUnitId?: string | null;
  responsiblePersonId?: string | null;
  submittedById?: string | null;
  archivedById?: string | null;
  status?: string | null;
  classification?: string | null;
  securityLevel?: string | null;
  items?: Array<{
    id?: string;
    itemId?: string | null;
    addedById?: string | null;
    [key: string]: any;
  }> | null;
  [key: string]: any;
}

type UserLike = {
  id?: string;
  role?: string | null;
  activePositionCode?: string | null;
  positionCode?: string | null;
  departmentId?: string | null;
  [key: string]: any;
} | null | undefined;

function isAdmin(user: UserLike): boolean {
  if (!user || !user.role) return false;
  return normalizeRole(user.role) === 'ADMIN';
}

function isExecutive(user: UserLike): boolean {
  if (!user || !user.role) return false;
  const role = normalizeRole(user.role);
  return role === 'ADMIN' || role === 'BAN_GIAM_HIEU';
}

function isArchivistOrClerk(user: UserLike): boolean {
  if (!user || !user.role) return false;
  const role = normalizeRole(user.role);
  if (role === 'VAN_THU') return true;
  const pos = ((user as any).activePositionCode || user.positionCode || '').toUpperCase();
  return pos === 'VAN_THU' || pos === 'CLERK' || pos === 'LUU_TRU' || pos === 'ARCHIVIST';
}

/**
 * Checks if user can read the specified dossier.
 * Strictly checks ownership, unit boundary, archival clearance, and data classification.
 */
export function canReadDossier(
  userOrContext: AuthenticatedUser | AuthorizationContext,
  dossier: DossierEntity
): boolean {
  if (!userOrContext || !dossier) return false;

  const isAuthContext = typeof (userOrContext as any).isSystemAdmin === 'function';
  const user = isAuthContext ? (userOrContext as AuthorizationContext).user : (userOrContext as AuthenticatedUser);
  const userId = isAuthContext ? (userOrContext as AuthorizationContext).userId : user?.id;

  if (!userId) return false;

  // 1. Check data classification clearance if classified
  if (dossier.classification || dossier.securityLevel) {
    const classificationTarget: DocumentClassificationTarget = {
      id: dossier.id,
      classification: dossier.classification,
      securityLevel: dossier.securityLevel,
      owningUnitId: dossier.owningUnitId,
      departmentId: dossier.owningUnitId,
      creatorId: dossier.responsiblePersonId,
      registeredById: dossier.submittedById,
    };
    const access = canAccessClassification(userOrContext as any, classificationTarget);
    if (!access.allowed) {
      return false;
    }
  }

  // 2. System Administrator
  if (isAuthContext && (userOrContext as AuthorizationContext).isSystemAdmin()) {
    return true;
  }
  if (isAdmin(user)) {
    return true;
  }

  // 3. Institutional Executive Leadership
  if (isExecutive(user)) {
    return true;
  }
  if (isAuthContext) {
    const hasExecPosition = (userOrContext as AuthorizationContext).positions?.some((p) =>
      ['HIEU_TRUONG', 'PHO_HIEU_TRUONG', 'BAN_GIAM_HIEU'].includes(p.positionCode.toUpperCase())
    );
    if (hasExecPosition) return true;
  }

  // 4. Archival and Clerical Personnel
  if (isArchivistOrClerk(user)) {
    return true;
  }

  // 5. Direct Responsibility / Creator / Submitter / Archiver
  if (dossier.responsiblePersonId && dossier.responsiblePersonId === userId) return true;
  if (dossier.submittedById && dossier.submittedById === userId) return true;
  if (dossier.archivedById && dossier.archivedById === userId) return true;

  // 6. Contributor of an item inside the dossier
  if (Array.isArray(dossier.items)) {
    const hasContributedItem = dossier.items.some(
      (item) => item.addedById === userId
    );
    if (hasContributedItem) return true;
  }

  // 7. Unit Boundary: Members of the owning unit
  const userUnitId =
    (user as any)?.departmentId ||
    (user as any)?.activeUnitId ||
    (isAuthContext ? (userOrContext as AuthorizationContext).primaryUnitIds?.[0] : null);

  if (dossier.owningUnitId && userUnitId && dossier.owningUnitId === userUnitId) {
    return true;
  }

  if (isAuthContext && dossier.owningUnitId) {
    const inUnit = (userOrContext as AuthorizationContext).primaryUnitIds?.includes(dossier.owningUnitId);
    if (inUnit) return true;
  }

  return false;
}

export const dossierPolicy = {
  canReadDossier,
};
