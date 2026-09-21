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
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { revokeSession, clearRevocationStoreForTesting } from '@/server/auth/session-policy';

import { middleware } from '../src/middleware';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';

/**
 * Issue #27 acceptance: opaque Auth.js/PrismaAdapter database sessions must
 * pass the centralized API middleware when valid, and fail closed (401) when
 * missing / invalid / expired / revoked. These tests use REAL opaque
 * `sessionToken` rows in the Prisma `sessions` table — never `signSessionToken()`.
 */
describe('Issue #27: middleware opaque database-session compatibility', () => {
  const runId = `dbsess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let dbUser: any;
  let adminUser: any;
  let jwtToken: string;

  let validOpaque: string;
  let expiredOpaque: string;
  let revokedAtOpaque: string;
  let revokedStoreOpaque: string;

  const createApiRequest = (url: string, token?: string) => {
    const headers: Record<string, string> = {};
    if (token) {
      headers['cookie'] = `${SESSION_COOKIE_NAME}=${token}`;
    }
    return new NextRequest(new URL(url, 'https://eoffice.qcet.edu.vn'), { headers });
  };

  before(async () => {
    clearRevocationStoreForTesting();

    dbUser = await prisma.user.create({
      data: {
        email: `dbsess-user-${runId}@cdktcnqn.edu.vn`,
        name: 'DB Session User',
        role: UserRole.CHUYEN_VIEN,
        isActive: true,
      },
    });

    adminUser = await prisma.user.create({
      data: {
        email: `dbsess-admin-${runId}@cdktcnqn.edu.vn`,
        name: 'DB Session Admin',
        role: UserRole.ADMIN,
        isActive: true,
      },
    });

    jwtToken = signSessionToken({
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
    });

    validOpaque = `opaque-valid-${runId}-${crypto.randomBytes(8).toString('hex')}`;
    await prisma.session.create({
      data: {
        sessionToken: validOpaque,
        userId: dbUser.id,
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    expiredOpaque = `opaque-expired-${runId}-${crypto.randomBytes(8).toString('hex')}`;
    await prisma.session.create({
      data: {
        sessionToken: expiredOpaque,
        userId: dbUser.id,
        expires: new Date(Date.now() - 60 * 1000),
      },
    });

    revokedAtOpaque = `opaque-revokedat-${runId}-${crypto.randomBytes(8).toString('hex')}`;
    await prisma.session.create({
      data: {
        sessionToken: revokedAtOpaque,
        userId: dbUser.id,
        expires: new Date(Date.now() + 60 * 60 * 1000),
        revokedAt: new Date(),
      },
    });

    revokedStoreOpaque = `opaque-revstore-${runId}-${crypto.randomBytes(8).toString('hex')}`;
    await prisma.session.create({
      data: {
        sessionToken: revokedStoreOpaque,
        userId: dbUser.id,
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await revokeSession(revokedStoreOpaque);
  });

  after(async () => {
    clearRevocationStoreForTesting();
    const ids = [dbUser?.id, adminUser?.id].filter(Boolean);
    if (ids.length > 0) {
      await prisma.session.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
  });

  test('valid opaque database session passes protected API middleware', async () => {
    const res = await middleware(createApiRequest('https://eoffice.qcet.edu.vn/api/tasks', validOpaque));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-middleware-next'), '1');
  });

  test('valid opaque database session passes via Bearer header', async () => {
    const req = new NextRequest(new URL('https://eoffice.qcet.edu.vn/api/tasks'), {
      headers: { authorization: `Bearer ${validOpaque}` },
    });
    const res = await middleware(req);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-middleware-next'), '1');
  });

  test('supported JWT flow for a real user still passes', async () => {
    const res = await middleware(createApiRequest('https://eoffice.qcet.edu.vn/api/tasks', jwtToken));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-middleware-next'), '1');
  });

  test('expired database session fails closed with 401', async () => {
    const res = await middleware(createApiRequest('https://eoffice.qcet.edu.vn/api/tasks', expiredOpaque));
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, 'Unauthorized');
    assert.ok(!JSON.stringify(body).includes(expiredOpaque));
  });

  test('database session with revokedAt fails closed with 401', async () => {
    const res = await middleware(createApiRequest('https://eoffice.qcet.edu.vn/api/tasks', revokedAtOpaque));
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, 'Unauthorized');
  });

  test('revoked database session (revocation store) fails closed with 401', async () => {
    const res = await middleware(createApiRequest('https://eoffice.qcet.edu.vn/api/tasks', revokedStoreOpaque));
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, 'Unauthorized');
  });

  test('unknown opaque session token fails closed with 401', async () => {
    const unknown = `opaque-unknown-${runId}-${crypto.randomBytes(12).toString('hex')}`;
    const res = await middleware(createApiRequest('https://eoffice.qcet.edu.vn/api/tasks', unknown));
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, 'Unauthorized');
  });

  test('non-admin opaque session is blocked from technical admin namespace', async () => {
    const res = await middleware(createApiRequest('https://eoffice.qcet.edu.vn/api/admin/users', validOpaque));
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, 'Forbidden');
  });

  test('opaque session passes executive path; business authority stays with route handler', async () => {
    const res = await middleware(
      createApiRequest('https://eoffice.qcet.edu.vn/api/executive/resolutions', validOpaque)
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-middleware-next'), '1');
  });

  test('public allowlist still works without any session', async () => {
    for (const path of ['/api/health', '/api/health/ready', '/api/auth/me', '/api/csp-report', '/api/runtime-config']) {
      const res = await middleware(createApiRequest(`https://eoffice.qcet.edu.vn${path}`));
      assert.equal(res.status, 200, `public path ${path} must pass`);
    }
  });
});
