/**
 * T-11 / D07 (spec task-document-gap-spec.md): người thường chỉ thấy phần của mình; trưởng đơn vị thấy việc chung
 * của đơn vị. Chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AssignmentStatus, JobCatalogGroup, TaskActorRole, TaskScope, TaskStatus, UnitType } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { loadAuthorizationContext } from '../src/server/authorization/authorization-context-service';
import { buildTaskReadWhere } from '../src/server/tasks/task-query-service';
import { canReadTask, dbReadScope } from '../src/server/tasks/staff-read-scope';

const runId = `t11_${Date.now()}`;
const u: Record<string, string> = {};
const t: Record<string, string> = {};
let unitId = '';
const createdPositions: string[] = [];

async function ensurePosition(code: string, group: JobCatalogGroup) {
  const existing = await prisma.positionDefinition.findUnique({ where: { code } });
  if (existing) return existing.id;
  const created = await prisma.positionDefinition.create({ data: { code, title: code, group, isLeadership: group === JobCatalogGroup.LDPU } });
  createdPositions.push(created.id);
  return created.id;
}

async function makeTask(key: string, opts: { parent?: string; actors: Array<[string, TaskActorRole]>; createdBy?: string }) {
  const task = await prisma.task.create({
    data: {
      code: `${runId}_${key}`.slice(0, 50),
      title: `Nhiệm vụ ${key}`,
      academicMonth: 10,
      academicYear: '2026-2027',
      dueDate: new Date('2026-12-30T00:00:00+07:00'),
      createdById: u[opts.createdBy ?? 'head'],
      leadUnitId: unitId,
      scope: TaskScope.DEPARTMENT,
      status: TaskStatus.IN_PROGRESS,
      parentTaskId: opts.parent ? t[opts.parent] : null,
      actors: { create: opts.actors.map(([k, role]) => ({ userId: u[k], role, isPrimaryDRI: role === TaskActorRole.DRI })) },
    },
  });
  t[key] = task.id;
}

const visibleIds = async (userKey: string) => {
  const ctx = await loadAuthorizationContext(u[userKey]);
  const rows = await prisma.task.findMany({ where: { AND: [{ id: { in: Object.values(t) } }, buildTaskReadWhere(ctx)] }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
};

describe('T-11 / D07 người thường chỉ thấy phần của mình', () => {
  before(async () => {
    for (const key of ['head', 'a', 'b', 'c']) {
      const user = await prisma.user.create({ data: { email: `${runId}_${key}@cdktcnqn.edu.vn`, name: `${runId} ${key}` } });
      u[key] = user.id;
    }
    unitId = (await prisma.organizationalUnit.create({ data: { code: `${runId}_U`.slice(0, 50), name: 'Đơn vị T-11', type: UnitType.DEPARTMENT } })).id;
    const from = new Date('2020-01-01T00:00:00Z');
    const head = await ensurePosition('TRUONG_DON_VI', JobCatalogGroup.LDPU);
    const staff = await ensurePosition('CHUYEN_VIEN', JobCatalogGroup.HTPV);
    await prisma.positionAssignment.create({ data: { userId: u.head, positionDefinitionId: head, unitId, status: AssignmentStatus.ACTIVE, effectiveFrom: from } });
    for (const key of ['a', 'b', 'c']) {
      await prisma.positionAssignment.create({ data: { userId: u[key], positionDefinitionId: staff, unitId, status: AssignmentStatus.ACTIVE, effectiveFrom: from } });
    }
    // a chủ trì việc cha có hai việc con: một do a, một do b chủ trì; c chủ trì việc riêng.
    await makeTask('parent', { actors: [['a', TaskActorRole.DRI]] });
    await makeTask('childA', { parent: 'parent', actors: [['a', TaskActorRole.DRI]] });
    await makeTask('childB', { parent: 'parent', actors: [['b', TaskActorRole.DRI]] });
    await makeTask('solo', { actors: [['c', TaskActorRole.DRI]] });
  });

  after(async () => {
    const ids = Object.values(u);
    await prisma.task.deleteMany({ where: { id: { in: [t.childA, t.childB].filter(Boolean) } } });
    await prisma.task.deleteMany({ where: { id: { in: Object.values(t) } } });
    await prisma.positionAssignment.deleteMany({ where: { userId: { in: ids } } });
    if (createdPositions.length) await prisma.positionDefinition.deleteMany({ where: { id: { in: createdPositions } } });
    await prisma.organizationalUnit.delete({ where: { id: unitId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  test('danh sách: người thường không thấy việc của đồng nghiệp cùng đơn vị (AC-T11-1)', async () => {
    const c = await visibleIds('c');
    assert.deepEqual([...c], [t.solo], 'c chỉ thấy việc riêng của mình');
    const a = await visibleIds('a');
    assert.equal(a.has(t.solo), false);
  });

  test('việc cha và việc con của phần mình tham gia vẫn hiện, anh em thì không', async () => {
    const a = await visibleIds('a');
    assert.deepEqual([t.parent, t.childA, t.childB].filter((id) => a.has(id)).sort(), [t.parent, t.childA, t.childB].sort(), 'a chủ trì việc cha nên thấy cả hai việc con');
    const b = await visibleIds('b');
    assert.equal(b.has(t.childB), true);
    assert.equal(b.has(t.parent), true, 'làm việc con thì thấy việc cha để có ngữ cảnh');
    assert.equal(b.has(t.childA), false, 'không thấy việc con của người khác');
  });

  test('trưởng đơn vị thấy việc chung của đơn vị mình', async () => {
    const head = await visibleIds('head');
    for (const key of ['parent', 'childA', 'childB', 'solo']) assert.equal(head.has(t[key]), true, key);
  });

  test('đọc theo mã áp cùng phạm vi cho quyền cơ bản của viên chức; trưởng đơn vị và người tham gia không bị ảnh hưởng', async () => {
    const ctxC = await loadAuthorizationContext(u.c);
    const scopeC = dbReadScope(ctxC);
    assert.equal(await canReadTask(ctxC, { id: t.solo, ...(await rawTask('solo')) } as never, scopeC), true);
    assert.equal(await canReadTask(ctxC, { id: t.parent, ...(await rawTask('parent')) } as never, scopeC), false, 'đồng nghiệp không đọc được việc cha của người khác');
    assert.equal(await canReadTask(ctxC, { id: t.parent, ...(await rawTask('parent')) } as never), true, 'không có bộ kiểm phạm vi thì chỉ theo engine');

    const ctxB = await loadAuthorizationContext(u.b);
    const scopeB = dbReadScope(ctxB);
    assert.equal(await canReadTask(ctxB, { id: t.parent, ...(await rawTask('parent')) } as never, scopeB), true, 'làm việc con thì đọc được việc cha');
    assert.equal(await canReadTask(ctxB, { id: t.childA, ...(await rawTask('childA')) } as never, scopeB), false);

    const ctxHead = await loadAuthorizationContext(u.head);
    assert.equal(await canReadTask(ctxHead, { id: t.childA, ...(await rawTask('childA')) } as never, dbReadScope(ctxHead)), true);
  });
});

async function rawTask(key: string) {
  return prisma.task.findUniqueOrThrow({ where: { id: t[key] }, include: { actors: true } });
}
