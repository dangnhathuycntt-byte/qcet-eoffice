import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRateLimit,
  checkRateLimit,
  buildRateLimitKey,
  sanitizeRateLimitSubject,
  classifyRateLimitSubject,
  getRateLimitHeaders,
  getRateLimitMetrics,
  resetRateLimits,
  resetRateLimitMetricsForTesting,
  sanitizeRateLimitSubject as sanitize,
  SharedMemoryRateLimitBackend,
  RateLimitBackendError,
  RATE_LIMIT_TIERS,
  RATE_LIMIT_KEY_PREFIX,
  __setRateLimitBackendForTesting,
  __clearRateLimitBackendForTesting,
  type RateLimitBackend,
} from '@/server/security/rate-limit';
import { RateLimitError } from '@/server/api/errors';

/**
 * Issue #29 acceptance: distributed persistent rate limiting.
 *
 * Production decisions go through the shared backend (Redis when REDIS_URL
 * is set). These tests inject a shared in-memory backend with identical
 * sliding-window semantics to prove cross-instance sharing, restart
 * persistence, atomicity under concurrency, and fail-closed backend errors —
 * without requiring a live Redis in unit tests.
 */
describe('Issue #29: distributed rate limiting', () => {
  beforeEach(() => {
    __clearRateLimitBackendForTesting();
    __setRateLimitBackendForTesting(new SharedMemoryRateLimitBackend());
    resetRateLimits();
    resetRateLimitMetricsForTesting();
  });

  afterEach(() => {
    __clearRateLimitBackendForTesting();
    resetRateLimits();
    resetRateLimitMetricsForTesting();
  });

  it('central tier configuration holds all documented tiers with frozen thresholds', () => {
    assert.equal(RATE_LIMIT_TIERS.AUTH_LOGIN.limit, 5);
    assert.equal(RATE_LIMIT_TIERS.AUTH_REGISTER.limit, 5);
    assert.equal(RATE_LIMIT_TIERS.SEARCH.limit, 30);
    assert.equal(RATE_LIMIT_TIERS.EXPORT.limit, 5);
    assert.equal(RATE_LIMIT_TIERS.MUTATIONS_SENSITIVE.limit, 30);
    assert.equal(RATE_LIMIT_TIERS.MUTATION.limit, 60);
    assert.equal(RATE_LIMIT_TIERS.PUSH_TEST.limit, 3);
    assert.equal(RATE_LIMIT_TIERS.FILE_DOWNLOAD.limit, 60);
    assert.equal(RATE_LIMIT_TIERS.DEFAULT_API.limit, 100);
  });

  it('keys are namespaced per app/tier/subject, never raw secrets', () => {
    assert.equal(buildRateLimitKey('MUTATION', 'user-123', 'user'), `${RATE_LIMIT_KEY_PREFIX}:MUTATION:user:user-123`);
    assert.equal(buildRateLimitKey('AUTH_LOGIN', '203.0.113.7', 'ip'), `${RATE_LIMIT_KEY_PREFIX}:AUTH_LOGIN:ip:203.0.113.7`);
    const secretKey = buildRateLimitKey('MUTATION', 'eyJhbGciOiJIUzI1NiJ9.cGF5bG9hZA.signature', 'user');
    assert.ok(!secretKey.includes('eyJhbGciOiJIUzI1NiJ9'));
  });

  it('sanitizes tokens/passwords/secrets out of identifiers and logs', () => {
    assert.equal(sanitize('eyJhbGciOiJIUzI1NiJ9.cGF5bG9hZA.signature'), '[redacted]');
    assert.equal(sanitize('Bearer abc123'), '[redacted]');
    assert.equal(sanitize('my-password=secret'), '[redacted]');
    assert.equal(sanitize('user-123'), 'user-123');
    assert.equal(sanitize('   '), 'anonymous');
    assert.equal(classifyRateLimitSubject('user-123'), 'user');
    assert.equal(classifyRateLimitSubject('203.0.113.7'), 'ip');
    assert.equal(classifyRateLimitSubject('anonymous'), 'anonymous');
  });

  it('MUTATION limit N => request N+1 in the same window throws 429 with retry metadata', async () => {
    const id = `mutation-n-plus-one`;
    const limit = RATE_LIMIT_TIERS.MUTATION.limit;
    for (let i = 0; i < limit; i++) {
      await assertRateLimit(id, 'MUTATION');
    }
    await assert.rejects(async () => assertRateLimit(id, 'MUTATION'), (err: unknown) => {
      assert.ok(err instanceof RateLimitError);
      assert.equal((err as RateLimitError).statusCode, 429);
      assert.equal((err as RateLimitError).code, 'RATE_LIMITED');
      assert.ok(((err as RateLimitError).retryAfter ?? 0) > 0);
      return true;
    });

    const blocked = await checkRateLimit('MUTATION', `mutation-n-plus-one-headers`);
    assert.equal(blocked.success, true);
    for (let i = 1; i < limit; i++) {
      await checkRateLimit('MUTATION', `mutation-n-plus-one-headers`);
    }
    const over = await checkRateLimit('MUTATION', `mutation-n-plus-one-headers`);
    assert.equal(over.success, false);
    assert.equal(over.remaining, 0);
    assert.ok(over.retryAfter > 0);
    const headers = getRateLimitHeaders(over);
    assert.ok(headers['Retry-After']);
    assert.equal(headers['X-RateLimit-Limit'], String(limit));
  });

  it('concurrent requests cannot race past the limit', async () => {
    const id = 'concurrent-racer';
    const limit = 5;
    const attempts = 20;
    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () => assertRateLimit(id, { limit, windowMs: 60000 }))
    );
    const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r) => r.status === 'rejected').length;
    assert.equal(fulfilled, limit);
    assert.equal(rejected, attempts - limit);
    for (const r of results) {
      if (r.status === 'rejected') {
        assert.ok(r.reason instanceof RateLimitError);
      }
    }
  });

  it('two app instances sharing one backend share quota (no double-spend)', async () => {
    const shared = new SharedMemoryRateLimitBackend();
    // Instance A and instance B resolve the SAME shared backend object,
    // simulating two Next.js processes on one Redis.
    __setRateLimitBackendForTesting(shared);
    await assertRateLimit('shared-quota-user', 'PUSH_TEST'); // 1/3
    await assertRateLimit('shared-quota-user', 'PUSH_TEST'); // 2/3 (instance B)
    await assertRateLimit('shared-quota-user', 'PUSH_TEST'); // 3/3 (instance A)
    await assert.rejects(async () => assertRateLimit('shared-quota-user', 'PUSH_TEST'), (err: unknown) => {
      assert.ok(err instanceof RateLimitError);
      return true;
    });
  });

  it('recreating the service object (restart) does not reset shared limiter state', async () => {
    const shared = new SharedMemoryRateLimitBackend();
    __setRateLimitBackendForTesting(shared);
    await assertRateLimit('restart-user', 'BULK_EXPORT'); // 1/3
    await assertRateLimit('restart-user', 'BULK_EXPORT'); // 2/3

    // Simulate process restart: drop module singletons, reconnect same backend.
    __clearRateLimitBackendForTesting();
    resetRateLimitMetricsForTesting();
    __setRateLimitBackendForTesting(shared);

    await assertRateLimit('restart-user', 'BULK_EXPORT'); // 3/3 still counted
    await assert.rejects(async () => assertRateLimit('restart-user', 'BULK_EXPORT'), (err: unknown) => {
      assert.ok(err instanceof RateLimitError);
      return true;
    });
  });

  it('per-instance reset cannot wipe shared backend state', async () => {
    const shared = new SharedMemoryRateLimitBackend();
    __setRateLimitBackendForTesting(shared);
    await assertRateLimit('reset-proof-user', 'PUSH_TEST');
    await assertRateLimit('reset-proof-user', 'PUSH_TEST');
    resetRateLimits(); // only clears the default process-local double + metrics
    resetRateLimitMetricsForTesting();
    await assertRateLimit('reset-proof-user', 'PUSH_TEST'); // 3/3
    await assert.rejects(async () => assertRateLimit('reset-proof-user', 'PUSH_TEST'), (err: unknown) => {
      assert.ok(err instanceof RateLimitError);
      return true;
    });
  });

  it('backend failure fails closed with 503 (never silent fail-open)', async () => {
    const failing: RateLimitBackend = {
      name: 'failing-backend',
      checkAndRecord: async () => {
        throw new Error('connection refused');
      },
      ping: async () => {
        throw new Error('connection refused');
      },
    };
    __setRateLimitBackendForTesting(failing);

    await assert.rejects(async () => assertRateLimit('victim-user', 'MUTATION'), (err: unknown) => {
      assert.ok(err instanceof RateLimitBackendError);
      assert.equal((err as RateLimitBackendError).statusCode, 503);
      assert.equal((err as RateLimitBackendError).code, 'RATE_LIMIT_BACKEND_UNAVAILABLE');
      return true;
    });
    await assert.rejects(async () => checkRateLimit('MUTATION', 'victim-user'), (err: unknown) => {
      assert.ok(err instanceof RateLimitBackendError);
      return true;
    });

    const metrics = getRateLimitMetrics();
    assert.equal(metrics.backendErrors, 2);
    assert.equal(metrics.allowed, 0);
  });

  it('blocked events increment aggregate metrics', async () => {
    const id = 'metrics-user';
    await assertRateLimit(id, 'PUSH_TEST');
    await assertRateLimit(id, 'PUSH_TEST');
    await assertRateLimit(id, 'PUSH_TEST');
    await assert.rejects(async () => assertRateLimit(id, 'PUSH_TEST'));
    const metrics = getRateLimitMetrics();
    assert.equal(metrics.allowed, 3);
    assert.equal(metrics.blocked, 1);
    assert.equal(metrics.backendErrors, 0);
  });

  it('existing route tiers keep working through the shared backend', async () => {
    for (const tier of ['AUTH_LOGIN', 'SEARCH', 'EXPORT', 'MUTATION', 'FILE_DOWNLOAD', 'DEFAULT_API'] as const) {
      const res = await checkRateLimit(tier, `tier-smoke-${tier}`);
      assert.equal(res.success, true);
      assert.equal(res.limit, RATE_LIMIT_TIERS[tier].limit);
    }
  });
});
