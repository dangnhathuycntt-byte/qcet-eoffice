import Redis from 'ioredis';
import os from 'node:os';
import { ApiError, RateLimitError } from '@/server/api/errors';
import { logger } from '@/server/observability/logger';
import { logAuditEvent } from '@/lib/db/audit';
import { isBuildPhase } from '@/config/env.server';

// ---------------------------------------------------------------------------
// Canonical tier policy (Issue #29).
//
// These names/thresholds are the single source of truth for rate-limit
// policy. Routes MUST reference a tier key; they MUST NOT hard-code
// limit/window values.
//
// NOTE (discrepancy record): the issue text lists the original 9 tiers and
// asks not to rename to SENSITIVE_READ / BULK_EXPORT. The codebase had
// already adopted SENSITIVE_READ / BULK_EXPORT / STANDARD_READ as canonical
// tiers with live route wiring (search, export-excel) before this issue.
// Renaming them back would break existing call sites the issue itself says
// must keep working, so they are retained as canonical policy here.
// ---------------------------------------------------------------------------

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
  REPORTS_EXPORT:      { limit: 5,  windowSeconds: 60 }, // 5 req / phút
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

/** Namespaced key prefix for every rate-limit record (Issue #29 identifier strategy). */
export const RATE_LIMIT_KEY_PREFIX = 'qcet:eoffice:ratelimit';

/** Subject classification for keys / observability. Never derived from secrets. */
export type RateLimitSubjectType = 'user' | 'ip' | 'anonymous';

// ---------------------------------------------------------------------------
// Backend selection rationale (on-prem multi-instance, Issue #29):
//
// - Self-hosted Redis (TCP, e.g. the `redis` service in docker-compose.yml)
//   is the production backend: atomic Lua sliding-window, TTL/window enforced
//   server-side, state shared across all Next.js instances and surviving app
//   restarts.
// - PostgreSQL was rejected for the hot path: per-request row writes plus
//   periodic cleanup would create write amplification and retention pressure
//   for a counter that Redis handles with a single atomic ZSET op.
// - `@upstash/ratelimit` is intentionally NOT used: it targets
//   `@upstash/redis` (HTTP/connectionless), not self-hosted TCP Redis, so it
//   is not a drop-in pair with `ioredis`.
// - When `REDIS_URL` is unset (local dev without Redis, unit tests), the
//   service uses a process-local test double with identical sliding-window
//   semantics. Production MUST set `REDIS_URL` (enforced by startup env
//   validation AND by the resolver below, which throws instead of returning
//   the memory double in production). The only production exception is the
//   Next.js build phase, which never serves traffic.
// ---------------------------------------------------------------------------

export interface SlidingWindowVerdict {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
}

export interface RateLimitBackend {
  readonly name: string;
  checkAndRecord(key: string, now: number, windowMs: number, limit: number): Promise<SlidingWindowVerdict>;
  ping(): Promise<void>;
}

interface MemoryRateLimitRecord {
  timestamps: number[];
  lastAccess: number;
}

const MEMORY_MAX_STORE_ENTRIES = 5000;
const MEMORY_AUTO_CLEANUP_INTERVAL = 1000;

/**
 * Process-local sliding-window backend with the same semantics as the Redis
 * Lua script. Used as the unit-test double and as the local fallback when
 * `REDIS_URL` is unset. A single instance shared by two limiter facades
 * simulates two app instances sharing one backend.
 */
export class SharedMemoryRateLimitBackend implements RateLimitBackend {
  readonly name = 'memory-test-double';
  private store = new Map<string, MemoryRateLimitRecord>();
  private checkCallCount = 0;

  cleanupExpiredKeys(now = Date.now(), maxRetentionMs = 60 * 60 * 1000): void {
    for (const [key, record] of this.store.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > now - maxRetentionMs);
      if (record.timestamps.length === 0 && now - record.lastAccess > maxRetentionMs) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
    this.checkCallCount = 0;
  }

  size(): number {
    return this.store.size;
  }

  checkAndRecordSync(key: string, now: number, windowMs: number, limit: number): SlidingWindowVerdict {
    this.checkCallCount++;
    if (this.checkCallCount >= MEMORY_AUTO_CLEANUP_INTERVAL || this.store.size > MEMORY_MAX_STORE_ENTRIES) {
      this.checkCallCount = 0;
      this.cleanupExpiredKeys(now);
    }

    let record = this.store.get(key);
    if (!record) {
      record = { timestamps: [], lastAccess: now };
      this.store.set(key, record);
    }

    const windowStart = now - windowMs;
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
    record.lastAccess = now;

    if (record.timestamps.length >= limit) {
      const oldestInWindow = record.timestamps[0];
      return { allowed: false, remaining: 0, resetAtMs: oldestInWindow + windowMs };
    }

    record.timestamps.push(now);
    return {
      allowed: true,
      remaining: limit - record.timestamps.length,
      resetAtMs: record.timestamps[0] + windowMs,
    };
  }

  async checkAndRecord(key: string, now: number, windowMs: number, limit: number): Promise<SlidingWindowVerdict> {
    return this.checkAndRecordSync(key, now, windowMs, limit);
  }

  async ping(): Promise<void> {
    return;
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

/** Fail-closed error when the shared rate-limit backend is unreachable. */
export class RateLimitBackendError extends ApiError {
  constructor(message = 'Rate limit service temporarily unavailable. Please retry later.') {
    super(503, 'RATE_LIMIT_BACKEND_UNAVAILABLE', message);
  }
}

export class RedisRateLimitBackend implements RateLimitBackend {
  readonly name = 'redis';
  private client: Redis | null = null;
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  private getClient(): Redis {
    if (!this.client) {
      this.client = new Redis(this.url, {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: false,
      });
      this.client.on('error', (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn('redis.rate_limit.error', {
          metadata: { error: message },
        });
      });

      const shutdown = () => {
        if (this.client) {
          const c = this.client;
          this.client = null;
          c.quit().catch(() => undefined);
        }
      };
      process.once('SIGTERM', shutdown);
      process.once('SIGINT', shutdown);
    }
    return this.client;
  }

  /** Exposes the underlying client for graceful-shutdown shims. */
  getRedisClient(): Redis | null {
    if (!this.url) return null;
    return this.getClient();
  }

  async close(): Promise<void> {
    if (this.client) {
      const c = this.client;
      this.client = null;
      await c.quit().catch(() => undefined);
    }
  }

  async checkAndRecord(key: string, now: number, windowMs: number, limit: number): Promise<SlidingWindowVerdict> {
    const client = this.getClient();
    const memberUnique = `${now}:${Math.random().toString(36).slice(2, 9)}`;
    const rawRes = await client.eval(
      SLIDING_WINDOW_LUA,
      1,
      key,
      now,
      windowMs,
      limit,
      memberUnique
    );
    const [isAllowed, remaining, resetAtMs] = rawRes as [number, number, number];
    return { allowed: isAllowed === 1, remaining: Math.max(0, remaining), resetAtMs };
  }

  async ping(): Promise<void> {
    const pong = await this.getClient().ping();
    if (pong !== 'PONG') {
      throw new Error(`Unexpected Redis PING response: ${pong}`);
    }
  }
}

// --- Backend singleton -----------------------------------------------------

const defaultMemoryBackend = new SharedMemoryRateLimitBackend();
let redisBackend: RedisRateLimitBackend | null = null;
let testBackendOverride: RateLimitBackend | null = null;

function getRedisUrl(): string | null {
  const url = (process.env.REDIS_URL || '').trim();
  return url.length > 0 ? url : null;
}

/**
 * Canonical backend resolver. Routes MUST NOT access Redis directly;
 * they go through `assertRateLimit` / `checkRateLimit`, which use this.
 *
 * Selection (Issue #29, corrective review):
 * - explicit test injection wins (unit tests);
 * - `REDIS_URL` set -> shared self-hosted Redis (production path);
 * - production runtime without `REDIS_URL` -> THROW (fail fast; the memory
 *   double is never a production source of truth);
 * - Next.js build phase (`NEXT_PHASE=phase-production-build`, which never
 *   serves traffic) may use the memory double so `next build` works without
 *   live infrastructure;
 * - development/test without `REDIS_URL` -> memory test double.
 */
export function getRateLimitBackend(): RateLimitBackend {
  if (testBackendOverride) {
    return testBackendOverride;
  }
  const redisUrl = getRedisUrl();
  if (redisUrl) {
    if (!redisBackend) {
      redisBackend = new RedisRateLimitBackend(redisUrl);
    }
    return redisBackend;
  }
  if (process.env.NODE_ENV === 'production' && !isBuildPhase()) {
    throw new Error(
      '[QCET-RATELIMIT] REDIS_URL is required in production. Set it to a shared self-hosted Redis (redis:// or rediss://); the process-local test double is not a valid production backend.'
    );
  }
  return defaultMemoryBackend;
}

export function getRateLimitBackendInfo(): { mode: 'redis' | 'memory-test-double'; redisConfigured: boolean } {
  if (testBackendOverride) {
    return {
      mode: testBackendOverride.name === 'redis' ? 'redis' : 'memory-test-double',
      redisConfigured: getRedisUrl() !== null,
    };
  }
  return getRedisUrl() ? { mode: 'redis', redisConfigured: true } : { mode: 'memory-test-double', redisConfigured: false };
}

/** Test seam: inject a shared backend (e.g. one double for two simulated instances). */
export function __setRateLimitBackendForTesting(backend: RateLimitBackend | null): void {
  testBackendOverride = backend;
}

export function __clearRateLimitBackendForTesting(): void {
  testBackendOverride = null;
}

/** @deprecated Use getRateLimitBackend(); kept for backward compatibility. */
export function getRedisClient(): Redis | null {
  const backend = getRateLimitBackend();
  if (backend instanceof RedisRateLimitBackend) {
    return backend.getRedisClient();
  }
  return null;
}

/** @deprecated Use backend close via getRateLimitBackend(); kept for backward compatibility. */
export function closeRedisClient(): Promise<void> | void {
  if (redisBackend) {
    const b = redisBackend;
    redisBackend = null;
    return b.close().catch(() => undefined);
  }
}

// --- Aggregate observability (process-local counters; decisions stay in the backend) ---

export interface RateLimitMetricsSnapshot {
  checks: number;
  allowed: number;
  blocked: number;
  backendErrors: number;
  totalLatencyMs: number;
}

const rateLimitMetrics: RateLimitMetricsSnapshot = {
  checks: 0,
  allowed: 0,
  blocked: 0,
  backendErrors: 0,
  totalLatencyMs: 0,
};

export function getRateLimitMetrics(): RateLimitMetricsSnapshot {
  return { ...rateLimitMetrics };
}

export function resetRateLimitMetricsForTesting(): void {
  rateLimitMetrics.checks = 0;
  rateLimitMetrics.allowed = 0;
  rateLimitMetrics.blocked = 0;
  rateLimitMetrics.backendErrors = 0;
  rateLimitMetrics.totalLatencyMs = 0;
}

function instanceMetadata(): { pid: number; hostname: string } {
  return { pid: process.pid, hostname: os.hostname() };
}

// --- Legacy in-memory store shims (deprecated sync path + unit tests) --------

/**
 * Clears the process-local test-double store. In production with Redis this
 * does NOT touch shared state (by design: a restart must not reset limits).
 */
export function cleanupExpiredKeys(now = Date.now(), maxRetentionMs = 60 * 60 * 1000): void {
  defaultMemoryBackend.cleanupExpiredKeys(now, maxRetentionMs);
}

export function resetRateLimits(): void {
  defaultMemoryBackend.clear();
  resetRateLimitMetricsForTesting();
}

export function getRateLimitStoreSize(): number {
  return defaultMemoryBackend.size();
}

function checkRateLimitMemoryInternal(
  fullKey: string,
  limit: number,
  windowMs: number,
  now: number
): SyncRateLimitResult {
  const verdict = defaultMemoryBackend.checkAndRecordSync(fullKey, now, windowMs, limit);
  const retryAfter = verdict.allowed ? 0 : Math.max(1, Math.ceil((verdict.resetAtMs - now) / 1000));
  return {
    success: verdict.allowed,
    allowed: verdict.allowed,
    limit,
    remaining: verdict.remaining,
    resetAt: verdict.resetAtMs,
    retryAfter,
  };
}

// --- Key resolution ----------------------------------------------------------

/** Sanitizes a caller-supplied identifier so secrets can never become keys or logs. */
export function sanitizeRateLimitSubject(raw: unknown): string {
  if (typeof raw !== 'string') return 'anonymous';
  const trimmed = raw.trim();
  if (!trimmed) return 'anonymous';
  // Never accept bearer/session tokens, passwords or secrets as identifiers.
  if (
    trimmed.length > 256 ||
    trimmed.includes(' ') ||
    trimmed.split('.').length === 3 ||
    /^(bearer|basic)\s+/i.test(trimmed) ||
    /(password|passwd|secret|session[_-]?token|api[_-]?key|cookie)/i.test(trimmed)
  ) {
    return '[redacted]';
  }
  return trimmed;
}

/**
 * Best-effort subject classification for keys/observability.
 * Callers SHOULD pass an explicit userId (authenticated) or IP (anonymous).
 */
export function classifyRateLimitSubject(identifier: string): RateLimitSubjectType {
  if (!identifier || identifier === 'anonymous' || identifier === '[redacted]') return 'anonymous';
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(identifier) || identifier.includes(':')) return 'ip';
  return 'user';
}

/**
 * Canonical key format: `qcet:eoffice:ratelimit:<TIER>:<subject>:<id>`.
 * The legacy `ratelimit:<TIER>:<identifier>` shape is superseded.
 */
export function buildRateLimitKey(tier: string, identifier: string, subjectType?: RateLimitSubjectType): string {
  const safeId = sanitizeRateLimitSubject(identifier);
  const subject = subjectType ?? classifyRateLimitSubject(safeId);
  return `${RATE_LIMIT_KEY_PREFIX}:${tier}:${subject}:${safeId}`;
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
    return { fullKey: buildRateLimitKey(tier, second), tier, limit: t.limit, windowMs: t.windowSeconds * 1000 };
  }

  // Case B: checkRateLimit('user_123', 'MUTATION' | 'AUTH_LOGIN' | ...)
  if (typeof second === 'string' && second in RATE_LIMIT_TIERS) {
    const tier = second as keyof typeof RATE_LIMIT_TIERS;
    const identifier = first as string;
    const t = RATE_LIMIT_TIERS[tier];
    return { fullKey: buildRateLimitKey(tier, identifier), tier, limit: t.limit, windowMs: t.windowSeconds * 1000 };
  }

  // Case C: checkRateLimit('user_123', { limit: 5, windowMs: 60000 })
  if (typeof second === 'object' && second !== null && 'limit' in second) {
    const identifier = first as string;
    return { fullKey: buildRateLimitKey('CUSTOM', identifier), tier: 'CUSTOM', limit: second.limit, windowMs: second.windowMs };
  }

  // Case D: fallback to DEFAULT_API
  const identifier = typeof second === 'string' ? second : String(first);
  const p = RATE_LIMIT_PRESETS.DEFAULT_API;
  return { fullKey: buildRateLimitKey('DEFAULT_API', identifier), tier: 'DEFAULT_API', limit: p.limit, windowMs: p.windowMs };
}

// --- Async distributed check ---------------------------------------------------

function toAsyncResult(
  limit: number,
  verdict: SlidingWindowVerdict,
  now: number
): AsyncRateLimitResult {
  const allowed = verdict.allowed;
  return {
    success: allowed,
    allowed,
    limit,
    remaining: verdict.remaining,
    resetAt: new Date(verdict.resetAtMs),
    retryAfter: allowed ? 0 : Math.max(1, Math.ceil((verdict.resetAtMs - now) / 1000)),
  };
}

async function checkRateLimitDistributed(
  fullKey: string,
  tier: string,
  identifier: string,
  limit: number,
  windowMs: number,
  now: number
): Promise<AsyncRateLimitResult> {
  const backend = getRateLimitBackend();
  const startedAt = Date.now();
  rateLimitMetrics.checks++;
  try {
    const verdict = await backend.checkAndRecord(fullKey, now, windowMs, limit);
    rateLimitMetrics.totalLatencyMs += Date.now() - startedAt;
    if (verdict.allowed) {
      rateLimitMetrics.allowed++;
    } else {
      rateLimitMetrics.blocked++;
    }
    return toAsyncResult(limit, verdict, now);
  } catch (err) {
    rateLimitMetrics.totalLatencyMs += Date.now() - startedAt;
    rateLimitMetrics.backendErrors++;
    const message = err instanceof Error ? err.message : String(err);
    // High-severity: the shared backend is a production dependency. Never
    // fail open — surface a controlled 503 so callers retry later.
    logger.error('ratelimit.backend_unavailable', {
      metadata: {
        tier,
        identifier: sanitizeRateLimitSubject(identifier),
        subjectType: classifyRateLimitSubject(sanitizeRateLimitSubject(identifier)),
        backend: backend.name,
        error: message,
        ...instanceMetadata(),
      },
    });
    if (err instanceof ApiError) {
      throw err;
    }
    throw new RateLimitBackendError();
  }
}

/**
 * Modern async API: checkRateLimit(tier, identifier) returns Promise<AsyncRateLimitResult>.
 * Uses the shared backend (Redis in production). Backend failures fail closed
 * with `RateLimitBackendError` (503) — never silent fail-open.
 */
export function checkRateLimit(
  tier: keyof typeof RATE_LIMIT_TIERS,
  identifier: string
): Promise<AsyncRateLimitResult>;

/**
 * Legacy sync API: checkRateLimit(identifier, tier, now?) returns SyncRateLimitResult.
 * @deprecated Unit-test double only. Uses the process-local store and MUST NOT
 * be used for production decisions — use the async overload (shared backend).
 */
export function checkRateLimit(
  identifier: string,
  tier: RateLimitTier | string | RateLimitConfig,
  now?: number
): SyncRateLimitResult;

/**
 * Implementation.
 * Fix: legacy sync callers always use in-memory (never return a Promise unless caller awaits).
 * Modern tier callers use the shared backend (Redis when configured).
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

  const { fullKey, tier, limit, windowMs } = resolveConfig(arg1, arg2);
  const now = typeof arg3 === 'number' ? arg3 : Date.now();

  // Legacy sync form: process-local test double (deprecated, never production).
  if (!isModernTierCall) {
    return checkRateLimitMemoryInternal(fullKey, limit, windowMs, now);
  }

  // Modern async form: shared backend (Redis in production) — fail-closed on errors.
  return checkRateLimitDistributed(fullKey, tier, String(arg2), limit, windowMs, now);
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

export interface AssertRateLimitOptions {
  message?: string;
  /** Explicit timestamp (tests). Defaults to Date.now(). */
  now?: number;
  /** Endpoint/method label for structured block logs, e.g. "POST /api/tasks". */
  endpoint?: string;
  /** Caller request id for block-log correlation. */
  requestId?: string;
  /** Subject classification; inferred when omitted. */
  subjectType?: RateLimitSubjectType;
  /** Authenticated user id (logged as subject owner, never the raw secret). */
  userId?: string | null;
}

/**
 * Canonical distributed rate-limit assertion (Issue #29).
 *
 * Async: resolves against the shared backend (Redis in production), so quota
 * is shared across instances and survives restarts. Throws `RateLimitError`
 * (429) when the tier quota is exceeded, and `RateLimitBackendError` (503)
 * fail-closed when the shared backend is unreachable.
 */
export async function assertRateLimit(
  identifier: string,
  tier: RateLimitTier | string | RateLimitConfig,
  messageOrOptions?: string | AssertRateLimitOptions,
  nowOrUndefined?: number
): Promise<void> {
  const options: AssertRateLimitOptions =
    typeof messageOrOptions === 'object' && messageOrOptions !== null
      ? messageOrOptions
      : { message: messageOrOptions, now: nowOrUndefined };

  const { fullKey, tier: resolvedTier, limit, windowMs } = resolveConfig(identifier, tier);
  const effectiveNow = options.now ?? Date.now();
  const safeIdentifier = sanitizeRateLimitSubject(identifier);
  const subjectType = options.subjectType ?? classifyRateLimitSubject(safeIdentifier);

  const result = await checkRateLimitDistributed(
    fullKey,
    resolvedTier,
    safeIdentifier,
    limit,
    windowMs,
    effectiveNow
  );

  if (!result.allowed) {
    const defaultMsg = `Rate limit exceeded. Please retry after ${result.retryAfter} second${
      result.retryAfter === 1 ? '' : 's'
    }.`;
    // Fire-and-forget structured block log (never blocks the 429 response).
    void logRateLimitExceeded(resolvedTier, safeIdentifier, options.endpoint, options.userId ?? null, {
      requestId: options.requestId,
      subjectType,
      retryAfter: result.retryAfter,
      resetAt: result.resetAt,
    }).catch(() => undefined);
    const err = new RateLimitError(options.message || defaultMsg, 'RATE_LIMITED', result.retryAfter);
    err.retryAfter = result.retryAfter;
    throw err;
  }
}

export interface RateLimitBlockDetails {
  requestId?: string;
  subjectType?: RateLimitSubjectType;
  retryAfter?: number;
  resetAt?: Date | number;
}

/**
 * Structured audit log for rate limit exceeded events.
 * Caller must capture retryAfter BEFORE calling this to avoid timing issues.
 * Identifiers are sanitized: raw tokens / secrets are never logged.
 */
export async function logRateLimitExceeded(
  tier: string,
  identifier: string,
  endpoint?: string,
  userId?: string | null,
  details?: RateLimitBlockDetails
): Promise<void> {
  const safeIdentifier = sanitizeRateLimitSubject(identifier);
  const subjectType = details?.subjectType ?? classifyRateLimitSubject(safeIdentifier);
  const metadata = {
    tier,
    endpoint,
    identifier: safeIdentifier,
    subjectType,
    ...(details?.requestId ? { requestId: details.requestId } : {}),
    ...(typeof details?.retryAfter === 'number' ? { retryAfter: details.retryAfter } : {}),
    ...(details?.resetAt
      ? {
          resetAt:
            details.resetAt instanceof Date
              ? details.resetAt.toISOString()
              : new Date(details.resetAt).toISOString(),
        }
      : {}),
    ...instanceMetadata(),
  };
  logger.warn('security.rate_limit_exceeded', {
    userId: userId ?? undefined,
    errorCode: 'RATE_LIMITED',
    metadata,
  });

  try {
    await logAuditEvent({
      action: 'RATE_LIMIT_EXCEEDED' as any,
      actorId: userId || null,
      entityType: 'System',
      entityId: `${RATE_LIMIT_KEY_PREFIX}:${tier}:${subjectType}`,
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
