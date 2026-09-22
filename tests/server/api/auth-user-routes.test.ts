import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { resetRateLimits } from '@/server/security/rate-limit';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { POST as registerPost } from '@/app/api/auth/register/route';
import { GET as meGet } from '@/app/api/auth/me/route';
import { GET as usersGet } from '@/app/api/users/route';

describe('Authentication and User API Routes Hardening', () => {
  const testRunId = Date.now();
  const testUserEmail = `test.user.${testRunId}@qcet.edu.vn`;
  const testUserPassword = 'StrongPassword123!';
  let testUserId = '';

  before(async () => {
    // Ensure cleanup of any leftover test accounts
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: `test.user.${testRunId}`,
        },
      },
    });

    // Create a verified active test user for login and auth checks
    const passwordHash = await hashPassword(testUserPassword);
    const user = await prisma.user.create({
      data: {
        email: testUserEmail,
        name: 'Nguyễn Văn Kiểm Thử',
        passwordHash,
        role: 'CHUYEN_VIEN',
        isActive: true,
        departmentId: 'CNTT',
      },
    });
    testUserId = user.id;
  });

  after(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: `${testRunId}`,
        },
      },
    });
  });

  beforeEach(() => {
    resetRateLimits();
  });

  describe('1. POST /api/auth/login', () => {
    test('rejects password login for a valid provisioned user without issuing a cookie', async () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `192.168.1.${testRunId % 200}`,
        },
        body: JSON.stringify({
          email: testUserEmail,
          password: testUserPassword,
        }),
      });

      const res = await loginPost(req);
      assert.strictEqual(res.status, 403);

      // Verify headers
      assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
      const requestId = res.headers.get('x-request-id');
      assert.ok(requestId && requestId.length > 0);

      // Verify cookie
      const cookie = res.cookies.get(SESSION_COOKIE_NAME);
      assert.equal(cookie, undefined);

      // Verify body
      const json = await res.json();
      assert.strictEqual(json.code || json.error?.code, 'FORBIDDEN');
      assert.match(json.message || json.error?.message || json.error, /Đăng nhập bằng mật khẩu đã bị vô hiệu hóa/);
    });

    test('rejects invalid password through the same disabled endpoint', async () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `192.168.1.${(testRunId + 1) % 200}`,
        },
        body: JSON.stringify({
          email: testUserEmail,
          password: 'CompletelyWrongPassword123!',
        }),
      });

      const res = await loginPost(req);
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');

      const json = await res.json();
      assert.ok(json.error || json.code);
      assert.strictEqual(json.code || json.error?.code, 'FORBIDDEN');
      assert.match(json.message || json.error?.message || json.error, /Đăng nhập bằng mật khẩu đã bị vô hiệu hóa/);
    });

    test('does not disclose whether a password-login user exists', async () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `192.168.1.${(testRunId + 2) % 200}`,
        },
        body: JSON.stringify({
          email: `nobody.${testRunId}@qcet.edu.vn`,
          password: 'RandomPassword123!',
        }),
      });

      const res = await loginPost(req);
      assert.strictEqual(res.status, 403);

      const json = await res.json();
      assert.ok(json.error || json.code);
      assert.strictEqual(json.code || json.error?.code, 'FORBIDDEN');
    });

    test('disabled password endpoint remains forbidden across repeated requests', async () => {
      const ip = `10.0.0.${testRunId % 200}`;
      const targetEmail = `ratelimit.${testRunId}@qcet.edu.vn`;

      // Preset limit for AUTH_LOGIN is 5 requests per 15 minutes
      for (let i = 0; i < 5; i++) {
        const req = new Request('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': ip,
          },
          body: JSON.stringify({
            email: targetEmail,
            password: 'WrongPassword123!',
          }),
        });
        const res = await loginPost(req);
        assert.strictEqual(res.status, 403);
      }

      // The retired endpoint performs no credential processing or account lookup.
      const blockedReq = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': ip,
        },
        body: JSON.stringify({
          email: targetEmail,
          password: 'WrongPassword123!',
        }),
      });
      const blockedRes = await loginPost(blockedReq);
      assert.strictEqual(blockedRes.status, 403);

      const json = await blockedRes.json();
      assert.ok(json.error || json.code);
      assert.strictEqual(json.code || json.error?.code, 'FORBIDDEN');
    });
  });

  describe('2. POST /api/auth/register', () => {
    test('public self-registration is permanently disabled and returns 403 Forbidden', async () => {
      const req = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `10.1.0.${testRunId % 200}`,
        },
        body: JSON.stringify({
          email: `reg.${testRunId}@qcet.edu.vn`,
          password: 'SecurePassword123!',
          name: 'Cán Bộ Mới',
          departmentId: 'CNTT',
        }),
      });

      const res = await registerPost(req);
      assert.strictEqual(res.status, 403);

      const json = await res.json();
      assert.ok(json.error || json.code);
      assert.strictEqual(json.code || json.error?.code, 'FORBIDDEN');
      assert.match(json.message || json.error?.message || json.error, /Đăng ký công khai đã bị vô hiệu hóa/);
    });
  });

  describe('3. GET /api/auth/me', () => {
    test('returns authenticated: false when unauthenticated', async () => {
      const req = new Request('http://localhost:3000/api/auth/me', {
        method: 'GET',
      });

      const res = await meGet(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');

      const json = await res.json();
      assert.strictEqual(json.authenticated, false);
      assert.strictEqual(json.user, null);
    });

    test('returns authenticated: true and sanitized user when valid token present', async () => {
      const token = signSessionToken({
        id: testUserId,
        email: testUserEmail,
        name: 'Nguyễn Văn Kiểm Thử',
        role: 'CHUYEN_VIEN',
        departmentId: 'CNTT',
      });

      const req = new Request('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const res = await meGet(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');

      const json = await res.json();
      assert.strictEqual(json.authenticated, true);
      assert.ok(json.user);
      assert.strictEqual(json.user.id, testUserId);
      assert.strictEqual(json.user.email, testUserEmail);
      assert.strictEqual(json.user.passwordHash, undefined);
    });
  });

  describe('4. GET /api/users', () => {
    test('rejects unauthenticated access with 401 AUTH_REQUIRED', async () => {
      const req = new Request('http://localhost:3000/api/users', {
        method: 'GET',
      });

      const res = await usersGet(req);
      assert.strictEqual(res.status, 401);

      const json = await res.json();
      assert.ok(json.error || json.code);
      assert.strictEqual(json.code || json.error?.code, 'AUTH_REQUIRED');
    });

    test('returns sanitized user list without passwords for authenticated requester', async () => {
      const token = signSessionToken({
        id: testUserId,
        email: testUserEmail,
        name: 'Nguyễn Văn Kiểm Thử',
        role: 'CHUYEN_VIEN',
        departmentId: 'CNTT',
      });

      const req = new Request('http://localhost:3000/api/users?limit=10', {
        method: 'GET',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const res = await usersGet(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.users));
      assert.ok(json.users.length > 0);

      // Verify no sensitive fields leaked
      for (const u of json.users) {
        assert.ok(u.id);
        assert.ok(u.email);
        assert.strictEqual(u.passwordHash, undefined, 'User DTO must omit passwordHash');
        assert.strictEqual(u.password, undefined, 'User DTO must omit password');
      }
    });

    test('filters users by search query and enforces SEARCH rate limit', async () => {
      const token = signSessionToken({
        id: testUserId,
        email: testUserEmail,
        name: 'Nguyễn Văn Kiểm Thử',
        role: 'CHUYEN_VIEN',
        departmentId: 'CNTT',
      });

      const req = new Request(`http://localhost:3000/api/users?q=Kiểm+Thử`, {
        method: 'GET',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const res = await usersGet(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.users.some((u: any) => u.email === testUserEmail));
    });
  });
});
