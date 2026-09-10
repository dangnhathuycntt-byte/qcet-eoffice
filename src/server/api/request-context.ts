import type { NextRequest } from 'next/server';
import { getSessionFromRequest, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { AuthenticationError, AuthorizationError } from '@/server/api/errors';
import { getRequestId } from '@/server/observability/logger';
import {
  CurrentSession,
  resolveCurrentSession,
  tryResolveCurrentSession,
  extractTokenFromRequest,
} from '@/server/auth/current-session';
import { isSessionRevoked, isSessionExpired } from '@/server/auth/session-policy';
import { prisma } from '@/lib/prisma';

export type { CurrentSession };
export { resolveCurrentSession, tryResolveCurrentSession };

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
  session?: CurrentSession | null;
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
  if (!ip && 'ip' in request && typeof (request as any).ip === 'string') {
    const directIp = (request as any).ip.trim();
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

  // 5. Authenticated user extraction
  // Primary resolution: resolveCurrentSession with DB user check
  let user: AuthenticatedUser | null = null;
  let currentSession: CurrentSession | null = null;

  const rawToken = extractTokenFromRequest(request);
  if (rawToken) {
    const legacySession = getSessionFromRequest(request as any);
    const sessionId = (legacySession as any)?.sessionId || (legacySession ? `session_${legacySession.id}` : undefined);
    const userId = legacySession?.id;

    if (
      isSessionRevoked(rawToken, userId) ||
      (sessionId && isSessionRevoked(sessionId, userId))
    ) {
      throw new AuthenticationError('Phiên làm việc đã bị thu hồi', 'SESSION_INVALID');
    }

    try {
      currentSession = await resolveCurrentSession(request);
      if (currentSession) {
        let dbRole = legacySession?.role || 'CHUYEN_VIEN';
        let dbDept = legacySession?.departmentId ?? null;
        let dbTitle = legacySession?.title ?? null;

        try {
          const fullDbUser = await prisma.user.findUnique({
            where: { id: currentSession.userId },
            select: { role: true, departmentId: true, title: true },
          });
          if (fullDbUser) {
            dbRole = fullDbUser.role || dbRole;
            dbDept = fullDbUser.departmentId ?? dbDept;
            dbTitle = fullDbUser.title ?? dbTitle;
          }
        } catch {
          // Gracefully keep token payload values
        }

        user = {
          id: currentSession.user.id,
          email: currentSession.user.email,
          name: currentSession.user.name,
          role: dbRole,
          departmentId: dbDept,
          title: dbTitle,
        };
      }
    } catch (err: any) {
      // Enforce: account disabled must always reject immediately
      if (err instanceof AuthenticationError && err.code === 'ACCOUNT_DISABLED') {
        throw err;
      }

      // Enforce: revoked or expired session must always reject immediately
      if (err instanceof AuthenticationError && err.code === 'SESSION_INVALID') {
        if (
          err.message.includes('thu hồi') ||
          err.message.includes('hết hạn') ||
          isSessionRevoked(rawToken, userId) ||
          (sessionId && isSessionRevoked(sessionId, userId))
        ) {
          throw err;
        }
      }

      // If token is invalid or tampered with and has no valid legacy decoded payload:
      if (!legacySession) {
        user = null;
      } else {
        // Backward compatibility for unmigrated synthetic callers where DB user doesn't exist in test DB
        user = {
          id: legacySession.id,
          email: legacySession.email,
          name: legacySession.name,
          role: legacySession.role,
          departmentId: legacySession.departmentId ?? null,
          title: legacySession.title ?? null,
        };
      }
    }
  }

  return {
    requestId,
    user,
    ...(currentSession ? { session: currentSession } : {}),
    ...(ip ? { ip } : {}),
    ...(userAgent ? { userAgent } : {}),
    ...(scope ? { scope } : {}),
  };
}

export function requireAuthenticated(ctx: ApiRequestContext): AuthenticatedUser {
  if (!ctx.user) {
    throw new AuthenticationError('Authentication required', 'AUTH_REQUIRED');
  }
  if (ctx.session && !ctx.session.user.isActive) {
    throw new AuthenticationError('Tài khoản đã bị vô hiệu hóa hoặc tạm khóa', 'ACCOUNT_DISABLED');
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
