import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '@qcet/db/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { setPushSenderForTesting, getVapidPublicKey } from '../src/server/notifications/push-service';
import { GET as getKeyRoute } from '../src/app/api/notifications/push/key/route';
import { POST as subscribeRoute, DELETE as unsubscribeRoute } from '../src/app/api/notifications/push/subscribe/route';
import { POST as pushPostRoute, DELETE as pushDeleteRoute } from '../src/app/api/notifications/push/route';
import { POST as testPushRoute } from '../src/app/api/notifications/push/test/route';
import { GET as getNotificationsRoute, PATCH as markAllReadRoute } from '../src/app/api/notifications/route';
import { PATCH as markOneReadRoute } from '../src/app/api/notifications/[id]/read/route';
import { POST as markAllReadAllRoute } from '../src/app/api/notifications/read-all/route';

describe('API Routes: Push & Notifications System', () => {
  let testUser: { id: string; email: string; name: string; role: string };
  let otherUser: { id: string; email: string; name: string; role: string };
  let testUserToken: string;
  let otherUserToken: string;

  const testEndpoint = `https://fcm.googleapis.com/fcm/send/test-sub-${Date.now()}`;
  const testP256dh = 'BMh1yYc2...test-p256dh-key...';
  const testAuth = 'test-auth-secret-123';
  const createdNotificationIds: string[] = [];
  const createdSubscriptionEndpoints: string[] = [];

  before(async () => {
    // 1. Get or create test users
    const users = await prisma.user.findMany({ take: 2 });
    assert.ok(users.length >= 2, 'Need at least 2 users in database for isolation testing');

    testUser = {
      id: users[0].id,
      email: users[0].email,
      name: users[0].name,
      role: users[0].role,
    };
    otherUser = {
      id: users[1].id,
      email: users[1].email,
      name: users[1].name,
      role: users[1].role,
    };

    testUserToken = signSessionToken({
      id: testUser.id,
      email: testUser.email,
      name: testUser.name,
      role: testUser.role,
    });

    otherUserToken = signSessionToken({
      id: otherUser.id,
      email: otherUser.email,
      name: otherUser.name,
      role: otherUser.role,
    });

    // Ensure clean slate for test subscriptions
    await prisma.pushSubscription.deleteMany({
      where: { userId: { in: [testUser.id, otherUser.id] } },
    }).catch(() => {});
  });

  after(async () => {
    // Reset push sender
    setPushSenderForTesting(null);

    // Clean up created subscriptions
    if (createdSubscriptionEndpoints.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: createdSubscriptionEndpoints } },
      }).catch(() => {});
    }

    // Clean up created notifications
    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: createdNotificationIds } },
      }).catch(() => {});
    }
  });

  // =========================================================================
  // 1. GET /api/notifications/push/key
  // =========================================================================
  describe('GET /api/notifications/push/key', () => {
    test('returns 200 with the active VAPID public key', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications/push/key');
      const res = await getKeyRoute(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(typeof json.publicKey === 'string');
      assert.strictEqual(json.publicKey, getVapidPublicKey());
    });
  });

  // =========================================================================
  // 2. POST & DELETE /api/notifications/push/subscribe
  // =========================================================================
  describe('/api/notifications/push/subscribe', () => {
    test('POST returns 401 Unauthorized when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: testEndpoint,
          p256dh: testP256dh,
          auth: testAuth,
        }),
      });
      const res = await subscribeRoute(req);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.success, false);
    });

    test('POST returns 400 Bad Request when missing required fields', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          endpoint: testEndpoint,
          // missing p256dh & auth
        }),
      });
      const res = await subscribeRoute(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.match(json.error, /endpoint.*p256dh.*auth/i);
    });

    test('POST rejects malformed endpoint URL with 400 and expected error message', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          endpoint: 'not-a-valid-url',
          p256dh: testP256dh,
          auth: testAuth,
        }),
      });
      const res = await subscribeRoute(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error, 'Push endpoint must be a valid HTTPS URL');
    });

    test('POST rejects non-HTTPS (HTTP) push endpoint with 400 Bad Request', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          endpoint: 'http://fcm.googleapis.com/fcm/send/insecure',
          p256dh: testP256dh,
          auth: testAuth,
        }),
      });
      const res = await subscribeRoute(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error, 'Push endpoint must be a valid HTTPS URL');
    });

    test('POST rejects dangerous non-HTTPS schemes (javascript:) with 400 Bad Request', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          endpoint: 'javascript:alert(1)',
          p256dh: testP256dh,
          auth: testAuth,
        }),
      });
      const res = await subscribeRoute(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error, 'Push endpoint must be a valid HTTPS URL');
    });

    test('POST creates a new active subscription with valid payload and auth cookie', async () => {
      createdSubscriptionEndpoints.push(testEndpoint);

      const req = new NextRequest('http://localhost:3000/api/notifications/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000',
          'Cookie': `${SESSION_COOKIE_NAME}=${testUserToken}`,
        },
        body: JSON.stringify({
          endpoint: testEndpoint,
          p256dh: testP256dh,
          auth: testAuth,
          deviceType: 'mobile-android',
          userAgent: 'Mozilla/5.0 (Linux; Android 14)',
        }),
      });

      const res = await subscribeRoute(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.subscriptionId);

      const saved = await prisma.pushSubscription.findUnique({
        where: { endpoint: testEndpoint },
      });
      assert.ok(saved);
      assert.strictEqual(saved.userId, testUser.id);
      assert.strictEqual(saved.p256dh, testP256dh);
      assert.strictEqual(saved.auth, testAuth);
      assert.strictEqual(saved.status, 'ACTIVE');
      assert.strictEqual(saved.deviceType, 'mobile-android');
    });

    test('POST updates existing subscription without duplicating on repeated subscription', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          endpoint: testEndpoint,
          p256dh: testP256dh,
          auth: testAuth,
          deviceType: 'mobile-ios',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
        }),
      });

      const res = await subscribeRoute(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);

      const count = await prisma.pushSubscription.count({
        where: { endpoint: testEndpoint },
      });
      assert.strictEqual(count, 1, 'Should not create duplicate rows for same endpoint');

      const updated = await prisma.pushSubscription.findUnique({
        where: { endpoint: testEndpoint },
      });
      assert.strictEqual(updated?.deviceType, 'mobile-ios');
      assert.strictEqual(updated?.status, 'ACTIVE');
    });

    test('DELETE returns 401 when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: testEndpoint }),
      });
      const res = await unsubscribeRoute(req);
      assert.strictEqual(res.status, 401);
    });

    test('DELETE returns 400 when endpoint is missing or blank', async () => {
      // revokePushSubscriptions thu hồi tất cả khi endpoint rỗng: URL này phải chặn ở bước validate.
      for (const body of [{}, { endpoint: '' }, { endpoint: '   ' }]) {
        const req = new NextRequest('http://localhost:3000/api/notifications/push/subscribe', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${testUserToken}`,
          },
          body: JSON.stringify(body),
        });
        const res = await unsubscribeRoute(req);
        assert.strictEqual(res.status, 400, JSON.stringify(body));
      }
    });

    test('DELETE marks the subscription as REVOKED', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications/push/subscribe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({ endpoint: testEndpoint }),
      });

      const res = await unsubscribeRoute(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);

      const revoked = await prisma.pushSubscription.findUnique({
        where: { endpoint: testEndpoint },
      });
      assert.strictEqual(revoked?.status, 'REVOKED');
      assert.ok(revoked?.disabledAt instanceof Date, 'Thu hồi phải ghi disabledAt như DELETE /push');
    });
  });

  // =========================================================================
  // 3. POST /api/notifications/push/test
  // =========================================================================
  describe('POST /api/notifications/push/test', () => {
    test('returns 401 when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications/push/test', {
        method: 'POST',
      });
      const res = await testPushRoute(req);
      assert.strictEqual(res.status, 401);
    });

    test('dispatches a test push without writing an inbox notification', async () => {
      // Re-activate the subscription for testing dispatch
      await prisma.pushSubscription.update({
        where: { endpoint: testEndpoint },
        data: { status: 'ACTIVE' },
      });

      let mockDispatched = false;
      setPushSenderForTesting(async () => {
        mockDispatched = true;
        return { statusCode: 201, body: 'mock-ok', headers: {} };
      });

      const req = new NextRequest('http://localhost:3000/api/notifications/push/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testUserToken}`,
          'Content-Type': 'application/json',
        },
      });

      const countBefore = await prisma.notification.count({ where: { userId: testUser.id } });
      const res = await testPushRoute(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.result);
      assert.strictEqual(json.result.sentCount, 1);
      assert.strictEqual(mockDispatched, true);

      // Thử chuông không được ghi vào Hộp thư
      const countAfter = await prisma.notification.count({ where: { userId: testUser.id } });
      assert.strictEqual(countAfter, countBefore);
    });
  });

  // =========================================================================
  // 3b. /push và /push/subscribe: hai URL, một đường ghi
  // (đặt sau mục 3 để các đăng ký ACTIVE thêm ở đây không đổi sentCount của mục 3)
  // =========================================================================
  describe('/api/notifications/push và /push/subscribe dùng chung một đường ghi', () => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const otherP256dh = 'BOther...other-user-p256dh-key...';
    const otherAuth = 'other-user-auth-secret-456';

    function uniqueEndpoint(suffix: string) {
      const endpoint = `https://fcm.googleapis.com/fcm/send/shared-path-${runId}-${suffix}`;
      createdSubscriptionEndpoints.push(endpoint);
      return endpoint;
    }

    function bearerRequest(
      path: '/api/notifications/push' | '/api/notifications/push/subscribe',
      method: 'POST' | 'DELETE',
      token: string,
      body: Record<string, unknown>
    ) {
      return new NextRequest(`http://localhost:3000${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    }

    function subscriptionBody(endpoint: string, keys = { p256dh: testP256dh, auth: testAuth }) {
      return {
        endpoint,
        keys,
        deviceType: 'browser',
        userAgent: 'Mozilla/5.0 (QCET push test)',
      };
    }

    async function subscribeVia(
      path: '/api/notifications/push' | '/api/notifications/push/subscribe',
      endpoint: string,
      token = testUserToken,
      keys?: { p256dh: string; auth: string }
    ) {
      const req = bearerRequest(path, 'POST', token, subscriptionBody(endpoint, keys));
      const res =
        path === '/api/notifications/push' ? await pushPostRoute(req) : await subscribeRoute(req);
      assert.strictEqual(res.status, 200);
      return res.json();
    }

    async function findRow(endpoint: string) {
      const row = await prisma.pushSubscription.findUnique({ where: { endpoint } });
      assert.ok(row, `Thiếu đăng ký ${endpoint}`);
      return row;
    }

    test('POST /push/subscribe kích hoạt lại đăng ký đã thu hồi qua DELETE /push: ACTIVE, disabledAt null', async () => {
      const endpoint = uniqueEndpoint('reactivate-after-delete');
      await subscribeVia('/api/notifications/push/subscribe', endpoint);

      const delRes = await pushDeleteRoute(
        bearerRequest('/api/notifications/push', 'DELETE', testUserToken, { endpoint })
      );
      assert.strictEqual(delRes.status, 200);
      const revoked = await findRow(endpoint);
      assert.strictEqual(revoked.status, 'REVOKED');
      assert.ok(revoked.disabledAt instanceof Date);

      await subscribeVia('/api/notifications/push/subscribe', endpoint);
      const reactivated = await findRow(endpoint);
      assert.strictEqual(reactivated.status, 'ACTIVE');
      assert.strictEqual(reactivated.disabledAt, null);
      assert.strictEqual(reactivated.userId, testUser.id);
    });

    test('POST /push/subscribe kích hoạt lại đăng ký bị push-service thu hồi (410): xóa disabledAt và bộ đếm lỗi', async () => {
      const endpoint = uniqueEndpoint('reactivate-after-410');
      await subscribeVia('/api/notifications/push/subscribe', endpoint);
      // Giống push-service khi gửi gặp 404/410: REVOKED kèm disabledAt, trình duyệt vẫn giữ subscription.
      await prisma.pushSubscription.update({
        where: { endpoint },
        data: { status: 'REVOKED', disabledAt: new Date(), failureCount: 5, lastFailureCode: 410 },
      });

      await subscribeVia('/api/notifications/push/subscribe', endpoint);
      const row = await findRow(endpoint);
      assert.strictEqual(row.status, 'ACTIVE');
      assert.strictEqual(row.disabledAt, null);
      assert.strictEqual(row.failureCount, 0);
      assert.strictEqual(row.lastFailureCode, null);
    });

    test('DELETE /push/subscribe thu hồi giống DELETE /push: REVOKED kèm disabledAt', async () => {
      const endpoint = uniqueEndpoint('delete-subscribe');
      await subscribeVia('/api/notifications/push/subscribe', endpoint);

      const res = await unsubscribeRoute(
        bearerRequest('/api/notifications/push/subscribe', 'DELETE', testUserToken, { endpoint })
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);

      const row = await findRow(endpoint);
      assert.strictEqual(row.status, 'REVOKED');
      assert.ok(row.disabledAt instanceof Date, 'DELETE /push/subscribe phải ghi disabledAt');
    });

    test('POST /push và POST /push/subscribe ghi cùng trạng thái và trả cùng dạng phản hồi, không kèm khóa', async () => {
      const viaPush = uniqueEndpoint('parity-push');
      const viaSubscribe = uniqueEndpoint('parity-subscribe');
      await subscribeVia('/api/notifications/push', viaPush);
      await subscribeVia('/api/notifications/push/subscribe', viaSubscribe);
      await prisma.pushSubscription.updateMany({
        where: { endpoint: { in: [viaPush, viaSubscribe] } },
        data: { status: 'REVOKED', disabledAt: new Date(), failureCount: 3, lastFailureCode: 500 },
      });

      const pushJson = await subscribeVia('/api/notifications/push', viaPush);
      const subscribeJson = await subscribeVia('/api/notifications/push/subscribe', viaSubscribe);

      const pick = (row: Awaited<ReturnType<typeof findRow>>) => ({
        userId: row.userId,
        p256dh: row.p256dh,
        auth: row.auth,
        deviceType: row.deviceType,
        userAgent: row.userAgent,
        status: row.status,
        failureCount: row.failureCount,
        lastFailureCode: row.lastFailureCode,
        disabledAt: row.disabledAt,
      });
      const pushRow = await findRow(viaPush);
      const subscribeRow = await findRow(viaSubscribe);
      assert.deepStrictEqual(pick(subscribeRow), pick(pushRow));
      assert.deepStrictEqual(pick(pushRow), {
        userId: testUser.id,
        p256dh: testP256dh,
        auth: testAuth,
        deviceType: 'browser',
        userAgent: 'Mozilla/5.0 (QCET push test)',
        status: 'ACTIVE',
        failureCount: 0,
        lastFailureCode: null,
        disabledAt: null,
      });

      assert.deepStrictEqual(pushJson, { success: true, subscriptionId: pushRow.id });
      assert.deepStrictEqual(subscribeJson, { success: true, subscriptionId: subscribeRow.id });
      const raw = JSON.stringify(subscribeJson);
      assert.ok(!raw.includes(testP256dh) && !raw.includes(testAuth), 'Phản hồi không được chứa p256dh/auth');
    });

    test('người khác DELETE endpoint của testUser qua /push và /push/subscribe: 200 nhưng đăng ký giữ nguyên', async () => {
      const endpoint = uniqueEndpoint('foreign-delete');
      await subscribeVia('/api/notifications/push/subscribe', endpoint);

      const viaPush = await pushDeleteRoute(
        bearerRequest('/api/notifications/push', 'DELETE', otherUserToken, { endpoint })
      );
      assert.strictEqual(viaPush.status, 200);
      const viaSubscribe = await unsubscribeRoute(
        bearerRequest('/api/notifications/push/subscribe', 'DELETE', otherUserToken, { endpoint })
      );
      assert.strictEqual(viaSubscribe.status, 200);

      const row = await findRow(endpoint);
      assert.strictEqual(row.status, 'ACTIVE');
      assert.strictEqual(row.userId, testUser.id);
      assert.strictEqual(row.disabledAt, null);
    });

    test('thiết bị dùng chung: người khác đăng ký lại cùng endpoint thì đăng ký chuyển sang người đó', async () => {
      const endpoint = uniqueEndpoint('shared-device');
      await subscribeVia('/api/notifications/push/subscribe', endpoint);
      const delRes = await pushDeleteRoute(
        bearerRequest('/api/notifications/push', 'DELETE', testUserToken, { endpoint })
      );
      assert.strictEqual(delRes.status, 200);

      const otherJson = await subscribeVia('/api/notifications/push/subscribe', endpoint, otherUserToken, {
        p256dh: otherP256dh,
        auth: otherAuth,
      });
      const handedOver = await findRow(endpoint);
      assert.deepStrictEqual(otherJson, { success: true, subscriptionId: handedOver.id });
      assert.strictEqual(handedOver.userId, otherUser.id);
      assert.strictEqual(handedOver.p256dh, otherP256dh);
      assert.strictEqual(handedOver.auth, otherAuth);
      assert.strictEqual(handedOver.status, 'ACTIVE');
      assert.strictEqual(handedOver.disabledAt, null);

      // Chủ cũ không còn thu hồi được đăng ký đã chuyển chủ.
      const staleDelete = await unsubscribeRoute(
        bearerRequest('/api/notifications/push/subscribe', 'DELETE', testUserToken, { endpoint })
      );
      assert.strictEqual(staleDelete.status, 200);
      const stillOther = await findRow(endpoint);
      assert.strictEqual(stillOther.userId, otherUser.id);
      assert.strictEqual(stillOther.status, 'ACTIVE');

      // Chủ cũ đăng ký lại qua /push thì chuyển về, như /push/subscribe.
      await subscribeVia('/api/notifications/push', endpoint);
      const back = await findRow(endpoint);
      assert.strictEqual(back.userId, testUser.id);
      assert.strictEqual(back.p256dh, testP256dh);
      assert.strictEqual(back.status, 'ACTIVE');
    });

    test('POST và DELETE /push từ chối khi chưa đăng nhập (401) hoặc thiếu/sai khóa (400)', async () => {
      const endpoint = uniqueEndpoint('push-validation');
      const anonymous = (method: 'POST' | 'DELETE', body: Record<string, unknown>) =>
        new NextRequest('http://localhost:3000/api/notifications/push', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

      const postRes = await pushPostRoute(anonymous('POST', subscriptionBody(endpoint)));
      assert.strictEqual(postRes.status, 401);
      assert.strictEqual((await postRes.json()).success, false);
      const deleteRes = await pushDeleteRoute(anonymous('DELETE', { endpoint }));
      assert.strictEqual(deleteRes.status, 401);
      assert.strictEqual((await deleteRes.json()).success, false);

      const missingKeys = await pushPostRoute(
        bearerRequest('/api/notifications/push', 'POST', testUserToken, { endpoint })
      );
      assert.strictEqual(missingKeys.status, 400);
      assert.strictEqual((await missingKeys.json()).success, false);

      const insecure = await pushPostRoute(
        bearerRequest(
          '/api/notifications/push',
          'POST',
          testUserToken,
          subscriptionBody('http://fcm.googleapis.com/fcm/send/insecure')
        )
      );
      assert.strictEqual(insecure.status, 400);
      const insecureJson = await insecure.json();
      assert.strictEqual(insecureJson.success, false);
      assert.strictEqual(insecureJson.error, 'Push endpoint must be a valid HTTPS URL');

      assert.strictEqual(await prisma.pushSubscription.count({ where: { endpoint } }), 0);
    });

    test('cookie phiên kèm Origin lạ bị chặn CSRF (403) ở cả hai URL, đăng ký không đổi', async () => {
      const endpoint = uniqueEndpoint('csrf');
      await subscribeVia('/api/notifications/push/subscribe', endpoint);

      const crossSite = (
        path: '/api/notifications/push' | '/api/notifications/push/subscribe',
        method: 'POST' | 'DELETE',
        body: Record<string, unknown>
      ) =>
        new NextRequest(`http://localhost:3000${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://evil-attacker.site',
            'Cookie': `${SESSION_COOKIE_NAME}=${otherUserToken}`,
          },
          body: JSON.stringify(body),
        });

      const responses = [
        await pushPostRoute(crossSite('/api/notifications/push', 'POST', subscriptionBody(endpoint))),
        await subscribeRoute(crossSite('/api/notifications/push/subscribe', 'POST', subscriptionBody(endpoint))),
        await pushDeleteRoute(crossSite('/api/notifications/push', 'DELETE', { endpoint })),
        await unsubscribeRoute(crossSite('/api/notifications/push/subscribe', 'DELETE', { endpoint })),
      ];
      for (const res of responses) {
        assert.strictEqual(res.status, 403);
        const json = await res.json();
        assert.strictEqual(json.success, false);
        assert.strictEqual(json.code, 'CSRF_VALIDATION_FAILED');
      }

      const row = await findRow(endpoint);
      assert.strictEqual(row.userId, testUser.id);
      assert.strictEqual(row.status, 'ACTIVE');
    });
  });

  // =========================================================================
  // 4. GET & PATCH /api/notifications
  // =========================================================================
  describe('GET & PATCH /api/notifications', () => {
    let notif1Id: string;
    let notif2Id: string;
    let otherNotifId: string;

    before(async () => {
      const n1 = await prisma.notification.create({
        data: {
          userId: testUser.id,
          actorName: 'Ban Giám Hiệu',
          title: '[GIAO VIỆC] Kế hoạch tuyển sinh 2026',
          body: 'BGH giao nhiệm vụ mới cho đồng chí',
          category: 'task',
          type: 'assigned',
          linkHref: '/?zone=tasks&taskId=test-1',
          isRead: false,
        },
      });
      notif1Id = n1.id;
      createdNotificationIds.push(n1.id);

      const n2 = await prisma.notification.create({
        data: {
          userId: testUser.id,
          actorName: 'Phòng Đào Tạo',
          title: '[ĐÃ DUYỆT] Báo cáo tiến độ',
          body: 'Báo cáo của đồng chí đã được duyệt',
          category: 'task',
          type: 'reviewed',
          linkHref: '/?zone=tasks&taskId=test-2',
          isRead: false,
        },
      });
      notif2Id = n2.id;
      createdNotificationIds.push(n2.id);

      const nOther = await prisma.notification.create({
        data: {
          userId: otherUser.id,
          actorName: 'Ban Giám Hiệu',
          title: '[HỎA TỐC] Chỉ đạo khẩn',
          body: 'Nhiệm vụ thuộc về user khác',
          category: 'directive',
          type: 'directive',
          linkHref: '/?zone=tasks&taskId=test-other',
          isRead: false,
        },
      });
      otherNotifId = nOther.id;
      createdNotificationIds.push(nOther.id);
    });

    test('GET returns 401 when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications');
      const res = await getNotificationsRoute(req);
      assert.strictEqual(res.status, 401);
    });

    test('GET returns notifications list and accurate unreadCount for current user', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications', {
        headers: {
          'Authorization': `Bearer ${testUserToken}`,
        },
      });
      const res = await getNotificationsRoute(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.notifications));
      assert.ok(json.unreadCount >= 2);

      // Verify other user's notification is not leaked
      const foundOther = json.notifications.some((n: { id: string }) => n.id === otherNotifId);
      assert.strictEqual(foundOther, false, 'Should not return other user notifications');
    });

    test('GET supports unreadOnly=true filter', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications?unreadOnly=true', {
        headers: {
          'Authorization': `Bearer ${testUserToken}`,
        },
      });
      const res = await getNotificationsRoute(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      for (const notif of json.notifications) {
        assert.strictEqual(notif.isRead, false);
      }
    });

    test('PATCH /api/notifications/[id]/read marks a single notification as read', async () => {
      const req = new NextRequest(`http://localhost:3000/api/notifications/${notif1Id}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${testUserToken}`,
          'Content-Type': 'application/json',
        },
      });

      const res = await markOneReadRoute(req, { params: Promise.resolve({ id: notif1Id }) });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);

      const updated = await prisma.notification.findUnique({
        where: { id: notif1Id },
      });
      assert.strictEqual(updated?.isRead, true);
      assert.ok(updated?.readAt);
    });

    test('PATCH /api/notifications/[id]/read returns 404 or 403 when trying to mark another user notification', async () => {
      const req = new NextRequest(`http://localhost:3000/api/notifications/${otherNotifId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${testUserToken}`,
        },
      });

      const res = await markOneReadRoute(req, { params: Promise.resolve({ id: otherNotifId }) });
      assert.ok(res.status === 404 || res.status === 403);
    });

    test('PATCH /api/notifications marks all remaining notifications as read', async () => {
      const req = new NextRequest('http://localhost:3000/api/notifications', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${testUserToken}`,
        },
      });

      const res = await markAllReadRoute(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);

      const unreadCount = await prisma.notification.count({
        where: { userId: testUser.id, isRead: false },
      });
      assert.strictEqual(unreadCount, 0);

      // Verify other user unread notification was untouched
      const otherUnread = await prisma.notification.findUnique({
        where: { id: otherNotifId },
      });
      assert.strictEqual(otherUnread?.isRead, false);
    });

    test('POST /api/notifications/read-all also marks all as read', async () => {
      // Create a fresh unread notification
      const freshNotif = await prisma.notification.create({
        data: {
          userId: testUser.id,
          actorName: 'Test Actor',
          title: 'Test unread',
          body: 'Test body',
          category: 'task',
          type: 'test',
          linkHref: '/?zone=tasks',
          isRead: false,
        },
      });
      createdNotificationIds.push(freshNotif.id);

      const req = new NextRequest('http://localhost:3000/api/notifications/read-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testUserToken}`,
        },
      });

      const res = await markAllReadAllRoute(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);

      const check = await prisma.notification.findUnique({
        where: { id: freshNotif.id },
      });
      assert.strictEqual(check?.isRead, true);
    });
  });
});
