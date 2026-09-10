import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/jwt-session';
import { AuthenticationError, AuthorizationError } from '@/server/api/errors';
import { getRequestId } from '@/server/observability/logger';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  departmentId?: string | null;
  title?: string | null;
  positionCode?: string | null;
}

export interface ApiRequestContext {
  requestId: string;
  user: AuthenticatedUser | null;
  ip?: string;
  userAgent?: string;
  scope?: string;
}

export interface RequestLike {
  headers?: {
    get(name: string): string | null;
  };
  url?: string;
  cookies?: {
    get(name: string): { value: string } | undefined;
  };
  ip?: string;
}

export const ROLE_EQUIVALENCE_MAP: Record<string, string> = {
  // Admin / Executive Leadership
  ADMIN: 'ADMIN',
  BAN_GIAM_HIEU: 'ADMIN',
  BGH: 'ADMIN',
  HIEU_TRUONG: 'ADMIN',
  PHO_HIEU_TRUONG: 'ADMIN',

  // Manager / Unit & Department Leadership
  MANAGER: 'MANAGER',
  TRUONG_PHONG: 'MANAGER',
  TRUONG_DON_VI: 'MANAGER',
  PHO_TRUONG_PHONG: 'MANAGER',

  // Staff / Specialist
  STAFF: 'STAFF',
  CHUYEN_VIEN: 'STAFF',
  GIANG_VIEN: 'STAFF',

  // Clerical / Records Management
  VAN_THU: 'VAN_THU',
  CLERK: 'VAN_THU',
};

export function normalizeRole(role: string): string {
  const trimmed = (role || '').trim().toUpperCase();
  return ROLE_EQUIVALENCE_MAP[trimmed] || trimmed;
}

export async function getApiContext(
  request: Request | NextRequest | RequestLike
): Promise<ApiRequestContext> {
  // 1. Request ID extraction or generation
  const requestId = getRequestId(request);

  // 2. Client IP address extraction
  let ip: string | undefined;
  const forwardedFor = request.headers?.get('x-forwarded-for')?.trim();
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) {
      ip = firstIp;
    }
  }
  if (!ip) {
    const realIp = request.headers?.get('x-real-ip')?.trim();
    if (realIp) {
      ip = realIp;
    }
  }
  if (!ip && 'ip' in request && typeof request.ip === 'string') {
    const directIp = request.ip.trim();
    if (directIp) {
      ip = directIp;
    }
  }

  // 3. User-Agent
  const userAgent = request.headers?.get('user-agent')?.trim() || undefined;

  // 4. Scope extraction (Query params take precedence over header)
  let scope: string | undefined;
  if (request.url) {
    try {
      const parsedUrl = new URL(request.url, 'http://localhost');
      const qScope = parsedUrl.searchParams.get('scope')?.trim();
      if (qScope) {
        scope = qScope;
      }
    } catch {
      // Ignore URL parsing errors for non-standard or malformed URLs
    }
  }
  if (!scope) {
    const headerScope = request.headers?.get('x-scope')?.trim();
    if (headerScope) {
      scope = headerScope;
    }
  }

  // 5. Authenticated user extraction (Server session is sole authority)
  let user: AuthenticatedUser | null = null;
  const session = getSessionFromRequest(request as any);
  if (session && session.id) {
    user = {
      id: session.id,
      email: session.email,
      name: session.name,
      role: session.role,
      departmentId: session.departmentId ?? null,
      title: session.title ?? null,
    };
  }

  return {
    requestId,
    user,
    ...(ip ? { ip } : {}),
    ...(userAgent ? { userAgent } : {}),
    ...(scope ? { scope } : {}),
  };
}

export function requireAuthenticated(ctx: ApiRequestContext): AuthenticatedUser {
  if (!ctx.user) {
    throw new AuthenticationError('Authentication required', 'AUTH_REQUIRED');
  }
  return ctx.user;
}

export function requireRole(
  ctx: ApiRequestContext,
  allowedRoles: string | string[]
): AuthenticatedUser {
  const user = requireAuthenticated(ctx);
  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (rolesArray.length === 0) {
    throw new AuthorizationError('Insufficient role permissions', 'FORBIDDEN');
  }

  const userNorm = normalizeRole(user.role);
  const userUpper = user.role.trim().toUpperCase();

  const isAllowed = rolesArray.some((allowed) => {
    const allowedNorm = normalizeRole(allowed);
    const allowedUpper = allowed.trim().toUpperCase();
    return allowedNorm === userNorm || allowedUpper === userUpper;
  });

  if (!isAllowed) {
    throw new AuthorizationError('Insufficient role permissions', 'FORBIDDEN');
  }

  return user;
}
