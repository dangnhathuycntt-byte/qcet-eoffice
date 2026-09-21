import nextEnvPkg from '@next/env';
const loadEnvConfig = (nextEnvPkg as any)?.loadEnvConfig || (nextEnvPkg as any)?.default?.loadEnvConfig || (nextEnvPkg as any);
if (typeof loadEnvConfig === 'function') {
  loadEnvConfig(process.cwd());
}

if (!process.env.QCET_ALLOW_DB_TESTS) {
  process.env.QCET_ALLOW_DB_TESTS = '1';
}
if (!process.env.NODE_ENV) {
  (process.env as any).NODE_ENV = 'test';
}
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('/qcet_eoffice')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\/qcet_eoffice(\?.*)?$/, '/qcet_test$1');
}

const TEST_SECRET = 'test-secret-key-for-authjs-v5-validation-32chars';
process.env.AUTH_SECRET = TEST_SECRET;
process.env.JWT_SECRET = TEST_SECRET;

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

import { middleware } from '../src/middleware';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';

describe('QCET Centralized API Middleware Protection (Issue #27)', () => {
  const runId = `mw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let staffUser: any;
  let adminUser: any;
  let bghUser: any;

  let staffToken: string;
  let adminToken: string;
  let bghToken: string;
  let banGiamHieuToken: string;

  before(async () => {
    staffUser = await prisma.user.create({
      data: {
        email: `mw-staff-${runId}@cdktcnqn.edu.vn`,
        name: 'Nguyen Van Chuyen Vien',
        role: UserRole.CHUYEN_VIEN,
        isActive: true,
      },
    });

    adminUser = await prisma.user.create({
      data: {
        email: `mw-admin-${runId}@cdktcnqn.edu.vn`,
        name: 'Quan tri vien He thong',
        role: UserRole.ADMIN,
        isActive: true,
      },
    });

    bghUser = await prisma.user.create({
      data: {
        email: `mw-bgh-${runId}@cdktcnqn.edu.vn`,
        name: 'Hieu truong',
        role: UserRole.BAN_GIAM_HIEU,
        isActive: true,
      },
    });

    staffToken = signSessionToken({
      id: staffUser.id,
      email: staffUser.email,
      name: staffUser.name,
      role: staffUser.role,
    });

    adminToken = signSessionToken({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
    });

    bghToken = signSessionToken({
      id: bghUser.id,
      email: bghUser.email,
      name: bghUser.name,
      role: 'BGH',
    });

    banGiamHieuToken = signSessionToken({
      id: bghUser.id,
      email: bghUser.email,
      name: bghUser.name,
      role: bghUser.role,
    });
  });

  after(async () => {
    const ids = [staffUser?.id, adminUser?.id, bghUser?.id].filter(Boolean);
    if (ids.length > 0) {
      await prisma.session.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
  });

  const createApiRequest = (
    url: string,
    options?: {
      cookieToken?: string;
      bearerToken?: string;
      headers?: Record<string, string>;
    }
  ) => {
    const headers: Record<string, string> = { ...(options?.headers || {}) };
    if (options?.cookieToken) {
      headers['cookie'] = `${SESSION_COOKIE_NAME}=${options.cookieToken}`;
    }
    if (options?.bearerToken) {
      headers['authorization'] = `Bearer ${options.bearerToken}`;
    }
    return new NextRequest(new URL(url, 'https://eoffice.qcet.edu.vn'), {
      headers,
    });
  };

  describe('1. Unauthenticated requests to protected API routes', () => {
    test('request without session to /api/tasks returns 401 JSON', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/tasks');
      const res = await middleware(req);

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, 'Unauthorized');
    });

    test('request without session to /api/documents returns 401 JSON', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/documents');
      const res = await middleware(req);

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, 'Unauthorized');
    });

    test('request without session to /api/admin/users returns 401 JSON', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/admin/users');
      const res = await middleware(req);

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, 'Unauthorized');
    });

    test('request with invalid/tampered token returns 401 JSON', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/tasks', {
        bearerToken: 'invalid.tampered.token',
      });
      const res = await middleware(req);

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, 'Unauthorized');
    });

    test('JWT for unknown user fails closed with 401', async () => {
      const ghostToken = signSessionToken({
        id: `ghost-${runId}`,
        email: `ghost-${runId}@cdktcnqn.edu.vn`,
        name: 'Ghost',
        role: 'CHUYEN_VIEN',
      });
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/tasks', {
        bearerToken: ghostToken,
      });
      const res = await middleware(req);

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, 'Unauthorized');
    });
  });

  describe('2. Role-based access control for /api/admin/*', () => {
    test('CHUYEN_VIEN accessing /api/admin/* returns 403 JSON', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/admin/users', {
        bearerToken: staffToken,
      });
      const res = await middleware(req);

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error, 'Forbidden');
    });

    test('CHUYEN_VIEN accessing /api/admin (root admin) returns 403 JSON', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/admin', {
        cookieToken: staffToken,
      });
      const res = await middleware(req);

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error, 'Forbidden');
    });

    test('ADMIN accessing /api/admin/* passes through', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/admin/users', {
        bearerToken: adminToken,
      });
      const res = await middleware(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-middleware-next'), '1');
    });
  });

  describe('3. /api/executive/* defers business authority to canonical layer (Issue #27 §4)', () => {
    test('request without session to /api/executive/* returns 401 JSON', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/executive/resolutions');
      const res = await middleware(req);

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, 'Unauthorized');
    });

    test('authenticated CHUYEN_VIEN passes middleware; business denial is enforced by route handler', async () => {
      const req = createApiRequest(
        'https://eoffice.qcet.edu.vn/api/executive/resolutions',
        {
          bearerToken: staffToken,
        }
      );
      const res = await middleware(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-middleware-next'), '1');
    });

    test('authenticated ADMIN passes middleware without being granted statutory authority here', async () => {
      const req = createApiRequest(
        'https://eoffice.qcet.edu.vn/api/executive/resolutions',
        {
          bearerToken: adminToken,
        }
      );
      const res = await middleware(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-middleware-next'), '1');
    });

    test('BAN_GIAM_HIEU role accessing /api/executive/* passes through', async () => {
      const req = createApiRequest(
        'https://eoffice.qcet.edu.vn/api/executive/resolutions',
        {
          bearerToken: bghToken,
        }
      );
      const res = await middleware(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-middleware-next'), '1');
    });

    test('BAN_GIAM_HIEU via cookie passes through', async () => {
      const req = createApiRequest(
        'https://eoffice.qcet.edu.vn/api/executive/resolutions',
        {
          cookieToken: banGiamHieuToken,
        }
      );
      const res = await middleware(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-middleware-next'), '1');
    });
  });

  describe('4. Standard protected API routes with valid session', () => {
    test('CHUYEN_VIEN accessing /api/tasks passes through via Bearer token', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/tasks', {
        bearerToken: staffToken,
      });
      const res = await middleware(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-middleware-next'), '1');
    });

    test('CHUYEN_VIEN accessing /api/tasks passes through via Cookie', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/tasks', {
        cookieToken: staffToken,
      });
      const res = await middleware(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-middleware-next'), '1');
    });
  });

  describe('5. Whitelisted public API routes (no session required)', () => {
    test('/api/health without session passes through', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/health');
      const res = await middleware(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-middleware-next'), '1');
    });

    test('/api/health/ready without session passes through', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/health/ready');
      const res = await middleware(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-middleware-next'), '1');
    });

    test('/api/health/live without session passes through', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/health/live');
      const res = await middleware(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-middleware-next'), '1');
    });

    test('/api/auth/login without session passes through', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/auth/login');
      const res = await middleware(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-middleware-next'), '1');
    });

    test('/api/auth/google without session passes through', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/auth/google');
      const res = await middleware(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-middleware-next'), '1');
    });

    test('/api/auth/me without session passes through to route handler', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/auth/me');
      const res = await middleware(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-middleware-next'), '1');
    });

    test('/api/csp-report without session passes through', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/csp-report');
      const res = await middleware(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-middleware-next'), '1');
    });

    test('/api/runtime-config without session passes through', async () => {
      const req = createApiRequest('https://eoffice.qcet.edu.vn/api/runtime-config');
      const res = await middleware(req);

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-middleware-next'), '1');
    });
  });
});
