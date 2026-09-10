import { prisma } from '@/lib/prisma';
import { AuthenticationError } from '@/server/api/errors';
import type { CurrentUser } from './current-user';

export interface RevocationRecord {
  sessionId: string;
  revokedAt: Date;
  revokedById?: string;
  revokeReason?: string;
}

// In-memory revocation registry for rapid revocation lookups
const revokedSessions = new Map<string, RevocationRecord>();
// Revoked users: all sessions for userId issued on or before revokedAt are revoked
const revokedUsers = new Map<string, { revokedAt: Date; revokedById?: string; revokeReason?: string }>();

/**
 * Checks if a session expiration timestamp has passed.
 */
export function isSessionExpired(expires: Date | number | string | null | undefined): boolean {
  if (!expires) return false;
  const expDate =
    expires instanceof Date
      ? expires
      : new Date(typeof expires === 'number' && expires < 10000000000 ? expires * 1000 : expires);
  return expDate.getTime() <= Date.now();
}

/**
 * Checks if a session or token has been revoked, either individually or via user revocation.
 */
export function isSessionRevoked(
  sessionIdOrToken: string,
  userId?: string,
  issuedAt?: Date | number
): boolean {
  if (!sessionIdOrToken) return false;

  if (revokedSessions.has(sessionIdOrToken)) {
    return true;
  }

  if (userId && revokedUsers.has(userId)) {
    const userRev = revokedUsers.get(userId)!;
    if (!issuedAt) {
      return true;
    }
    const issueTime =
      issuedAt instanceof Date
        ? issuedAt.getTime()
        : typeof issuedAt === 'number' && issuedAt < 10000000000
          ? issuedAt * 1000
          : new Date(issuedAt).getTime();

    if (issueTime <= userRev.revokedAt.getTime()) {
      return true;
    }
  }

  return false;
}

/**
 * Revoke a specific server session by id or token.
 */
export async function revokeSession(
  sessionIdOrToken: string,
  options?: { revokedById?: string; revokeReason?: string; revokedAt?: Date }
): Promise<void> {
  if (!sessionIdOrToken) return;

  const record: RevocationRecord = {
    sessionId: sessionIdOrToken,
    revokedAt: options?.revokedAt || new Date(),
    revokedById: options?.revokedById,
    revokeReason: options?.revokeReason,
  };

  revokedSessions.set(sessionIdOrToken, record);

  // Synchronize with database Session table if present
  try {
    // Delete session from DB or update revokedAt if column exists
    await prisma.session.deleteMany({
      where: {
        OR: [
          { id: sessionIdOrToken },
          { sessionToken: sessionIdOrToken },
        ],
      },
    });
  } catch {
    // Gracefully continue if DB session model is unpopulated or in non-DB environment
  }
}

/**
 * Revoke all sessions for a specific user.
 */
export async function revokeAllUserSessions(
  userId: string,
  options?: { revokedById?: string; revokeReason?: string }
): Promise<void> {
  if (!userId) return;

  revokedUsers.set(userId, {
    revokedAt: new Date(),
    revokedById: options?.revokedById,
    revokeReason: options?.revokeReason,
  });

  try {
    await prisma.session.deleteMany({
      where: { userId },
    });
  } catch {
    // Gracefully continue if DB session table is empty or unpopulated
  }
}

/**
 * Admin operation to disable a user and revoke all active sessions.
 */
export async function disableUser(
  userId: string,
  options?: { disabledById?: string; reason?: string }
): Promise<void> {
  if (!userId) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
    },
  });

  await revokeAllUserSessions(userId, {
    revokedById: options?.disabledById,
    revokeReason: options?.reason || 'Account disabled by administrator',
  });
}

/**
 * Validates session parameters and user state according to Session Policy.
 * Throws AuthenticationError(401) with code SESSION_INVALID or ACCOUNT_DISABLED.
 */
export function assertSessionPolicy(
  session: {
    sessionId: string;
    expires?: Date | number | string | null;
    revokedAt?: Date | null;
    userId: string;
    issuedAt?: Date | number;
    token?: string;
  },
  user?: CurrentUser
): void {
  // 1. Check user state first if provided
  if (user && !user.isActive) {
    throw new AuthenticationError('Tài khoản đã bị vô hiệu hóa hoặc tạm khóa', 'ACCOUNT_DISABLED');
  }

  // 2. Check if session has expired
  if (isSessionExpired(session.expires)) {
    throw new AuthenticationError('Phiên làm việc đã hết hạn', 'SESSION_INVALID');
  }

  // 3. Check if session is marked revoked on entity
  if (session.revokedAt != null) {
    throw new AuthenticationError('Phiên làm việc đã bị thu hồi', 'SESSION_INVALID');
  }

  // 4. Check revocation store
  if (
    isSessionRevoked(session.sessionId, session.userId, session.issuedAt) ||
    (session.token && isSessionRevoked(session.token, session.userId, session.issuedAt))
  ) {
    throw new AuthenticationError('Phiên làm việc đã bị thu hồi', 'SESSION_INVALID');
  }
}

/**
 * Testing utility to reset in-memory revocation maps.
 */
export function clearRevocationStoreForTesting(): void {
  revokedSessions.clear();
  revokedUsers.clear();
}
