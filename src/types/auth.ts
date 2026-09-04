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
}

export type PermissionChecker = (roleOrUser: UserRole | AuthUser) => boolean;
