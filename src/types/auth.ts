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

export type PermissionChecker = (roleOrUser: UserRole | AuthUser) => boolean;
