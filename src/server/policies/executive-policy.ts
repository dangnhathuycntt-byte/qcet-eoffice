import { type AuthenticatedUser, normalizeRole } from '@/server/api/request-context';

export function isAdmin(user: AuthenticatedUser): boolean {
  if (!user || !user.role) return false;
  return normalizeRole(user.role) === 'ADMIN';
}

function isExecutive(user: AuthenticatedUser): boolean {
  return normalizeRole(user.role) === 'ADMIN';
}

/**
 * Checks if user can access executive resolutions and leadership minutes.
 * Strictly restricted to BAN_GIAM_HIEU / ADMIN.
 */
export function canAccessExecutiveResolutions(user: AuthenticatedUser): boolean {
  if (!user || !user.id) return false;
  return isExecutive(user);
}

/**
 * Checks if user can create an executive resolution.
 */
export function canCreateResolution(user: AuthenticatedUser): boolean {
  if (!user || !user.id) return false;
  return isExecutive(user);
}

/**
 * Checks if user can update, publish, or delete an executive resolution.
 */
export function canManageResolution(user: AuthenticatedUser): boolean {
  if (!user || !user.id) return false;
  return isExecutive(user);
}

export const executivePolicy = {
  canAccessExecutiveResolutions,
  canCreateResolution,
  canManageResolution,
};
