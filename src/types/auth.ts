export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF';

export interface OnboardingData {
  hasSeenWelcome?: boolean;
  hasCompletedTour?: boolean;
  completedSteps?: string[];
  isDismissed?: boolean;
  snoozedUntil?: string | null;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  department: string;
  departmentCode: string;
  avatar?: string;
  phone?: string;
  title?: string;
  aliases?: string[];
  isFirstLogin?: boolean;
  emailVerified?: boolean;
  provider?: 'google' | 'demo' | 'system';
  dbRole?: string;
  onboardedAt?: string | null;
  onboardingData?: OnboardingData | null;
}

/**
 * Live server-authenticated session with active credentials and server truth.
 */
export interface AuthenticatedSession {
  user: AuthUser;
  token?: string;
  expiresAt?: string;
}

/**
 * Offline cached identity representation (Phase 8: Auth/Session cleanup).
 * Distinct from an active server-authenticated session.
 * Allows viewing cached local data, but strictly forbids privileged mutations.
 */
export interface CachedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  department: string;
  departmentCode: string;
  avatar?: string;
  phone?: string;
  title?: string;
  aliases?: string[];
  isFirstLogin?: boolean;
  emailVerified?: boolean;
  provider?: 'google' | 'demo' | 'system';
  dbRole?: string;
  onboardedAt?: string | null;
  onboardingData?: OnboardingData | null;
  cachedAt?: string;
  isOfflineCached?: boolean;
}

/**
 * Offline cached identity representation.
 */
export type CachedOfflineIdentity = CachedUser;

/**
 * Explicit demo identity representation.
 */
export interface DemoIdentity {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  department: string;
  departmentCode: string;
  title?: string;
  isDemo: true;
}

/**
 * Strongly-typed session states (Phase 8: OWASP session truth):
 * - authenticated: Active valid server session
 * - offline-cached: Offline local cached state (read-only view, mutations prohibited)
 * - anonymous: Unauthenticated guest
 * - loading: Resolving server session or local storage
 */
export type AuthState =
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'offline-cached'; user: CachedUser }
  | { status: 'anonymous' }
  | { status: 'loading' };

export type PermissionChecker = (roleOrUser: UserRole | AuthUser | CachedUser | DemoIdentity) => boolean;

