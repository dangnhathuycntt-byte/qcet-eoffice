/**
 * LEGACY USER POLICY ADAPTER (Transitional)
 *
 * ARCHITECTURAL DEPRECATION NOTICE:
 * This module is a legacy adapter. Canonical account and identity authorization is governed
 * by canonical `authorize(context, action, resource)`.
 * Do not import role equivalence into new business logic.
 */

import { type AuthenticatedUser, normalizeRole } from '@/server/api/request-context';

function isAdmin(user: AuthenticatedUser): boolean {
  return normalizeRole(user.role) === 'ADMIN';
}

/**
 * Checks if user can view target user details.
 */
export function canViewUser(
  currentUser: AuthenticatedUser,
  targetUserId: string
): boolean {
  return Boolean(currentUser && currentUser.id && targetUserId);
}

/**
 * Checks if user can modify another user's role.
 * Institutional governance restricts role modifications to BAN_GIAM_HIEU / ADMIN.
 */
export function canUpdateUserRole(
  currentUser: AuthenticatedUser,
  targetUserId: string
): boolean {
  if (!currentUser || !currentUser.id || !targetUserId) return false;
  return isAdmin(currentUser);
}

export const userPolicy = {
  canViewUser,
  canUpdateUserRole,
};
