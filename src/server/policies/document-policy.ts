import { type AuthenticatedUser, normalizeRole } from '@/server/api/request-context';
import type { AuthorizationContext } from '@/server/authorization/authorization-context';
import {
  canAccessClassification,
  type DocumentClassificationTarget,
} from '@/server/authorization/document-classification';

export interface DocumentEntity extends DocumentClassificationTarget {
  id: string;
  departmentId?: string | null;
  leadDepartmentId?: string | null;
  draftingDeptId?: string | null;
  creatorId?: string | null;
  registeredById?: string | null;
  leadUserId?: string | null;
  scope?: string | null;
  isPublic?: boolean | null;
  [key: string]: any;
}

export function isAdmin(user: AuthenticatedUser): boolean {
  return normalizeRole(user?.role) === 'ADMIN';
}

export function isManager(user: AuthenticatedUser): boolean {
  return normalizeRole(user?.role) === 'MANAGER';
}

export function isClerk(user: AuthenticatedUser): boolean {
  return normalizeRole(user?.role) === 'VAN_THU';
}

/**
 * Checks if user can read the specified document.
 * Strictly enforces canonical document classification policy (F15).
 * Removes automatic bypasses for ADMIN or CLERK on RESTRICTED or MAT/TOI_MAT/TUYET_MAT documents.
 */
export function canReadDocument(
  userOrContext: AuthenticatedUser | AuthorizationContext,
  doc: DocumentEntity | DocumentClassificationTarget
): boolean {
  if (!userOrContext || !doc) return false;
  return canAccessClassification(userOrContext as any, doc as any).allowed;
}

/**
 * Checks if user can create a document.
 */
export function canCreateDocument(user: AuthenticatedUser): boolean {
  return Boolean(user && user.id);
}

/**
 * Checks if user can update document metadata or content.
 */
export function canUpdateDocument(
  userOrContext: AuthenticatedUser | AuthorizationContext,
  doc: DocumentEntity
): boolean {
  if (!userOrContext || !doc) return false;
  if (!canReadDocument(userOrContext, doc)) return false;

  const user =
    'user' in (userOrContext as any) && (userOrContext as any).user
      ? (userOrContext as any).user
      : (userOrContext as AuthenticatedUser);
  const userId = (userOrContext as any).userId || user?.id;

  // Creator or registered user can update
  if (doc.creatorId && doc.creatorId === userId) return true;
  if (doc.registeredById && doc.registeredById === userId) return true;

  // Department manager of the document's department
  const deptId =
    (userOrContext as any).primaryUnitIds?.[0] || (user as any)?.departmentId;
  if (isManager(user as AuthenticatedUser) && deptId) {
    if (doc.departmentId && deptId === doc.departmentId) return true;
    if (doc.leadDepartmentId && deptId === doc.leadDepartmentId) return true;
    if (doc.draftingDeptId && deptId === doc.draftingDeptId) return true;
  }

  // Clerical staff (Văn thư) for internal registry handling
  if (isClerk(user as AuthenticatedUser)) {
    return true;
  }

  return false;
}

/**
 * Checks if user has authority to give executive direction / bút phê on the document.
 * Restricted strictly to BAN_GIAM_HIEU / HIEU_TRUONG and TRUONG_PHONG of the relevant department.
 * Technical administrators (SYSTEM_ADMIN) cannot give executive directions.
 */
export function canDirectDocument(
  userOrContext: AuthenticatedUser | AuthorizationContext,
  doc: DocumentEntity
): boolean {
  if (!userOrContext || !doc) return false;
  if (!canReadDocument(userOrContext, doc)) return false;

  const user =
    'user' in (userOrContext as any) && (userOrContext as any).user
      ? (userOrContext as any).user
      : (userOrContext as AuthenticatedUser);
  const deptId =
    (userOrContext as any).primaryUnitIds?.[0] || (user as any)?.departmentId;

  // Executive leadership check
  const roleUpper = ((user as any)?.role || '').toUpperCase();
  const posUpper = ((user as any)?.positionCode || '').toUpperCase();
  const isExecutive =
    roleUpper === 'BAN_GIAM_HIEU' ||
    roleUpper === 'HIEU_TRUONG' ||
    roleUpper === 'PHO_HIEU_TRUONG' ||
    posUpper === 'HIEU_TRUONG' ||
    posUpper === 'PHO_HIEU_TRUONG' ||
    (typeof (userOrContext as any).hasPosition === 'function' &&
      ((userOrContext as any).hasPosition('HIEU_TRUONG') ||
        (userOrContext as any).hasPosition('PHO_HIEU_TRUONG')));

  if (isExecutive) return true;

  if (isManager(user as AuthenticatedUser) && deptId) {
    if (doc.departmentId && deptId === doc.departmentId) return true;
    if (doc.leadDepartmentId && deptId === doc.leadDepartmentId) return true;
    if (doc.draftingDeptId && deptId === doc.draftingDeptId) return true;
  }

  return false;
}

/**
 * Checks if user can delete the document.
 */
export function canDeleteDocument(
  userOrContext: AuthenticatedUser | AuthorizationContext,
  doc: DocumentEntity
): boolean {
  if (!userOrContext || !doc) return false;
  if (!canReadDocument(userOrContext, doc)) return false;

  const user =
    'user' in (userOrContext as any) && (userOrContext as any).user
      ? (userOrContext as any).user
      : (userOrContext as AuthenticatedUser);
  const userId = (userOrContext as any).userId || user?.id;

  if (doc.creatorId && doc.creatorId === userId) return true;
  if (doc.registeredById && doc.registeredById === userId) return true;

  const deptId =
    (userOrContext as any).primaryUnitIds?.[0] || (user as any)?.departmentId;
  if (isManager(user as AuthenticatedUser) && deptId) {
    if (doc.departmentId && deptId === doc.departmentId) return true;
    if (doc.leadDepartmentId && deptId === doc.leadDepartmentId) return true;
    if (doc.draftingDeptId && deptId === doc.draftingDeptId) return true;
  }

  return false;
}

export const documentPolicy = {
  canReadDocument,
  canCreateDocument,
  canUpdateDocument,
  canDirectDocument,
  canDeleteDocument,
};
