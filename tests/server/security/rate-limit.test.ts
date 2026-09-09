import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRateLimit,
  assertRateLimit,
  getRateLimitHeaders,
  resetRateLimits,
  RATE_LIMIT_PRESETS,
  type RateLimitConfig,
} from '@/server/security/rate-limit';
import { RateLimitError, ApiError } from '@/server/api/errors';

describe('Business Flow Rate Limiting Engine', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  describe('checkRateLimit counter and sliding window', () => {
    it('decrements remaining counter on successive calls within limit', () => {
      const config: RateLimitConfig = { limit: 3, windowMs: 60000 };
      const key = 'test:user:1';
      const baseTime = 1000000;

      const r1 = checkRateLimit(key, config, baseTime);
      assert.strictEqual(r1.allowed, true);
      assert.strictEqual(r1.limit, 3);
      assert.strictEqual(r1.remaining, 2);
      assert.strictEqual(r1.resetAt, baseTime + 60000);
      assert.strictEqual(r1.retryAfter, 0);

      const r2 = checkRateLimit(key, config, baseTime + 1000);
      assert.strictEqual(r2.allowed, true);
      assert.strictEqual(r2.remaining, 1);
      assert.strictEqual(r2.resetAt, baseTime + 60000);

      const r3 = checkRateLimit(key, config, baseTime + 2000);
      assert.strictEqual(r3.allowed, true);
      assert.strictEqual(r3.remaining, 0);
      assert.strictEqual(r3.resetAt, baseTime + 60000);
    });

    it('blocks requests when rate limit is reached', () => {
      const config: RateLimitConfig = { limit: 2, windowMs: 10000 };
      const key = 'test:user:blocked';
      const baseTime = 2000000;

      // 1st request
      const r1 = checkRateLimit(key, config, baseTime);
      assert.strictEqual(r1.allowed, true);
      assert.strictEqual(r1.remaining, 1);

      // 2nd request - limit reached
      const r2 = checkRateLimit(key, config, baseTime + 2000);
      assert.strictEqual(r2.allowed, true);
      assert.strictEqual(r2.remaining, 0);

      // 3rd request - blocked
      const r3 = checkRateLimit(key, config, baseTime + 4000);
      assert.strictEqual(r3.allowed, false);
      assert.strictEqual(r3.remaining, 0);
      assert.strictEqual(r3.resetAt, baseTime + 10000);
      // retryAfter = (2010000 - 2004000) / 1000 = 6 seconds
      assert.strictEqual(r3.retryAfter, 6);

      // 4th request at baseTime + 5000 - still blocked
      const r4 = checkRateLimit(key, config, baseTime + 5000);
      assert.strictEqual(r4.allowed, false);
      assert.strictEqual(r4.retryAfter, 5);
    });

    it('resets/slides window and allows requests after window expires', () => {
      const config: RateLimitConfig = { limit: 2, windowMs: 5000 };
      const key = 'test:user:expiry';
      const baseTime = 3000000;

      checkRateLimit(key, config, baseTime);
      checkRateLimit(key, config, baseTime + 1000);

      // Exceeded at +2000
      const blocked = checkRateLimit(key, config, baseTime + 2000);
      assert.strictEqual(blocked.allowed, false);

      // Advance time past the 1st request expiration (baseTime + 5001)
      const allowedAgain = checkRateLimit(key, config, baseTime + 5001);
      assert.strictEqual(allowedAgain.allowed, true);
      assert.strictEqual(allowedAgain.remaining, 0); // 1 request still active (at +1000)

      // Advance time past the 2nd request expiration (baseTime + 6001)
      const fullyRefilled = checkRateLimit(key, config, baseTime + 15000);
      assert.strictEqual(fullyRefilled.allowed, true);
      assert.strictEqual(fullyRefilled.remaining, 1);
    });

    it('keeps separate counters for different keys and does not cross-contaminate', () => {
      const config: RateLimitConfig = { limit: 1, windowMs: 10000 };
      const baseTime = 4000000;

      const userA = checkRateLimit('user:alice', config, baseTime);
      assert.strictEqual(userA.allowed, true);

      // Alice is blocked on 2nd request
      const userABlocked = checkRateLimit('user:alice', config, baseTime + 100);
      assert.strictEqual(userABlocked.allowed, false);

      // Bob should not be affected by Alice's throttling
      const userB = checkRateLimit('user:bob', config, baseTime + 200);
      assert.strictEqual(userB.allowed, true);
      assert.strictEqual(userB.remaining, 0);
    });
  });

  describe('Rate Limit Presets', () => {
    it('supports AUTH_LOGIN preset (5 requests / 15m)', () => {
      assert.strictEqual(RATE_LIMIT_PRESETS.AUTH_LOGIN.limit, 5);
      assert.strictEqual(RATE_LIMIT_PRESETS.AUTH_LOGIN.windowMs, 15 * 60 * 1000);

      const key = 'ip:192.168.1.1:login';
      const t0 = 1000000;
      for (let i = 0; i < 5; i++) {
        const res = checkRateLimit(key, 'AUTH_LOGIN', t0 + i * 100);
        assert.strictEqual(res.allowed, true);
      }
      const blocked = checkRateLimit(key, 'AUTH_LOGIN', t0 + 1000);
      assert.strictEqual(blocked.allowed, false);
    });

    it('supports AUTH_REGISTER preset (5 requests / 1h)', () => {
      assert.strictEqual(RATE_LIMIT_PRESETS.AUTH_REGISTER.limit, 5);
      assert.strictEqual(RATE_LIMIT_PRESETS.AUTH_REGISTER.windowMs, 60 * 60 * 1000);
    });

    it('supports SEARCH preset (30 requests / 1m)', () => {
      assert.strictEqual(RATE_LIMIT_PRESETS.SEARCH.limit, 30);
      assert.strictEqual(RATE_LIMIT_PRESETS.SEARCH.windowMs, 60 * 1000);
    });

    it('supports EXPORT preset (5 requests / 1m)', () => {
      assert.strictEqual(RATE_LIMIT_PRESETS.EXPORT.limit, 5);
      assert.strictEqual(RATE_LIMIT_PRESETS.EXPORT.windowMs, 60 * 1000);
    });

    it('supports MUTATIONS_SENSITIVE preset (30 requests / 1m)', () => {
      assert.strictEqual(RATE_LIMIT_PRESETS.MUTATIONS_SENSITIVE.limit, 30);
      assert.strictEqual(RATE_LIMIT_PRESETS.MUTATIONS_SENSITIVE.windowMs, 60 * 1000);
    });

    it('supports PUSH_TEST preset (3 requests / 5m)', () => {
      assert.strictEqual(RATE_LIMIT_PRESETS.PUSH_TEST.limit, 3);
      assert.strictEqual(RATE_LIMIT_PRESETS.PUSH_TEST.windowMs, 5 * 60 * 1000);
    });

    it('supports DEFAULT_API preset (100 requests / 1m)', () => {
      assert.strictEqual(RATE_LIMIT_PRESETS.DEFAULT_API.limit, 100);
      assert.strictEqual(RATE_LIMIT_PRESETS.DEFAULT_API.windowMs, 60 * 1000);
    });
  });

  describe('assertRateLimit', () => {
    it('does not throw when request is within limit', () => {
      assert.doesNotThrow(() => {
        assertRateLimit('allowed-user', { limit: 5, windowMs: 10000 });
      });
    });

    it('throws RateLimitError with 429 status and retryAfter property when limit exceeded', () => {
      const config: RateLimitConfig = { limit: 1, windowMs: 10000 };
      const key = 'test:assert:user';
      const baseTime = 5000000;

      assertRateLimit(key, config, undefined, baseTime);

      assert.throws(
        () => assertRateLimit(key, config, 'Custom rate limit message', baseTime + 1000),
        (err: unknown) => {
          assert.ok(err instanceof RateLimitError);
          assert.ok(err instanceof ApiError);
          assert.strictEqual(err.statusCode, 429);
          assert.strictEqual(err.code, 'RATE_LIMITED');
          assert.strictEqual(err.message, 'Custom rate limit message');
          assert.strictEqual(err.retryAfter, 9); // Math.ceil((5010000 - 5001000) / 1000)
          return true;
        }
      );
    });
  });

  describe('getRateLimitHeaders', () => {
    it('sets standard rate limit headers when allowed', () => {
      const result = {
        allowed: true,
        limit: 100,
        remaining: 85,
        resetAt: 1700000000000,
        retryAfter: 0,
      };

      const headers = getRateLimitHeaders(result);
      assert.strictEqual(headers['X-RateLimit-Limit'], '100');
      assert.strictEqual(headers['X-RateLimit-Remaining'], '85');
      assert.strictEqual(headers['X-RateLimit-Reset'], '1700000000');
      assert.strictEqual(headers['Retry-After'], undefined);
    });

    it('includes Retry-After header when request is blocked', () => {
      const result = {
        allowed: false,
        limit: 10,
        remaining: 0,
        resetAt: 1700000030000,
        retryAfter: 30,
      };

      const headers = getRateLimitHeaders(result);
      assert.strictEqual(headers['X-RateLimit-Limit'], '10');
      assert.strictEqual(headers['X-RateLimit-Remaining'], '0');
      assert.strictEqual(headers['X-RateLimit-Reset'], '1700000030');
      assert.strictEqual(headers['Retry-After'], '30');
    });
  });

  describe('resetRateLimits', () => {
    it('clears all memory counters across all keys', () => {
      const config: RateLimitConfig = { limit: 1, windowMs: 60000 };
      checkRateLimit('key-1', config);
      checkRateLimit('key-2', config);

      assert.strictEqual(checkRateLimit('key-1', config).allowed, false);
      assert.strictEqual(checkRateLimit('key-2', config).allowed, false);

      resetRateLimits();

      assert.strictEqual(checkRateLimit('key-1', config).allowed, true);
      assert.strictEqual(checkRateLimit('key-2', config).allowed, true);
    });
  });
});
