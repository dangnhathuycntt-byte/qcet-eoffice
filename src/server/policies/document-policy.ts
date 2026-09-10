import { type AuthenticatedUser, normalizeRole } from '@/server/api/request-context';

export interface DocumentEntity {
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
  return normalizeRole(user.role) === 'ADMIN';
}

export function isManager(user: AuthenticatedUser): boolean {
  return normalizeRole(user.role) === 'MANAGER';
}

export function isClerk(user: AuthenticatedUser): boolean {
  return normalizeRole(user.role) === 'VAN_THU';
}

/**
 * Checks if user can read the specified document.
 */
export function canReadDocument(
  user: AuthenticatedUser,
  doc: DocumentEntity
): boolean {
  if (!user || !doc) return false;

  // Public documents are readable by any authenticated user
  if (doc.isPublic) return true;

  // Documents scoped to the entire school
  const scopeUpper = (doc.scope || '').toString().trim().toUpperCase();
  if (scopeUpper === 'SCHOOL' || scopeUpper === 'PUBLIC') {
    return true;
  }

  // Institutional leadership / Admin
  if (isAdmin(user)) return true;

  // Clerical / Văn thư staff have registry read authority across documents
  if (isClerk(user)) return true;

  // Creator or registered user or lead user can read
  if (doc.creatorId && doc.creatorId === user.id) return true;
  if (doc.registeredById && doc.registeredById === user.id) return true;
  if (doc.leadUserId && doc.leadUserId === user.id) return true;

  // Members of the document's department
  if (user.departmentId) {
    if (doc.departmentId && doc.departmentId === user.departmentId) return true;
    if (doc.leadDepartmentId && doc.leadDepartmentId === user.departmentId) return true;
    if (doc.draftingDeptId && doc.draftingDeptId === user.departmentId) return true;
  }

  return false;
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
  user: AuthenticatedUser,
  doc: DocumentEntity
): boolean {
  if (!user || !doc) return false;

  if (isAdmin(user)) return true;
  if (isClerk(user)) return true;

  // Creator or registered user can update
  if (doc.creatorId && doc.creatorId === user.id) return true;
  if (doc.registeredById && doc.registeredById === user.id) return true;

  // Department manager of the document's department
  if (isManager(user) && user.departmentId) {
    if (doc.departmentId && user.departmentId === doc.departmentId) return true;
    if (doc.leadDepartmentId && user.departmentId === doc.leadDepartmentId) return true;
    if (doc.draftingDeptId && user.departmentId === doc.draftingDeptId) return true;
  }

  return false;
}

/**
 * Checks if user has authority to give executive direction / bút phê on the document.
 * Restricted strictly to BAN_GIAM_HIEU / ADMIN and TRUONG_PHONG of the relevant department.
 */
export function canDirectDocument(
  user: AuthenticatedUser,
  doc: DocumentEntity
): boolean {
  if (!user || !doc) return false;

  if (isAdmin(user)) return true;

  if (isManager(user) && user.departmentId) {
    if (doc.departmentId && user.departmentId === doc.departmentId) return true;
    if (doc.leadDepartmentId && user.departmentId === doc.leadDepartmentId) return true;
    if (doc.draftingDeptId && user.departmentId === doc.draftingDeptId) return true;
  }

  return false;
}

/**
 * Checks if user can delete the document.
 */
export function canDeleteDocument(
  user: AuthenticatedUser,
  doc: DocumentEntity
): boolean {
  if (!user || !doc) return false;

  if (isAdmin(user)) return true;

  if (doc.creatorId && doc.creatorId === user.id) return true;
  if (doc.registeredById && doc.registeredById === user.id) return true;

  if (isManager(user) && user.departmentId) {
    if (doc.departmentId && user.departmentId === doc.departmentId) return true;
    if (doc.leadDepartmentId && user.departmentId === doc.leadDepartmentId) return true;
    if (doc.draftingDeptId && user.departmentId === doc.draftingDeptId) return true;
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
