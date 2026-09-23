import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getApiContext,
  requireAuthenticated,
  requireRole,
  normalizeRole,
  type AuthenticatedUser,
  type ApiRequestContext,
} from '@/server/api/request-context';
import { AuthenticationError, AuthorizationError } from '@/server/api/errors';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';

describe('Central API Request Context & Auth Extraction', () => {
  describe('normalizeRole', () => {
    it('normalizes executive and admin Vietnamese aliases to ADMIN', () => {
      assert.strictEqual(normalizeRole('ADMIN'), 'ADMIN');
      assert.strictEqual(normalizeRole('BAN_GIAM_HIEU'), 'ADMIN');
      assert.strictEqual(normalizeRole('BGH'), 'ADMIN');
      assert.strictEqual(normalizeRole('HIEU_TRUONG'), 'ADMIN');
      assert.strictEqual(normalizeRole('PHO_HIEU_TRUONG'), 'ADMIN');
      assert.strictEqual(normalizeRole('ban_giam_hieu'), 'ADMIN');
    });

    it('normalizes department manager Vietnamese aliases to MANAGER', () => {
      assert.strictEqual(normalizeRole('MANAGER'), 'MANAGER');
      assert.strictEqual(normalizeRole('TRUONG_PHONG'), 'MANAGER');
      assert.strictEqual(normalizeRole('TRUONG_DON_VI'), 'MANAGER');
      assert.strictEqual(normalizeRole('PHO_TRUONG_PHONG'), 'MANAGER');
      assert.strictEqual(normalizeRole('truong_phong'), 'MANAGER');
    });

    it('normalizes staff and specialist Vietnamese aliases to STAFF', () => {
      assert.strictEqual(normalizeRole('STAFF'), 'STAFF');
      assert.strictEqual(normalizeRole('CHUYEN_VIEN'), 'STAFF');
      assert.strictEqual(normalizeRole('GIANG_VIEN'), 'STAFF');
      assert.strictEqual(normalizeRole('chuyen_vien'), 'STAFF');
    });

    it('normalizes clerical aliases to VAN_THU', () => {
      assert.strictEqual(normalizeRole('VAN_THU'), 'VAN_THU');
      assert.strictEqual(normalizeRole('CLERK'), 'VAN_THU');
    });

    it('returns uppercase trimmed role for unmapped or custom roles', () => {
      assert.strictEqual(normalizeRole('AUDITOR'), 'AUDITOR');
      assert.strictEqual(normalizeRole(' guest '), 'GUEST');
    });
  });

  describe('getApiContext', () => {
    it('propagates existing x-request-id header', async () => {
      const customId = 'req-qcet-unique-1234';
      const req = new Request('http://localhost:3000/api/tasks', {
        headers: { 'x-request-id': customId },
      });

      const ctx = await getApiContext(req);
      assert.strictEqual(ctx.requestId, customId);
    });

    it('generates a valid UUID v4 when x-request-id is missing or empty', async () => {
      const req1 = new Request('http://localhost:3000/api/tasks');
      const ctx1 = await getApiContext(req1);
      assert.ok(ctx1.requestId);
      assert.match(
        ctx1.requestId,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );

      const req2 = new Request('http://localhost:3000/api/tasks', {
        headers: { 'x-request-id': '   ' },
      });
      const ctx2 = await getApiContext(req2);
      assert.notStrictEqual(ctx2.requestId.trim(), '');
      assert.match(
        ctx2.requestId,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('extracts client IP from x-forwarded-for header (first hop)', async () => {
      const req = new Request('http://localhost:3000/api/tasks', {
        headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' },
      });

      const ctx = await getApiContext(req);
      assert.strictEqual(ctx.ip, '203.0.113.195');
    });

    it('falls back to x-real-ip when x-forwarded-for is missing', async () => {
      const req = new Request('http://localhost:3000/api/tasks', {
        headers: { 'x-real-ip': '198.51.100.42' },
      });

      const ctx = await getApiContext(req);
      assert.strictEqual(ctx.ip, '198.51.100.42');
    });

    it('extracts user-agent header', async () => {
      const agent = 'QCET-Mobile/1.0 (iOS 17.5)';
      const req = new Request('http://localhost:3000/api/tasks', {
        headers: { 'user-agent': agent },
      });

      const ctx = await getApiContext(req);
      assert.strictEqual(ctx.userAgent, agent);
    });

    it('extracts scope from URL query params', async () => {
      const req = new Request('http://localhost:3000/api/tasks?scope=school&status=ACTIVE');

      const ctx = await getApiContext(req);
      assert.strictEqual(ctx.scope, 'school');
    });

    it('handles relative URL strings with scope parameter', async () => {
      const req = {
        url: '/api/tasks?scope=unit',
        headers: new Headers(),
      };

      const ctx = await getApiContext(req as any);
      assert.strictEqual(ctx.scope, 'unit');
    });

    it('falls back to x-scope header when scope query parameter is absent', async () => {
      const req = new Request('http://localhost:3000/api/tasks', {
        headers: { 'x-scope': 'personal' },
      });

      const ctx = await getApiContext(req);
      assert.strictEqual(ctx.scope, 'personal');
    });

    it('prioritizes URL scope parameter over x-scope header', async () => {
      const req = new Request('http://localhost:3000/api/tasks?scope=unit', {
        headers: { 'x-scope': 'school' },
      });

      const ctx = await getApiContext(req);
      assert.strictEqual(ctx.scope, 'unit');
    });

    it('returns user: null when request is unauthenticated', async () => {
      const req = new Request('http://localhost:3000/api/tasks');

      const ctx = await getApiContext(req);
      assert.strictEqual(ctx.user, null);
    });

    it('extracts AuthenticatedUser from valid session cookie', async () => {
      const token = signSessionToken({
        id: 'user-gv-01',
        email: 'gv01@qncet.edu.vn',
        name: 'Nguyen Van A',
        role: 'CHUYEN_VIEN',

        title: 'Giang vien CNTT',
      });

      const req = new Request('http://localhost:3000/api/tasks', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const ctx = await getApiContext(req);
      assert.ok(ctx.user);
      assert.strictEqual(ctx.user.id, 'user-gv-01');
      assert.strictEqual(ctx.user.email, 'gv01@qncet.edu.vn');
      assert.strictEqual(ctx.user.name, 'Nguyen Van A');
      assert.strictEqual(ctx.user.role, 'CHUYEN_VIEN');
      assert.strictEqual(ctx.user.departmentId, 'CNTT');
      assert.strictEqual(ctx.user.title, 'Giang vien CNTT');
    });

    it('extracts AuthenticatedUser from Authorization Bearer token', async () => {
      const token = signSessionToken({
        id: 'user-bgh-01',
        email: 'hieutruong@qncet.edu.vn',
        name: 'Tran Thi B',
        role: 'BAN_GIAM_HIEU',

      });

      const req = new Request('http://localhost:3000/api/tasks', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const ctx = await getApiContext(req);
      assert.ok(ctx.user);
      assert.strictEqual(ctx.user.id, 'user-bgh-01');
      assert.strictEqual(ctx.user.role, 'BAN_GIAM_HIEU');
      assert.strictEqual(ctx.user.title, null);
    });

    it('returns user: null when session token is invalid or tampered with', async () => {
      const req = new Request('http://localhost:3000/api/tasks', {
        headers: {
          authorization: 'Bearer invalid-garbage-token-12345',
        },
      });

      const ctx = await getApiContext(req);
      assert.strictEqual(ctx.user, null);
    });

    it('enforces backend-security: ignores spoofed client user headers', async () => {
      // Attacker tries to send identity headers without a valid cryptographically signed session
      const req = new Request('http://localhost:3000/api/tasks', {
        headers: {
          'x-user-id': 'attacker-spoofed-admin',
          'x-user-role': 'ADMIN',
          'x-user-email': 'admin@qncet.edu.vn',
        },
      });

      const ctx = await getApiContext(req);
      assert.strictEqual(ctx.user, null);
    });
  });

  describe('requireAuthenticated', () => {
    it('returns AuthenticatedUser when user is present in context', () => {
      const user: AuthenticatedUser = {
        id: 'usr-1',
        email: 'test@qncet.edu.vn',
        name: 'User 1',
        role: 'STAFF',

      };
      const ctx: ApiRequestContext = {
        requestId: 'req-1',
        user,
      };

      const result = requireAuthenticated(ctx);
      assert.strictEqual(result, user);
      assert.strictEqual(result.id, 'usr-1');
    });

    it('throws AuthenticationError when user is null', () => {
      const ctx: ApiRequestContext = {
        requestId: 'req-2',
        user: null,
      };

      assert.throws(
        () => requireAuthenticated(ctx),
        (err: unknown) => {
          assert.ok(err instanceof AuthenticationError);
          assert.strictEqual(err.statusCode, 401);
          assert.strictEqual(err.code, 'AUTH_REQUIRED');
          assert.strictEqual(err.message, 'Authentication required');
          return true;
        }
      );
    });
  });

  describe('requireRole', () => {
    const adminUser: AuthenticatedUser = {
      id: 'admin-1',
      email: 'admin@qncet.edu.vn',
      name: 'Admin User',
      role: 'ADMIN',

    };

    const bghUser: AuthenticatedUser = {
      id: 'bgh-1',
      email: 'bgh@qncet.edu.vn',
      name: 'BGH User',
      role: 'BAN_GIAM_HIEU',

    };

    const managerUser: AuthenticatedUser = {
      id: 'mgr-1',
      email: 'mgr@qncet.edu.vn',
      name: 'Manager User',
      role: 'TRUONG_PHONG',

    };

    const staffUser: AuthenticatedUser = {
      id: 'staff-1',
      email: 'staff@qncet.edu.vn',
      name: 'Staff User',
      role: 'CHUYEN_VIEN',

    };

    it('throws AuthenticationError when context has no authenticated user', () => {
      const ctx: ApiRequestContext = {
        requestId: 'req-auth-fail',
        user: null,
      };

      assert.throws(
        () => requireRole(ctx, 'ADMIN'),
        (err: unknown) => {
          assert.ok(err instanceof AuthenticationError);
          assert.strictEqual(err.statusCode, 401);
          assert.strictEqual(err.code, 'AUTH_REQUIRED');
          return true;
        }
      );
    });

    it('allows direct exact role match', () => {
      const ctx: ApiRequestContext = { requestId: 'req-1', user: adminUser };
      const res = requireRole(ctx, 'ADMIN');
      assert.strictEqual(res, adminUser);
    });

    it('allows BAN_GIAM_HIEU user when ADMIN role is required', () => {
      const ctx: ApiRequestContext = { requestId: 'req-2', user: bghUser };
      const res = requireRole(ctx, 'ADMIN');
      assert.strictEqual(res, bghUser);
    });

    it('allows ADMIN user when BAN_GIAM_HIEU role is required', () => {
      const ctx: ApiRequestContext = { requestId: 'req-3', user: adminUser };
      const res = requireRole(ctx, 'BAN_GIAM_HIEU');
      assert.strictEqual(res, adminUser);
    });

    it('allows TRUONG_PHONG user when MANAGER role is required', () => {
      const ctx: ApiRequestContext = { requestId: 'req-4', user: managerUser };
      const res = requireRole(ctx, 'MANAGER');
      assert.strictEqual(res, managerUser);
    });

    it('allows CHUYEN_VIEN user when STAFF role is required', () => {
      const ctx: ApiRequestContext = { requestId: 'req-5', user: staffUser };
      const res = requireRole(ctx, 'STAFF');
      assert.strictEqual(res, staffUser);
    });

    it('allows role check matching any role in allowed roles array', () => {
      const ctxManager: ApiRequestContext = { requestId: 'req-6', user: managerUser };
      const res1 = requireRole(ctxManager, ['ADMIN', 'MANAGER']);
      assert.strictEqual(res1, managerUser);

      const ctxBgh: ApiRequestContext = { requestId: 'req-7', user: bghUser };
      const res2 = requireRole(ctxBgh, ['ADMIN', 'MANAGER']);
      assert.strictEqual(res2, bghUser);
    });

    it('case-insensitively matches allowed roles', () => {
      const ctx: ApiRequestContext = { requestId: 'req-8', user: adminUser };
      const res = requireRole(ctx, 'admin');
      assert.strictEqual(res, adminUser);
    });

    it('throws AuthorizationError when user role does not match required role', () => {
      const ctx: ApiRequestContext = { requestId: 'req-9', user: staffUser };

      assert.throws(
        () => requireRole(ctx, 'ADMIN'),
        (err: unknown) => {
          assert.ok(err instanceof AuthorizationError);
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'FORBIDDEN');
          assert.strictEqual(err.message, 'Insufficient role permissions');
          return true;
        }
      );
    });

    it('throws AuthorizationError when user role does not match any allowed roles in array', () => {
      const ctx: ApiRequestContext = { requestId: 'req-10', user: staffUser };

      assert.throws(
        () => requireRole(ctx, ['ADMIN', 'MANAGER']),
        (err: unknown) => {
          assert.ok(err instanceof AuthorizationError);
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'FORBIDDEN');
          return true;
        }
      );
    });

    it('throws AuthorizationError when allowed roles array is empty', () => {
      const ctx: ApiRequestContext = { requestId: 'req-11', user: adminUser };

      assert.throws(
        () => requireRole(ctx, []),
        (err: unknown) => {
          assert.ok(err instanceof AuthorizationError);
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'FORBIDDEN');
          return true;
        }
      );
    });
  });
});
