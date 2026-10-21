/**
 * Ghi chú cá nhân: riêng tư tuyệt đối theo chủ nhân (không có đường xem/sửa/xóa của người khác), tìm kiếm trong ghi chú của
 * mình, ghim lên đầu, gắn cuộc họp chỉ khi đọc được cuộc họp đó.
 */
import { describe, it, before, after } from 'node:test';
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
import { GET as listRoute, POST as createRoute } from '@/app/api/notes/route';
import { GET as getRoute, PATCH as patchRoute, DELETE as deleteRoute } from '@/app/api/notes/[id]/route';
import {
  CreatePersonalNoteSchema,
  ListPersonalNotesQuerySchema,
  UpdatePersonalNoteSchema,
  PERSONAL_NOTE_CONTENT_MAX,
} from '@qcet/contracts/personal-notes';
import {
  createPersonalNote,
  deletePersonalNote,
  getPersonalNote,
  listPersonalNotes,
  updatePersonalNote,
} from '@/server/notes/personal-notes-service';

const runId = crypto.randomBytes(4).toString('hex');
const users: Record<'me' | 'other', string> = { me: '', other: '' };
let meetingId = '';
const list = (userId: string, query: Record<string, string> = {}) => listPersonalNotes(userId, ListPersonalNotesQuerySchema.parse(query));
const create = (userId: string, input: Record<string, unknown> = {}) => createPersonalNote(userId, CreatePersonalNoteSchema.parse(input));

function bearer(key: 'me' | 'other') {
  const token = signSessionToken({ id: users[key], email: `note_${runId}_${key}@cdktcnqn.edu.vn`, name: `Người ${key} ${runId}`, role: 'CHUYEN_VIEN' });
  return { Authorization: `Bearer ${token}` };
}
const json = (headers: Record<string, string>, body: unknown, method = 'POST', path = '/api/notes') =>
  new NextRequest(`http://localhost:3000${path}`, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const ctxOf = (id: string) => ({ params: Promise.resolve({ id }) });

describe('Ghi chú cá nhân', () => {
  before(async () => {
    for (const key of ['me', 'other'] as const) {
      users[key] = (
        await prisma.user.create({
          data: { email: `note_${runId}_${key}@cdktcnqn.edu.vn`, name: `Người ${key} ${runId}`, role: 'CHUYEN_VIEN', isActive: true },
          select: { id: true },
        })
      ).id;
    }
    meetingId = (
      await prisma.meeting.create({
        data: { title: `Họp ghi chú ${runId}`, organizerId: users.me, startTime: new Date('2026-11-01T02:00:00.000Z') },
        select: { id: true },
      })
    ).id;
  });

  after(async () => {
    const ids = Object.values(users).filter(Boolean);
    await prisma.personalNote.deleteMany({ where: { userId: { in: ids } } });
    await prisma.meeting.deleteMany({ where: { id: meetingId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it('tạo, đọc, sửa, xóa trọn vòng; danh sách chỉ trích đoạn đầu', async () => {
    const note = await create(users.me, { title: 'Việc cần nhớ', content: 'dòng một\n\n  dòng hai ' + 'x'.repeat(300) });
    assert.equal(note.pinned, false);
    assert.equal((await getPersonalNote(users.me, note.id)).content.startsWith('dòng một'), true);

    const { notes } = await list(users.me);
    const row = notes.find((n) => n.id === note.id)!;
    assert.equal(row.excerpt.length <= 160, true);
    assert.equal(row.excerpt.startsWith('dòng một dòng hai'), true, 'khoảng trắng gộp một');
    // Thẻ kiểu Google Keep (21/10/2026): đoạn đầu giữ xuống dòng, gộp dòng trống, tối đa 600 ký tự
    assert.equal(row.preview.startsWith('dòng một\n\n  dòng hai'), true, 'preview giữ xuống dòng');
    assert.equal(row.preview.length <= 600, true);
    assert.equal('content' in row, false, 'danh sách không chở nội dung đầy đủ');

    const updated = await updatePersonalNote(users.me, note.id, UpdatePersonalNoteSchema.parse({ title: 'Đã đổi', pinned: true }));
    assert.equal(updated.title, 'Đã đổi');
    assert.equal(updated.pinned, true);
    assert.equal(updated.content, note.content, 'trường không gửi giữ nguyên');

    assert.deepEqual(await deletePersonalNote(users.me, note.id), { id: note.id });
    await assert.rejects(getPersonalNote(users.me, note.id), /không tồn tại/);
  });

  it('riêng tư: người khác không thấy, không sửa, không xóa (404, ghi chú còn nguyên)', async () => {
    const note = await create(users.me, { title: 'Bí mật', content: 'chỉ mình tôi' });
    assert.equal((await list(users.other)).notes.some((n) => n.id === note.id), false);
    assert.equal((await list(users.other, { q: 'Bí mật' })).notes.length, 0);
    await assert.rejects(getPersonalNote(users.other, note.id), /không tồn tại/);
    await assert.rejects(updatePersonalNote(users.other, note.id, { title: 'chiếm' }), /không tồn tại/);
    await assert.rejects(deletePersonalNote(users.other, note.id), /không tồn tại/);
    const still = await prisma.personalNote.findUniqueOrThrow({ where: { id: note.id } });
    assert.equal(still.title, 'Bí mật');
    assert.equal(still.userId, users.me);
  });

  it('ghim lên đầu, tìm không phân biệt hoa thường trong tiêu đề và nội dung', async () => {
    await prisma.personalNote.deleteMany({ where: { userId: users.me } });
    const old = await create(users.me, { title: 'Cũ', content: 'Kiểm định chất lượng' });
    await new Promise((resolve) => setTimeout(resolve, 15));
    await create(users.me, { title: 'Mới', content: 'hội trường' });
    const pinned = await create(users.me, { title: 'Ghim', content: 'khác', pinned: true });

    const all = (await list(users.me)).notes.map((n) => n.id);
    assert.equal(all[0], pinned.id, 'ghim đứng đầu dù tạo sau cùng hoặc cũ hơn');
    assert.equal(all.length, 3);

    assert.deepEqual((await list(users.me, { q: 'KIỂM ĐỊNH' })).notes.map((n) => n.id), [old.id]);
    assert.equal((await list(users.me, { q: 'ghim' })).notes[0].id, pinned.id);
    assert.equal((await list(users.me, { limit: '2' })).hasMore, true);
  });

  it('nội dung soạn bằng editor khối: thẻ và dòng trích là chữ thật, tìm không khớp tên trường JSON', async () => {
    await prisma.personalNote.deleteMany({ where: { userId: users.me } });
    const content = JSON.stringify({
      qcetBlocks: true,
      version: 1,
      blocks: [
        { id: 'b1', type: 'heading', level: 2, content: 'Chuẩn bị họp' },
        { id: 'b2', type: 'bulleted_list', content: 'In tài liệu' },
        { id: 'b3', type: 'checklist', content: 'Đặt phòng', checked: true },
        { id: 'b4', type: 'checklist', content: 'Gửi giấy mời', checked: false },
      ],
    });
    const note = await create(users.me, { title: 'Khối', content });

    const row = (await list(users.me)).notes.find((n) => n.id === note.id)!;
    assert.equal(row.preview, 'Chuẩn bị họp\n• In tài liệu\n☑ Đặt phòng\n☐ Gửi giấy mời');
    assert.equal(row.excerpt, 'Chuẩn bị họp • In tài liệu ☑ Đặt phòng ☐ Gửi giấy mời');

    assert.deepEqual((await list(users.me, { q: 'giấy mời' })).notes.map((n) => n.id), [note.id]);
    assert.equal((await list(users.me, { q: 'qcetBlocks' })).notes.length, 0, 'tên trường JSON không phải chữ của ghi chú');
    assert.equal((await list(users.me, { q: 'checklist' })).notes.length, 0);
  });

  it('gắn cuộc họp: người tổ chức được, người không liên quan bị từ chối; gỡ liên kết bằng null', async () => {
    const linked = await create(users.me, { title: 'Ghi chú họp', entityType: 'meeting', entityId: meetingId });
    assert.equal(linked.entityId, meetingId);
    assert.deepEqual((await list(users.me, { entityType: 'meeting', entityId: meetingId })).notes.map((n) => n.id), [linked.id]);

    await assert.rejects(create(users.other, { title: 'dò', entityType: 'meeting', entityId: meetingId }), /không có quyền xem/);
    await assert.rejects(create(users.me, { title: 'ma', entityType: 'task', entityId: 'khong-ton-tai' }), /không có quyền xem/);

    const unlinked = await updatePersonalNote(users.me, linked.id, UpdatePersonalNoteSchema.parse({ entityType: null, entityId: null }));
    assert.equal(unlinked.entityType, null);
    assert.equal(unlinked.entityId, null);
  });

  it('hợp đồng: gắn đối tượng đủ cặp, không nhận trường lạ, sửa phải có gì đó, giới hạn độ dài', () => {
    assert.equal(CreatePersonalNoteSchema.safeParse({ entityType: 'meeting' }).success, false);
    assert.equal(CreatePersonalNoteSchema.safeParse({ entityId: 'x' }).success, false);
    assert.equal(CreatePersonalNoteSchema.safeParse({ entityType: 'document', entityId: 'x' }).success, false);
    assert.equal(CreatePersonalNoteSchema.safeParse({ userId: 'khac' }).success, false, 'không nhận userId từ client');
    assert.equal(CreatePersonalNoteSchema.safeParse({ content: 'x'.repeat(PERSONAL_NOTE_CONTENT_MAX + 1) }).success, false);
    assert.equal(CreatePersonalNoteSchema.safeParse({}).success, true, 'ghi chú trống được tạo để gõ tiếp');
    assert.equal(UpdatePersonalNoteSchema.safeParse({}).success, false);
    assert.equal(UpdatePersonalNoteSchema.safeParse({ entityType: null, entityId: null }).success, true);
  });

  it('route: cần đăng nhập, tạo/đọc/sửa/xóa của chính mình, người khác nhận 404, body sai nhận 400', async () => {
    const anonymous = await listRoute(new NextRequest('http://localhost:3000/api/notes'));
    assert.equal(anonymous.status, 401);
    assert.equal((await createRoute(json({}, { title: 'x' }))).status, 401);

    const created = await createRoute(json(bearer('me'), { title: 'Qua route', content: 'nội dung' }));
    assert.equal(created.status, 201);
    const id = (await created.json()).id as string;
    assert.ok(id, 'có mã ghi chú');

    const read = await getRoute(new NextRequest(`http://localhost:3000/api/notes/${id}`, { headers: bearer('me') }), ctxOf(id));
    assert.equal(read.status, 200);
    assert.equal(read.headers.get('cache-control'), 'private, no-store');

    const foreignRead = await getRoute(new NextRequest(`http://localhost:3000/api/notes/${id}`, { headers: bearer('other') }), ctxOf(id));
    assert.equal(foreignRead.status, 404);
    const foreignPatch = await patchRoute(json(bearer('other'), { title: 'chiếm' }, 'PATCH', `/api/notes/${id}`), ctxOf(id));
    assert.equal(foreignPatch.status, 404);
    const foreignDelete = await deleteRoute(new NextRequest(`http://localhost:3000/api/notes/${id}`, { method: 'DELETE', headers: bearer('other') }), ctxOf(id));
    assert.equal(foreignDelete.status, 404);

    const bad = await patchRoute(json(bearer('me'), {}, 'PATCH', `/api/notes/${id}`), ctxOf(id));
    assert.equal(bad.status, 400);
    const patched = await patchRoute(json(bearer('me'), { pinned: true }, 'PATCH', `/api/notes/${id}`), ctxOf(id));
    assert.equal(patched.status, 200);

    const listed = await listRoute(new NextRequest('http://localhost:3000/api/notes?q=Qua%20route', { headers: bearer('me') }));
    assert.equal(listed.status, 200);

    const removed = await deleteRoute(new NextRequest(`http://localhost:3000/api/notes/${id}`, { method: 'DELETE', headers: bearer('me') }), ctxOf(id));
    assert.equal(removed.status, 200);
    assert.equal(await prisma.personalNote.count({ where: { id } }), 0);
  });
});
