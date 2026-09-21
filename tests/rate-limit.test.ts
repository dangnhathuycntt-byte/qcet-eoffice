import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRateLimit,
  RATE_LIMIT_TIERS,
  getRateLimitIdentifier,
  resetRateLimits,
} from '@/server/api/rate-limit';

describe('Issue #29: Redis-backed Rate Limiter Test Suite', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  // Test 1: Fallback in-memory hoạt động khi REDIS_URL không set
  it('Test 1: Fallback in-memory hoạt động trơn tru khi REDIS_URL không set', async () => {
    // Đảm bảo trong môi trường test (hoặc không có Redis), in-memory fallback chạy bình thường
    const res = await checkRateLimit('MUTATION', 'test-user-fallback');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.limit, RATE_LIMIT_TIERS.MUTATION.limit);
    assert.strictEqual(res.remaining, RATE_LIMIT_TIERS.MUTATION.limit - 1);
    assert.ok(res.resetAt instanceof Date);
  });

  // Test 2: checkRateLimit trả success=true trong hạn mức
  it('Test 2: checkRateLimit trả success=true trong hạn mức', async () => {
    const res1 = await checkRateLimit('SENSITIVE_READ', 'user-sensitive-1');
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.limit, 30);
    assert.strictEqual(res1.remaining, 29);

    const res2 = await checkRateLimit('SENSITIVE_READ', 'user-sensitive-1');
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.remaining, 28);
  });

  // Test 3: Sau khi vượt limit → success=false, remaining=0
  it('Test 3: Sau khi vượt limit → success=false, remaining=0', async () => {
    const tier = 'BULK_EXPORT'; // limit = 3, window = 3600s
    const userId = 'export-abuser-1';

    // 3 requests within limit
    for (let i = 0; i < 3; i++) {
      const res = await checkRateLimit(tier, userId);
      assert.strictEqual(res.success, true);
    }

    // 4th request exceeds limit
    const blockedRes = await checkRateLimit(tier, userId);
    assert.strictEqual(blockedRes.success, false);
    assert.strictEqual(blockedRes.remaining, 0);
    assert.ok(blockedRes.retryAfter > 0);
  });

  // Test 4: resetAt là Date trong tương lai
  it('Test 4: resetAt là Date trong tương lai', async () => {
    const nowBefore = Date.now();
    const res = await checkRateLimit('STANDARD_READ', 'user-future-date');
    assert.strictEqual(res.success, true);
    assert.ok(res.resetAt instanceof Date);
    assert.ok(res.resetAt.getTime() >= nowBefore);
    assert.ok(res.resetAt.getTime() <= nowBefore + RATE_LIMIT_TIERS.STANDARD_READ.windowSeconds * 1000 + 1000);
  });

  // Test 5: getRateLimitIdentifier ưu tiên userId hơn IP
  it('Test 5: getRateLimitIdentifier ưu tiên userId hơn IP', () => {
    const mockRequest = {
      headers: {
        get: (headerName: string) => {
          if (headerName.toLowerCase() === 'x-forwarded-for') {
            return '203.0.113.195, 10.0.0.1';
          }
          return null;
        },
      },
    };

    // Khi có authContext chứa userId
    const authContextWithUserId = { userId: 'usr_abc123' };
    const idWithAuth = getRateLimitIdentifier(authContextWithUserId, mockRequest);
    assert.strictEqual(idWithAuth, 'usr_abc123');

    // Khi authContext rỗng hoặc null -> fallback sang client IP từ request
    const idWithIp = getRateLimitIdentifier(null, mockRequest);
    assert.strictEqual(idWithIp, '203.0.113.195');

    // Khi không có cả authContext và IP -> fallback anonymous
    const idAnonymous = getRateLimitIdentifier(null, { headers: { get: () => null } });
    assert.strictEqual(idAnonymous, 'anonymous');
  });

  // Test 6: Khác tier → quota độc lập (AUTH_LOGIN vs MUTATION)
  it('Test 6: Khác tier → quota độc lập (AUTH_LOGIN vs MUTATION)', async () => {
    const targetIdentifier = 'user-multitier-test';

    // Tiêu thụ hết hạn ngạch của AUTH_LOGIN (5 requests)
    for (let i = 0; i < 5; i++) {
      const authRes = await checkRateLimit('AUTH_LOGIN', targetIdentifier);
      assert.strictEqual(authRes.success, true);
    }

    // Lần thứ 6 của AUTH_LOGIN bị chặn
    const blockedAuth = await checkRateLimit('AUTH_LOGIN', targetIdentifier);
    assert.strictEqual(blockedAuth.success, false);

    // Nhưng MUTATION của cùng identifier vẫn được phép và có quota đầy đủ (60)
    const mutationRes = await checkRateLimit('MUTATION', targetIdentifier);
    assert.strictEqual(mutationRes.success, true);
    assert.strictEqual(mutationRes.remaining, 59);
  });

  // Test 7: Redis mode (nếu test env có Redis) — optional, có thể skip với { skip: !process.env.REDIS_URL }
  it(
    'Test 7: Redis sliding window mode hoạt động chính xác khi có REDIS_URL',
    { skip: !process.env.REDIS_URL },
    async () => {
      const res = await checkRateLimit('MUTATION', 'redis-test-user');
      assert.strictEqual(res.success, true);
      assert.ok(res.resetAt instanceof Date);
    }
  );
});
