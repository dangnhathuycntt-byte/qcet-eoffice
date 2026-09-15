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

/**
 * ARCHITECTURAL DEPRECATION NOTICE (Sprint 2 - Identity & Authority):
 *
 * `ROLE_EQUIVALENCE_MAP` is strictly retained for backward compatibility with legacy
 * authentication token extraction and UI display mapping.
 *
 * DO NOT USE THIS MAP FOR BUSINESS AUTHORIZATION OR INSTITUTIONAL AUTHORITY CHECKS.
 *
 * In accordance with Vietnamese public higher-education governance (Law on Vocational
 * Education, Decree 30/2020/ND-CP, Decision 283/QD-CDKTCNQN, Decision 420/QD-CDKTCNQN):
 * - Technical administration (SYSTEM_ADMIN / ADMIN) is strictly separated from statutory
 *   institutional leadership (HIEU_TRUONG, PHO_HIEU_TRUONG).
 * - Statutory governance authorities are based on active PositionAssignment and portfolio
 *   responsibility, NEVER on generic SaaS role strings (ADMIN / MANAGER / STAFF).
 * - All business authorization MUST be evaluated through the canonical authorization
 *   engine (`src/server/authorization/authorization-engine.ts` -> `authorize()`).
 *
 * @deprecated Retained only for legacy auth token compatibility and UI display. Do not import in business authorization.
 */
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

/**
 * ARCHITECTURAL DEPRECATION NOTICE (Sprint 2 - Identity & Authority):
 *
 * `normalizeRole` normalizes role strings for legacy authentication compatibility and UI display.
 *
 * STRICT INVARIANTS:
 * 1. normalizeRole('ADMIN') === 'ADMIN' (never returns 'HIEU_TRUONG' or 'BAN_GIAM_HIEU').
 * 2. It must NEVER be used to evaluate statutory institutional authority, signing rights,
 *    or executive direction.
 * 3. All business authorization must use canonical `authorize()` in `src/server/authorization/`.
 *
 * @deprecated Retained for legacy auth compatibility and UI display only.
 */
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
    const legacySession = await getSessionFromRequest(request as any);
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

/**
 * Statutory institutional leadership roles that CANNOT be checked or granted via requireRole.
 * In accordance with Vietnamese higher-education governance, statutory leadership authority
 * requires active PositionAssignment evaluated via the canonical authorize() engine.
 */
const STATUTORY_INSTITUTIONAL_ROLES = new Set([
  'HIEU_TRUONG',
  'PHO_HIEU_TRUONG',
  'PHO_HIEU_TRUONG_DT',
  'PHO_HIEU_TRUONG_HC',
]);

/**
 * ARCHITECTURAL DEPRECATION NOTICE (Sprint 2 - Identity & Authority):
 *
 * `requireRole` is a legacy route middleware helper for coarse-grained technical role gating.
 *
 * STRICT INVARIANTS & SECURITY GUARDS:
 * 1. It must NEVER be used to evaluate, grant, or assert statutory institutional authority
 *    (e.g., Hiệu trưởng, Phó Hiệu trưởng, Bút phê, Phê duyệt văn bản, Ký số).
 * 2. Attempting to check statutory institutional positions (e.g., 'HIEU_TRUONG', 'PHO_HIEU_TRUONG')
 *    via requireRole is strictly rejected. Statutory actions must be evaluated via canonical
 *    `authorize(context, action, resource)`.
 * 3. A technical 'ADMIN' role does NOT satisfy or grant statutory institutional authority.
 *
 * @deprecated Use canonical `authorize(context, action, resource)` with AuthorizationContext.
 */
export function requireRole(
  ctx: ApiRequestContext,
  allowedRoles: string | string[]
): AuthenticatedUser {
  const user = requireAuthenticated(ctx);
  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (rolesArray.length === 0) {
    throw new AuthorizationError('Insufficient role permissions', 'FORBIDDEN');
  }

  // Guard against evaluating statutory institutional authority via legacy requireRole
  const hasStatutoryRole = rolesArray.some((r) =>
    STATUTORY_INSTITUTIONAL_ROLES.has(r.trim().toUpperCase())
  );
  if (hasStatutoryRole) {
    throw new AuthorizationError(
      'Statutory institutional authority (Hiệu trưởng, Phó Hiệu trưởng) cannot be evaluated or granted via requireRole. Use canonical authorize() with PositionAssignment.',
      'STATUTORY_AUTHORITY_PROHIBITED'
    );
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
