import Redis from 'ioredis';
import { RateLimitError } from '@/server/api/errors';
import { logger } from '@/server/observability/logger';
import { logAuditEvent } from '@/lib/db/audit';

export const RATE_LIMIT_TIERS = {
  AUTH_LOGIN:     { limit: 5,   windowSeconds: 900  }, // 5 req / 15 phút
  MUTATION:       { limit: 60,  windowSeconds: 60   }, // 60 req / phút
  SENSITIVE_READ: { limit: 30,  windowSeconds: 60   }, // 30 req / phút
  BULK_EXPORT:    { limit: 3,   windowSeconds: 3600 }, // 3 req / giờ
  STANDARD_READ:  { limit: 120, windowSeconds: 60   }, // 120 req / phút
  // Backward-compat aliases to preserve existing assertRateLimit callers
  MUTATIONS_SENSITIVE: { limit: 30, windowSeconds: 60 }, // 30 req / phút
  SEARCH:              { limit: 30, windowSeconds: 60 }, // 30 req / phút
  EXPORT:              { limit: 5,  windowSeconds: 60 }, // 5 req / phút
  FILE_DOWNLOAD:       { limit: 60, windowSeconds: 60 }, // 60 req / phút
  DEFAULT_API:         { limit: 100, windowSeconds: 60 }, // 100 req / phút
  AUTH_REGISTER:       { limit: 5,  windowSeconds: 3600 }, // 5 req / 1h
  PUSH_TEST:           { limit: 3,  windowSeconds: 300  }, // 3 req / 5 phút
} as const;

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS;

// Backward-compatibility presets alias mapping to windowMs (legacy assertRateLimit callers)
export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export const RATE_LIMIT_PRESETS: Record<string, RateLimitConfig> = Object.fromEntries(
  Object.entries(RATE_LIMIT_TIERS).map(([k, v]) => [k, { limit: v.limit, windowMs: v.windowSeconds * 1000 }])
);

export interface AsyncRateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: Date;
  allowed: boolean;
  limit: number;
  retryAfter: number;
}

export interface SyncRateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Epoch ms for legacy sync
  retryAfter: number;
  success: boolean;
}

export type RateLimitResult = SyncRateLimitResult;

interface RateLimitRecord {
  timestamps: number[];
  lastAccess: number;
}

// Unified in-memory store — shared by BOTH assertRateLimit and checkRateLimit fallback
// so quota is consistent regardless of backend.
const memoryStore = new Map<string, RateLimitRecord>();

let checkCallCount = 0;
const AUTO_CLEANUP_INTERVAL = 1000;
const MAX_STORE_ENTRIES = 5000;

export function cleanupExpiredKeys(now = Date.now(), maxRetentionMs = 60 * 60 * 1000): void {
  for (const [key, record] of memoryStore.entries()) {
    record.timestamps = record.timestamps.filter((ts) => ts > now - maxRetentionMs);
    if (record.timestamps.length === 0 && now - record.lastAccess > maxRetentionMs) {
      memoryStore.delete(key);
    }
  }
}

export function resetRateLimits(): void {
  memoryStore.clear();
  checkCallCount = 0;
}

export function getRateLimitStoreSize(): number {
  return memoryStore.size;
}

// Redis Singleton
let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }
  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    redisClient.on('error', (err: any) => {
      logger.warn('redis.rate_limit.error', {
        metadata: { error: err?.message || String(err) },
      });
    });

    // Graceful shutdown: close Redis connection on process exit
    // Fix: closeRedisClient was exported but never called — hook SIGTERM here
    const shutdown = () => {
      if (redisClient) {
        const c = redisClient;
        redisClient = null;
        c.quit().catch(() => undefined);
      }
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  }
  return redisClient;
}

export function closeRedisClient(): Promise<void> | void {
  if (redisClient) {
    const client = redisClient;
    redisClient = null;
    return client.quit().then(() => undefined).catch(() => undefined);
  }
}

/**
 * Sliding window rate limit using Redis Sorted Set (ZSET).
 * Returns [isAllowed, remaining, resetAtMs].
 * On allowed path: resetAtMs is oldest_ts + windowMs (correct sliding window reset).
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clearBefore = now - windowMs

-- Remove elements outside sliding window
redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)

-- Count existing requests in window
local currentCount = redis.call('ZCARD', key)

if currentCount < limit then
  -- Add current request timestamp
  redis.call('ZADD', key, now, ARGV[4])
  redis.call('PEXPIRE', key, windowMs)
  -- resetAtMs: use oldest element if any, else now (first request ever)
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldestTs = now
  if oldest and #oldest >= 2 then
    oldestTs = tonumber(oldest[2])
  end
  return {1, limit - currentCount - 1, oldestTs + windowMs}
else
  -- Limit reached: get oldest timestamp in window
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldestTs = now
  if oldest and #oldest >= 2 then
    oldestTs = tonumber(oldest[2])
  end
  local resetAtMs = oldestTs + windowMs
  return {0, 0, resetAtMs}
end
`;

function checkRateLimitMemoryInternal(
  fullKey: string,
  limit: number,
  windowMs: number,
  now: number
): SyncRateLimitResult {
  checkCallCount++;
  if (checkCallCount >= AUTO_CLEANUP_INTERVAL || memoryStore.size > MAX_STORE_ENTRIES) {
    checkCallCount = 0;
    cleanupExpiredKeys(now);
  }

  let record = memoryStore.get(fullKey);
  if (!record) {
    record = { timestamps: [], lastAccess: now };
    memoryStore.set(fullKey, record);
  }

  const windowStart = now - windowMs;
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
  record.lastAccess = now;

  if (record.timestamps.length >= limit) {
    const oldestInWindow = record.timestamps[0];
    const resetAtMs = oldestInWindow + windowMs;
    const retryAfter = Math.max(1, Math.ceil((resetAtMs - now) / 1000));

    return {
      success: false,
      allowed: false,
      limit,
      remaining: 0,
      resetAt: resetAtMs,
      retryAfter,
    };
  }

  record.timestamps.push(now);
  const remaining = limit - record.timestamps.length;
  // Correct resetAt: oldest_ts + windowMs (matching Lua script fix)
  const resetAtMs = record.timestamps[0] + windowMs;

  return {
    success: true,
    allowed: true,
    limit,
    remaining,
    resetAt: resetAtMs,
    retryAfter: 0,
  };
}

/**
 * Resolve tier config from overloaded call signatures.
 * Fix: Case A only matches when second is NOT a tier name itself
 * (prevents ambiguous calls where both args look like tier names).
 */
function resolveConfig(
  first: string | RateLimitConfig,
  second?: string | RateLimitConfig
): { fullKey: string; tier: string; limit: number; windowMs: number } {
  // Case A: checkRateLimit('MUTATION', 'user_123')
  // Only if second is NOT also a tier/preset key (prevents misuse)
  if (
    typeof first === 'string' &&
    first in RATE_LIMIT_TIERS &&
    typeof second === 'string' &&
    !(second in RATE_LIMIT_TIERS) &&
    !(second in RATE_LIMIT_PRESETS)
  ) {
    const tier = first as keyof typeof RATE_LIMIT_TIERS;
    const t = RATE_LIMIT_TIERS[tier];
    return { fullKey: `ratelimit:${tier}:${second}`, tier, limit: t.limit, windowMs: t.windowSeconds * 1000 };
  }

  // Case B: checkRateLimit('user_123', 'MUTATION' | 'AUTH_LOGIN' | ...)
  if (typeof second === 'string' && second in RATE_LIMIT_TIERS) {
    const tier = second as keyof typeof RATE_LIMIT_TIERS;
    const identifier = first as string;
    const t = RATE_LIMIT_TIERS[tier];
    return { fullKey: `ratelimit:${tier}:${identifier}`, tier, limit: t.limit, windowMs: t.windowSeconds * 1000 };
  }

  // Case C: checkRateLimit('user_123', { limit: 5, windowMs: 60000 })
  if (typeof second === 'object' && second !== null && 'limit' in second) {
    const identifier = first as string;
    return { fullKey: `ratelimit:CUSTOM:${identifier}`, tier: 'CUSTOM', limit: second.limit, windowMs: second.windowMs };
  }

  // Case D: fallback to DEFAULT_API
  const identifier = typeof second === 'string' ? second : String(first);
  const p = RATE_LIMIT_PRESETS.DEFAULT_API;
  return { fullKey: `ratelimit:DEFAULT_API:${identifier}`, tier: 'DEFAULT_API', limit: p.limit, windowMs: p.windowMs };
}

/**
 * Modern async API: checkRateLimit(tier, identifier) returns Promise<AsyncRateLimitResult>.
 * Uses Redis when available, falls back to in-memory (same store as assertRateLimit).
 */
export function checkRateLimit(
  tier: keyof typeof RATE_LIMIT_TIERS,
  identifier: string
): Promise<AsyncRateLimitResult>;

/**
 * Legacy sync API: checkRateLimit(identifier, tier, now?) returns SyncRateLimitResult.
 * Always uses in-memory store (same store as assertRateLimit = shared quota).
 */
export function checkRateLimit(
  identifier: string,
  tier: RateLimitTier | string | RateLimitConfig,
  now?: number
): SyncRateLimitResult;

/**
 * Implementation.
 * Fix: legacy sync callers always use in-memory (never return a Promise unless caller awaits).
 * Modern tier callers use Redis when available, else in-memory.
 */
export function checkRateLimit(
  arg1: any,
  arg2: any,
  arg3?: any
): any {
  const isModernTierCall =
    typeof arg1 === 'string' &&
    arg1 in RATE_LIMIT_TIERS &&
    typeof arg2 === 'string' &&
    !(arg2 in RATE_LIMIT_TIERS) &&
    !(arg2 in RATE_LIMIT_PRESETS);

  const { fullKey, limit, windowMs } = resolveConfig(arg1, arg2);
  const now = typeof arg3 === 'number' ? arg3 : Date.now();

  // Legacy sync form: always use in-memory (avoids returning Promise to non-awaiting callers)
  if (!isModernTierCall) {
    return checkRateLimitMemoryInternal(fullKey, limit, windowMs, now);
  }

  // Modern async form: try Redis, fall back to in-memory (same shared store)
  const redis = getRedisClient();
  if (redis) {
    return (async (): Promise<AsyncRateLimitResult> => {
      try {
        const memberUnique = `${now}:${Math.random().toString(36).slice(2, 9)}`;
        const rawRes = await redis.eval(
          SLIDING_WINDOW_LUA,
          1,
          fullKey,
          now,
          windowMs,
          limit,
          memberUnique
        );

        const [isAllowed, remaining, resetAtMs] = rawRes as [number, number, number];
        const allowed = isAllowed === 1;
        // Fix: use resetAtMs from Lua (oldest_ts + windowMs) for both allowed and blocked paths
        const retryAfter = allowed ? 0 : Math.max(1, Math.ceil((resetAtMs - now) / 1000));

        return {
          success: allowed,
          allowed,
          limit,
          remaining: Math.max(0, remaining),
          resetAt: new Date(resetAtMs),
          retryAfter,
        };
      } catch (redisErr: any) {
        logger.warn('redis.rate_limit.fallback_memory', {
          metadata: { error: redisErr?.message || String(redisErr) },
        });
        // Fallback uses same memoryStore → quota still shared
        const mem = checkRateLimitMemoryInternal(fullKey, limit, windowMs, now);
        return {
          success: mem.success,
          allowed: mem.allowed,
          limit: mem.limit,
          remaining: mem.remaining,
          resetAt: new Date(mem.resetAt),
          retryAfter: mem.retryAfter,
        };
      }
    })();
  }

  // No Redis: use in-memory (shared store)
  const mem = checkRateLimitMemoryInternal(fullKey, limit, windowMs, now);
  return Promise.resolve<AsyncRateLimitResult>({
    success: mem.success,
    allowed: mem.allowed,
    limit: mem.limit,
    remaining: mem.remaining,
    resetAt: new Date(mem.resetAt),
    retryAfter: mem.retryAfter,
  });
}

/**
 * Extracts rate limit identifier — prioritizes userId over IP.
 */
export function getRateLimitIdentifier(
  authContext?: { userId?: string | null; id?: string | null; user?: { id?: string | null } } | null,
  request?: { headers?: { get(name: string): string | null }; ip?: string } | null
): string {
  if (authContext) {
    if ('userId' in authContext && authContext.userId && typeof authContext.userId === 'string' && authContext.userId.trim()) {
      return authContext.userId.trim();
    }
    if ('id' in authContext && authContext.id && typeof authContext.id === 'string' && authContext.id.trim()) {
      return authContext.id.trim();
    }
    if ('user' in authContext && authContext.user?.id && typeof authContext.user.id === 'string' && authContext.user.id.trim()) {
      return authContext.user.id.trim();
    }
  }

  if (request) {
    const forwardedFor = request.headers?.get('x-forwarded-for')?.trim();
    if (forwardedFor) {
      const firstIp = forwardedFor.split(',')[0].trim();
      if (firstIp) return firstIp;
    }
    const realIp = request.headers?.get('x-real-ip')?.trim();
    if (realIp) return realIp;
    if (request.ip && typeof request.ip === 'string') {
      return request.ip.trim();
    }
  }

  return 'anonymous';
}

/**
 * Synchronous rate limit assertion (uses shared in-memory store).
 * Throws RateLimitError (429) when limit exceeded.
 */
export function assertRateLimit(
  identifier: string,
  tier: RateLimitTier | string | RateLimitConfig,
  message?: string,
  now?: number
): void {
  const { fullKey, limit, windowMs } = resolveConfig(identifier, tier);
  const effectiveNow = now ?? Date.now();
  const result = checkRateLimitMemoryInternal(fullKey, limit, windowMs, effectiveNow);

  if (!result.allowed) {
    const defaultMsg = `Rate limit exceeded. Please retry after ${result.retryAfter} second${
      result.retryAfter === 1 ? '' : 's'
    }.`;
    const err = new RateLimitError(message || defaultMsg, 'RATE_LIMITED', result.retryAfter);
    err.retryAfter = result.retryAfter;
    throw err;
  }
}

/**
 * Fire-and-forget audit log for rate limit exceeded events.
 * Caller must capture retryAfter BEFORE calling this to avoid timing issues.
 */
export async function logRateLimitExceeded(
  tier: string,
  identifier: string,
  endpoint?: string,
  userId?: string | null
): Promise<void> {
  const metadata = { tier, endpoint, identifier };
  logger.warn('security.rate_limit_exceeded', {
    userId,
    errorCode: 'RATE_LIMITED',
    metadata,
  });

  try {
    await logAuditEvent({
      action: 'RATE_LIMIT_EXCEEDED' as any,
      actorId: userId || null,
      entityType: 'System',
      entityId: identifier,
      metadata,
    });
  } catch {
    // Suppress — audit failure must not block the response
  }
}

/**
 * Build standard HTTP rate limit headers.
 * Fix: isBlocked checks both allowed and success (including undefined → treat as blocked
 * when retryAfter > 0, which is the authoritative signal).
 */
export function getRateLimitHeaders(result: {
  limit: number;
  remaining: number;
  resetAt: Date | number;
  allowed?: boolean;
  success?: boolean;
  retryAfter?: number;
}): Record<string, string> {
  const resetEpochSeconds =
    result.resetAt instanceof Date
      ? Math.ceil(result.resetAt.getTime() / 1000)
      : Math.ceil(result.resetAt / 1000);

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(resetEpochSeconds),
  };

  // Fix: use retryAfter > 0 as the authoritative "blocked" signal in addition to
  // explicit allowed/success flags. Covers callers that omit allowed/success.
  const isBlocked =
    result.allowed === false ||
    result.success === false ||
    (!result.allowed && !result.success && (result.retryAfter ?? 0) > 0);

  if (isBlocked && result.retryAfter !== undefined && result.retryAfter > 0) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}
