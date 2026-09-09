/**
 * User Data Transfer Objects (DTOs) & Sanitization Mappers
 *
 * Implements OWASP API3 (Excessive Data Exposure) safeguards.
 * Ensures zero leakage of passwords, password hashes, secrets, reset tokens,
 * session tokens, or internal account information to client responses.
 */

export interface UserSummaryDTO {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
}

export interface UserDepartmentDTO {
  id: string;
  code?: string | null;
  name: string;
}

export interface UserPublicDTO {
  id: string;
  name: string;
  email: string;
  role: string;
  position?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  departmentId?: string | null;
  department?: UserDepartmentDTO | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserSessionDTO {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId?: string | null;
  departmentCode?: string | null;
  departmentName?: string | null;
  avatarUrl?: string | null;
}

function toISOStringSafe(val: unknown): string {
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date(0).toISOString() : val.toISOString();
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

function extractDepartment(raw: Record<string, any>): UserDepartmentDTO | null {
  if (raw.department && typeof raw.department === 'object') {
    return {
      id: String(raw.department.id ?? raw.departmentId ?? ''),
      code: raw.department.code ?? raw.department.shortName ?? null,
      name: String(raw.department.name ?? ''),
    };
  }
  if (typeof raw.department === 'string' && raw.department.trim()) {
    return {
      id: String(raw.departmentId ?? ''),
      code: raw.departmentCode ?? null,
      name: raw.department,
    };
  }
  if (raw.departmentId) {
    return {
      id: String(raw.departmentId),
      code: raw.departmentCode ?? null,
      name: raw.departmentName ?? String(raw.departmentId),
    };
  }
  return null;
}

/**
 * Maps raw user entity to minimal UserSummaryDTO.
 * Returns null if raw user is null, undefined, or not an object.
 */
export function toUserSummaryDTO(rawUser: unknown): UserSummaryDTO | null {
  if (!rawUser || typeof rawUser !== 'object') return null;
  const user = rawUser as Record<string, any>;

  return {
    id: String(user.id ?? ''),
    name: String(user.name ?? ''),
    email: String(user.email ?? ''),
    role: String(user.role ?? ''),
    avatarUrl: user.avatarUrl ?? user.avatar ?? null,
  };
}

/**
 * Maps raw user entity to UserPublicDTO for profile views and public directory.
 * Returns null if raw user is null, undefined, or not an object.
 */
export function toUserPublicDTO(rawUser: unknown): UserPublicDTO | null {
  if (!rawUser || typeof rawUser !== 'object') return null;
  const user = rawUser as Record<string, any>;

  return {
    id: String(user.id ?? ''),
    name: String(user.name ?? ''),
    email: String(user.email ?? ''),
    role: String(user.role ?? ''),
    position: user.position ?? user.title ?? null,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? user.avatar ?? null,
    departmentId: user.departmentId ?? user.department?.id ?? null,
    department: extractDepartment(user),
    createdAt: toISOStringSafe(user.createdAt),
    updatedAt: toISOStringSafe(user.updatedAt),
  };
}

/**
 * Maps raw user entity to UserSessionDTO for session validation and client auth state.
 * Returns null if raw user is null, undefined, or not an object.
 */
export function toUserSessionDTO(rawUser: unknown): UserSessionDTO | null {
  if (!rawUser || typeof rawUser !== 'object') return null;
  const user = rawUser as Record<string, any>;

  return {
    id: String(user.id ?? ''),
    name: String(user.name ?? ''),
    email: String(user.email ?? ''),
    role: String(user.role ?? ''),
    departmentId: user.departmentId ?? user.department?.id ?? null,
    departmentCode: user.departmentCode ?? user.department?.code ?? user.department?.shortName ?? null,
    departmentName: user.departmentName ?? user.department?.name ?? null,
    avatarUrl: user.avatarUrl ?? user.avatar ?? null,
  };
}

/**
 * Array mapping helpers
 */
export function toUserSummaryDTOArray(rawUsers: unknown[]): UserSummaryDTO[] {
  if (!Array.isArray(rawUsers)) return [];
  return rawUsers
    .map(toUserSummaryDTO)
    .filter((u): u is UserSummaryDTO => u !== null);
}

export function toUserPublicDTOArray(rawUsers: unknown[]): UserPublicDTO[] {
  if (!Array.isArray(rawUsers)) return [];
  return rawUsers
    .map(toUserPublicDTO)
    .filter((u): u is UserPublicDTO => u !== null);
}
