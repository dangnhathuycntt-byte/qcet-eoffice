/**
 * T-09 (spec task-document-gap-spec.md): mẫu nhiệm vụ và nhiệm vụ lặp lại theo tháng.
 * Chạy trên qcet_test; chỉ quét các lịch lặp lại do test tạo và chỉ xóa bản ghi của test.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AssignmentStatus, JobCatalogGroup, TaskActorRole, UnitType } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '../src/lib/prisma';
import {
  STALE_CLAIM_MS,
  createRecurrence,
  createTemplate,
  listRecurrences,
  listTemplates,
  runTaskRecurrences,
  updateRecurrence,
  updateTemplate,
} from '../src/server/tasks/task-recurrence-service';
import { dueDateForPeriod, isPeriodDue, periodKeyOf, renderTitle } from '../src/domain/tasks/recurrence-rules';
import { ApiError } from '../src/server/api/errors';

const runId = `t09_${Date.now()}`;
const u: Record<string, string> = {};
const recurrences: string[] = [];
const templates: string[] = [];
let unitId = '';
let positionId = '';
let createdPosition = false;

const at = (iso: string) => new Date(iso);
const session = (key: string) => ({ id: u[key], email: `${key}@x`, name: key, role: 'TRUONG_PHONG' });
const forbidden = (err: unknown) => err instanceof ApiError && err.statusCode === 403;
const validation = (code: string) => (err: unknown) => err instanceof ApiError && err.code === code;
const scan = (id: string, now: string) => runTaskRecurrences({ now: at(now), recurrenceIds: [id] });
const tasksOf = (id: string) => prisma.taskRecurrenceRun.findMany({ where: { recurrenceId: id }, orderBy: { periodKey: 'asc' } });

async function makeTemplate(overrides: Record<string, unknown> = {}) {
  const t = await createTemplate(session('head'), {
    name: `Mẫu ${runId}`,
    unitId,
    title: 'Báo cáo công tác tháng {thang}',
    description: 'Tổng hợp số liệu',
    priority: 'HIGH',
    dueDay: 25,
    criteria: ['Đủ số liệu', 'Có chữ ký'],
    subtasks: ['Thu thập số liệu {thang}', 'Soạn báo cáo'],
    ...overrides,
  });
  templates.push(t.id);
  return t;
}

async function makeRecurrence(templateId: string, overrides: Record<string, unknown> = {}) {
  const r = await createRecurrence(session('head'), {
    templateId,
    driUserId: u.dri,
    collaboratorIds: [u.collab],
    reviewerUserId: u.reviewer,
    startPeriod: '2026-10',
    ...overrides,
  });
  recurrences.push(r.id);
  return r;
}

describe('T-09 mẫu và nhiệm vụ lặp lại', () => {
  before(async () => {
    for (const key of ['head', 'dri', 'collab', 'reviewer', 'stranger']) {
      const user = await prisma.user.create({ data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}` } });
      u[key] = user.id;
    }
    unitId = (await prisma.organizationalUnit.create({ data: { code: `${runId}_U`.slice(0, 50), name: 'Đơn vị T-09', type: UnitType.DEPARTMENT } })).id;
    let position = await prisma.positionDefinition.findUnique({ where: { code: 'TRUONG_DON_VI' } });
    if (!position) {
      position = await prisma.positionDefinition.create({ data: { code: 'TRUONG_DON_VI', title: 'Trưởng đơn vị', group: JobCatalogGroup.LDPU, isLeadership: true } });
      createdPosition = true;
    }
    positionId = position.id;
    const from = new Date('2020-01-01T00:00:00Z');
    await prisma.positionAssignment.create({ data: { userId: u.head, positionDefinitionId: position.id, unitId, status: AssignmentStatus.ACTIVE, effectiveFrom: from } });
    // Người thực hiện thuộc đơn vị (createTask yêu cầu cùng đơn vị).
    const staff = await prisma.positionDefinition.findUnique({ where: { code: 'CHUYEN_VIEN' } });
    const staffPos = staff ?? (await prisma.positionDefinition.create({ data: { code: 'CHUYEN_VIEN', title: 'Chuyên viên', group: JobCatalogGroup.HTPV } }));
    for (const key of ['dri', 'collab']) {
      await prisma.positionAssignment.create({ data: { userId: u[key], positionDefinitionId: staffPos.id, unitId, status: AssignmentStatus.ACTIVE, effectiveFrom: from } });
    }
  });

  after(async () => {
    const ids = Object.values(u);
    const runs = await prisma.taskRecurrenceRun.findMany({ where: { recurrenceId: { in: recurrences } }, select: { taskId: true } });
    const taskIds = runs.map((r) => r.taskId).filter((x): x is string => Boolean(x));
    const children = await prisma.task.findMany({ where: { parentTaskId: { in: taskIds } }, select: { id: true } });
    const all = [...taskIds, ...children.map((c) => c.id)];
    await prisma.auditEvent.deleteMany({ where: { OR: [{ entityId: { in: [...all, ...recurrences, ...templates] } }, { actorId: { in: ids } }] } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: all } } });
    await prisma.taskRecurrenceRun.deleteMany({ where: { recurrenceId: { in: recurrences } } });
    await prisma.task.deleteMany({ where: { id: { in: children.map((c) => c.id) } } });
    await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    await prisma.taskRecurrence.deleteMany({ where: { id: { in: recurrences } } });
    await prisma.taskTemplate.deleteMany({ where: { id: { in: templates } } });
    await prisma.positionAssignment.deleteMany({ where: { userId: { in: ids } } });
    if (positionId && createdPosition) await prisma.positionDefinition.delete({ where: { id: positionId } });
    await prisma.organizationalUnit.delete({ where: { id: unitId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  test('quy tắc thuần túy: kỳ, bước lặp, hạn chót, tiêu đề', () => {
    assert.equal(periodKeyOf(at('2026-10-31T17:30:00Z')), '2026-11', '00:30 ngày 01/11 giờ Việt Nam đã sang tháng 11');
    assert.equal(periodKeyOf(at('2026-10-31T16:30:00Z')), '2026-10');
    const monthly = { startPeriod: '2026-09', endPeriod: null, everyMonths: 1 };
    assert.equal(isPeriodDue(monthly, '2026-08'), false);
    assert.equal(isPeriodDue(monthly, '2027-02'), true);
    const quarterly = { startPeriod: '2026-09', endPeriod: '2027-03', everyMonths: 3 };
    assert.deepEqual(['2026-09', '2026-10', '2026-12', '2027-03', '2027-06'].map((k) => isPeriodDue(quarterly, k)), [true, false, true, true, false]);
    assert.equal(dueDateForPeriod('2026-10', 25).toISOString(), '2026-10-24T17:00:00.000Z');
    assert.equal(dueDateForPeriod('2026-10', 31).toISOString(), '2026-10-27T17:00:00.000Z', 'ngày hạn bị chặn ở 28');
    assert.equal(renderTitle('Báo cáo {thang} năm học {nam_hoc} ({nam})', '2026-10'), 'Báo cáo 10/2026 năm học 2026-2027 (2026)');
    assert.equal(renderTitle('Báo cáo {thang}', '2027-02'), 'Báo cáo 02/2027');
  });

  test('chỉ trưởng đơn vị hoặc lãnh đạo quản lý mẫu; dữ liệu mẫu được kiểm', async () => {
    await assert.rejects(createTemplate(session('stranger'), { name: 'X', unitId, title: 'X' }), forbidden, 'stranger');
    await assert.rejects(createTemplate(session('dri'), { name: 'X', unitId, title: 'X' }), forbidden, 'dri');
    await assert.rejects(createTemplate(session('head'), { name: 'X', unitId, title: 'X', dueDay: 31 }), ZodError);
    await assert.rejects(createTemplate(session('head'), { name: 'X', unitId, title: 'X', criteria: Array(21).fill('a') }), ZodError);
    await assert.rejects(createTemplate(session('head'), { name: 'X', unitId: 'khong-ton-tai', title: 'X' }), ApiError);

    const t = await makeTemplate();
    assert.equal((await listTemplates(session('head'))).some((x) => x.id === t.id), true);
    assert.equal((await listTemplates(session('stranger'))).some((x) => x.id === t.id), false, 'người ngoài không thấy mẫu');
    await assert.rejects(updateTemplate(session('stranger'), t.id, { name: 'Đổi' }), forbidden);
    const renamed = await updateTemplate(session('head'), t.id, { name: 'Mẫu đã đổi' });
    assert.equal(renamed.name, 'Mẫu đã đổi');
  });

  test('lịch lặp lại: kiểm người thực hiện, N4 của người duyệt, kỳ, quyền', async () => {
    const t = await makeTemplate();
    await assert.rejects(createRecurrence(session('stranger'), { templateId: t.id, driUserId: u.dri, startPeriod: '2026-10' }), forbidden);
    await assert.rejects(createRecurrence(session('head'), { templateId: t.id, driUserId: 'khong-ton-tai', startPeriod: '2026-10' }), validation('RECURRENCE_USER_NOT_FOUND'));
    await assert.rejects(createRecurrence(session('head'), { templateId: t.id, driUserId: u.dri, collaboratorIds: [u.dri], startPeriod: '2026-10' }), validation('RECURRENCE_DRI_IS_COLLABORATOR'));
    await assert.rejects(createRecurrence(session('head'), { templateId: t.id, driUserId: u.dri, reviewerUserId: u.dri, startPeriod: '2026-10' }), validation('RECURRENCE_REVIEWER_N4'));
    await assert.rejects(createRecurrence(session('head'), { templateId: t.id, driUserId: u.dri, reviewerUserId: u.head, startPeriod: '2026-10' }), validation('RECURRENCE_REVIEWER_N4'));
    await assert.rejects(createRecurrence(session('head'), { templateId: t.id, driUserId: u.dri, startPeriod: '2026-13' }), ZodError);
    await assert.rejects(createRecurrence(session('head'), { templateId: t.id, driUserId: u.dri, startPeriod: '2026-10', endPeriod: '2026-09' }), ZodError);
    await updateTemplate(session('head'), t.id, { isActive: false });
    await assert.rejects(createRecurrence(session('head'), { templateId: t.id, driUserId: u.dri, startPeriod: '2026-10' }), validation('TEMPLATE_INACTIVE'));
  });

  test('bộ quét tạo nhiệm vụ đủ nội dung của tháng hiện tại và không tạo lần hai (AC-T09-1)', async () => {
    const t = await makeTemplate();
    const rec = await makeRecurrence(t.id);

    const first = await scan(rec.id, '2026-10-05T08:00:00+07:00');
    assert.equal(first.created, 1);
    const [run] = await tasksOf(rec.id);
    assert.equal(run.periodKey, '2026-10');
    assert.ok(run.taskId);
    assert.equal(run.error, null);

    const task = await prisma.task.findUniqueOrThrow({ where: { id: run.taskId! }, include: { actors: true, criteria: { orderBy: { position: 'asc' } }, subTasks: true } });
    assert.equal(task.title, 'Báo cáo công tác tháng 10/2026');
    assert.equal(task.priority, 'HIGH');
    assert.equal(task.academicMonth, 10);
    assert.equal(task.academicYear, '2026-2027');
    assert.equal(task.dueDate.toISOString(), '2026-10-24T17:00:00.000Z');
    assert.equal(task.createdById, u.head, 'nhiệm vụ mang tên người giao');
    assert.equal(task.leadUnitId, unitId);
    const roleOf = (userId: string) => task.actors.filter((a) => a.userId === userId).map((a) => a.role);
    assert.deepEqual(roleOf(u.dri), [TaskActorRole.DRI]);
    assert.deepEqual(roleOf(u.collab), [TaskActorRole.COLLABORATOR]);
    assert.deepEqual(roleOf(u.reviewer), [TaskActorRole.REVIEWER]);
    assert.deepEqual(task.criteria.map((c) => c.text), ['Đủ số liệu', 'Có chữ ký']);
    assert.deepEqual(task.subTasks.map((s) => s.title).sort(), ['Soạn báo cáo', 'Thu thập số liệu 10/2026']);
    assert.ok(await prisma.auditEvent.findFirst({ where: { entityId: task.id, action: 'TASK_RECURRENCE_GENERATED' } }));

    // Chạy lại và chạy song song trong cùng kỳ: vẫn một nhiệm vụ.
    const again = await scan(rec.id, '2026-10-06T08:00:00+07:00');
    assert.equal(again.created, 0);
    assert.equal(again.skippedExisting, 1);
    const parallel = await Promise.all([scan(rec.id, '2026-10-07T08:00:00+07:00'), scan(rec.id, '2026-10-07T08:00:00+07:00')]);
    assert.equal(parallel.reduce((n, r) => n + r.created, 0), 0);
    assert.equal(await prisma.taskRecurrenceRun.count({ where: { recurrenceId: rec.id } }), 1);
    assert.equal(await prisma.task.count({ where: { title: 'Báo cáo công tác tháng 10/2026', createdById: u.head } }) >= 1, true);
  });

  test('kỳ mới tạo nhiệm vụ mới; chạy song song lần đầu chỉ ra một nhiệm vụ', async () => {
    const t = await makeTemplate({ subtasks: [], criteria: [] });
    const rec = await makeRecurrence(t.id, { reviewerUserId: null });

    const parallel = await Promise.all([scan(rec.id, '2026-10-01T08:00:00+07:00'), scan(rec.id, '2026-10-01T08:00:00+07:00'), scan(rec.id, '2026-10-01T08:00:00+07:00')]);
    assert.equal(parallel.reduce((n, r) => n + r.created, 0), 1, 'ba lần quét đồng thời chỉ tạo một nhiệm vụ');

    const november = await scan(rec.id, '2026-11-02T08:00:00+07:00');
    assert.equal(november.created, 1);
    assert.deepEqual((await tasksOf(rec.id)).map((r) => r.periodKey), ['2026-10', '2026-11']);
  });

  test('chu kỳ: chưa đến kỳ bắt đầu, ngoài bước lặp, quá kỳ kết thúc, tạm dừng đều không tạo', async () => {
    const t = await makeTemplate({ subtasks: [], criteria: [] });
    const quarterly = await makeRecurrence(t.id, { reviewerUserId: null, everyMonths: 3, startPeriod: '2026-10', endPeriod: '2027-01' });
    assert.equal((await scan(quarterly.id, '2026-09-30T08:00:00+07:00')).considered, 0, 'trước kỳ bắt đầu');
    assert.equal((await scan(quarterly.id, '2026-11-10T08:00:00+07:00')).considered, 0, 'tháng không đúng bước 3');
    assert.equal((await scan(quarterly.id, '2026-10-10T08:00:00+07:00')).created, 1);
    assert.equal((await scan(quarterly.id, '2027-01-10T08:00:00+07:00')).created, 1, 'tháng 1/2027 là bước thứ hai');
    assert.equal((await scan(quarterly.id, '2027-04-10T08:00:00+07:00')).considered, 0, 'quá kỳ kết thúc');

    const paused = await makeRecurrence(t.id, { reviewerUserId: null });
    await updateRecurrence(session('head'), paused.id, { isActive: false });
    assert.equal((await scan(paused.id, '2026-10-10T08:00:00+07:00')).considered, 0);
    await updateRecurrence(session('head'), paused.id, { isActive: true });
    assert.equal((await scan(paused.id, '2026-10-10T08:00:00+07:00')).created, 1);

    const inactiveTemplate = await makeTemplate({ subtasks: [], criteria: [] });
    const rec = await makeRecurrence(inactiveTemplate.id, { reviewerUserId: null });
    await updateTemplate(session('head'), inactiveTemplate.id, { isActive: false });
    assert.equal((await scan(rec.id, '2026-10-10T08:00:00+07:00')).considered, 0, 'mẫu ngừng dùng thì không sinh');
  });

  test('lỗi khi tạo: ghi lỗi, không tạo nhiệm vụ, không tự thử lại; sửa rồi thử lại được', async () => {
    const t = await makeTemplate({ subtasks: [], criteria: [] });
    const rec = await makeRecurrence(t.id, { reviewerUserId: null });
    // Người chủ trì rời đơn vị.
    await prisma.positionAssignment.updateMany({ where: { userId: u.dri }, data: { status: AssignmentStatus.TERMINATED } });

    const first = await scan(rec.id, '2026-10-10T08:00:00+07:00');
    assert.equal(first.failed, 1);
    assert.equal(first.created, 0);
    const [failed] = await tasksOf(rec.id);
    assert.equal(failed.taskId, null);
    assert.match(failed.error ?? '', /cùng đơn vị/);
    const listed = (await listRecurrences(session('head'), t.id)).find((r) => r.id === rec.id);
    assert.equal(listed?.lastRun?.status, 'FAILED');

    assert.equal((await scan(rec.id, '2026-10-11T08:00:00+07:00')).skippedExisting, 1, 'không tự thử lại');

    await prisma.positionAssignment.updateMany({ where: { userId: u.dri }, data: { status: AssignmentStatus.ACTIVE } });
    await updateRecurrence(session('head'), rec.id, { retryFailed: true }, at('2026-10-11T08:00:00+07:00'));
    assert.equal((await scan(rec.id, '2026-10-11T09:00:00+07:00')).created, 1);
    assert.equal((await listRecurrences(session('head'), t.id)).find((r) => r.id === rec.id)?.lastRun?.status, 'CREATED');
  });

  test('dòng giữ chỗ treo quá hạn được dọn để thử lại', async () => {
    const t = await makeTemplate({ subtasks: [], criteria: [] });
    const rec = await makeRecurrence(t.id, { reviewerUserId: null });
    await prisma.taskRecurrenceRun.create({ data: { recurrenceId: rec.id, periodKey: '2026-10', claimedAt: new Date(at('2026-10-10T08:00:00+07:00').getTime() - STALE_CLAIM_MS - 60_000) } });
    const res = await scan(rec.id, '2026-10-10T08:00:00+07:00');
    assert.equal(res.created, 1, 'dòng treo bị dọn rồi tạo lại');
  });
});
