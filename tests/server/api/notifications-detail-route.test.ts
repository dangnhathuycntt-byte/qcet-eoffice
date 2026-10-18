import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import type { Notification } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signSessionToken } from '@/lib/jwt-session';
import { GET as getNotificationDetailRoute } from '@/app/api/notifications/[id]/route';

// Đặc tả GET /api/notifications/[id]: chỉ người nhận đọc được; thông báo của người khác
// trả 404 giống thông báo không tồn tại; route không đánh dấu đã đọc.
describe('GET /api/notifications/[id]', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdUserIds: string[] = [];
  const createdNotificationIds: string[] = [];

  type FixtureUser = { id: string; email: string; name: string; role: string };
  let owner: FixtureUser;
  let stranger: FixtureUser;
  let adminUser: FixtureUser;
  let disabledUser: FixtureUser;
  let ownerToken: string;
  let strangerToken: string;
  let adminToken: string;
  let disabledToken: string;

  let ownerUnread: Notification;
  let ownerRead: Notification;
  let strangerNotif: Notification;
  let disabledNotif: Notification;

  async function createUser(key: string, role: UserRole, isActive = true): Promise<FixtureUser> {
    const user = await prisma.user.create({
      data: {
        id: `ntf-detail-${key}-${runId}`,
        email: `ntf.detail.${key}.${runId}@qcet.edu.vn`,
        name: `Kiểm thử chi tiết thông báo ${key}`,
        role,
        isActive,
      },
    });
    createdUserIds.push(user.id);
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  async function createNotification(data: Parameters<typeof prisma.notification.create>[0]['data']) {
    const row = await prisma.notification.create({ data });
    createdNotificationIds.push(row.id);
    return row;
  }

  function tokenFor(user: FixtureUser) {
    return signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role });
  }

  function getDetail(id: string, headers: Record<string, string> = {}) {
    const req = new NextRequest(
      `http://localhost:3000/api/notifications/${encodeURIComponent(id)}`,
      { headers }
    );
    return getNotificationDetailRoute(req, { params: Promise.resolve({ id }) });
  }

  function bearer(token: string, extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${token}`, ...extra };
  }

  /** DTO kỳ vọng dựng từ bản ghi DB (message ← body, link ← linkHref, chuỗi rỗng → null). */
  function expectedDto(row: Notification) {
    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      message: row.body,
      type: row.type,
      link: row.linkHref,
      actorName: row.actorName && row.actorName.trim() ? row.actorName.trim() : null,
      category: row.category && row.category.trim() ? row.category.trim() : null,
      isRead: row.isRead,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async function assertNotFoundWithoutLeak(res: Response, leaked?: Notification) {
    assert.strictEqual(res.status, 404);
    assert.ok(res.headers.get('content-type')?.startsWith('application/json'));
    const raw = await res.text();
    const json = JSON.parse(raw);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.code, 'NOT_FOUND');
    assert.strictEqual(json.error, 'Không tìm thấy thông báo');
    assert.strictEqual(json.message, 'Không tìm thấy thông báo');
    assert.ok(!('notification' in json), 'Không được trả khóa notification');
    assert.ok(!('data' in json), 'Không được trả khóa data');
    if (leaked) {
      assert.ok(!raw.includes(leaked.title), 'Không được lộ tiêu đề thông báo của người khác');
      assert.ok(!raw.includes(leaked.body), 'Không được lộ nội dung thông báo của người khác');
      assert.ok(!raw.includes(leaked.linkHref), 'Không được lộ đường dẫn thông báo của người khác');
    }
    return json;
  }

  async function assertUnauthorized(res: Response, code: string) {
    assert.strictEqual(res.status, 401);
    assert.ok(res.headers.get('content-type')?.startsWith('application/json'));
    const raw = await res.text();
    const json = JSON.parse(raw);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.code, code);
    assert.ok(!('notification' in json));
    assert.ok(!('data' in json));
    return { json, raw };
  }

  before(async () => {
    owner = await createUser('owner', UserRole.CHUYEN_VIEN);
    stranger = await createUser('stranger', UserRole.CHUYEN_VIEN);
    adminUser = await createUser('admin', UserRole.ADMIN);
    disabledUser = await createUser('disabled', UserRole.CHUYEN_VIEN, false);

    ownerToken = tokenFor(owner);
    strangerToken = tokenFor(stranger);
    adminToken = tokenFor(adminUser);
    disabledToken = tokenFor(disabledUser);

    const day = 24 * 60 * 60 * 1000;
    ownerUnread = await createNotification({
      userId: owner.id,
      actorName: '  Phòng Đào tạo  ',
      title: `Thông báo chi tiết ${runId}`,
      body: `Nội dung riêng của chủ sở hữu ${runId}`,
      category: 'task',
      type: 'TASK_ASSIGNED',
      linkHref: `/?zone=tasks&taskId=detail-${runId}`,
      isRead: false,
      createdAt: new Date(Date.now() - 2 * day),
    });
    ownerRead = await createNotification({
      userId: owner.id,
      actorName: null,
      title: `Thông báo đã đọc ${runId}`,
      body: `Nội dung đã đọc ${runId}`,
      category: '',
      type: 'DEADLINE_REMINDER',
      linkHref: `/?zone=tasks&taskId=read-${runId}`,
      isRead: true,
      readAt: new Date(Date.now() - day),
      createdAt: new Date(Date.now() - 3 * day),
    });
    strangerNotif = await createNotification({
      userId: stranger.id,
      actorName: 'Ban Giám hiệu',
      title: `Bí mật của người khác ${runId}`,
      body: `Nội dung không được lộ ${runId}`,
      category: 'directive',
      type: 'DOCUMENT_DIRECTIVE',
      linkHref: `/?zone=documents&documentId=secret-${runId}`,
      isRead: false,
    });
    disabledNotif = await createNotification({
      userId: disabledUser.id,
      title: `Thông báo của tài khoản bị khóa ${runId}`,
      body: `Nội dung tài khoản bị khóa ${runId}`,
      category: 'task',
      type: 'TASK_ASSIGNED',
      linkHref: `/?zone=tasks&taskId=disabled-${runId}`,
      isRead: false,
    });
  });

  after(async () => {
    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({ where: { id: { in: createdNotificationIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.auditEvent.deleteMany({ where: { actorId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  test('không có thông tin đăng nhập: 401 AUTH_REQUIRED, không trả dữ liệu', async () => {
    const res = await getDetail(ownerUnread.id);
    const { json, raw } = await assertUnauthorized(res, 'AUTH_REQUIRED');
    assert.strictEqual(json.error, 'Unauthorized: Authentication required');
    assert.ok(!raw.includes(ownerUnread.title));
  });

  test('Bearer token không hợp lệ: 401 SESSION_INVALID, không trả dữ liệu', async () => {
    const res = await getDetail(ownerUnread.id, bearer('not-a-valid-session-token'));
    const { raw } = await assertUnauthorized(res, 'SESSION_INVALID');
    assert.ok(!raw.includes(ownerUnread.title));
  });

  test('tài khoản bị vô hiệu hóa đọc chính thông báo của mình: 401 ACCOUNT_DISABLED', async () => {
    const res = await getDetail(disabledNotif.id, bearer(disabledToken));
    const { raw } = await assertUnauthorized(res, 'ACCOUNT_DISABLED');
    assert.ok(!raw.includes(disabledNotif.title));
  });

  test('người nhận đọc thông báo chưa đọc: 200, đúng DTO, no-store, không tự đánh dấu đã đọc', async () => {
    const res = await getDetail(ownerUnread.id, bearer(ownerToken, { 'x-request-id': `req-${runId}` }));
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type')?.startsWith('application/json'));
    assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
    assert.strictEqual(res.headers.get('x-request-id'), `req-${runId}`);

    const json = await res.json();
    const dto = expectedDto(ownerUnread);
    assert.strictEqual(dto.actorName, 'Phòng Đào tạo', 'actorName được cắt khoảng trắng');
    assert.deepStrictEqual(json, { success: true, notification: dto, data: dto });
    assert.ok(!('body' in json.notification) && !('linkHref' in json.notification));

    const stored = await prisma.notification.findUnique({ where: { id: ownerUnread.id } });
    assert.strictEqual(stored?.isRead, false, 'GET chi tiết không được đánh dấu đã đọc');
    assert.strictEqual(stored?.readAt, null);
  });

  test('người nhận đọc thông báo đã đọc: readAt dạng ISO, category rỗng thành null', async () => {
    const res = await getDetail(ownerRead.id, bearer(ownerToken));
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    const dto = expectedDto(ownerRead);
    assert.strictEqual(dto.category, null);
    assert.strictEqual(dto.actorName, null);
    assert.strictEqual(dto.isRead, true);
    assert.strictEqual(typeof dto.readAt, 'string');
    assert.deepStrictEqual(json, { success: true, notification: dto, data: dto });
  });

  test('id có khoảng trắng hai đầu được cắt trước khi tra: 200 đúng thông báo', async () => {
    const res = await getDetail(`  ${ownerUnread.id}  `, bearer(ownerToken));
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.notification.id, ownerUnread.id);
    assert.strictEqual(json.data.title, ownerUnread.title);
  });

  test('người dùng khác đọc thông báo không phải của mình: 404 NOT_FOUND, không lộ nội dung', async () => {
    const res = await getDetail(strangerNotif.id, bearer(ownerToken));
    await assertNotFoundWithoutLeak(res, strangerNotif);

    const untouched = await prisma.notification.findUnique({ where: { id: strangerNotif.id } });
    assert.strictEqual(untouched?.isRead, false);
  });

  test('vai trò ADMIN cũng không đọc được thông báo của người khác: 404 NOT_FOUND', async () => {
    const res = await getDetail(ownerUnread.id, bearer(adminToken));
    await assertNotFoundWithoutLeak(res, ownerUnread);
  });

  test('id không tồn tại: 404 cùng mã và thông điệp với thông báo của người khác', async () => {
    const missing = await assertNotFoundWithoutLeak(
      await getDetail(`missing-${runId}`, bearer(strangerToken))
    );
    const foreign = await assertNotFoundWithoutLeak(
      await getDetail(ownerUnread.id, bearer(strangerToken)),
      ownerUnread
    );
    const strip = ({ requestId: _ignored, ...rest }: Record<string, unknown>) => rest;
    assert.deepStrictEqual(strip(foreign), strip(missing), 'Không phân biệt được tồn tại hay không');
  });
});
