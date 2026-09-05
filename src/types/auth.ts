export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF';

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
  isFirstLogin?: boolean;
  emailVerified?: boolean;
  provider?: 'google' | 'demo' | 'system';
}

export type PermissionChecker = (roleOrUser: UserRole | AuthUser) => boolean;
