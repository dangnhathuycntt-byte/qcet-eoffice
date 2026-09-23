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

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserRole, TaskStatus, TaskPriority, TaskScope, TaskActorRole } from '@prisma/client';
import { signSessionToken, getJwtSecret, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import {
  resolveCurrentSession,
  tryResolveCurrentSession,
  CurrentSession,
} from '@/server/auth/current-session';
import { loadCurrentUser } from '@/server/auth/current-user';
import {
  revokeSession,
  revokeAllUserSessions,
  disableUser,
  clearRevocationStoreForTesting,
  isSessionRevoked,
  isSessionExpired,
} from '@/server/auth/session-policy';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { GET as getTaskById } from '@/app/api/tasks/[id]/route';
import { POST as createTask } from '@/app/api/tasks/route';
import { POST as logoutRoute } from '@/app/api/auth/logout/route';
import { AuthenticationError } from '@/server/api/errors';


describe('Sprint 2: Task 1 (F06: Session Revocation & Identity Resolution)', () => {
  const testRunId = String(Date.now());
  const deptId = `DEPT-S2-T1-${testRunId}`;

  let activeUser: any;
  let dynamicUser: any;
  let testTask: any;

  let activeToken: string;
  let dynamicToken: string;

  function createRequest(
    url: string,
    options: {
      method?: string;
      token?: string;
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ) {
    const headers = new Headers(options.headers);
    headers.set('Origin', 'http://localhost:3000');
    headers.set('Referer', 'http://localhost:3000');
    if (options.token) {
      headers.set('Cookie', `${SESSION_COOKIE_NAME}=${options.token}`);
    }
    if (options.body) {
      headers.set('Content-Type', 'application/json');
    }
    return new NextRequest(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  }

  before(async () => {
    // Verify DB isolation
    const dbUrl = process.env.DATABASE_URL || '';
    let dbName = '';
    try {
      dbName = new URL(dbUrl).pathname.replace(/^\//, '');
    } catch {}

    const isExplicitTestOptIn = process.env.QCET_ALLOW_DB_TESTS === '1';
    const isTestEnv = process.env.NODE_ENV === 'test';
    const isLocalHost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
    const isTestDbName = dbName.endsWith('_test') || dbName.endsWith('test');

    if (!isExplicitTestOptIn || !isTestEnv || !isLocalHost || !isTestDbName) {
      throw new Error(
        `SECURITY INVARIANT VIOLATION: Requires test DB ending in '_test'. Current: dbName=${dbName}`
      );
    }

    // 1. Create test department
    await prisma.organizationalUnit.create({
      data: {
        id: deptId,
        name: `Sprint 2 Dept ${testRunId}`,
        shortName: `D-S2-${testRunId.slice(-6)}`,
      },
    });

    // 2. Create test users
    activeUser = await prisma.user.create({
      data: {
        email: `active.${testRunId}@qncet.edu.vn`,
        name: 'Active Staff User',
        role: UserRole.CHUYEN_VIEN,
        departmentId: deptId,
        isActive: true,
      },
    });

    dynamicUser = await prisma.user.create({
      data: {
        email: `dynamic.${testRunId}@qncet.edu.vn`,
        name: 'Dynamic Lifecycle User',
        role: UserRole.CHUYEN_VIEN,
        departmentId: deptId,
        isActive: true,
      },
    });

    // 3. Create test task
    testTask = await prisma.task.create({
      data: {
        code: `TASK-S2-${testRunId.slice(-6)}`,
        title: `Sprint 2 Task ${testRunId}`,
        description: 'Test session authorization on task access',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.NORMAL,
        scope: TaskScope.DEPARTMENT,
        departmentId: deptId,
        createdById: activeUser.id,
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date(Date.now() + 7 * 86400000),
        actors: {
          create: [
            {
              userId: activeUser.id,
              role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date(),
            },
            {
              userId: dynamicUser.id,
              role: TaskActorRole.COLLABORATOR, isPrimaryDRI: false, appointedAt: new Date(),
            },
          ],
        },
      },
    });

    // 4. Issue tokens
    activeToken = signSessionToken({
      id: activeUser.id,
      email: activeUser.email,
      name: activeUser.name,
      role: activeUser.role,
      departmentId: activeUser.departmentId,
    });

    dynamicToken = signSessionToken({
      id: dynamicUser.id,
      email: dynamicUser.email,
      name: dynamicUser.name,
      role: dynamicUser.role,
      departmentId: dynamicUser.departmentId,
    });
  });

  after(async () => {
    try {
      await prisma.taskActor.deleteMany({ where: { taskId: testTask?.id } });
      await prisma.task.deleteMany({ where: { id: testTask?.id } });
      await prisma.session.deleteMany({
        where: { userId: { in: [activeUser?.id, dynamicUser?.id].filter(Boolean) } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [activeUser?.id, dynamicUser?.id].filter(Boolean) } },
      });
      await prisma.organizationalUnit.deleteMany({ where: { id: deptId } });
    } catch (err) {
      console.error('Cleanup error in session-revocation.test.ts:', err);
    }
  });

  beforeEach(() => {
    clearRevocationStoreForTesting();
  });

  describe('1. CurrentSession Invariant (Authority separation)', () => {
    test('resolveCurrentSession returns identity only, no business role snapshot authority', async () => {
      const req = createRequest('http://localhost:3000/api/tasks', { token: activeToken });
      const session = await resolveCurrentSession(req);

      assert.ok(session);
      assert.strictEqual(session.userId, activeUser.id);
      assert.strictEqual(session.user.id, activeUser.id);
      assert.strictEqual(session.user.email, activeUser.email);
      assert.strictEqual(session.user.name, activeUser.name);
      assert.strictEqual(session.user.isActive, true);

      // CRITICAL INVARIANT: resolveCurrentSession must NOT return business role snapshot as final authority
      assert.strictEqual((session as any).role, undefined);
      assert.strictEqual((session.user as any).role, undefined);
    });

    test('loadCurrentUser returns active DB user and rejects inactive user', async () => {
      const user = await loadCurrentUser(activeUser.id);
      assert.strictEqual(user.id, activeUser.id);
      assert.strictEqual(user.isActive, true);

      // If user does not exist in DB -> throws SESSION_INVALID
      await assert.rejects(
        async () => loadCurrentUser('non-existent-user-id'),
        (err: any) => err instanceof AuthenticationError && err.code === 'SESSION_INVALID'
      );
    });
  });

  describe('2. Valid Session (Success scenario)', () => {
    test('valid active user session accesses protected API returning 200', async () => {
      const req = createRequest(`http://localhost:3000/api/tasks/${testTask.id}`, {
        token: activeToken,
      });
      const res = await getTaskById(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.data.id, testTask.id);
    });
  });

  describe('3. Locked Account (User.isActive = false)', () => {
    test('when admin disables user (User.isActive=false), same token is immediately rejected with 401 ACCOUNT_DISABLED', async () => {
      // 1. User initially succeeds
      const reqInitial = createRequest(`http://localhost:3000/api/tasks/${testTask.id}`, {
        token: dynamicToken,
      });
      const resInitial = await getTaskById(reqInitial, {
        params: Promise.resolve({ id: testTask.id }),
      });
      assert.strictEqual(resInitial.status, 200);

      // 2. Admin disables user in database
      await prisma.user.update({
        where: { id: dynamicUser.id },
        data: { isActive: false },
      });

      // 3. Same token now immediately rejected by resolveCurrentSession
      const reqAfterLock = createRequest(`http://localhost:3000/api/tasks/${testTask.id}`, {
        token: dynamicToken,
      });

      await assert.rejects(
        async () => resolveCurrentSession(reqAfterLock),
        (err: any) => {
          assert.ok(err instanceof AuthenticationError);
          assert.strictEqual(err.code, 'ACCOUNT_DISABLED');
          return true;
        }
      );

      // 4. GET protected API returns 401 with code ACCOUNT_DISABLED
      const resGet = await getTaskById(reqAfterLock, {
        params: Promise.resolve({ id: testTask.id }),
      });
      assert.strictEqual(resGet.status, 401);
      const getJson = await resGet.json();
      assert.strictEqual(getJson.code, 'ACCOUNT_DISABLED');

      // 5. POST protected API returns 401 with code ACCOUNT_DISABLED
      const reqPost = createRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        token: dynamicToken,
        body: {
          title: 'Attempted task after account locked',
          priority: 'MEDIUM',
        },
      });
      const resPost = await createTask(reqPost);
      assert.strictEqual(resPost.status, 401);
      const postJson = await resPost.json();
      assert.strictEqual(postJson.code, 'ACCOUNT_DISABLED');

      // Restore user state for subsequent tests
      await prisma.user.update({
        where: { id: dynamicUser.id },
        data: { isActive: true },
      });
    });

    test('disableUser helper disables user and revokes all sessions', async () => {
      await disableUser(dynamicUser.id, { reason: 'Security lock' });

      // Verify DB record
      const dbUser = await prisma.user.findUnique({ where: { id: dynamicUser.id } });
      assert.strictEqual(dbUser?.isActive, false);

      // Verify token rejected (both session revocation and account disabled reject with 401)
      const req = createRequest(`http://localhost:3000/api/tasks/${testTask.id}`, {
        token: dynamicToken,
      });
      await assert.rejects(
        async () => resolveCurrentSession(req),
        (err: any) =>
          err instanceof AuthenticationError &&
          (err.code === 'ACCOUNT_DISABLED' || err.code === 'SESSION_INVALID')
      );

      // Restore
      await prisma.user.update({
        where: { id: dynamicUser.id },
        data: { isActive: true },
      });
    });
  });

  describe('4. Revoked Session (session.revokedAt != null / isSessionRevoked)', () => {
    test('explicitly revoked session token returns 401 SESSION_INVALID', async () => {
      // 1. Session works before revocation
      const req1 = createRequest(`http://localhost:3000/api/tasks/${testTask.id}`, {
        token: activeToken,
      });
      const res1 = await getTaskById(req1, { params: Promise.resolve({ id: testTask.id }) });
      assert.strictEqual(res1.status, 200);

      // 2. Revoke the token
      await revokeSession(activeToken, { revokeReason: 'User logged out' });

      // 3. Same token now immediately rejected
      const req2 = createRequest(`http://localhost:3000/api/tasks/${testTask.id}`, {
        token: activeToken,
      });
      await assert.rejects(
        async () => resolveCurrentSession(req2),
        (err: any) => err instanceof AuthenticationError && err.code === 'SESSION_INVALID'
      );

      const res2 = await getTaskById(req2, { params: Promise.resolve({ id: testTask.id }) });
      assert.strictEqual(res2.status, 401);
      const json2 = await res2.json();
      assert.strictEqual(json2.code, 'SESSION_INVALID');
    });

    test('POST /api/auth/logout revokes session on server', async () => {
      const tokenToRevoke = signSessionToken({
        id: activeUser.id,
        email: activeUser.email,
        name: activeUser.name,
        role: activeUser.role,
      });

      const logoutReq = createRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        token: tokenToRevoke,
      });

      const logoutRes = await logoutRoute(logoutReq);
      assert.strictEqual(logoutRes.status, 200);

      // The token used in logout should now be revoked
      const reqAfterLogout = createRequest(`http://localhost:3000/api/tasks/${testTask.id}`, {
        token: tokenToRevoke,
      });
      const taskRes = await getTaskById(reqAfterLogout, {
        params: Promise.resolve({ id: testTask.id }),
      });
      assert.strictEqual(taskRes.status, 401);
    });

    test('database session record with revokedAt or deleted denies access', async () => {
      const customSessionId = `test-sess-${testRunId}`;
      const customToken = `opaque-session-token-${testRunId}`;

      // Create session in DB Session table
      await prisma.session.create({
        data: {
          id: customSessionId,
          sessionToken: customToken,
          userId: activeUser.id,
          expires: new Date(Date.now() + 3600 * 1000),
        },
      });

      // Request using custom sessionToken as cookie
      const reqWithOpaque = createRequest(`http://localhost:3000/api/tasks/${testTask.id}`, {
        token: customToken,
      });
      const resolved = await resolveCurrentSession(reqWithOpaque);
      assert.strictEqual(resolved.sessionId, customSessionId);
      assert.strictEqual(resolved.userId, activeUser.id);

      // Revoke the session
      await revokeSession(customSessionId);

      // Now request is rejected
      await assert.rejects(
        async () => resolveCurrentSession(reqWithOpaque),
        (err: any) => err instanceof AuthenticationError && err.code === 'SESSION_INVALID'
      );
    });
  });

  describe('5. Expired Session (expires < now)', () => {
    test('JWT token with expired exp timestamp returns 401 SESSION_INVALID', async () => {
      // Mint a token expired 1 hour ago
      const expiredPayload = {
        id: activeUser.id,
        email: activeUser.email,
        name: activeUser.name,
        role: activeUser.role,
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600,
      };
      const expiredToken = jwt.sign(expiredPayload, getJwtSecret());

      const req = createRequest(`http://localhost:3000/api/tasks/${testTask.id}`, {
        token: expiredToken,
      });

      await assert.rejects(
        async () => resolveCurrentSession(req),
        (err: any) => {
          assert.ok(err instanceof AuthenticationError);
          assert.strictEqual(err.code, 'SESSION_INVALID');
          return true;
        }
      );

      const res = await getTaskById(req, { params: Promise.resolve({ id: testTask.id }) });
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.code, 'SESSION_INVALID');
    });

    test('database session with past expires returns 401 SESSION_INVALID', async () => {
      const expiredOpaqueToken = `expired-opaque-${testRunId}`;
      await prisma.session.create({
        data: {
          sessionToken: expiredOpaqueToken,
          userId: activeUser.id,
          expires: new Date(Date.now() - 10000), // Expired in the past
        },
      });

      const req = createRequest(`http://localhost:3000/api/tasks/${testTask.id}`, {
        token: expiredOpaqueToken,
      });

      await assert.rejects(
        async () => resolveCurrentSession(req),
        (err: any) => err instanceof AuthenticationError && err.code === 'SESSION_INVALID'
      );
    });
  });
});
