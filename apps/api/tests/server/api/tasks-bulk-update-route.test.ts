/**
 * Đặc tả mức route cho POST /api/tasks/actions/bulk-update (T-08, đổi ưu tiên hàng loạt).
 *
 * Khóa hành vi hiện có: thứ tự rào chắn (CSRF → Content-Type → kích thước → xác thực → rate limit
 * → Idempotency-Key → validate), lỗi dạng RFC 9457 (application/problem+json), kết quả từng dòng
 * (một dòng bị từ chối không làm hỏng cả lô), OCC theo `expectedVersion`, idempotency theo người dùng.
 * Phần dịch vụ đã có tests/task-bulk-update.test.ts; file này chỉ phủ phần route.
 *
 * Chạy trên qcet_test; mọi bản ghi mang runId riêng và được dọn theo id trong after().
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { Prisma, TaskActorRole, TaskPriority, TaskStatus, UserRole } from '@prisma/client';
import { prisma } from '@qcet/db/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { getAcademicMonthInfo } from '@qcet/shared/lib/academic-calendar';
import { resetRateLimits } from '@/server/security/rate-limit';
import { DEFAULT_ERROR_URI_BASE } from '@/server/api/problem-details';
import { POST as bulkUpdate } from '@/app/api/tasks/actions/bulk-update/route';

const runId = `t08r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ROUTE_PATH = '/api/tasks/actions/bulk-update';
const URL_BASE = `http://localhost:3000${ROUTE_PATH}`;
const OPERATION = 'task.bulk-update-priority';
const DAY = 24 * 60 * 60 * 1000;

type UserKey =
  | 'creator'
  | 'dri'
  | 'otherDri'
  | 'observer'
  | 'stranger'
  | 'inactive'
  | 'validator'
  | 'rate';
type TaskKey = 'a' | 'b' | 'foreign' | 'observed' | 'completed' | 'archived' | 'idem' | 'cookie' | 'xkey';

const users = {} as Record<UserKey, { id: string; email: string; name: string; role: UserRole }>;
const tokens = {} as Record<UserKey, string>;
const tasks = {} as Record<TaskKey, string>;

let keySeq = 0;
const newKey = () => `${runId}-k${++keySeq}`;

interface CallOptions {
  token?: string | null;
  cookieToken?: string;
  key?: string | null;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
}

function makeRequest(opts: CallOptions): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.cookieToken) headers.cookie = `${SESSION_COOKIE_NAME}=${opts.cookieToken}`;
  if (opts.key !== null) headers['idempotency-key'] = opts.key ?? newKey();
  Object.assign(headers, opts.headers);
  for (const [name, value] of Object.entries(headers)) {
    if (value === '') delete headers[name];
  }
  const body = opts.rawBody !== undefined ? opts.rawBody : JSON.stringify(opts.body ?? {});
  return new NextRequest(URL_BASE, { method: 'POST', headers, body });
}

const call = (opts: CallOptions) => bulkUpdate(makeRequest(opts));

async function snapshot(key: TaskKey) {
  return prisma.task.findUniqueOrThrow({
    where: { id: tasks[key] },
    select: { priority: true, version: true, status: true, dueDate: true, archivedAt: true },
  });
}

async function item(key: TaskKey) {
  const { version } = await snapshot(key);
  return { id: tasks[key], expectedVersion: version };
}

const auditCount = (key: TaskKey) =>
  prisma.auditEvent.count({ where: { entityId: tasks[key], action: 'TASK_UPDATED' } });

/** Sự kiện RATE_LIMIT_EXCEEDED không có actorId; định danh người dùng nằm ở metadata.identifier. */
const rateLimitAuditWhere = (): Prisma.AuditEventWhereInput => ({
  action: 'RATE_LIMIT_EXCEEDED',
  metadata: { path: ['identifier'], equals: users.rate.id },
});

const idempotencyRecord = (userKey: UserKey, key: string) =>
  prisma.idempotencyRecord.findUnique({
    where: { userId_operation_key: { userId: users[userKey].id, operation: OPERATION, key } },
  });

/** Lỗi của route này luôn là RFC 9457; không được mang dữ liệu kết quả. */
async function expectProblem(res: Response, status: number, code: string) {
  assert.equal(res.status, status);
  assert.match(res.headers.get('content-type') ?? '', /^application\/problem\+json/);
  assert.ok(res.headers.get('x-request-id'), 'phải có x-request-id');
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.status, status);
  assert.equal(body.code, code);
  assert.equal(body.type, `${DEFAULT_ERROR_URI_BASE}/${code.toLowerCase().replace(/_/g, '-')}`);
  assert.equal(body.instance, ROUTE_PATH);
  assert.equal(typeof body.requestId, 'string');
  assert.equal(body.data, undefined, 'lỗi không được kèm data');
  assert.equal(body.results, undefined, 'lỗi không được kèm kết quả từng dòng');
  return body;
}

async function expectSuccess(res: Response) {
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /^application\/json/);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(body.data && Array.isArray(body.data.results), 'phải có data.results');
  return body.data as {
    total: number;
    succeeded: number;
    failed: number;
    results: Array<Record<string, unknown>>;
  };
}

async function createUser(key: UserKey, isActive = true) {
  const user = await prisma.user.create({
    data: {
      email: `${runId}_${key}@cdktcnqn.edu.vn`.toLowerCase(),
      name: `${runId} ${key}`,
      role: UserRole.CHUYEN_VIEN,
      isActive,
    },
    select: { id: true, email: true, name: true, role: true },
  });
  users[key] = user;
  tokens[key] = signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role });
}

async function createTask(
  key: TaskKey,
  opts: {
    driKey?: UserKey;
    observerKey?: UserKey;
    status?: TaskStatus;
    archived?: boolean;
  } = {}
) {
  const now = Date.now();
  const startDate = new Date(now - 1 * DAY);
  const dueDate = new Date(now + 7 * DAY);
  const period = getAcademicMonthInfo(dueDate);
  const status = opts.status ?? TaskStatus.IN_PROGRESS;
  const completed = status === TaskStatus.COMPLETED;
  const actors: Array<{ userId: string; role: TaskActorRole; isPrimaryDRI?: boolean }> = [
    { userId: users[opts.driKey ?? 'dri'].id, role: TaskActorRole.DRI, isPrimaryDRI: true },
  ];
  if (opts.observerKey) actors.push({ userId: users[opts.observerKey].id, role: TaskActorRole.OBSERVER });

  const task = await prisma.task.create({
    data: {
      code: `${runId}_${key}`.slice(0, 50),
      title: `Nhiệm vụ đổi hàng loạt ${key} ${runId}`,
      academicMonth: period.monthNumber,
      academicYear: period.academicYear,
      startDate,
      dueDate,
      createdById: users.creator.id,
      priority: TaskPriority.NORMAL,
      status,
      progressPercent: completed ? 100 : 0,
      completedAt: completed ? new Date(now) : null,
      archivedAt: opts.archived ? new Date(now) : null,
      actors: { create: actors },
    },
    select: { id: true },
  });
  tasks[key] = task.id;
}

describe('POST /api/tasks/actions/bulk-update (route)', () => {
  before(async () => {
    console.log(`[tasks-bulk-update-route] runId=${runId}`);
    resetRateLimits();

    for (const key of ['creator', 'dri', 'otherDri', 'observer', 'stranger', 'validator', 'rate'] as UserKey[]) {
      await createUser(key);
    }
    await createUser('inactive', false);

    await createTask('a');
    await createTask('b');
    await createTask('foreign', { driKey: 'otherDri' });
    await createTask('observed', { driKey: 'otherDri', observerKey: 'observer' });
    await createTask('completed', { status: TaskStatus.COMPLETED });
    await createTask('archived', { archived: true });
    await createTask('idem');
    await createTask('cookie');
    await createTask('xkey');
  });

  after(async () => {
    const userIds = Object.values(users).map((u) => u.id);
    const taskIds = Object.values(tasks);
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: taskIds } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: taskIds } } });
    if (users.rate) await prisma.auditEvent.deleteMany({ where: rateLimitAuditWhere() });
    if (userIds.length > 0) {
      await prisma.auditEvent.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.idempotencyRecord.deleteMany({ where: { userId: { in: userIds } } });
    }
    await prisma.taskActor.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    resetRateLimits();
  });

  describe('xác thực', () => {
    test('không có token: 401 AUTH_REQUIRED, không ghi idempotency, nhiệm vụ không đổi', async () => {
      const before = await snapshot('a');
      const key = newKey();
      const res = await call({
        token: null,
        key,
        body: { items: [{ id: tasks.a, expectedVersion: before.version }], priority: TaskPriority.URGENT },
      });
      await expectProblem(res, 401, 'AUTH_REQUIRED');
      assert.deepEqual(await snapshot('a'), before);
      const anyRecord = await prisma.idempotencyRecord.findFirst({ where: { key } });
      assert.equal(anyRecord, null);
    });

    test('token không hợp lệ: 401 SESSION_INVALID', async () => {
      const before = await snapshot('a');
      const res = await call({
        token: 'khong-phai-token-hop-le',
        body: { items: [{ id: tasks.a, expectedVersion: before.version }], priority: TaskPriority.URGENT },
      });
      await expectProblem(res, 401, 'SESSION_INVALID');
      assert.deepEqual(await snapshot('a'), before);
    });

    test('tài khoản đã khóa (token còn hạn): 401 ACCOUNT_DISABLED', async () => {
      const before = await snapshot('a');
      const res = await call({
        token: tokens.inactive,
        body: { items: [{ id: tasks.a, expectedVersion: before.version }], priority: TaskPriority.URGENT },
      });
      await expectProblem(res, 401, 'ACCOUNT_DISABLED');
      assert.deepEqual(await snapshot('a'), before);
    });
  });

  describe('CSRF, Content-Type, kích thước', () => {
    test('cookie phiên không kèm Origin/Referer: 403 CSRF_VALIDATION_FAILED, nhiệm vụ không đổi', async () => {
      const before = await snapshot('cookie');
      const res = await call({
        token: null,
        cookieToken: tokens.dri,
        body: { items: [{ id: tasks.cookie, expectedVersion: before.version }], priority: TaskPriority.HIGH },
      });
      await expectProblem(res, 403, 'CSRF_VALIDATION_FAILED');
      assert.deepEqual(await snapshot('cookie'), before);
    });

    test('cookie phiên kèm Origin lạ: 403 CSRF_VALIDATION_FAILED', async () => {
      const before = await snapshot('cookie');
      const res = await call({
        token: null,
        cookieToken: tokens.dri,
        headers: { origin: 'https://evil.example' },
        body: { items: [{ id: tasks.cookie, expectedVersion: before.version }], priority: TaskPriority.HIGH },
      });
      await expectProblem(res, 403, 'CSRF_VALIDATION_FAILED');
      assert.deepEqual(await snapshot('cookie'), before);
    });

    test('cookie phiên với Sec-Fetch-Site: cross-site: 403 CSRF_VALIDATION_FAILED', async () => {
      const before = await snapshot('cookie');
      const res = await call({
        token: null,
        cookieToken: tokens.dri,
        headers: { 'sec-fetch-site': 'cross-site' },
        body: { items: [{ id: tasks.cookie, expectedVersion: before.version }], priority: TaskPriority.HIGH },
      });
      await expectProblem(res, 403, 'CSRF_VALIDATION_FAILED');
      assert.deepEqual(await snapshot('cookie'), before);
    });

    test('cùng payload qua cookie với Origin đúng thì được áp dụng (đối chứng cho ba ca CSRF)', async () => {
      const before = await snapshot('cookie');
      assert.equal(before.priority, TaskPriority.NORMAL);
      const res = await call({
        token: null,
        cookieToken: tokens.dri,
        headers: { origin: 'http://localhost:3000' },
        body: { items: [{ id: tasks.cookie, expectedVersion: before.version }], priority: TaskPriority.HIGH },
      });
      const data = await expectSuccess(res);
      assert.equal(data.succeeded, 1);
      const after = await snapshot('cookie');
      assert.equal(after.priority, TaskPriority.HIGH);
      assert.equal(after.version, before.version + 1);
    });

    test('Content-Type không phải JSON: 415 UNSUPPORTED_MEDIA_TYPE, kiểm trước cả xác thực', async () => {
      const before = await snapshot('a');
      const body = { items: [{ id: tasks.a, expectedVersion: before.version }], priority: TaskPriority.URGENT };
      // Không token: route trả 415 chứ không phải 401 (rào Content-Type đứng trước xác thực).
      for (const token of [null, tokens.dri]) {
        const res = await call({ token, headers: { 'content-type': 'text/plain' }, body });
        await expectProblem(res, 415, 'UNSUPPORTED_MEDIA_TYPE');
      }
      assert.deepEqual(await snapshot('a'), before);
    });

    test('Content-Length vượt 1MB: 413 PAYLOAD_TOO_LARGE, kiểm trước cả xác thực', async () => {
      const before = await snapshot('a');
      const body = { items: [{ id: tasks.a, expectedVersion: before.version }], priority: TaskPriority.URGENT };
      for (const token of [null, tokens.dri]) {
        const res = await call({ token, headers: { 'content-length': String(2 * 1024 * 1024) }, body });
        await expectProblem(res, 413, 'PAYLOAD_TOO_LARGE');
      }
      assert.deepEqual(await snapshot('a'), before);
    });
  });

  describe('Idempotency-Key', () => {
    test('thiếu Idempotency-Key: 400 IDEMPOTENCY_KEY_REQUIRED (kiểm trước khi đọc body)', async () => {
      const before = await snapshot('a');
      const res = await call({
        token: tokens.validator,
        key: null,
        // Body sai cũng không được tới bước validate: lỗi khóa đứng trước.
        body: { items: [] },
      });
      const body = await expectProblem(res, 400, 'IDEMPOTENCY_KEY_REQUIRED');
      assert.deepEqual(body.invalidParams, [
        { name: 'Idempotency-Key', reason: 'Bắt buộc; độ dài tối đa 255 ký tự.' },
      ]);
      assert.deepEqual(await snapshot('a'), before);
      assert.equal(await prisma.idempotencyRecord.count({ where: { userId: users.validator.id } }), 0);
    });

    test('Idempotency-Key chỉ có khoảng trắng hoặc dài 256 ký tự: 400 IDEMPOTENCY_KEY_REQUIRED', async () => {
      const before = await snapshot('a');
      const validBody = { items: [{ id: tasks.a, expectedVersion: before.version }], priority: TaskPriority.URGENT };
      for (const key of ['   ', 'k'.repeat(256)]) {
        const res = await call({ token: tokens.validator, key, body: validBody });
        await expectProblem(res, 400, 'IDEMPOTENCY_KEY_REQUIRED');
      }
      assert.deepEqual(await snapshot('a'), before);
      assert.equal(await prisma.idempotencyRecord.count({ where: { userId: users.validator.id } }), 0);
    });

    test('nhận khóa qua header X-Idempotency-Key', async () => {
      const before = await snapshot('xkey');
      const key = newKey();
      const res = await call({
        token: tokens.dri,
        key: null,
        headers: { 'x-idempotency-key': key },
        body: { items: [{ id: tasks.xkey, expectedVersion: before.version }], priority: TaskPriority.LOW },
      });
      const data = await expectSuccess(res);
      assert.equal(data.succeeded, 1);
      assert.equal((await snapshot('xkey')).priority, TaskPriority.LOW);
      const record = await idempotencyRecord('dri', key);
      assert.equal(record?.status, 'COMPLETED');
    });
  });

  describe('validate payload', () => {
    // Mỗi ca: 400 VALIDATION_ERROR, không tiêu khóa idempotency (validate đứng trước withIdempotency),
    // nhiệm vụ a giữ nguyên.
    const cases: Array<{
      name: string;
      build: (validItem: { id: string; expectedVersion: number }) => { body?: unknown; rawBody?: string };
      detail?: string;
      params?: string[];
    }> = [
      { name: 'JSON hỏng', build: () => ({ rawBody: '{"items": [' }), detail: 'Invalid JSON body' },
      { name: 'body rỗng', build: () => ({ rawBody: '' }), detail: 'Invalid JSON body' },
      { name: 'thiếu items và priority', build: () => ({ body: {} }), params: ['items', 'priority'] },
      { name: 'body là mảng', build: () => ({ body: [] }), params: ['_root'] },
      {
        name: 'items rỗng',
        build: () => ({ body: { items: [], priority: TaskPriority.LOW } }),
        detail: 'Chọn ít nhất một nhiệm vụ',
        params: ['items'],
      },
      {
        name: 'quá 200 nhiệm vụ',
        build: () => ({
          body: {
            items: Array.from({ length: 201 }, (_, i) => ({ id: `${runId}-x${i}`, expectedVersion: 1 })),
            priority: TaskPriority.LOW,
          },
        }),
        detail: 'Tối đa 200 nhiệm vụ mỗi lần',
        params: ['items'],
      },
      {
        name: 'mã nhiệm vụ trùng nhau',
        build: (v) => ({ body: { items: [v, { ...v }], priority: TaskPriority.LOW } }),
        detail: 'Danh sách nhiệm vụ có mã trùng nhau',
        params: ['items'],
      },
      { name: 'ưu tiên không hợp lệ', build: (v) => ({ body: { items: [v], priority: 'KHONG_HOP_LE' } }), params: ['priority'] },
      {
        name: 'trường lạ ở gốc (đổi trạng thái hàng loạt bị chặn, Q6)',
        build: (v) => ({ body: { items: [v], priority: TaskPriority.LOW, status: TaskStatus.COMPLETED } }),
        params: ['_root'],
      },
      {
        name: 'trường lạ trong dòng (đổi hạn hàng loạt bị chặn, Q6)',
        build: (v) => ({ body: { items: [{ ...v, dueDate: '2030-01-01' }], priority: TaskPriority.LOW } }),
        params: ['items.0'],
      },
      {
        name: 'expectedVersion âm',
        build: (v) => ({ body: { items: [{ id: v.id, expectedVersion: -1 }], priority: TaskPriority.LOW } }),
        params: ['items.0.expectedVersion'],
      },
      {
        name: 'expectedVersion dạng chuỗi',
        build: (v) => ({ body: { items: [{ id: v.id, expectedVersion: String(v.expectedVersion) }], priority: TaskPriority.LOW } }),
        params: ['items.0.expectedVersion'],
      },
      {
        name: 'mã nhiệm vụ chỉ có khoảng trắng',
        build: () => ({ body: { items: [{ id: '   ', expectedVersion: 1 }], priority: TaskPriority.LOW } }),
        params: ['items.0.id'],
      },
    ];

    for (const c of cases) {
      test(`${c.name}: 400 VALIDATION_ERROR`, async () => {
        const before = await snapshot('a');
        const key = newKey();
        const res = await call({ token: tokens.validator, key, ...c.build({ id: tasks.a, expectedVersion: before.version }) });
        const body = await expectProblem(res, 400, 'VALIDATION_ERROR');
        if (c.detail) assert.equal(body.detail, c.detail);
        if (c.params) {
          assert.ok(Array.isArray(body.invalidParams), 'phải có invalidParams');
          const names = [...new Set((body.invalidParams as Array<{ name: string }>).map((p) => p.name))].sort();
          assert.deepEqual(names, [...c.params].sort());
        }
        assert.equal(await idempotencyRecord('validator', key), null, 'payload lỗi không được tiêu khóa idempotency');
        assert.deepEqual(await snapshot('a'), before);
      });
    }
  });

  describe('kết quả từng dòng và phân quyền', () => {
    test('DRI đổi ưu tiên hai nhiệm vụ: 200, DB đổi đúng trường, version +1, ghi audit từng nhiệm vụ', async () => {
      const beforeA = await snapshot('a');
      const beforeB = await snapshot('b');
      const res = await call({
        token: tokens.dri,
        body: {
          items: [
            { id: tasks.a, expectedVersion: beforeA.version },
            { id: tasks.b, expectedVersion: beforeB.version },
          ],
          priority: TaskPriority.URGENT,
        },
      });
      const data = await expectSuccess(res);
      assert.deepEqual(
        { total: data.total, succeeded: data.succeeded, failed: data.failed },
        { total: 2, succeeded: 2, failed: 0 }
      );
      assert.deepEqual(data.results, [
        { id: tasks.a, ok: true, changed: true, version: beforeA.version + 1 },
        { id: tasks.b, ok: true, changed: true, version: beforeB.version + 1 },
      ]);

      for (const [key, before] of [['a', beforeA], ['b', beforeB]] as const) {
        const after = await snapshot(key);
        assert.equal(after.priority, TaskPriority.URGENT);
        assert.equal(after.version, before.version + 1);
        // Chỉ đổi ưu tiên: trạng thái và hạn giữ nguyên.
        assert.equal(after.status, before.status);
        assert.equal(after.dueDate.getTime(), before.dueDate.getTime());

        const audits = await prisma.auditEvent.findMany({ where: { entityId: tasks[key], action: 'TASK_UPDATED' } });
        assert.equal(audits.length, 1);
        assert.equal(audits[0].actorId, users.dri.id);
        assert.equal(audits[0].entityType, 'Task');
        assert.deepEqual(audits[0].beforeData, { priority: TaskPriority.NORMAL });
        assert.deepEqual(audits[0].afterData, { priority: TaskPriority.URGENT });
        assert.deepEqual(audits[0].metadata, { bulk: true });
      }
    });

    test('cùng giá trị: ok nhưng changed=false, không tăng version, không ghi audit mới', async () => {
      const before = await snapshot('a');
      assert.equal(before.priority, TaskPriority.URGENT);
      const auditsBefore = await auditCount('a');
      const res = await call({
        token: tokens.dri,
        body: { items: [{ id: tasks.a, expectedVersion: before.version }], priority: TaskPriority.URGENT },
      });
      const data = await expectSuccess(res);
      assert.deepEqual(data.results, [{ id: tasks.a, ok: true, changed: false, version: before.version }]);
      assert.equal((await snapshot('a')).version, before.version);
      assert.equal(await auditCount('a'), auditsBefore);
    });

    test('lô lẫn dòng hợp lệ và dòng lỗi: vẫn 200, từng dòng báo mã riêng theo thứ tự gửi, chỉ dòng hợp lệ đổi', async () => {
      const a = await snapshot('a');
      const b = await snapshot('b');
      const foreign = await snapshot('foreign');
      const completed = await snapshot('completed');
      const archived = await snapshot('archived');
      const missingId = `${runId}-khong-ton-tai`;
      const auditForeign = await auditCount('foreign');

      const res = await call({
        token: tokens.dri,
        body: {
          items: [
            { id: tasks.a, expectedVersion: a.version },
            { id: tasks.foreign, expectedVersion: foreign.version },
            { id: tasks.completed, expectedVersion: completed.version },
            { id: tasks.archived, expectedVersion: archived.version },
            { id: tasks.b, expectedVersion: b.version - 1 },
            { id: missingId, expectedVersion: 1 },
          ],
          priority: TaskPriority.LOW,
        },
      });
      const data = await expectSuccess(res);
      assert.deepEqual(
        { total: data.total, succeeded: data.succeeded, failed: data.failed },
        { total: 6, succeeded: 1, failed: 5 }
      );
      assert.deepEqual(
        data.results.map((r) => [r.id, r.ok, r.code ?? null]),
        [
          [tasks.a, true, null],
          [tasks.foreign, false, 'FORBIDDEN'],
          [tasks.completed, false, 'TASK_CLOSED'],
          [tasks.archived, false, 'TASK_CLOSED'],
          [tasks.b, false, 'VERSION_CONFLICT'],
          [missingId, false, 'NOT_FOUND'],
        ]
      );
      // Dòng lỗi chỉ có id/ok/code/message: không lộ version hay dữ liệu nhiệm vụ.
      for (const row of data.results.slice(1)) {
        assert.deepEqual(Object.keys(row).sort(), ['code', 'id', 'message', 'ok']);
        assert.equal(typeof row.message, 'string');
      }

      assert.equal((await snapshot('a')).priority, TaskPriority.LOW);
      assert.equal((await snapshot('a')).version, a.version + 1);
      assert.deepEqual(await snapshot('foreign'), foreign);
      assert.deepEqual(await snapshot('completed'), completed);
      assert.deepEqual(await snapshot('archived'), archived);
      assert.deepEqual(await snapshot('b'), b);
      assert.equal(await auditCount('foreign'), auditForeign);
      assert.equal(await auditCount('completed'), 0);
      assert.equal(await auditCount('archived'), 0);
    });

    test('người không liên quan: 200 nhưng mọi dòng FORBIDDEN, không dòng nào đổi', async () => {
      const a = await snapshot('a');
      const b = await snapshot('b');
      const res = await call({
        token: tokens.stranger,
        body: {
          items: [
            { id: tasks.a, expectedVersion: a.version },
            { id: tasks.b, expectedVersion: b.version },
          ],
          priority: TaskPriority.HIGH,
        },
      });
      const data = await expectSuccess(res);
      assert.deepEqual(
        { total: data.total, succeeded: data.succeeded, failed: data.failed },
        { total: 2, succeeded: 0, failed: 2 }
      );
      assert.deepEqual(
        data.results.map((r) => [r.id, r.ok, r.code]),
        [
          [tasks.a, false, 'FORBIDDEN'],
          [tasks.b, false, 'FORBIDDEN'],
        ]
      );
      assert.deepEqual(await snapshot('a'), a);
      assert.deepEqual(await snapshot('b'), b);
    });

    test('người quan sát (OBSERVER) không đổi được ưu tiên: dòng FORBIDDEN với lý do chỉ đọc', async () => {
      const observed = await snapshot('observed');
      const res = await call({
        token: tokens.observer,
        body: { items: [{ id: tasks.observed, expectedVersion: observed.version }], priority: TaskPriority.HIGH },
      });
      const data = await expectSuccess(res);
      assert.equal(data.succeeded, 0);
      assert.deepEqual(data.results, [
        {
          id: tasks.observed,
          ok: false,
          code: 'FORBIDDEN',
          message: 'Người theo dõi hoặc quan sát không có quyền thay đổi dữ liệu tác vụ.',
        },
      ]);
      assert.deepEqual(await snapshot('observed'), observed);
    });
  });

  describe('idempotency qua route', () => {
    test('gửi lại cùng khóa và cùng body: trả đúng kết quả đã lưu, không đổi lần hai', async () => {
      const before = await snapshot('idem');
      const key = newKey();
      const body = { items: [{ id: tasks.idem, expectedVersion: before.version }], priority: TaskPriority.HIGH };

      const first = await expectSuccess(await call({ token: tokens.dri, key, body }));
      const afterFirst = await snapshot('idem');
      assert.equal(afterFirst.priority, TaskPriority.HIGH);
      assert.equal(afterFirst.version, before.version + 1);

      const second = await expectSuccess(await call({ token: tokens.dri, key, body }));
      assert.deepEqual(second, first);
      assert.deepEqual(await snapshot('idem'), afterFirst);
      assert.equal(await auditCount('idem'), 1);
    });

    test('cùng khóa nhưng body khác: 409 IDEMPOTENCY_CONFLICT, không đổi dữ liệu', async () => {
      const before = await snapshot('idem');
      const key = newKey();
      await expectSuccess(
        await call({
          token: tokens.dri,
          key,
          body: { items: [{ id: tasks.idem, expectedVersion: before.version }], priority: TaskPriority.HIGH },
        })
      );
      const afterFirst = await snapshot('idem');

      const res = await call({
        token: tokens.dri,
        key,
        body: { items: [{ id: tasks.idem, expectedVersion: afterFirst.version }], priority: TaskPriority.LOW },
      });
      await expectProblem(res, 409, 'IDEMPOTENCY_CONFLICT');
      assert.deepEqual(await snapshot('idem'), afterFirst);
    });

    test('khóa idempotency tách theo người dùng: người khác dùng lại khóa không nhận kết quả đã lưu', async () => {
      const before = await snapshot('idem');
      const key = newKey();
      const body = { items: [{ id: tasks.idem, expectedVersion: before.version }], priority: TaskPriority.URGENT };

      const owner = await expectSuccess(await call({ token: tokens.dri, key, body }));
      assert.equal(owner.succeeded, 1);
      const afterOwner = await snapshot('idem');

      const other = await expectSuccess(await call({ token: tokens.stranger, key, body }));
      assert.equal(other.succeeded, 0);
      assert.deepEqual(other.results.map((r) => r.code), ['FORBIDDEN']);
      assert.deepEqual(await snapshot('idem'), afterOwner);
      assert.equal((await idempotencyRecord('stranger', key))?.status, 'COMPLETED');
    });
  });

  describe('rate limit', () => {
    test('quá 30 yêu cầu/phút của cùng người dùng: 429 RATE_LIMITED kèm Retry-After', async () => {
      // Khóa rate limit theo user (MUTATIONS_SENSITIVE: 30/60s), backend bộ nhớ trong tiến trình khi
      // không có REDIS_URL; dùng người dùng riêng của file nên không ảnh hưởng ca khác.
      // Thiếu Idempotency-Key để mỗi yêu cầu dừng sau bước rate limit, không chạm dữ liệu.
      for (let i = 0; i < 30; i++) {
        const res = await call({ token: tokens.rate, key: null, body: {} });
        assert.equal(res.status, 400, `yêu cầu thứ ${i + 1} phải qua rate limit`);
      }
      const res = await call({ token: tokens.rate, key: null, body: {} });
      await expectProblem(res, 429, 'RATE_LIMITED');
      const retryAfter = Number(res.headers.get('retry-after'));
      assert.ok(Number.isInteger(retryAfter) && retryAfter >= 1 && retryAfter <= 60, `Retry-After=${retryAfter}`);

      // Lần bị chặn được ghi nhật ký bảo mật (ghi nền, không chặn phản hồi): chờ bản ghi xuất hiện
      // để after() dọn được theo id người dùng của fixture.
      let logged = 0;
      for (let i = 0; i < 30 && logged === 0; i++) {
        logged = await prisma.auditEvent.count({ where: rateLimitAuditWhere() });
        if (logged === 0) await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(logged, 1, 'phải ghi đúng một sự kiện RATE_LIMIT_EXCEEDED cho người dùng bị chặn');
    });
  });
});
