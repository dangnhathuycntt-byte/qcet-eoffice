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
} as const;

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS;

// Backward-compatibility presets alias mapping to windowMs
export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export const RATE_LIMIT_PRESETS: Record<string, RateLimitConfig> = {
  AUTH_LOGIN: { limit: RATE_LIMIT_TIERS.AUTH_LOGIN.limit, windowMs: RATE_LIMIT_TIERS.AUTH_LOGIN.windowSeconds * 1000 },
  AUTH_REGISTER: { limit: 5, windowMs: 60 * 60 * 1000 },
  SEARCH: { limit: 30, windowMs: 60 * 1000 },
  EXPORT: { limit: 5, windowMs: 60 * 1000 },
  MUTATIONS_SENSITIVE: { limit: 30, windowMs: 60 * 1000 },
  MUTATION: { limit: RATE_LIMIT_TIERS.MUTATION.limit, windowMs: RATE_LIMIT_TIERS.MUTATION.windowSeconds * 1000 },
  PUSH_TEST: { limit: 3, windowMs: 5 * 60 * 1000 },
  FILE_DOWNLOAD: { limit: 60, windowMs: 60 * 1000 },
  DEFAULT_API: { limit: 100, windowMs: 60 * 1000 },
  SENSITIVE_READ: { limit: RATE_LIMIT_TIERS.SENSITIVE_READ.limit, windowMs: RATE_LIMIT_TIERS.SENSITIVE_READ.windowSeconds * 1000 },
  BULK_EXPORT: { limit: RATE_LIMIT_TIERS.BULK_EXPORT.limit, windowMs: RATE_LIMIT_TIERS.BULK_EXPORT.windowSeconds * 1000 },
  STANDARD_READ: { limit: RATE_LIMIT_TIERS.STANDARD_READ.limit, windowMs: RATE_LIMIT_TIERS.STANDARD_READ.windowSeconds * 1000 },
};

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

// In-memory key store for fallback when REDIS_URL is not set
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
 * Sliding window rate limit check using Redis Sorted Set (ZSET).
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
  return {1, limit - currentCount - 1, 0}
else
  -- Limit reached: get oldest timestamp in window to calculate resetAt
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

function resolveConfig(
  first: string | RateLimitConfig,
  second?: string | RateLimitConfig
): { fullKey: string; limit: number; windowMs: number } {
  // Case A: checkRateLimit('MUTATION', 'user_123')
  if (typeof first === 'string' && first in RATE_LIMIT_TIERS && typeof second === 'string') {
    const tier = first as keyof typeof RATE_LIMIT_TIERS;
    const identifier = second;
    const t = RATE_LIMIT_TIERS[tier];
    return {
      fullKey: `ratelimit:${tier}:${identifier}`,
      limit: t.limit,
      windowMs: t.windowSeconds * 1000,
    };
  }

  // Case B: checkRateLimit('user_123', 'MUTATION' | 'AUTH_LOGIN' | ...)
  if (typeof second === 'string' && second in RATE_LIMIT_TIERS) {
    const tier = second as keyof typeof RATE_LIMIT_TIERS;
    const identifier = first as string;
    const t = RATE_LIMIT_TIERS[tier];
    return {
      fullKey: `ratelimit:${tier}:${identifier}`,
      limit: t.limit,
      windowMs: t.windowSeconds * 1000,
    };
  }

  // Case C: checkRateLimit('user_123', 'SEARCH' | 'EXPORT' | ...)
  if (typeof second === 'string' && second in RATE_LIMIT_PRESETS) {
    const tier = second;
    const identifier = first as string;
    const p = RATE_LIMIT_PRESETS[tier];
    return {
      fullKey: `ratelimit:${tier}:${identifier}`,
      limit: p.limit,
      windowMs: p.windowMs,
    };
  }

  // Case D: checkRateLimit('user_123', { limit: 5, windowMs: 60000 })
  if (typeof second === 'object' && second !== null && 'limit' in second) {
    const identifier = first as string;
    return {
      fullKey: `ratelimit:CUSTOM:${identifier}`,
      limit: second.limit,
      windowMs: second.windowMs,
    };
  }

  // Case E: single string or other
  const identifier = typeof second === 'string' ? second : String(first);
  const p = RATE_LIMIT_PRESETS.DEFAULT_API;
  return {
    fullKey: `ratelimit:DEFAULT_API:${identifier}`,
    limit: p.limit,
    windowMs: p.windowMs,
  };
}

/**
 * Modern Issue #29 API: checkRateLimit(tier, identifier) returns Promise<AsyncRateLimitResult>
 */
export function checkRateLimit(
  tier: keyof typeof RATE_LIMIT_TIERS,
  identifier: string
): Promise<AsyncRateLimitResult>;

/**
 * Legacy API: checkRateLimit(identifier, tier, now?) returns SyncRateLimitResult
 */
export function checkRateLimit(
  identifier: string,
  tier: RateLimitTier | string | RateLimitConfig,
  now?: number
): SyncRateLimitResult;

/**
 * Implementation handling both modern async and legacy sync forms.
 */
export function checkRateLimit(
  arg1: any,
  arg2: any,
  arg3?: any
): any {
  const isModernTierCall =
    typeof arg1 === 'string' && arg1 in RATE_LIMIT_TIERS && typeof arg2 === 'string';

  const { fullKey, limit, windowMs } = resolveConfig(arg1, arg2);
  const now = typeof arg3 === 'number' ? arg3 : Date.now();
  const redis = getRedisClient();

  // If redis is active AND this was called in modern form (or Redis is set)
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
        const effectiveResetAtMs = allowed ? (now + windowMs) : resetAtMs;
        const retryAfter = allowed ? 0 : Math.max(1, Math.ceil((effectiveResetAtMs - now) / 1000));

        return {
          success: allowed,
          allowed,
          limit,
          remaining: Math.max(0, remaining),
          resetAt: new Date(effectiveResetAtMs),
          retryAfter,
        };
      } catch (redisErr: any) {
        logger.warn('redis.rate_limit.fallback_memory', {
          metadata: { error: redisErr?.message || String(redisErr) },
        });
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

  // In-memory execution
  const mem = checkRateLimitMemoryInternal(fullKey, limit, windowMs, now);

  if (isModernTierCall) {
    const asyncRes: AsyncRateLimitResult = {
      success: mem.success,
      allowed: mem.allowed,
      limit: mem.limit,
      remaining: mem.remaining,
      resetAt: new Date(mem.resetAt),
      retryAfter: mem.retryAfter,
    };
    return Promise.resolve(asyncRes);
  }

  // Legacy sync result
  return mem;
}

/**
 * Extracts rate limit identifier from authContext and request.
 * Prioritizes userId if present, otherwise client IP.
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
 * Asserts rate limit synchronously (using memory) or can be awaited.
 * Throws RateLimitError with retryAfter on limit breach.
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
 * Records an audit event when rate limit is exceeded.
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
    // Suppress error if DB audit event cannot be recorded
  }
}

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

  const isBlocked = result.allowed === false || result.success === false;
  if (isBlocked && result.retryAfter !== undefined && result.retryAfter > 0) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}
