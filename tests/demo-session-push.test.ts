import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { POST as subscribeRoute, DELETE as unsubscribeRoute } from '../src/app/api/notifications/push/subscribe/route';
import { POST as testPushRoute } from '../src/app/api/notifications/push/test/route';
import { prisma } from '../src/lib/prisma';
import { signSessionToken } from '../src/lib/jwt-session';

describe('Push Notification Authentication & Session Integration', () => {
  let testUser: {
    id: string;
    email: string;
    name: string;
    role: any;
    departmentId: string | null;
    title: string | null;
  };

  before(async () => {
    let user = await prisma.user.findFirst({
      where: { email: 'bgh@cdktcnqn.edu.vn' },
    });
    if (!user) {
      const dept = await prisma.department.upsert({
        where: { id: 'ban-giam-hieu' },
        update: {},
        create: {
          id: 'ban-giam-hieu',
          name: 'Ban Giám Hiệu',
          shortName: 'BGH',
        },
      });
      user = await prisma.user.create({
        data: {
          email: 'bgh@cdktcnqn.edu.vn',
          name: 'Ban Giám Hiệu',
          role: 'ADMIN',
          departmentId: dept.id,
          title: 'Hiệu trưởng',
        },
      });
    }
    testUser = user;
  });

  after(async () => {
    if (testUser) {
      await prisma.pushSubscription.deleteMany({
        where: {
          userId: testUser.id,
        },
      });
    }
  });
  test('POST /api/notifications/push/subscribe strictly rejects unauthenticated requests with 401 (preventing userId injection)', async () => {
    const testEndpoint = `https://fcm.googleapis.com/fcm/send/tamper-${Date.now()}`;
    const req = new NextRequest('http://localhost:3000/api/notifications/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: testEndpoint,
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9AcDnVUeG3Ividd02-y1O0XCXDAURKVSTQVNn_2QV60Q94=',
        auth: 'tBHItJI5svbpez7KI4CCXg==',
        userId: 'user-admin-bgh', // Attempted impersonation without cookie
      }),
    });

    const res = await subscribeRoute(req);
    assert.strictEqual(res.status, 401);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.match(json.error, /Unauthorized/);
  });

  test('Push notification lifecycle succeeds when authenticated via session cookie', async () => {
    // 1. Establish session using signed JWT token directly
    const sessionCookie = signSessionToken({
      id: testUser.id,
      email: testUser.email,
      name: testUser.name,
      role: testUser.role,
      departmentId: testUser.departmentId ?? undefined,
      title: testUser.title ?? undefined,
    });
    assert.ok(sessionCookie, 'Session cookie must exist');

    const testEndpoint = `https://fcm.googleapis.com/fcm/send/demo-auth-${Date.now()}`;

    // 2. Subscribe with session cookie
    const subReq = new NextRequest('http://localhost:3000/api/notifications/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        cookie: `qcet_session=${sessionCookie}`,
      },
      body: JSON.stringify({
        endpoint: testEndpoint,
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9AcDnVUeG3Ividd02-y1O0XCXDAURKVSTQVNn_2QV60Q94=',
        auth: 'tBHItJI5svbpez7KI4CCXg==',
      }),
    });

    const subRes = await subscribeRoute(subReq);
    assert.strictEqual(subRes.status, 200);
    const subJson = await subRes.json();
    assert.strictEqual(subJson.success, true);

    const dbSub = await prisma.pushSubscription.findUnique({
      where: { endpoint: testEndpoint },
    });
    assert.ok(dbSub);
    assert.strictEqual(dbSub?.userId, testUser.id);

    // 3. Test push notification dispatch with session cookie
    const testReq = new NextRequest('http://localhost:3000/api/notifications/push/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        cookie: `qcet_session=${sessionCookie}`,
      },
      body: JSON.stringify({
        title: 'Thử nghiệm thông báo',
      }),
    });

    const testRes = await testPushRoute(testReq);
    assert.strictEqual(testRes.status, 200);
    const testJson = await testRes.json();
    assert.strictEqual(testJson.success, true);

    // 4. Unsubscribe with session cookie
    const unsubReq = new NextRequest('http://localhost:3000/api/notifications/push/subscribe', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        cookie: `qcet_session=${sessionCookie}`,
      },
      body: JSON.stringify({
        endpoint: testEndpoint,
      }),
    });

    const unsubRes = await unsubscribeRoute(unsubReq);
    assert.strictEqual(unsubRes.status, 200);

    const revokedSub = await prisma.pushSubscription.findUnique({
      where: { endpoint: testEndpoint },
    });
    assert.strictEqual(revokedSub?.status, 'REVOKED');
  });

  test('POST /api/notifications/push/subscribe still rejects with 401 when no session and no valid userId', async () => {
    const req = new NextRequest('http://localhost:3000/api/notifications/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://invalid-endpoint',
        p256dh: 'foo',
        auth: 'bar',
        userId: 'non-existent-user-id',
      }),
    });

    const res = await subscribeRoute(req);
    assert.strictEqual(res.status, 401);
  });
});
