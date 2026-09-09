import { RateLimitError } from '@/server/api/errors';

export type RateLimitTier =
  | 'AUTH_LOGIN'
  | 'AUTH_REGISTER'
  | 'SEARCH'
  | 'EXPORT'
  | 'MUTATIONS_SENSITIVE'
  | 'PUSH_TEST'
  | 'DEFAULT_API';

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export const RATE_LIMIT_PRESETS: Record<RateLimitTier, RateLimitConfig> = {
  AUTH_LOGIN: { limit: 5, windowMs: 15 * 60 * 1000 },          // 5 reqs per 15 min
  AUTH_REGISTER: { limit: 5, windowMs: 60 * 60 * 1000 },       // 5 reqs per 1 hour
  SEARCH: { limit: 30, windowMs: 60 * 1000 },                  // 30 reqs per 1 min
  EXPORT: { limit: 5, windowMs: 60 * 1000 },                   // 5 reqs per 1 min
  MUTATIONS_SENSITIVE: { limit: 30, windowMs: 60 * 1000 },     // 30 reqs per 1 min
  PUSH_TEST: { limit: 3, windowMs: 5 * 60 * 1000 },            // 3 reqs per 5 min
  DEFAULT_API: { limit: 100, windowMs: 60 * 1000 },            // 100 reqs per 1 min
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;   // Epoch timestamp in milliseconds
  retryAfter: number; // Seconds until retry (0 if allowed)
}

interface RateLimitRecord {
  timestamps: number[];
  lastAccess: number;
}

// In-memory key store
const store = new Map<string, RateLimitRecord>();

let checkCallCount = 0;
const AUTO_CLEANUP_INTERVAL = 1000;
const MAX_STORE_ENTRIES = 5000;

/**
 * Cleans up expired entries from the rate limit store.
 */
export function cleanupExpiredKeys(now = Date.now(), maxRetentionMs = 60 * 60 * 1000): void {
  for (const [key, record] of store.entries()) {
    // Keep only timestamps within max retention
    record.timestamps = record.timestamps.filter((ts) => ts > now - maxRetentionMs);
    if (record.timestamps.length === 0 && now - record.lastAccess > maxRetentionMs) {
      store.delete(key);
    }
  }
}

/**
 * Completely clears the in-memory rate limit store.
 * Primary use: test isolation.
 */
export function resetRateLimits(): void {
  store.clear();
  checkCallCount = 0;
}

/**
 * Returns current store size (for monitoring / testing).
 */
export function getRateLimitStoreSize(): number {
  return store.size;
}

/**
 * Checks whether a given identifier conforms to the rate limit configuration.
 * Employs a sliding window algorithm to ensure smooth throttling without boundary spikes.
 *
 * @param identifier Unique rate limit key (e.g. `ip:auth-login:1.2.3.4` or `user:export:usr_123`)
 * @param tier Preset tier name or custom `{ limit, windowMs }` config
 * @param now Optional epoch milliseconds timestamp (defaults to Date.now())
 */
export function checkRateLimit(
  identifier: string,
  tier: RateLimitTier | RateLimitConfig,
  now = Date.now()
): RateLimitResult {
  // Periodic store cleanup trigger
  checkCallCount++;
  if (checkCallCount >= AUTO_CLEANUP_INTERVAL || store.size > MAX_STORE_ENTRIES) {
    checkCallCount = 0;
    cleanupExpiredKeys(now);
  }

  const config: RateLimitConfig =
    typeof tier === 'string'
      ? RATE_LIMIT_PRESETS[tier] ?? RATE_LIMIT_PRESETS.DEFAULT_API
      : tier;

  let record = store.get(identifier);
  if (!record) {
    record = { timestamps: [], lastAccess: now };
    store.set(identifier, record);
  }

  // Filter timestamps outside current sliding window
  const windowStart = now - config.windowMs;
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
  record.lastAccess = now;

  // Check if limit reached
  if (record.timestamps.length >= config.limit) {
    const oldestInWindow = record.timestamps[0];
    const resetAt = oldestInWindow + config.windowMs;
    const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));

    return {
      allowed: false,
      limit: config.limit,
      remaining: 0,
      resetAt,
      retryAfter,
    };
  }

  // Record this request
  record.timestamps.push(now);
  const remaining = config.limit - record.timestamps.length;
  const resetAt = record.timestamps[0] + config.windowMs;

  return {
    allowed: true,
    limit: config.limit,
    remaining,
    resetAt,
    retryAfter: 0,
  };
}

/**
 * Asserts that the rate limit has not been exceeded.
 * Throws RateLimitError (429) if limit reached, attaching `retryAfter`.
 *
 * @param identifier Unique rate limit key
 * @param tier Preset tier name or custom config
 * @param message Optional custom error message
 * @param now Optional epoch milliseconds timestamp
 */
export function assertRateLimit(
  identifier: string,
  tier: RateLimitTier | RateLimitConfig,
  message?: string,
  now?: number
): void {
  const result = checkRateLimit(identifier, tier, now);
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
 * Builds standard HTTP rate limit headers.
 * Sets `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (epoch seconds),
 * and `Retry-After` (seconds) if blocked.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };

  if (!result.allowed && result.retryAfter > 0) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}
