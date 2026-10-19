/**
 * Lưu trữ thông báo như Notion: rời Hộp thư và đánh dấu đã đọc, xem lại ở bộ lọc "Đã lưu trữ", bỏ lưu trữ đưa về Hộp thư;
 * chỉ đụng thông báo của chính người gọi; số chưa đọc của nút Hộp thư không tính thông báo đã lưu trữ.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

if (!process.env.QCET_ALLOW_DB_TESTS) {
  process.env.QCET_ALLOW_DB_TESTS = '1';
}
if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
  (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
}
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('_test')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\/qcet_eoffice(\?.*)?$/, '/qcet_test$1');
}

import { NextRequest } from 'next/server';
import { prisma } from '@qcet/db/prisma';
import { signSessionToken } from '@/lib/jwt-session';
import { GET as listRoute } from '@/app/api/notifications/route';
import { POST as archiveRoute } from '@/app/api/notifications/archive/route';
import { NotificationArchiveSchema, NotificationQuerySchema } from '@qcet/contracts/notifications';
import {
  archiveNotifications,
  countUnreadNotifications,
  listNotificationsForUser,
} from '@/server/notifications/notification-inbox-service';

const runId = crypto.randomBytes(4).toString('hex');
const users: Record<'me' | 'other', string> = { me: '', other: '' };
const READ_AT = new Date('2026-10-01T03:00:00.000Z');

async function seed(userId: string, key: string, isRead: boolean) {
  const row = await prisma.notification.create({
    data: {
      userId,
      title: `Thông báo ${key}`,
      body: '',
      type: 'assigned',
      linkHref: `/tasks/${key}`,
      isRead,
      readAt: isRead ? READ_AT : null,
    },
  });
  return row.id;
}

const list = (userId: string, query: Record<string, string> = {}) => listNotificationsForUser(userId, NotificationQuerySchema.parse(query));

describe('Lưu trữ thông báo', () => {
  let unread = '';
  let read = '';
  let othersId = '';

  before(async () => {
    for (const key of ['me', 'other'] as const) {
      users[key] = (
        await prisma.user.create({
          data: { email: `arc_${runId}_${key}@cdktcnqn.edu.vn`, name: `Người ${key} ${runId}`, role: 'CHUYEN_VIEN', isActive: true },
          select: { id: true },
        })
      ).id;
    }
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany({ where: { userId: { in: Object.values(users) } } });
    unread = await seed(users.me, 'a', false);
    read = await seed(users.me, 'b', true);
    othersId = await seed(users.other, 'c', false);
  });

  after(async () => {
    const ids = Object.values(users).filter(Boolean);
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it('lưu trữ theo mã: rời Hộp thư, đã đọc, readAt cũ được giữ; số chưa đọc giảm', async () => {
    assert.equal(await countUnreadNotifications(users.me), 1);
    assert.equal(await archiveNotifications(users.me, { ids: [unread, read], archived: true }), 2);

    const rows = await prisma.notification.findMany({ where: { id: { in: [unread, read] } } });
    for (const row of rows) {
      assert.ok(row.archivedAt, 'đã có archivedAt');
      assert.equal(row.isRead, true);
    }
    assert.equal(rows.find((row) => row.id === read)?.readAt?.toISOString(), READ_AT.toISOString(), 'readAt của thư đã đọc không bị ghi đè');
    assert.ok(rows.find((row) => row.id === unread)?.readAt, 'thư chưa đọc được ghi readAt');

    const inbox = await list(users.me);
    assert.equal(inbox.notifications.length, 0);
    assert.equal(inbox.unreadCount, 0);
    const archived = await list(users.me, { archived: 'true' });
    assert.deepEqual(archived.notifications.map((n) => n.id).sort(), [unread, read].sort());
  });

  it('bỏ lưu trữ chỉ đưa về Hộp thư, không đổi trạng thái đọc', async () => {
    await archiveNotifications(users.me, { ids: [unread], archived: true });
    assert.equal(await archiveNotifications(users.me, { ids: [unread], archived: false }), 1);
    const row = await prisma.notification.findUniqueOrThrow({ where: { id: unread } });
    assert.equal(row.archivedAt, null);
    assert.equal(row.isRead, true);
    assert.deepEqual((await list(users.me)).notifications.map((n) => n.id).sort(), [unread, read].sort());
  });

  it('lưu trữ thư đã đọc bỏ qua thư chưa đọc; lưu trữ tất cả lấy hết', async () => {
    assert.equal(await archiveNotifications(users.me, { scope: 'read' }), 1);
    assert.deepEqual((await list(users.me)).notifications.map((n) => n.id), [unread]);
    assert.equal(await archiveNotifications(users.me, { scope: 'all' }), 1);
    assert.equal((await list(users.me)).notifications.length, 0);
    assert.equal(await countUnreadNotifications(users.me), 0);
  });

  it('mã của người khác không bị đụng tới (đếm 0), kể cả lưu trữ tất cả', async () => {
    assert.equal(await archiveNotifications(users.me, { ids: [othersId], archived: true }), 0);
    await archiveNotifications(users.me, { scope: 'all' });
    const other = await prisma.notification.findUniqueOrThrow({ where: { id: othersId } });
    assert.equal(other.archivedAt, null);
    assert.equal(other.isRead, false);
    assert.equal(await countUnreadNotifications(users.other), 1);
  });

  it('thông báo đã lưu trữ mà bị đánh dấu chưa đọc vẫn không tính vào nút Hộp thư', async () => {
    await archiveNotifications(users.me, { ids: [unread], archived: true });
    await prisma.notification.update({ where: { id: unread }, data: { isRead: false, readAt: null } });
    assert.equal(await countUnreadNotifications(users.me), 0);
  });

  it('route: POST /archive lưu trữ của chính người gọi, GET ?archived=true trả đúng thông báo đã lưu trữ', async () => {
    const token = signSessionToken({ id: users.me, email: `arc_${runId}_me@cdktcnqn.edu.vn`, name: `Người me ${runId}`, role: 'CHUYEN_VIEN' });
    const auth = { Authorization: `Bearer ${token}` };
    const post = await archiveRoute(
      new NextRequest('http://localhost:3000/api/notifications/archive', {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [unread, othersId], archived: true }),
      })
    );
    assert.equal(post.status, 200);
    assert.deepEqual(await post.json(), { count: 1, unreadCount: 0 });

    const archived = await (await listRoute(new NextRequest('http://localhost:3000/api/notifications?archived=true', { headers: auth }))).json();
    assert.deepEqual(archived.notifications.map((n: { id: string }) => n.id), [unread]);
    assert.ok(archived.notifications[0].archivedAt, 'DTO có archivedAt');
    const inbox = await (await listRoute(new NextRequest('http://localhost:3000/api/notifications', { headers: auth }))).json();
    assert.deepEqual(inbox.notifications.map((n: { id: string }) => n.id), [read]);

    const bad = await archiveRoute(
      new NextRequest('http://localhost:3000/api/notifications/archive', {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'unread' }),
      })
    );
    assert.equal(bad.status, 400);
    const anonymous = await archiveRoute(
      new NextRequest('http://localhost:3000/api/notifications/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'all' }),
      })
    );
    assert.equal(anonymous.status, 401);
  });

  it('hợp đồng: đúng một dạng thân, giới hạn 100 mã', () => {
    assert.ok(NotificationArchiveSchema.safeParse({ ids: ['a'], archived: true }).success);
    assert.ok(NotificationArchiveSchema.safeParse({ scope: 'read' }).success);
    assert.equal(NotificationArchiveSchema.safeParse({ ids: [], archived: true }).success, false);
    assert.equal(NotificationArchiveSchema.safeParse({ ids: Array.from({ length: 101 }, (_, i) => `n${i}`), archived: true }).success, false);
    assert.equal(NotificationArchiveSchema.safeParse({ scope: 'unread' }).success, false);
    assert.equal(NotificationArchiveSchema.safeParse({ ids: ['a'], archived: true, scope: 'all' }).success, false);
  });
});
