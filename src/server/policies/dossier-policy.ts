/**
 * DOSSIER POLICY ADAPTER
 *
 * Enforces authorization boundaries for WorkDossier and DossierItem resources.
 * Supports AuthenticatedUser, AuthenticatedUserContext, and AuthorizationContext.
 *
 * RFC-09 Invariant (Option B - Scoped Item-Level Read Only):
 * DossierItem.addedById MUST NOT grant whole-dossier access.
 * Contributor can only read/download their own contributed item via canReadDossierItem().
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

export interface DossierItemEntity {
  id?: string;
  itemId?: string | null;
  addedById?: string | null;
  dossierId?: string | null;
  [key: string]: any;
}

type UserLike = {
  id?: string;
  role?: string | null;
  systemRole?: string | null;
  activePositionCode?: string | null;
  positionCode?: string | null;
  departmentId?: string | null;
  activeUnitId?: string | null;
  [key: string]: any;
} | null | undefined;

function isAdmin(user: UserLike): boolean {
  if (!user) return false;
  const role = normalizeRole(user.role || (user as any).systemRole || '');
  return role === 'ADMIN';
}

function isExecutive(user: UserLike): boolean {
  if (!user) return false;
  const role = normalizeRole(user.role || (user as any).systemRole || '');
  if (role === 'ADMIN' || role === 'BAN_GIAM_HIEU' || role === 'RECTOR') return true;
  const pos = ((user as any).activePositionCode || user.positionCode || '').toUpperCase();
  return (
    pos === 'HIEU_TRUONG' ||
    pos === 'PHO_HIEU_TRUONG' ||
    pos === 'PHO_HIEU_TRUONG_DT' ||
    pos === 'PHO_HIEU_TRUONG_HC' ||
    pos === 'BAN_GIAM_HIEU' ||
    pos === 'RECTOR' ||
    pos === 'BGH'
  );
}

function isArchivistOrClerk(user: UserLike): boolean {
  if (!user) return false;
  const role = normalizeRole(user.role || (user as any).systemRole || '');
  if (role === 'VAN_THU' || role === 'CLERK' || role === 'LUU_TRU' || role === 'ARCHIVIST') return true;
  const pos = ((user as any).activePositionCode || user.positionCode || '').toUpperCase();
  return pos === 'VAN_THU' || pos === 'CLERK' || pos === 'LUU_TRU' || pos === 'ARCHIVIST';
}

/**
 * Checks if user can read the specified dossier.
 * Strictly checks ownership, unit boundary, archival clearance, and data classification.
 *
 * NOTE (RFC-09 Option B):
 * DossierItem.addedById MUST NOT grant whole-dossier access.
 * Item contributors can only access their contributed items via canReadDossierItem().
 */
export function canReadDossier(
  userOrContext: AuthenticatedUser | AuthorizationContext | any,
  dossier: DossierEntity
): boolean {
  if (!userOrContext || !dossier) return false;

  const isAuthContext = typeof (userOrContext as any).isSystemAdmin === 'function';
  const user = isAuthContext ? (userOrContext as AuthorizationContext).user : userOrContext;
  const userId = isAuthContext ? (userOrContext as AuthorizationContext).userId : (userOrContext as any)?.id;

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
      primaryOwnerId: dossier.archivedById,
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
      ['HIEU_TRUONG', 'PHO_HIEU_TRUONG', 'BAN_GIAM_HIEU', 'RECTOR'].includes(p.positionCode.toUpperCase())
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

  // 6. Contributor of an item inside the dossier:
  // [RFC-09 Option B]: REMOVED. DossierItem.addedById MUST NOT grant whole-dossier access.

  // 7. Unit Boundary: Members of the owning unit (for non-RESTRICTED / non-PERSONAL_DATA dossiers)
  const isRestrictedOrPersonal =
    dossier.classification === 'RESTRICTED' ||
    dossier.classification === 'PERSONAL_DATA' ||
    dossier.securityLevel === 'MAT' ||
    dossier.securityLevel === 'TOI_MAT' ||
    dossier.securityLevel === 'TUYET_MAT';

  if (!isRestrictedOrPersonal) {
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
  }

  return false;
}

/**
 * Checks if user can read/download a specific item within a dossier (RFC-09 Option B).
 * 1. If user has full access to the dossier (canReadDossier), returns true.
 * 2. Else if item.addedById === actor.id (or actor.userId), returns true (Scoped Item-Level Read Only).
 * 3. Else returns false.
 */
export function canReadDossierItem(
  actor: AuthenticatedUser | AuthorizationContext | any,
  item: DossierItemEntity,
  dossier: DossierEntity
): boolean {
  if (!actor || !item || !dossier) return false;

  // 1. Full access to whole dossier grants access to all items
  if (canReadDossier(actor, dossier)) {
    return true;
  }

  // 2. Scoped Item-Level Read Only: Contributor can read/download their own item
  const isAuthContext = typeof (actor as any).isSystemAdmin === 'function';
  const userId = isAuthContext
    ? (actor as AuthorizationContext).userId
    : (actor as any)?.id;

  if (userId && item.addedById && item.addedById === userId) {
    return true;
  }

  return false;
}

export const dossierPolicy = {
  canReadDossier,
  canReadDossierItem,
};
