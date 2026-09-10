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

/**
 * Checks if user can complete the onboarding process for target user.
 * Restricted to the user themselves or BAN_GIAM_HIEU / ADMIN.
 */
export function canOnboardUser(
  currentUser: AuthenticatedUser,
  targetUserId: string
): boolean {
  if (!currentUser || !currentUser.id || !targetUserId) return false;
  return isAdmin(currentUser) || currentUser.id === targetUserId;
}

export const userPolicy = {
  canViewUser,
  canUpdateUserRole,
  canOnboardUser,
};
