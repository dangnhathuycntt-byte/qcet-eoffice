import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

const TEST_SECRET = 'test-secret-key-for-authjs-v5-validation-32chars';
process.env.AUTH_SECRET = TEST_SECRET;
process.env.JWT_SECRET = TEST_SECRET;

import { middleware } from '../src/middleware';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';

describe('QCET Centralized API Middleware Protection (Issue #27)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AUTH_SECRET = TEST_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const staffToken = signSessionToken({
    id: 'user-chuyen-vien-1',
    email: 'chuyenvien@cdktcnqn.edu.vn',
    name: 'Nguyễn Văn Chuyên Viên',
    role: 'CHUYEN_VIEN',
    departmentId: 'PHONG_DAO_TAO',
  });

  const adminToken = signSessionToken({
    id: 'user-admin-1',
    email: 'admin@cdktcnqn.edu.vn',
    name: 'Quản trị viên Hệ thống',
    role: 'ADMIN',
    departmentId: 'BGH',
  });

  const bghToken = signSessionToken({
    id: 'user-bgh-1',
    email: 'hieutruong@cdktcnqn.edu.vn',
    name: 'Hiệu trưởng',
    role: 'BGH',
    departmentId: 'BGH',
  });

  const banGiamHieuToken = signSessionToken({
    id: 'user-bgh-2',
    email: 'phohieutruong@cdktcnqn.edu.vn',
    name: 'Phó Hiệu trưởng',
    role: 'BAN_GIAM_HIEU',
    departmentId: 'BGH',
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

  describe('3. Role-based access control for /api/executive/*', () => {
    test('CHUYEN_VIEN accessing /api/executive/* returns 403 JSON', async () => {
      const req = createApiRequest(
        'https://eoffice.qcet.edu.vn/api/executive/resolutions',
        {
          bearerToken: staffToken,
        }
      );
      const res = await middleware(req);

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error, 'Forbidden');
    });

    test('BGH role accessing /api/executive/* passes through', async () => {
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

    test('BAN_GIAM_HIEU role accessing /api/executive/* passes through', async () => {
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
