import jwt from 'jsonwebtoken';
import { decode } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import {
  getJwtSecret,
  SESSION_COOKIE_NAME,
  SECURE_SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
} from '@/lib/jwt-session';
import { AuthenticationError } from '@/server/api/errors';
import { CurrentUser, loadCurrentUser } from './current-user';
import {
  isSessionExpired,
  isSessionRevoked,
  assertSessionPolicy,
} from './session-policy';

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
 * Invariants:
 * - Session exists in DB (or valid verified cryptographic token)
 * - Session not expired (session.expires > new Date())
 * - Session not revoked (session.revokedAt == null && isSessionRevoked() === false)
 * - User exists in DB and user.isActive === true
 * - Fail-closed on invalid token, expired session, disabled account, or DB failure
 */
async function resolveTokenSession(token: string): Promise<CurrentSession> {
  // 1. Primary path: Query database Session by sessionToken with included User
  try {
    const dbSession = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: { user: true },
    });

    if (dbSession) {
      if (isSessionExpired(dbSession.expires)) {
        throw new AuthenticationError('Phiên làm việc đã hết hạn', 'SESSION_INVALID');
      }
      if (
        (dbSession as any).revokedAt != null ||
        isSessionRevoked(dbSession.id, dbSession.userId) ||
        isSessionRevoked(token, dbSession.userId)
      ) {
        throw new AuthenticationError('Phiên làm việc đã bị thu hồi', 'SESSION_INVALID');
      }
      if (!dbSession.user.isActive) {
        throw new AuthenticationError('Tài khoản đã bị vô hiệu hóa hoặc tạm khóa', 'ACCOUNT_DISABLED');
      }

      return {
        sessionId: dbSession.id,
        userId: dbSession.user.id,
        user: {
          id: dbSession.user.id,
          email: dbSession.user.email,
          name: dbSession.user.name,
          isActive: dbSession.user.isActive,
        },
      };
    }
  } catch (err) {
    if (err instanceof AuthenticationError) {
      throw err;
    }
    // If not AuthenticationError, continue to token decode check
  }

  // 2. Secondary path: Cryptographic JWT / JWE validation with DB User verification
  let decoded: any = null;
  let isJwt = false;

  try {
    decoded = jwt.verify(token, getJwtSecret()) as any;
    isJwt = true;
  } catch (err: any) {
    if (err?.name === 'TokenExpiredError') {
      throw new AuthenticationError('Phiên làm việc đã hết hạn', 'SESSION_INVALID');
    }

    // Try decoding as NextAuth / Auth.js JWE token
    const secret = getJwtSecret();
    for (const salt of [
        SESSION_COOKIE_NAME,
        SECURE_SESSION_COOKIE_NAME,
        'next-auth.session-token',
        '__Secure-next-auth.session-token',
      ]) {
      try {
        const decodedJwe = await decode({
          token: token.trim(),
          secret,
          salt,
        });
        if (decodedJwe && (decodedJwe.id || decodedJwe.sub || decodedJwe.email)) {
          decoded = {
            id: decodedJwe.id || decodedJwe.sub,
            email: decodedJwe.email,
            name: decodedJwe.name || '',
            role: decodedJwe.role || 'CHUYEN_VIEN',
            departmentId: decodedJwe.departmentId || null,
            title: decodedJwe.title || null,
            isActive: decodedJwe.isActive !== false,
            exp: decodedJwe.exp,
            iat: decodedJwe.iat,
            jti: decodedJwe.jti,
          };
          isJwt = true;
          break;
        }
      } catch {
        // A token is encrypted for one cookie salt; continue trying the others.
      }
    }
  }

  if (!isJwt || !decoded) {
    throw new AuthenticationError('Phiên làm việc không hợp lệ', 'SESSION_INVALID');
  }

  const userId = decoded.id || decoded.userId;
  if (!userId) {
    throw new AuthenticationError('Phiên làm việc không hợp lệ', 'SESSION_INVALID');
  }

  const sessionId = decoded.sessionId || decoded.jti || `session_${decoded.id}`;
  const expires = decoded.exp ? new Date(decoded.exp * 1000) : undefined;
  const issuedAt = decoded.iat ? new Date(decoded.iat * 1000) : undefined;

  // Check expiration and revocation
  assertSessionPolicy({
    sessionId,
    expires,
    userId,
    issuedAt,
    token,
  });

  // Verify DB user exists and is active
  const user = await loadCurrentUser(userId);

  return {
    sessionId,
    userId: user.id,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
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
