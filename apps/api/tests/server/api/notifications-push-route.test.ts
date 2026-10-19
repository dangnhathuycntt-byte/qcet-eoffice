import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '@qcet/db/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { getVapidPublicKey } from '@/server/notifications/push-service';
import { DEFAULT_PUSH_PREFERENCES } from '@qcet/shared/lib/pwa/push-preferences';
import {
  GET as pushGetRoute,
  POST as pushPostRoute,
  DELETE as pushDeleteRoute,
} from '@/app/api/notifications/push/route';

// Đặc tả các nhánh của /api/notifications/push chưa có trong tests/api-notifications-push.test.ts:
// GET trạng thái + tùy chọn, POST tùy chọn và payload sai, DELETE thu hồi tất cả của chính mình.
// Mỗi nhóm dùng user riêng theo runId: MUTATION rate limit khóa theo user id, và before() của
// test cũ xóa đăng ký của users[0..1] trong seed.
describe('/api/notifications/push: GET, POST tùy chọn/validate, DELETE thu hồi', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const BASE = 'http://localhost:3000/api/notifications/push';
  const P256DH = `BNtfPushP256dh-${runId}`;
  const AUTH = `ntf-push-auth-${runId}`;
  const createdUserIds: string[] = [];
  const createdEndpoints: string[] = [];

  type FixtureUser = { id: string; email: string; name: string; role: string; token: string };

  async function createUser(
    key: string,
    options: { isActive?: boolean; onboardingData?: Prisma.InputJsonValue } = {}
  ): Promise<FixtureUser> {
    const user = await prisma.user.create({
      data: {
        id: `ntf-push-${key}-${runId}`,
        email: `ntf.push.${key}.${runId}@qcet.edu.vn`,
        name: `Kiểm thử push ${key}`,
        role: UserRole.CHUYEN_VIEN,
        isActive: options.isActive ?? true,
        ...(options.onboardingData !== undefined ? { onboardingData: options.onboardingData } : {}),
      },
    });
    createdUserIds.push(user.id);
    const token = signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role });
    return { id: user.id, email: user.email, name: user.name, role: user.role, token };
  }

  function endpointFor(suffix: string) {
    const endpoint = `https://fcm.googleapis.com/fcm/send/ntf-push-${runId}-${suffix}`;
    createdEndpoints.push(endpoint);
    return endpoint;
  }

  async function seedSubscription(
    userId: string,
    suffix: string,
    status: 'ACTIVE' | 'REVOKED' = 'ACTIVE'
  ) {
    return prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: endpointFor(suffix),
        p256dh: P256DH,
        auth: AUTH,
        status,
        disabledAt: status === 'REVOKED' ? new Date(Date.now() - 60_000) : null,
      },
    });
  }

  function request(
    method: 'GET' | 'POST' | 'DELETE',
    options: { headers?: Record<string, string>; body?: string } = {}
  ) {
    return new NextRequest(BASE, {
      method,
      headers: options.headers,
      ...(options.body !== undefined ? { body: options.body } : {}),
    });
  }

  function bearerJson(token: string, body?: unknown, extra: Record<string, string> = {}) {
    return {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...extra },
      ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
    };
  }

  async function readJson(res: Response) {
    assert.ok(res.headers.get('content-type')?.startsWith('application/json'));
    return res.json();
  }

  async function assertError(res: Response, status: number, code: string) {
    assert.strictEqual(res.status, status);
    const json = await readJson(res);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.code, code);
    return json;
  }

  async function storedPreferences(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { onboardingData: true } });
    return user?.onboardingData as Record<string, unknown> | null;
  }

  let bystander: FixtureUser;
  let bystanderEndpoint: string;

  before(async () => {
    bystander = await createUser('bystander');
    bystanderEndpoint = (await seedSubscription(bystander.id, 'bystander-active')).endpoint;
  });

  after(async () => {
    if (createdEndpoints.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: createdEndpoints } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.auditEvent.deleteMany({ where: { actorId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  // ===========================================================================
  // GET: khóa VAPID + tùy chọn + số đăng ký đang hoạt động
  // ===========================================================================
  describe('GET /api/notifications/push', () => {
    let statusUser: FixtureUser;

    before(async () => {
      statusUser = await createUser('status', {
        onboardingData: {
          tourSeen: true,
          pushPreferences: { taskAssigned: false, unitRequest: false },
        },
      });
      await seedSubscription(statusUser.id, 'status-active-1');
      await seedSubscription(statusUser.id, 'status-active-2');
      await seedSubscription(statusUser.id, 'status-revoked', 'REVOKED');
    });

    test('chưa đăng nhập: 200 với khóa VAPID, tùy chọn mặc định và 0 đăng ký', async () => {
      const res = await pushGetRoute(request('GET'));
      assert.strictEqual(res.status, 200);
      const json = await readJson(res);
      assert.deepStrictEqual(json, {
        success: true,
        publicKey: getVapidPublicKey(),
        preferences: DEFAULT_PUSH_PREFERENCES,
        subscriptionsCount: 0,
      });
    });

    test('Bearer token không hợp lệ: 401 SESSION_INVALID, không coi như khách', async () => {
      const res = await pushGetRoute(request('GET', { headers: { Authorization: 'Bearer not-a-valid-token' } }));
      const json = await assertError(res, 401, 'SESSION_INVALID');
      assert.ok(!('publicKey' in json));
      assert.ok(!('preferences' in json));
      assert.ok(!('subscriptionsCount' in json));
    });

    test('đã đăng nhập: tùy chọn đã lưu gộp lên mặc định, chỉ đếm đăng ký ACTIVE của chính mình', async () => {
      const res = await pushGetRoute(request('GET', { headers: { Authorization: `Bearer ${statusUser.token}` } }));
      assert.strictEqual(res.status, 200);
      const json = await readJson(res);
      assert.deepStrictEqual(json, {
        success: true,
        publicKey: getVapidPublicKey(),
        preferences: { ...DEFAULT_PUSH_PREFERENCES, taskAssigned: false, unitRequest: false },
        subscriptionsCount: 2,
      });
    });

    test('người dùng khác chỉ thấy số đăng ký của mình', async () => {
      const res = await pushGetRoute(request('GET', { headers: { Authorization: `Bearer ${bystander.token}` } }));
      assert.strictEqual(res.status, 200);
      const json = await readJson(res);
      assert.deepStrictEqual(json.preferences, DEFAULT_PUSH_PREFERENCES);
      assert.strictEqual(json.subscriptionsCount, 1);
    });
  });

  // ===========================================================================
  // POST: cập nhật tùy chọn
  // ===========================================================================
  describe('POST /api/notifications/push: tùy chọn', () => {
    let prefsUser: FixtureUser;

    before(async () => {
      prefsUser = await createUser('prefs', { onboardingData: { completedSteps: ['welcome'] } });
    });

    test('chỉ gửi preferences: 200 trả đủ 7 khóa, lưu vào onboardingData và giữ khóa khác, không tạo đăng ký', async () => {
      const res = await pushPostRoute(
        request('POST', bearerJson(prefsUser.token, { preferences: { taskAssigned: false, taskExtension: false } }))
      );
      assert.strictEqual(res.status, 200);
      const expected = {
        ...DEFAULT_PUSH_PREFERENCES,
        taskAssigned: false,
        taskExtension: false,
      };
      assert.deepStrictEqual(await readJson(res), { success: true, preferences: expected });

      const stored = await storedPreferences(prefsUser.id);
      assert.deepStrictEqual(stored, { completedSteps: ['welcome'], pushPreferences: expected });
      assert.strictEqual(await prisma.pushSubscription.count({ where: { userId: prefsUser.id } }), 0);
    });

    test('máy khách cũ không gửi khóa mới: giữ giá trị đã lưu của taskExtension/taskDecline/unitRequest', async () => {
      const res = await pushPostRoute(
        request(
          'POST',
          bearerJson(prefsUser.token, {
            preferences: {
              taskAssigned: false,
              taskReview: true,
              deadlineReminder: false,
              documentDirective: true,
              taskDecline: false,
            },
          })
        )
      );
      assert.strictEqual(res.status, 200);
      const expected = {
        taskAssigned: false,
        taskReview: true,
        deadlineReminder: false,
        documentDirective: true,
        taskExtension: false,
        taskDecline: false,
        unitRequest: true,
      };
      assert.deepStrictEqual(await readJson(res), { success: true, preferences: expected });

      const getRes = await pushGetRoute(request('GET', { headers: { Authorization: `Bearer ${prefsUser.token}` } }));
      const status = await readJson(getRes);
      assert.deepStrictEqual(status.preferences, expected);
      assert.strictEqual(status.subscriptionsCount, 0);
    });

    test('giá trị tùy chọn không phải boolean: 400 VALIDATION_ERROR, không đổi dữ liệu đã lưu', async () => {
      const previous = await storedPreferences(prefsUser.id);
      const res = await pushPostRoute(
        request('POST', bearerJson(prefsUser.token, { preferences: { taskAssigned: 'yes', taskReview: false } }))
      );
      const json = await assertError(res, 400, 'VALIDATION_ERROR');
      assert.ok(json.fieldErrors?.['preferences.taskAssigned'], 'Phải báo lỗi ở preferences.taskAssigned');
      assert.ok(!('preferences' in json));
      assert.deepStrictEqual(await storedPreferences(prefsUser.id), previous);
    });

    test('preferences kèm endpoint nhưng thiếu khóa: 400, không tạo đăng ký', async () => {
      const endpoint = endpointFor('prefs-missing-keys');
      const res = await pushPostRoute(
        request('POST', bearerJson(prefsUser.token, { preferences: { taskReview: false }, endpoint }))
      );
      const json = await assertError(res, 400, 'VALIDATION_ERROR');
      assert.strictEqual(json.error, 'Missing required fields: endpoint, p256dh, and auth are required');
      assert.strictEqual(await prisma.pushSubscription.count({ where: { endpoint } }), 0);
    });

    test('preferences kèm đăng ký hợp lệ: lưu cả hai, phản hồi chỉ có subscriptionId', async () => {
      const endpoint = endpointFor('prefs-with-subscription');
      const preferences = {
        taskAssigned: true,
        taskReview: false,
        deadlineReminder: true,
        documentDirective: false,
        taskExtension: true,
        taskDecline: true,
        unitRequest: false,
      };
      const res = await pushPostRoute(
        request(
          'POST',
          bearerJson(prefsUser.token, { preferences, endpoint, keys: { p256dh: P256DH, auth: AUTH } })
        )
      );
      assert.strictEqual(res.status, 200);
      const json = await readJson(res);
      const row = await prisma.pushSubscription.findUnique({ where: { endpoint } });
      assert.ok(row, 'Phải tạo đăng ký');
      assert.deepStrictEqual(json, { success: true, subscriptionId: row.id });
      assert.strictEqual(row.userId, prefsUser.id);
      assert.strictEqual(row.status, 'ACTIVE');

      const stored = await storedPreferences(prefsUser.id);
      assert.deepStrictEqual(stored?.pushPreferences, preferences);
      assert.deepStrictEqual(stored?.completedSteps, ['welcome']);
    });
  });

  // ===========================================================================
  // POST: đăng ký với payload biến thể / sai
  // ===========================================================================
  describe('POST /api/notifications/push: payload đăng ký', () => {
    let subUser: FixtureUser;
    let disabledUser: FixtureUser;

    before(async () => {
      subUser = await createUser('sub');
      disabledUser = await createUser('disabled', { isActive: false });
    });

    test('p256dh/auth ở cấp gốc, platform thay deviceType, userAgent lấy từ header', async () => {
      const endpoint = endpointFor('top-level-keys');
      const res = await pushPostRoute(
        request(
          'POST',
          bearerJson(
            subUser.token,
            { endpoint, p256dh: P256DH, auth: AUTH, platform: 'ios' },
            { 'User-Agent': `QCET-Test-UA/${runId}` }
          )
        )
      );
      assert.strictEqual(res.status, 200);
      const json = await readJson(res);
      const row = await prisma.pushSubscription.findUnique({ where: { endpoint } });
      assert.ok(row);
      assert.deepStrictEqual(json, { success: true, subscriptionId: row.id });
      assert.strictEqual(row.userId, subUser.id);
      assert.strictEqual(row.p256dh, P256DH);
      assert.strictEqual(row.auth, AUTH);
      assert.strictEqual(row.deviceType, 'ios');
      assert.strictEqual(row.userAgent, `QCET-Test-UA/${runId}`);
      assert.strictEqual(row.status, 'ACTIVE');
    });

    test('endpoint dài hơn 1024 ký tự: 400 VALIDATION_ERROR, không ghi', async () => {
      const endpoint = endpointFor(`long-${'a'.repeat(1100)}`);
      const res = await pushPostRoute(
        request('POST', bearerJson(subUser.token, { endpoint, keys: { p256dh: P256DH, auth: AUTH } }))
      );
      const json = await assertError(res, 400, 'VALIDATION_ERROR');
      assert.ok(json.fieldErrors?.endpoint, 'Phải báo lỗi ở endpoint');
      assert.strictEqual(await prisma.pushSubscription.count({ where: { endpoint } }), 0);
    });

    test('keys.p256dh dài hơn 255 ký tự: 400 VALIDATION_ERROR, không ghi', async () => {
      const endpoint = endpointFor('long-p256dh');
      const res = await pushPostRoute(
        request(
          'POST',
          bearerJson(subUser.token, { endpoint, keys: { p256dh: 'k'.repeat(300), auth: AUTH } })
        )
      );
      const json = await assertError(res, 400, 'VALIDATION_ERROR');
      assert.ok(json.fieldErrors?.['keys.p256dh'], 'Phải báo lỗi ở keys.p256dh');
      assert.strictEqual(await prisma.pushSubscription.count({ where: { endpoint } }), 0);
    });

    test('JSON hỏng: 400 "Invalid JSON body", không ghi', async () => {
      const endpoint = endpointFor('malformed-json');
      const res = await pushPostRoute(
        request('POST', bearerJson(subUser.token, `{"endpoint":"${endpoint}",`))
      );
      const json = await assertError(res, 400, 'VALIDATION_ERROR');
      assert.strictEqual(json.error, 'Invalid JSON body');
      assert.strictEqual(await prisma.pushSubscription.count({ where: { endpoint } }), 0);
    });

    test('Content-Type không phải JSON: 415 UNSUPPORTED_MEDIA_TYPE, không ghi', async () => {
      const endpoint = endpointFor('text-plain');
      const res = await pushPostRoute(
        request('POST', {
          headers: { 'Content-Type': 'text/plain', Authorization: `Bearer ${subUser.token}` },
          body: JSON.stringify({ endpoint, keys: { p256dh: P256DH, auth: AUTH } }),
        })
      );
      await assertError(res, 415, 'UNSUPPORTED_MEDIA_TYPE');
      assert.strictEqual(await prisma.pushSubscription.count({ where: { endpoint } }), 0);
    });

    test('tài khoản bị vô hiệu hóa: 401 ACCOUNT_DISABLED, không ghi', async () => {
      const endpoint = endpointFor('disabled-account');
      const res = await pushPostRoute(
        request('POST', bearerJson(disabledUser.token, { endpoint, keys: { p256dh: P256DH, auth: AUTH } }))
      );
      const json = await assertError(res, 401, 'ACCOUNT_DISABLED');
      assert.ok(!('subscriptionId' in json));
      assert.strictEqual(await prisma.pushSubscription.count({ where: { endpoint } }), 0);
    });
  });

  // ===========================================================================
  // DELETE: theo endpoint và thu hồi tất cả của chính mình
  // ===========================================================================
  describe('DELETE /api/notifications/push', () => {
    let revokeUser: FixtureUser;
    const ownEndpoints: string[] = [];

    before(async () => {
      revokeUser = await createUser('revoke');
      for (const suffix of ['revoke-a', 'revoke-b', 'revoke-c']) {
        ownEndpoints.push((await seedSubscription(revokeUser.id, suffix)).endpoint);
      }
    });

    async function resetOwnRows() {
      await prisma.pushSubscription.updateMany({
        where: { endpoint: { in: ownEndpoints } },
        data: { status: 'ACTIVE', disabledAt: null },
      });
    }

    async function assertBystanderUntouched() {
      const row = await prisma.pushSubscription.findUnique({ where: { endpoint: bystanderEndpoint } });
      assert.strictEqual(row?.userId, bystander.id);
      assert.strictEqual(row?.status, 'ACTIVE');
      assert.strictEqual(row?.disabledAt, null);
    }

    async function assertOwnRowsActive() {
      const rows = await prisma.pushSubscription.findMany({ where: { endpoint: { in: ownEndpoints } } });
      assert.strictEqual(rows.length, ownEndpoints.length);
      for (const row of rows) {
        assert.strictEqual(row.status, 'ACTIVE', row.endpoint);
        assert.strictEqual(row.disabledAt, null, row.endpoint);
      }
    }

    async function assertOwnRowsRevoked(since: number) {
      const rows = await prisma.pushSubscription.findMany({ where: { endpoint: { in: ownEndpoints } } });
      assert.strictEqual(rows.length, ownEndpoints.length);
      for (const row of rows) {
        assert.strictEqual(row.userId, revokeUser.id);
        assert.strictEqual(row.status, 'REVOKED', row.endpoint);
        assert.ok(row.disabledAt instanceof Date && row.disabledAt.getTime() >= since, row.endpoint);
      }
    }

    async function assertRevokeSuccess(res: Response) {
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(await readJson(res), {
        success: true,
        message: 'Push subscription revoked successfully',
      });
    }

    test('theo endpoint của mình: chỉ đăng ký đó REVOKED, đăng ký khác giữ ACTIVE', async () => {
      await resetOwnRows();
      const since = Date.now();
      const [target, ...others] = ownEndpoints;
      await assertRevokeSuccess(
        await pushDeleteRoute(request('DELETE', bearerJson(revokeUser.token, { endpoint: target })))
      );

      const revoked = await prisma.pushSubscription.findUnique({ where: { endpoint: target } });
      assert.strictEqual(revoked?.status, 'REVOKED');
      assert.ok(revoked?.disabledAt instanceof Date && revoked.disabledAt.getTime() >= since);
      const rest = await prisma.pushSubscription.findMany({ where: { endpoint: { in: others } } });
      assert.deepStrictEqual(
        rest.map((row) => [row.status, row.disabledAt]),
        others.map(() => ['ACTIVE', null])
      );
      await assertBystanderUntouched();
    });

    test('endpoint sai kiểu: 400 VALIDATION_ERROR, không thu hồi gì', async () => {
      await resetOwnRows();
      const res = await pushDeleteRoute(request('DELETE', bearerJson(revokeUser.token, { endpoint: 12345 })));
      const json = await assertError(res, 400, 'VALIDATION_ERROR');
      assert.ok(json.fieldErrors?.endpoint, 'Phải báo lỗi ở endpoint');
      await assertOwnRowsActive();
      await assertBystanderUntouched();
    });

    test('JSON hỏng: 400 "Invalid JSON body", không rơi về thu hồi tất cả', async () => {
      await resetOwnRows();
      const res = await pushDeleteRoute(request('DELETE', bearerJson(revokeUser.token, '{"endpoint":')));
      const json = await assertError(res, 400, 'VALIDATION_ERROR');
      assert.strictEqual(json.error, 'Invalid JSON body');
      await assertOwnRowsActive();
    });

    test('Bearer token không hợp lệ: 401 SESSION_INVALID, không thu hồi gì', async () => {
      await resetOwnRows();
      const res = await pushDeleteRoute(request('DELETE', bearerJson('not-a-valid-token')));
      await assertError(res, 401, 'SESSION_INVALID');
      await assertOwnRowsActive();
      await assertBystanderUntouched();
    });

    test('cookie phiên không kèm Origin/Referer: 403 CSRF_VALIDATION_FAILED, không thu hồi gì', async () => {
      await resetOwnRows();
      const res = await pushDeleteRoute(
        request('DELETE', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${revokeUser.token}` } })
      );
      await assertError(res, 403, 'CSRF_VALIDATION_FAILED');
      await assertOwnRowsActive();
    });

    test('không có body: thu hồi tất cả đăng ký của chính mình, không đụng đăng ký người khác', async () => {
      await resetOwnRows();
      const since = Date.now();
      await assertRevokeSuccess(
        await pushDeleteRoute(request('DELETE', { headers: { Authorization: `Bearer ${revokeUser.token}` } }))
      );
      await assertOwnRowsRevoked(since);
      await assertBystanderUntouched();

      const ownStatus = await readJson(
        await pushGetRoute(request('GET', { headers: { Authorization: `Bearer ${revokeUser.token}` } }))
      );
      assert.strictEqual(ownStatus.subscriptionsCount, 0);
      const bystanderStatus = await readJson(
        await pushGetRoute(request('GET', { headers: { Authorization: `Bearer ${bystander.token}` } }))
      );
      assert.strictEqual(bystanderStatus.subscriptionsCount, 1);
    });

    test('body {} qua cookie cùng Origin: thu hồi tất cả của chính mình', async () => {
      await resetOwnRows();
      const since = Date.now();
      await assertRevokeSuccess(
        await pushDeleteRoute(
          request('DELETE', {
            headers: {
              'Content-Type': 'application/json',
              Origin: 'http://localhost:3000',
              Cookie: `${SESSION_COOKIE_NAME}=${revokeUser.token}`,
            },
            body: '{}',
          })
        )
      );
      await assertOwnRowsRevoked(since);
      await assertBystanderUntouched();
    });

    test('endpoint null: thu hồi tất cả của chính mình', async () => {
      await resetOwnRows();
      const since = Date.now();
      await assertRevokeSuccess(
        await pushDeleteRoute(request('DELETE', bearerJson(revokeUser.token, { endpoint: null })))
      );
      await assertOwnRowsRevoked(since);
      await assertBystanderUntouched();
    });
  });
});
