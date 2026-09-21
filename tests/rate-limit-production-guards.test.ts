import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRateLimit,
  checkRateLimit,
  getRateLimitBackend,
  getRateLimitBackendInfo,
  resetRateLimits,
  resetRateLimitMetricsForTesting,
  RateLimitBackendError,
  SharedMemoryRateLimitBackend,
  __setRateLimitBackendForTesting,
  __clearRateLimitBackendForTesting,
} from '@/server/security/rate-limit';
import { RateLimitError } from '@/server/api/errors';
import { validateServerEnv } from '@/config/env.server';

/**
 * BLOCKER 4 (corrective review, Issue #29): production must never run on the
 * process-local test double. Missing/invalid REDIS_URL fails startup env
 * validation, the resolver throws instead of returning memory, and readiness
 * reports 503. Development/test keep the memory double explicitly.
 */
describe('Issue #29: production Redis is mandatory', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    __clearRateLimitBackendForTesting();
    resetRateLimits();
    resetRateLimitMetricsForTesting();
  });

  afterEach(() => {
    (process.env as any).NODE_ENV = savedEnv.NODE_ENV;
    if (savedEnv.REDIS_URL === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = savedEnv.REDIS_URL;
    }
    if (savedEnv.NEXT_PHASE === undefined) {
      delete process.env.NEXT_PHASE;
    } else {
      process.env.NEXT_PHASE = savedEnv.NEXT_PHASE;
    }
    __clearRateLimitBackendForTesting();
    resetRateLimits();
    resetRateLimitMetricsForTesting();
  });

  const validProdBase = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/qcet_eoffice?schema=public',
    AUTH_SECRET: 'production-secret-key-at-least-32-chars!!',
  };

  it('production missing REDIS_URL fails startup env validation', () => {
    assert.throws(() => validateServerEnv({ ...validProdBase } as any), /REDIS_URL/);
  });

  it('production invalid REDIS_URL scheme fails startup env validation', () => {
    assert.throws(
      () => validateServerEnv({ ...validProdBase, REDIS_URL: 'http://localhost:6379' } as any),
      /REDIS_URL/
    );
    assert.throws(
      () => validateServerEnv({ ...validProdBase, REDIS_URL: 'localhost:6379' } as any),
      /REDIS_URL/
    );
  });

  it('production valid REDIS_URL passes startup env validation', () => {
    const env = validateServerEnv({ ...validProdBase, REDIS_URL: 'redis://redis:6379' } as any);
    assert.equal(env.REDIS_URL, 'redis://redis:6379');
    const tlsEnv = validateServerEnv({ ...validProdBase, REDIS_URL: 'rediss://redis:6380' } as any);
    assert.equal(tlsEnv.REDIS_URL, 'rediss://redis:6380');
  });

  it('development without REDIS_URL passes validation (test double allowed)', () => {
    const env = validateServerEnv({ NODE_ENV: 'development' } as any);
    assert.equal(env.NODE_ENV, 'development');
  });

  it('production resolver never selects the memory backend', () => {
    (process.env as any).NODE_ENV = 'production';
    delete process.env.REDIS_URL;
    delete process.env.NEXT_PHASE;
    __clearRateLimitBackendForTesting();
    assert.throws(() => getRateLimitBackend(), /REDIS_URL/);
  });

  it('development/test without REDIS_URL explicitly use the memory test double', () => {
    for (const nodeEnv of ['development', 'test']) {
      (process.env as any).NODE_ENV = nodeEnv;
      delete process.env.REDIS_URL;
      __clearRateLimitBackendForTesting();
      const backend = getRateLimitBackend();
      assert.equal(backend.name, 'memory-test-double');
      assert.equal(getRateLimitBackendInfo().mode, 'memory-test-double');
      assert.equal(getRateLimitBackendInfo().redisConfigured, false);
    }
  });

  it('build phase may resolve the memory double without live Redis', () => {
    (process.env as any).NODE_ENV = 'production';
    delete process.env.REDIS_URL;
    process.env.NEXT_PHASE = 'phase-production-build';
    __clearRateLimitBackendForTesting();
    const backend = getRateLimitBackend();
    assert.equal(backend.name, 'memory-test-double');
  });

  it('configured backend outage fails closed with 503 (no fail-open)', async () => {
    __setRateLimitBackendForTesting({
      name: 'redis',
      checkAndRecord: async () => {
        throw new Error('ECONNREFUSED redis:6379');
      },
      ping: async () => {
        throw new Error('ECONNREFUSED redis:6379');
      },
    });

    await assert.rejects(async () => assertRateLimit('outage-user', 'MUTATION'), (err: unknown) => {
      assert.ok(err instanceof RateLimitBackendError);
      assert.ok(!(err instanceof RateLimitError));
      assert.equal((err as RateLimitBackendError).statusCode, 503);
      return true;
    });
    await assert.rejects(async () => checkRateLimit('MUTATION', 'outage-user'), (err: unknown) => {
      assert.ok(err instanceof RateLimitBackendError);
      return true;
    });
  });

  it('injected shared backend is honored regardless of NODE_ENV', () => {
    (process.env as any).NODE_ENV = 'production';
    process.env.REDIS_URL = 'redis://redis:6379';
    const shared = new SharedMemoryRateLimitBackend();
    __setRateLimitBackendForTesting(shared);
    assert.equal(getRateLimitBackend(), shared);
  });
});
