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

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserRole, TaskScope, TaskPriority, TaskStatus, TaskActorRole, UnitType } from '@prisma/client';
import { signSessionToken } from '@/lib/jwt-session';
import { DELETE as deleteDeliverable } from '@/app/api/tasks/[id]/deliverables/route';
import { DELETE as deleteDossierItem } from '@/app/api/dossiers/[id]/items/route';


/**
 * Issue #28 nested-resource invariant: authorize parent, verify the child
 * belongs to that parent, then enforce the action. Parent/child ID mismatch
 * must fail closed without mutating or leaking the foreign child.
 */
describe('Issue #28: nested resource parent/child mismatch', () => {
  const runId = `nested-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

  let alice: any;
  let bob: any;
  let aliceToken: string;
  let deptA: any;
  let deptB: any;
  let taskA: any;
  let taskB: any;
  let deliverableA: any;
  let deliverableB: any;

  let unit: any;
  let dossierA: any;
  let dossierB: any;
  let itemA: any;
  let itemB: any;

  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

  before(async () => {
    deptA = await prisma.organizationalUnit.create({ data: { id: `DEPT_NA_${runId}`, code: `DEPT_NA_${runId}`, name: `Dept A ${runId}`, type: "DEPARTMENT" as any, status: 'ACTIVE' as any } });
    deptB = await prisma.organizationalUnit.create({ data: { id: `DEPT_NB_${runId}`, code: `DEPT_NB_${runId}`, name: `Dept B ${runId}`, type: "DEPARTMENT" as any, status: 'ACTIVE' as any } });

    alice = await prisma.user.create({
      data: { email: `alice.${runId}@qcet.edu.vn`, name: `Alice ${runId}`, role: UserRole.CHUYEN_VIEN, isActive: true },
    });
    bob = await prisma.user.create({
      data: { email: `bob.${runId}@qcet.edu.vn`, name: `Bob ${runId}`, role: UserRole.CHUYEN_VIEN, isActive: true },
    });
    aliceToken = signSessionToken({ id: alice.id, email: alice.email, name: alice.name, role: alice.role});

    const mkTask = (owner: any, dept: any, code: string, title: string) =>
      prisma.task.create({
        data: {
          code, title, scope: TaskScope.DEPARTMENT, priority: TaskPriority.NORMAL,
          status: TaskStatus.IN_PROGRESS, academicMonth: 10, academicYear: '2026-2027',
          dueDate: new Date('2026-11-01'), createdById: owner.id, leadUnitId: dept.id,
          actors: { create: [{ userId: owner.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }] },
        },
      });

    taskA = await mkTask(alice, deptA, `NV-NA-${runId}`, `Nhiem vu cua Alice ${runId}`);
    taskB = await mkTask(bob, deptB, `NV-NB-${runId}`, `Nhiem vu cua Bob ${runId}`);

    deliverableA = await prisma.taskDeliverable.create({
      data: { taskId: taskA.id, title: `Minh chung A ${runId}`, fileUrl: `tasks/2026/na-${runId}.pdf`, uploadedById: alice.id },
    });
    deliverableB = await prisma.taskDeliverable.create({
      data: { taskId: taskB.id, title: `Minh chung B ${runId}`, fileUrl: `tasks/2026/nb-${runId}.pdf`, uploadedById: bob.id },
    });

    unit = await prisma.organizationalUnit.create({
      data: { code: `U-NEST-${runId}`, name: `Unit nest ${runId}`, type: UnitType.DEPARTMENT },
    });
    dossierA = await prisma.workDossier.create({
      data: { code: `HS-A-${runId}`, title: `Ho so A ${runId}`, owningUnitId: unit.id, responsiblePersonId: alice.id },
    });
    dossierB = await prisma.workDossier.create({
      data: { code: `HS-B-${runId}`, title: `Ho so B ${runId}`, owningUnitId: unit.id, responsiblePersonId: bob.id },
    });
    itemA = await prisma.dossierItem.create({
      data: { dossierId: dossierA.id, itemType: 'ATTACHMENT', title: `Tai lieu A ${runId}`, addedById: alice.id },
    });
    itemB = await prisma.dossierItem.create({
      data: { dossierId: dossierB.id, itemType: 'ATTACHMENT', title: `Tai lieu B ${runId}`, addedById: bob.id },
    });
  });

  after(async () => {
    await prisma.taskDeliverable.deleteMany({ where: { taskId: { in: [taskA?.id, taskB?.id].filter(Boolean) } } }).catch(() => undefined);
    await prisma.taskActor.deleteMany({ where: { taskId: { in: [taskA?.id, taskB?.id].filter(Boolean) } } }).catch(() => undefined);
    await prisma.taskActor.deleteMany({ where: { taskId: { in: [taskA?.id, taskB?.id].filter(Boolean) } } }).catch(() => undefined);
    await prisma.task.deleteMany({ where: { id: { in: [taskA?.id, taskB?.id].filter(Boolean) } } }).catch(() => undefined);
    await prisma.dossierItem.deleteMany({ where: { dossierId: { in: [dossierA?.id, dossierB?.id].filter(Boolean) } } }).catch(() => undefined);
    await prisma.workDossier.deleteMany({ where: { id: { in: [dossierA?.id, dossierB?.id].filter(Boolean) } } }).catch(() => undefined);
    if (unit) await prisma.organizationalUnit.delete({ where: { id: unit.id } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: [alice?.id, bob?.id].filter(Boolean) } } }).catch(() => undefined);
    await prisma.organizationalUnit.deleteMany({ where: { id: { in: [deptA?.id, deptB?.id].filter(Boolean) } } }).catch(() => undefined);
  });

  test('DELETE deliverable with mismatched parent task fails closed and preserves the foreign child', async () => {
    const res = await deleteDeliverable(
      new NextRequest(`http://localhost/api/tasks/${taskA.id}/deliverables?deliverableId=${deliverableB.id}`, {
        method: 'DELETE',
        headers: bearer(aliceToken),
      }),
      { params: Promise.resolve({ id: taskA.id }) }
    );
    assert.ok(res.status === 403 || res.status === 404, `expected 403/404, got ${res.status}`);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(!JSON.stringify(body).includes(deliverableB.title), 'must not leak foreign child payload');

    const preserved = await prisma.taskDeliverable.findUnique({ where: { id: deliverableB.id } });
    assert.ok(preserved, 'foreign deliverable must not be deleted');
  });

  test('DELETE dossier item with mismatched parent dossier returns 404 and preserves the foreign child', async () => {
    const res = await deleteDossierItem(
      new NextRequest(`http://localhost/api/dossiers/${dossierA.id}/items?itemId=${itemB.id}`, {
        method: 'DELETE',
        headers: bearer(aliceToken),
      }),
      { params: Promise.resolve({ id: dossierA.id }) }
    );
    assert.ok(res.status === 403 || res.status === 404, `expected 403/404, got ${res.status}`);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(!JSON.stringify(body).includes(itemB.title), 'must not leak foreign child payload');

    const preserved = await prisma.dossierItem.findUnique({ where: { id: itemB.id } });
    assert.ok(preserved, 'foreign dossier item must not be deleted');
  });

  test('DELETE own deliverable under correct parent still works (no regression)', async () => {
    const res = await deleteDeliverable(
      new NextRequest(`http://localhost/api/tasks/${taskA.id}/deliverables?deliverableId=${deliverableA.id}`, {
        method: 'DELETE',
        headers: bearer(aliceToken),
      }),
      { params: Promise.resolve({ id: taskA.id }) }
    );
    assert.equal(res.status, 200);
    const gone = await prisma.taskDeliverable.findUnique({ where: { id: deliverableA.id } });
    assert.equal(gone, null);
  });
});
