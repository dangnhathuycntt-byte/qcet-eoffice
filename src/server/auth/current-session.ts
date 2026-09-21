import {
  resolveCanonicalTokenSession,
  SESSION_COOKIE_NAME,
  SECURE_SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
} from '@/lib/jwt-session';
import { AuthenticationError } from '@/server/api/errors';

export interface CurrentSession {
  sessionId: string;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
    isActive: boolean;
  };
}

export type RequestLike = {
  headers?: Headers | { get: (name: string) => string | null } | Record<string, string | string[] | undefined>;
  cookies?: { get: (name: string) => { value: string } | undefined };
  url?: string;
};

const VALID_COOKIE_NAMES = [
  SESSION_COOKIE_NAME,
  SECURE_SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
];

/**
 * Extracts raw authentication token or session token from HTTP request.
 */
export function extractTokenFromRequest(request: RequestLike): string | null {
  return extractTokensFromRequest(request)[0] ?? null;
}

/** Returns authentication candidates in canonical priority order. */
export function extractTokensFromRequest(request: RequestLike): string[] {
  const tokens: string[] = [];
  const add = (value: string | null | undefined) => {
    const token = value?.trim();
    if (token && !tokens.includes(token)) tokens.push(token);
  };

  // 1. Check Authorization header (Bearer token)
  let authHeader: string | null = null;
  if (request.headers) {
    if (typeof (request.headers as any).get === 'function') {
      authHeader = (request.headers as any).get('authorization') || (request.headers as any).get('Authorization');
    } else {
      const h = request.headers as Record<string, string | string[] | undefined>;
      const raw = h['authorization'] || h['Authorization'];
      authHeader = Array.isArray(raw) ? raw[0] : (raw ?? null);
    }
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) return [token];
  }

  // 2. Check NextRequest cookies map
  if (request.cookies && typeof request.cookies.get === 'function') {
    for (const name of VALID_COOKIE_NAMES) {
      const cookie = request.cookies.get(name);
      add(cookie?.value);
    }
  }

  // 3. Fall back to parsing Cookie header
  let cookieHeader: string | null = null;
  if (request.headers) {
    if (typeof (request.headers as any).get === 'function') {
      cookieHeader = (request.headers as any).get('cookie') || (request.headers as any).get('Cookie');
    } else {
      const h = request.headers as Record<string, string | string[] | undefined>;
      const raw = h['cookie'] || h['Cookie'];
      cookieHeader = Array.isArray(raw) ? raw[0] : (raw ?? null);
    }
  }

  if (cookieHeader) {
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const [name, ...rest] = cookie.trim().split('=');
      if (VALID_COOKIE_NAMES.includes(name)) {
        const val = rest.join('=').trim();
        add(val ? decodeURIComponent(val) : null);
      }
    }
  }

  return tokens;
}

/**
 * Resolves and strictly validates the current authenticated session and DB user.
 *
 * Delegates to the ONE canonical token-level resolver
 * (`resolveCanonicalTokenSession` in `@/lib/jwt-session`) and maps success
 * to the identity-only `CurrentSession` shape. The role snapshot is
 * intentionally NOT exposed here: business authority must be evaluated via
 * the canonical authorization engine, never from session claims.
 *
 * Invariants (enforced by the canonical resolver, fail-closed):
 * - Session exists in DB (or valid verified cryptographic token)
 * - Session not expired (session.expires > new Date())
 * - Session not revoked (session.revokedAt == null && isSessionRevoked() === false)
 * - User exists in DB and user.isActive === true
 * - Fail-closed on invalid token, expired session, disabled account, or DB failure
 */
async function resolveTokenSession(token: string): Promise<CurrentSession> {
  const canonical = await resolveCanonicalTokenSession(token);
  return {
    sessionId: canonical.sessionId,
    userId: canonical.userId,
    user: {
      id: canonical.user.id,
      email: canonical.user.email,
      name: canonical.user.name,
      isActive: canonical.user.isActive,
    },
  };
}

export async function resolveCurrentSession(request: RequestLike): Promise<CurrentSession> {
  const tokens = extractTokensFromRequest(request);
  if (tokens.length === 0) {
    throw new AuthenticationError('Yêu cầu xác thực tài khoản', 'AUTH_REQUIRED');
  }

  let lastError: AuthenticationError | null = null;
  for (const token of tokens) {
    try {
      return await resolveTokenSession(token);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new AuthenticationError('Phiên làm việc không hợp lệ', 'SESSION_INVALID');
}

/**
 * Attempts to resolve current session if token is provided.
 * Returns null if request is unauthenticated.
 * Throws 401 if token is present but expired, revoked, or account is disabled.
 */
export async function tryResolveCurrentSession(request: RequestLike): Promise<CurrentSession | null> {
  const token = extractTokenFromRequest(request);
  if (!token) {
    return null;
  }
  return resolveCurrentSession(request);
}
