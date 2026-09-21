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
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import {
  verifySessionTokenAsync,
  signSessionToken,
  getJwtSecret,
  SESSION_COOKIE_NAME,
} from '@/lib/jwt-session';
import { resolveCurrentSession } from '@/server/auth/current-session';
import { AuthenticationError } from '@/server/api/errors';
import { clearRevocationStoreForTesting } from '@/server/auth/session-policy';

/**
 * BLOCKER 2 (Issue #27 corrective review): parity between the two public
 * session entry points. Both delegate to the ONE canonical token resolver
 * (`resolveCanonicalTokenSession`), so the same token must produce the same
 * decision: success payloads agree on identity, failures fail closed on
 * both paths (`verifySessionTokenAsync` -> null, `resolveCurrentSession` ->
 * `AuthenticationError` with the same code).
 */
describe('Canonical session resolver parity (middleware <-> request handlers)', () => {
  const runId = `parity-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

  let activeUser: any;
  let disabledUser: any;

  let validOpaque: string;
  let expiredOpaque: string;
  let revokedOpaque: string;
  let disabledOpaque: string;
  let validJwt: string;
  let expiredJwt: string;
  let ghostJwt: string;
  let disabledJwt: string;

  const toRequest = (token: string) =>
    new NextRequest('http://localhost/api/tasks', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });

  async function expectParity(
    token: string,
    expected: { ok: true } | { ok: false; code: 'SESSION_INVALID' | 'ACCOUNT_DISABLED' }
  ) {
    const payload = await verifySessionTokenAsync(token);
    if (expected.ok) {
      assert.ok(payload, 'verifySessionTokenAsync must resolve a payload');
      const session = await resolveCurrentSession(toRequest(token));
      assert.equal(session.userId, payload!.id);
      assert.equal(session.user.email, payload!.email);
      assert.equal((session as any).role, undefined, 'handler session stays identity-only');
      return { payload, session };
    }
    assert.equal(payload, null, 'verifySessionTokenAsync must fail closed with null');
    await assert.rejects(async () => resolveCurrentSession(toRequest(token)), (err: unknown) => {
      assert.ok(err instanceof AuthenticationError);
      assert.equal((err as AuthenticationError).code, expected.code);
      return true;
    });
    return null;
  }

  before(async () => {
    clearRevocationStoreForTesting();

    activeUser = await prisma.user.create({
      data: {
        email: `parity-active-${runId}@cdktcnqn.edu.vn`,
        name: `Parity Active ${runId}`,
        role: UserRole.CHUYEN_VIEN,
        isActive: true,
      },
    });
    disabledUser = await prisma.user.create({
      data: {
        email: `parity-disabled-${runId}@cdktcnqn.edu.vn`,
        name: `Parity Disabled ${runId}`,
        role: UserRole.CHUYEN_VIEN,
        isActive: false,
      },
    });

    const mkSession = (sessionToken: string, userId: string, expires: Date, revokedAt?: Date) =>
      prisma.session.create({ data: { sessionToken, userId, expires, ...(revokedAt ? { revokedAt } : {}) } });

    validOpaque = `parity-valid-${runId}`;
    expiredOpaque = `parity-expired-${runId}`;
    revokedOpaque = `parity-revoked-${runId}`;
    disabledOpaque = `parity-disabled-${runId}`;
    await mkSession(validOpaque, activeUser.id, new Date(Date.now() + 3600000));
    await mkSession(expiredOpaque, activeUser.id, new Date(Date.now() - 60000));
    await mkSession(revokedOpaque, activeUser.id, new Date(Date.now() + 3600000), new Date());
    await mkSession(disabledOpaque, disabledUser.id, new Date(Date.now() + 3600000));

    validJwt = signSessionToken({ id: activeUser.id, email: activeUser.email, name: activeUser.name, role: activeUser.role });
    disabledJwt = signSessionToken({ id: disabledUser.id, email: disabledUser.email, name: disabledUser.name, role: disabledUser.role });
    ghostJwt = signSessionToken({ id: `ghost-${runId}`, email: `ghost-${runId}@cdktcnqn.edu.vn`, name: 'Ghost', role: 'CHUYEN_VIEN' });
    expiredJwt = jwt.sign(
      { id: activeUser.id, email: activeUser.email, name: activeUser.name, role: activeUser.role },
      getJwtSecret(),
      { expiresIn: '-1h' }
    );
  });

  after(async () => {
    clearRevocationStoreForTesting();
    const ids = [activeUser?.id, disabledUser?.id].filter(Boolean);
    if (ids.length > 0) {
      await prisma.session.deleteMany({ where: { userId: { in: ids } } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
    }
  });

  test('valid opaque database session: same identity on both paths', async () => {
    await expectParity(validOpaque, { ok: true });
  });

  test('expired opaque database session fails closed on both paths', async () => {
    await expectParity(expiredOpaque, { ok: false, code: 'SESSION_INVALID' });
  });

  test('revoked opaque database session fails closed on both paths', async () => {
    await expectParity(revokedOpaque, { ok: false, code: 'SESSION_INVALID' });
  });

  test('unknown opaque token fails closed on both paths', async () => {
    await expectParity(`parity-unknown-${runId}`, { ok: false, code: 'SESSION_INVALID' });
  });

  test('valid JWT for a real user: same identity on both paths', async () => {
    await expectParity(validJwt, { ok: true });
  });

  test('expired JWT fails closed on both paths', async () => {
    await expectParity(expiredJwt, { ok: false, code: 'SESSION_INVALID' });
  });

  test('JWT for unknown user fails closed on both paths', async () => {
    await expectParity(ghostJwt, { ok: false, code: 'SESSION_INVALID' });
  });

  test('disabled account: null on middleware path, ACCOUNT_DISABLED on handler path', async () => {
    await expectParity(disabledOpaque, { ok: false, code: 'ACCOUNT_DISABLED' });
    await expectParity(disabledJwt, { ok: false, code: 'ACCOUNT_DISABLED' });
  });

  test('tampered token fails closed on both paths', async () => {
    await expectParity('tampered.payload.signature', { ok: false, code: 'SESSION_INVALID' });
  });
});
